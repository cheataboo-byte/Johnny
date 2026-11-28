/* ============================================================
   molecule | A self-contained, educational biochemistry demo
   ============================================================
   Contents:
   1. AUTH & USER STORAGE
   2. BOT CUSTOMIZATION
   3. BIOCHEMISTRY ENGINE
   4. RECOMMENDATION & UPDATES ALGORITHM
   5. UI RENDERING
*/
"use strict";
import {
  initializeFirebase, firebaseIsConfigured, observeAuth, createAccount,
  signInAccount, signOutAccount, sendPasswordReset, loadUserData,
  saveUserProfile, saveUserScan, listenToNotifications, markNotificationRead,
  enableBrowserPush, listenToForegroundPush, resendVerificationEmail, refreshEmailVerification, requestAccountDeletion,
  exportAccountData, clearPushDevice
} from "./firebase-client.js";
import {extendedEntries,everydayObjects,bioConcepts} from "./bio-knowledge.js";
import {initializeVirtualLab} from "./virtual-lab.js";
import {initializeIngredientTools,LOGIC_ENGINE,STATE_MANAGER} from "./ingredient-tools.js";
let activeNotifications=[];
let foregroundMessageUnsubscribe=null;
let deferredInstallPrompt=null;
let firebaseInitializationError="";
let virtualLab=null;

/* 1. AUTH & USER STORAGE
   Firebase Authentication + Firestore for real accounts. Demo mode is
   device-local, contains no password, and is never represented as cloud auth. */
const AuthManager = (() => {
  const USERS_KEY = "molecule.users.v1", SESSION_KEY = "molecule.session.v1";
  const freshProfile = () => ({
    focus:"barrier", bot:{name:"BioBot",avatar:"🧬",tone:"friendly"},
    details:{ageRange:"prefer-not",gender:"prefer-not",genderSelfDescribe:"",skinType:"unsure",concerns:[],allergies:""},
    notifications:{inApp:true,push:false,email:false}, scans:[], saved:[], readUpdates:[],chemTopicHistory:[]
  });
  const getUsers = () => { try { return JSON.parse(localStorage.getItem(USERS_KEY) || "{}"); } catch (error) { console.error("Could not read local profiles.", error); return {}; } };
  const saveUsers = users => localStorage.setItem(USERS_KEY, JSON.stringify(users));
  let users=getUsers(), activeUser=null, mode="guest", notificationUnsubscribe=null, loadGeneration=0;
  const restoredDemo=localStorage.getItem(SESSION_KEY);
  if(restoredDemo&&users[restoredDemo]){activeUser=users[restoredDemo];mode="demo";}
  function getCurrent(){return activeUser;}
  function persist(){
    if(mode==="demo"&&activeUser){users[activeUser.email]=activeUser;saveUsers(users);}
    else if(mode==="firebase"&&activeUser){
      saveUserProfile(activeUser.uid,activeUser).catch(error=>{console.error("Could not sync profile changes.",error);showToast("Profile sync failed. Check your connection and try saving again.");});
    }
  }
  function setFirebaseUser(firebaseUser, profile, scans){
    loadGeneration++;
    stopNotificationListener();
    activeNotifications=[];
    activeUser={...freshProfile(),...profile,uid:firebaseUser.uid,email:firebaseUser.email,emailVerified:firebaseUser.emailVerified,name:firebaseUser.displayName||profile.name||firebaseUser.email,scans:scans||[]};
    activeUser.bot={...freshProfile().bot,...profile.bot};
    activeUser.details={...freshProfile().details,...profile.details};
    activeUser.notifications={...freshProfile().notifications,...profile.notifications};
    activeUser.chemTopicHistory=Array.isArray(profile.chemTopicHistory)?profile.chemTopicHistory:[];
    mode="firebase";
    localStorage.removeItem(SESSION_KEY);
    if(foregroundMessageUnsubscribe){foregroundMessageUnsubscribe();foregroundMessageUnsubscribe=null;}
    if(activeUser.notifications.push){
      listenToForegroundPush(payload=>showToast(payload.notification?.title||payload.data?.title||"New molecule update"))
        .then(unsubscribe=>{foregroundMessageUnsubscribe=unsubscribe;})
        .catch(error=>console.info("Foreground push listener is not active.",error.message));
    }
    notificationUnsubscribe=listenToNotifications(firebaseUser.uid,items=>{activeNotifications=items;renderNotifications();},error=>{console.error("Could not load notifications.",error);showToast("Notifications could not be refreshed.");});
    return activeUser;
  }
  function stopNotificationListener(){if(notificationUnsubscribe){notificationUnsubscribe();notificationUnsubscribe=null;}}
  async function activateFirebaseUser(firebaseUser){
    const generation=++loadGeneration;
    if(!firebaseUser){
      if(mode==="firebase"){stopNotificationListener();activeUser=null;mode="guest";activeNotifications=[];renderAll();}
      return;
    }
    const data=await loadUserData(firebaseUser);
    if(generation!==loadGeneration)return;
    setFirebaseUser(firebaseUser,data.profile,data.scans);
    activeNotifications=data.notifications;
    renderAll();renderNotifications();
  }
  async function ensureDemo(){
    if(firebaseIsConfigured())await signOutAccount();
    const email="demo@molecule.local";
    if(!users[email])users[email]=Object.assign(freshProfile(),{name:"Demo explorer",email});
    activeUser=users[email];mode="demo";activeNotifications=activeUser.notificationsList||[];localStorage.setItem(SESSION_KEY,email);persist();
    return activeUser;
  }
  async function signUp(name,email,password){
    if(!firebaseIsConfigured())throw new Error("Real sign-up needs Firebase project setup. Continue as Demo User works without cloud auth.");
    const firebaseUser=await createAccount(email.trim(),password,name.trim());
    const data=await loadUserData(firebaseUser);
    return setFirebaseUser(firebaseUser,data.profile,data.scans);
  }
  async function signIn(email,password){
    if(!firebaseIsConfigured())throw new Error("Real sign-in needs Firebase project setup. Continue as Demo User works without cloud auth.");
    const firebaseUser=await signInAccount(email.trim(),password);
    const data=await loadUserData(firebaseUser);
    return setFirebaseUser(firebaseUser,data.profile,data.scans);
  }
  async function signOut(){
    const wasFirebase=mode==="firebase";
    stopNotificationListener();activeUser=null;activeNotifications=[];mode="guest";localStorage.removeItem(SESSION_KEY);
    if(wasFirebase)await signOutAccount();
  }
  function deleteDemoAccount(){
    if(mode!=="demo"||!activeUser)return false;
    delete users[activeUser.email];saveUsers(users);activeNotifications=[];return true;
  }
  function update(mutator){if(!activeUser)return false;mutator(activeUser);persist();return true;}
  return {getCurrent,ensureDemo,signUp,signIn,signOut,update,activateFirebaseUser,getMode:()=>mode,stopNotificationListener,deleteDemoAccount};
})();

/* 2. BOT CUSTOMIZATION */
const BotProfile = {
  presets:["🧬","🔬","🧪","🦠","⚛️","🌿"],
  current(){ const u=AuthManager.getCurrent(); return u?u.bot:{name:"BioBot",avatar:"🧬",tone:"friendly"}; },
  save(settings){AuthManager.update(u=>{u.bot=Object.assign({},u.bot,settings);});},
  greeting(){return this.current().tone==="academic"
    ?"Hello. I can explain ingredient classes, simplified mechanisms, formulation context, and the limitations of label-based analysis. What would you like to examine?"
    :"Hi! I'm here to make ingredient science a little easier. Ask me about a product you've scanned or a compound you're curious about!";}
};

/* 3. BIOCHEMISTRY ENGINE
   Mechanisms and pH ranges are simplified educational descriptions, not
   individualized recommendations or universal product-performance claims. */
const BioBotEngine = (() => {
  const entries = [
    {name:"Water",aliases:["aqua","water"],klass:"Solvent",mechanism:"Dissolves and carries water-soluble ingredients through a formula.",ph:"Formula-dependent",solubility:"Miscible",caution:"Low",advice:"Usually the main solvent; its position near the beginning often reflects its role as a vehicle."},
    {name:"Glycerin",aliases:["glycerol"],klass:"Humectant",mechanism:"A small polyol that binds water and supports hydration in the outer skin layer.",ph:"Broadly stable",solubility:"Water-soluble",caution:"Low",advice:"A widely used humectant; the whole formula and environment influence feel and hydration."},
    {name:"Hyaluronic Acid",aliases:["sodium hyaluronate","hyaluronate","ha"],klass:"Humectant",mechanism:"Hyaluronan and its salts bind water; molecular size and formulation influence where they act.",ph:"Broadly stable",solubility:"Water-soluble (salt)",caution:"Low",advice:"Often used for a hydrated feel. The INCI form and formula matter."},
    {name:"Niacinamide",aliases:["vitamin b3","niacin","nicotinamide"],klass:"Vitamin / barrier support",mechanism:"A vitamin B3 form involved in cellular NAD/NADP pathways; topical formulas are studied for barrier and tone-related effects.",ph:"Typically near-skin-compatible",solubility:"Water-soluble",caution:"Low–moderate",advice:"A versatile ingredient; irritation is still possible. Product pH and co-ingredients matter."},
    {name:"Ceramide NP",aliases:["ceramide 3","ceramide np","ceramide"],klass:"Barrier lipid",mechanism:"A skin-identical sphingolipid type that contributes to intercellular lipid organization in the stratum corneum.",ph:"Formula-dependent",solubility:"Oil/lipid phase",caution:"Low",advice:"Often formulated alongside cholesterol and fatty acids; look at the complete moisturizer."},
    {name:"Panthenol",aliases:["provitamin b5","d-panthenol"],klass:"Humectant / soothing",mechanism:"A provitamin form related to pantothenic acid; can act as a humectant in topical products.",ph:"Broadly stable",solubility:"Water-soluble",caution:"Low",advice:"Often included in moisturizing formulas; individual sensitivities are possible."},
    {name:"Retinol",aliases:["vitamin a","retinyl alcohol"],klass:"Retinoid",mechanism:"A vitamin A derivative that is converted in skin through retinaldehyde to retinoic acid, influencing gene expression.",ph:"Formula-dependent; stability is key",solubility:"Oil-soluble",caution:"Moderate–high",advice:"Can cause irritation and increase sun sensitivity. Ask a clinician about use, especially during pregnancy or treatment."},
    {name:"Retinal",aliases:["retinaldehyde"],klass:"Retinoid",mechanism:"A vitamin A aldehyde converted to retinoic acid in skin, affecting cellular signaling.",ph:"Formula-dependent; stability is key",solubility:"Oil-soluble",caution:"Moderate–high",advice:"Can be irritating; introduce only with appropriate professional guidance."},
    {name:"Salicylic Acid",aliases:["bha","beta hydroxy acid"],klass:"Exfoliating acid (BHA)",mechanism:"A lipophilic beta-hydroxy acid that can loosen connections between surface corneocytes.",ph:"Usually acidic for activity",solubility:"Limited in water; more soluble in oil/alcohol systems",caution:"Moderate",advice:"Concentration and pH affect activity. Avoid eyes and ask a professional if pregnant, sensitive, or using medicines."},
    {name:"Glycolic Acid",aliases:["aha","alpha hydroxy acid","hydroxyacetic acid"],klass:"Exfoliating acid (AHA)",mechanism:"A small alpha-hydroxy acid that can affect cohesion among surface skin cells.",ph:"Usually acidic for activity",solubility:"Water-soluble",caution:"Moderate",advice:"May irritate and increase sun sensitivity. Formula pH and use pattern matter."},
    {name:"Lactic Acid",aliases:["2-hydroxypropanoic acid"],klass:"Exfoliating acid (AHA)",mechanism:"An alpha-hydroxy acid that may alter surface cell cohesion and also functions as a humectant.",ph:"Usually acidic for activity",solubility:"Water-soluble",caution:"Moderate",advice:"The final formula and concentration shape its role; patch-test new products as appropriate."},
    {name:"Ascorbic Acid",aliases:["vitamin c","l-ascorbic acid"],klass:"Antioxidant",mechanism:"A water-soluble antioxidant and enzyme cofactor; it can donate electrons and is oxidation-sensitive.",ph:"Often low pH in direct-acid formulas",solubility:"Water-soluble; oxidation-sensitive",caution:"Moderate",advice:"Packaging, stability, and pH matter. Some people find direct-acid formulas irritating."},
    {name:"Sodium Ascorbyl Phosphate",aliases:["sap","vitamin c phosphate"],klass:"Vitamin C derivative",mechanism:"A water-soluble ascorbate derivative used in formulations; conversion and performance depend on the product.",ph:"Formula-dependent",solubility:"Water-soluble",caution:"Low–moderate",advice:"Derivatives differ from pure ascorbic acid; do not assume identical evidence or behavior."},
    {name:"Tocopherol",aliases:["vitamin e","alpha-tocopherol"],klass:"Antioxidant",mechanism:"A lipid-soluble antioxidant that can help interrupt lipid oxidation chains.",ph:"Formula-dependent",solubility:"Oil-soluble",caution:"Low",advice:"Often used in oil phases; oxidation protection depends on the full formulation."},
    {name:"Zinc Oxide",aliases:["zno"],klass:"Mineral UV filter",mechanism:"An inorganic particulate UV filter that attenuates ultraviolet radiation in a tested sunscreen formula.",ph:"Formula-dependent",solubility:"Dispersed particulate",caution:"Low",advice:"Label reading alone cannot verify SPF or UVA protection; use a properly tested sunscreen as directed."},
    {name:"Titanium Dioxide",aliases:["tio2"],klass:"Mineral UV filter",mechanism:"An inorganic particulate UV filter that attenuates ultraviolet radiation in a tested sunscreen formula.",ph:"Formula-dependent",solubility:"Dispersed particulate",caution:"Low",advice:"UV protection depends on the finished, tested product and how it is applied."},
    {name:"Benzoyl Peroxide",aliases:["bpo"],klass:"Oxidizing acne active",mechanism:"An oxidizing agent with antimicrobial activity against Cutibacterium acnes.",ph:"Formula-dependent",solubility:"Sparingly water-soluble",caution:"Moderate–high",advice:"Can irritate and bleach fabrics; ask a pharmacist or clinician about a suitable routine."},
    {name:"Azelaic Acid",aliases:["azelaic"],klass:"Dicarboxylic acid",mechanism:"A naturally occurring dicarboxylic acid studied for effects on keratinization, inflammation, and pigmentation pathways.",ph:"Formulation-dependent",solubility:"Limited in water",caution:"Moderate",advice:"Strength and product type vary. Discuss treatment-strength products with a clinician."},
    {name:"Allantoin",aliases:["5-ureidohydantoin"],klass:"Soothing agent",mechanism:"A topical skin-conditioning ingredient associated with soothing and skin-protective formulations.",ph:"Broadly stable",solubility:"Slightly water-soluble",caution:"Low",advice:"A common supporting ingredient; it is not a treatment for an underlying skin condition."},
    {name:"Squalane",aliases:["squalane oil"],klass:"Emollient",mechanism:"A stable saturated hydrocarbon emollient that helps soften and reduce the feel of dryness.",ph:"Not pH-active",solubility:"Oil-soluble",caution:"Low",advice:"Supports emollience; the finished product determines texture and suitability."},
    {name:"Shea Butter",aliases:["butyrospermum parkii butter"],klass:"Emollient / occlusive",mechanism:"A plant-derived lipid blend that softens skin and can reduce water loss as part of a formula.",ph:"Not pH-active",solubility:"Oil-soluble",caution:"Low–moderate",advice:"Richness and potential sensitivities vary; consider the whole formula and your preferences."},
    {name:"Sodium Lauryl Sulfate",aliases:["sls","lauryl sulfate"],klass:"Anionic surfactant",mechanism:"A cleansing surfactant that reduces surface tension and can remove oils; at sufficient exposure it may disrupt skin barrier lipids.",ph:"Formula-dependent",solubility:"Water-soluble",caution:"Moderate–high",advice:"Rinse-off concentration and contact time matter. Repeated exposure may be drying or irritating for some."},
    {name:"Cocamidopropyl Betaine",aliases:["capb","cocamidopropyl betaine"],klass:"Amphoteric surfactant",mechanism:"An amphoteric cleansing surfactant used in rinse-off formulas, often alongside other surfactants.",ph:"Formula-dependent",solubility:"Water-soluble",caution:"Low–moderate",advice:"Some people are sensitive to it or manufacturing impurities; reaction history is worth discussing with a professional."}
  ];
  const formulas={
    "Water":"H₂O","Glycerin":"C₃H₈O₃","Hyaluronic Acid":"(C₁₄H₂₁NO₁₁)ₙ / salt forms vary",
    "Niacinamide":"C₆H₆N₂O","Ceramide NP":"Ceramide family; exact formula depends on species",
    "Panthenol":"C₉H₁₉NO₄","Retinol":"C₂₀H₃₀O","Retinal":"C₂₀H₂₈O",
    "Salicylic Acid":"C₇H₆O₃","Glycolic Acid":"C₂H₄O₃","Lactic Acid":"C₃H₆O₃",
    "Ascorbic Acid":"C₆H₈O₆","Sodium Ascorbyl Phosphate":"C₆H₆Na₃O₉P",
    "Tocopherol":"C₂₉H₅₀O₂","Zinc Oxide":"ZnO","Titanium Dioxide":"TiO₂",
    "Benzoyl Peroxide":"C₁₄H₁₀O₄","Azelaic Acid":"C₉H₁₆O₄","Allantoin":"C₄H₆N₄O₃",
    "Squalane":"C₃₀H₆₂","Shea Butter":"Variable triglyceride mixture",
    "Sodium Lauryl Sulfate":"C₁₂H₂₅NaO₄S","Cocamidopropyl Betaine":"C₁₉H₃₈N₂O₃ (common lauric form)"
  };
  extendedEntries.forEach(addition=>{
    const existing=entries.find(entry=>entry.name.toLowerCase()===addition.name.toLowerCase());
    if(existing)Object.assign(existing,addition);else entries.push(addition);
  });
  entries.forEach(entry=>{
    entry.formula=entry.formula||formulas[entry.name]||"Variable mixture or polymer; exact formula depends on form";
    entry.domain=entry.domain||(/sunscreen|UV filter|Mineral/.test(entry.klass)?"Personal care":/surfactant|solvent/.test(entry.klass)?"Household / personal care":"Personal care / biochemistry");
    entry.chemicalClass=entry.chemicalClass||entry.klass;
    entry.safetyAndExposure=entry.safetyAndExposure||(/High|high/.test(entry.caution)
      ?"Exposure depends on product and route; do not ingest or inhale concentrated material. Follow the product label and consult a qualified professional."
      :"Commonly used in topical formulations; avoid ingestion unless explicitly food-grade and avoid inhaling powders or aerosols. Individual sensitivity is possible.");
    entry.mechanismKm=entry.mechanismKm||`សមាសធាតុ ${entry.name} មានតួនាទីជា ${entry.chemicalClass}; ឥទ្ធិពលអាស្រ័យលើកំហាប់ រូបមន្ត និងរបៀបប៉ះពាល់។`;
    entry.safetyAndExposureKm=entry.safetyAndExposureKm||"ការប៉ះពាល់អាស្រ័យលើផលិតផល និងរបៀបប្រើ។ កុំបរិភោគ លុះត្រាតែជាផលិតផលអាហារ; ជៀសវាងស្រូបម្សៅ ឬអ័ព្ទ និងអនុវត្តតាមស្លាក។";
  });
  const aliases = new Map();
  entries.forEach(entry=>[entry.name,...entry.aliases].forEach(alias=>aliases.set(alias.toLowerCase(),entry)));
  function normalizeName(raw){const clean=raw.trim().replace(/^[\s•\-]+|[\s.;]+$/g,"");return aliases.get(clean.toLowerCase())?.name || clean;}
  function parse(text){
    const pieces=text.split(/[,;\n\r•]+/).map(x=>x.trim()).filter(Boolean), seen=new Set(), result=[];
    pieces.forEach(raw=>{const name=normalizeName(raw),key=name.toLowerCase();if(!key||seen.has(key))return;seen.add(key);const data=aliases.get(raw.trim().toLowerCase())||aliases.get(name.toLowerCase());result.push(data?Object.assign({},data,{input:raw,known:true}):{name,input:raw,known:false,formula:"Unknown",domain:"Unclassified",chemicalClass:"Unknown",klass:"Not in demo guide",mechanism:"This ingredient is not in the curated local knowledge base.",safetyAndExposure:"Safety and exposure are not assessed by this app.",ph:"Not assessed",solubility:"Not assessed",caution:"Unknown",advice:"Look up manufacturer information or consult a qualified professional; unknown here does not mean unsafe."});});
    return result;
  }
  function interactions(items){
    const classes=new Set(items.map(x=>x.klass)), names=new Set(items.map(x=>x.name));
    const notes=[];
    if(classes.has("Humectant")&&(classes.has("Barrier lipid")||classes.has("Emollient")||classes.has("Emollient / occlusive")))notes.push({type:"positive",title:"Complementary hydration + barrier roles",text:"A humectant alongside barrier lipids or emollients may combine water-binding and softening roles. The overall formula determines the finished feel and performance."});
    if([...names].some(n=>["Glycolic Acid","Lactic Acid","Salicylic Acid"].includes(n))&&[...names].some(n=>["Retinol","Retinal"].includes(n)))notes.push({type:"caution",title:"Consider cumulative irritation",text:"Exfoliating acids and retinoids can each irritate some people. This label-level flag cannot determine compatibility; product strength, pH, schedule, and tolerance matter. Ask a dermatologist or pharmacist for personal guidance."});
    if(names.has("Benzoyl Peroxide")&&names.has("Retinol"))notes.push({type:"caution",title:"Check active-ingredient formulation",text:"Benzoyl peroxide may oxidize some retinoids in certain formulations. Compatibility varies by specific active and product; check the product directions or consult a pharmacist."});
    if(names.has("Sodium Hypochlorite")&&([...names].some(name=>["Acetic Acid","Citric Acid","Salicylic Acid","Ascorbic Acid","Ammonia"].includes(name))))notes.push({type:"caution",title:"Never mix household cleaners",text:"Bleach can react dangerously with acids or ammonia and release toxic gases. This label analyzer does not calculate products or exposure. Do not mix cleaning products; if accidental mixing occurs, leave the area and contact emergency or poison-control services."});
    if(classes.has("Antioxidant")&&classes.has("Vitamin C derivative"))notes.push({type:"context",title:"Multiple antioxidant ingredients",text:"Antioxidants may serve complementary formulation roles. Ingredient presence alone does not establish stability or added benefit."});
    if(!notes.length)notes.push({type:"context",title:"No specific rule flag",text:"No interaction pattern in this small demo rule set matched. That is not proof that the formula is compatible or suitable for everyone."});
    return notes;
  }
  function analyze(text){const items=parse(text);return {items,interactions:interactions(items),cautionCount:items.filter(i=>/high|moderate/i.test(i.caution)).length};}
  function find(query){const q=query.trim().toLowerCase();return entries.find(e=>e.name.toLowerCase()===q||e.aliases.some(a=>a.toLowerCase()===q))||entries.find(e=>e.name.toLowerCase().includes(q)||q.includes(e.name.toLowerCase()))||null;}
  return {entries,parse,analyze,normalizeName,find};
})();

/* 3B. BIOBOTBRAIN — intent routing, safe explanations, and chemical lookup */
const BioBotBrain = (() => {
  const normalize=value=>String(value).toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
  function mentionedEntries(question){
    const text=` ${normalize(question)} `;
    return BioBotEngine.entries.filter(entry=>[entry.name,...entry.aliases].some(alias=>{
      const key=normalize(alias);return key&&text.includes(` ${key} `);
    })).sort((a,b)=>Math.max(b.name.length,...b.aliases.map(alias=>alias.length))-Math.max(a.name.length,...a.aliases.map(alias=>alias.length)));
  }
  function findObject(question){
    const text=` ${normalize(question)} `;
    return everydayObjects.find(object=>[object.key.replace(/-/g," "),object.title,...object.aliases]
      .some(alias=>text.includes(` ${normalize(alias)} `)))||null;
  }
  function findConcept(question){
    const text=normalize(question);
    return bioConcepts.find(concept=>concept.triggers.some(trigger=>text.includes(normalize(trigger))))||null;
  }
  function renderedEntry(entry,academic){
    const mechanism=language==="km"?(entry.mechanismKm||`សមាសធាតុនេះជា ${entry.chemicalClass}។`):entry.mechanism;
    const safety=language==="km"?(entry.safetyAndExposureKm||entry.safetyAndExposure):entry.safetyAndExposure;
    const values={name:entry.name,formula:entry.formula||"Variable / not specified",domain:entry.domain||"General chemistry",
      className:entry.chemicalClass||entry.klass,mechanism,safety,advice:entry.advice};
    const template=t(academic?"answerCompound":"answerCompoundFriendly");
    return template.replace(/\{(\w+)\}/g,(match,key)=>values[key]||match);
  }
  function disclaimerFor(domain,extra=""){
    const basis=String(domain||"").toLowerCase();
    const contextual=/stationery|household|solvent|volatile|cleaner/.test(basis)?t("disclaimerSolvent"):
      /food|beverage/.test(basis)?t("disclaimerFood"):
      /personal care|skincare/.test(basis)?t("disclaimerSkin"):
      /biology|medical/.test(basis)?t("disclaimerMedical"):t("disclaimerGeneral");
    return `${extra?extra+"\n\n":""}${contextual}\n\n${t("chatDisclaimer")}`;
  }
  function answerObject(object,academic){
    const components=object.components.map(name=>{
      const entry=BioBotEngine.find(name);
      if(!entry)return name;
      const mechanism=language==="km"?(entry.mechanismKm||entry.mechanism):entry.mechanism;
      return `${entry.name} (${entry.formula}): ${mechanism}`;
    }).join("\n");
    const values={title:object.title,components,description:language==="km"?object.km:object.en,
      safety:language==="km"?object.safetyKm:object.safetyEn};
    const body=t("answerObject").replace(/\{(\w+)\}/g,(match,key)=>values[key]||match);
    return {text:`${body}\n\n${disclaimerFor(object.domain==="food"?"Food":"Household")}`,topicKey:`object:${object.key}`,domain:object.domain};
  }
  function answerFollowUp(topicKey,aspect){
    const [kind,...parts]=String(topicKey||"").split(":");
    const id=parts.join(":");
    if(kind==="chemical"){
      const entry=BioBotEngine.find(id);
      if(!entry)return {text:`${t("followupUnknown")}\n\n${t("chatDisclaimer")}`,topicKey,domain:"chemical lookup"};
      const mechanism=language==="km"?(entry.mechanismKm||entry.mechanism):entry.mechanism;
      const safety=language==="km"?(entry.safetyAndExposureKm||entry.safetyAndExposure):entry.safetyAndExposure;
      let detail="";
      if(aspect==="exposure")detail=`${safety}\n\n${entry.advice}`;
      else if(aspect==="related"){
        const peers=BioBotEngine.entries.filter(candidate=>candidate.chemicalClass===entry.chemicalClass&&candidate.name!==entry.name).slice(0,3);
        detail=peers.length
          ?`${entry.name} is a ${entry.chemicalClass}. Related entries in the guide: ${peers.map(candidate=>candidate.name).join(", ")}. Similar classes can still have different mechanisms and exposure risks.`
          :t("followupNoRelated").replace("{name}",entry.name);
      }else if(aspect==="limits")detail=t("followupLimits").replace("{name}",entry.name);
      else detail=mechanism;
      return {text:`${entry.name} · ${t(aspect==="exposure"?"followupExposureTitle":aspect==="related"?"followupCompareTitle":aspect==="limits"?"followupLimitsTitle":"followupMechanismTitle")}\n${detail}\n\n${disclaimerFor(entry.domain)}`,topicKey,domain:entry.domain};
    }
    if(kind==="object"){
      const object=everydayObjects.find(item=>item.key===id);
      if(!object)return null;
      const components=object.components.map(name=>{
        const entry=BioBotEngine.find(name);
        if(!entry)return name;
        const mechanism=language==="km"?(entry.mechanismKm||entry.mechanism):entry.mechanism;
        return `${entry.name}: ${mechanism}`;
      }).join("\n");
      const detail=aspect==="exposure"
        ?(language==="km"?object.safetyKm:object.safetyEn)
        :components;
      return {text:`${object.title} · ${t(aspect==="exposure"?"followupExposureTitle":"followupComponentsTitle")}\n${detail}\n\n${disclaimerFor(object.domain==="food"?"Food":"Household")}`,topicKey,domain:object.domain};
    }
    if(kind==="concept"){
      const concept=bioConcepts.find(item=>item.key===id);
      if(!concept)return null;
      const detail=aspect==="limits"?t("followupLimits").replace("{name}",id.replace(/-/g," ")):language==="km"?concept.km:concept.en;
      return {text:`${t(aspect==="limits"?"followupLimitsTitle":"followupMechanismTitle")} · ${id.replace(/-/g," ")}\n${detail}\n\n${disclaimerFor("biology")}`,topicKey,domain:"core biology"};
    }
    if(kind==="lab"){
      return {text:`${t("followupLabTitle")}\n${t("followupLabText")}\n\n${t("chatDisclaimer")}`,topicKey,domain:"laboratory simulation"};
    }
    return null;
  }
  /* Answers in order: contextual memory, curated local knowledge, public topic APIs, then a grounded fallback. */
  async function answer(question,labContext=null,followUp=null,toolContext=null,chatContext=null){
    const bot=BotProfile.current(),academic=bot.tone==="academic";
    if(followUp?.topicKey){
      const savedFollowUp=answerFollowUp(followUp.topicKey,followUp.aspect);
      if(savedFollowUp)return savedFollowUp;
    }
    if(toolContext?.type==="interaction"&&typeof toolContext.summary==="string"){
      const lead=academic?"Interpretation of the checker output:":"Let's unpack what the checker found:";
      return {text:`${lead}\n${toolContext.summary}\n\nThese are limited label-level rules, not a complete compatibility or personal-safety assessment. Concentration, finished-product pH, formulation, directions, and individual response may change the picture. What ingredient or note would you like to explore further?\n\n${t("chatDisclaimer")}`,topicKey:"question:tool-interaction",domain:"ingredient interactions"};
    }
    if(toolContext?.type==="comparison"&&typeof toolContext.summary==="string"){
      const lead=academic?"Side-by-side ingredient summary:":"Here's the comparison at a glance:";
      return {text:`${lead}\n${toolContext.summary}\n\nShared names indicate label overlap only; unique ingredients do not establish which product is more effective, safer, or suitable for you. Product concentrations and complete formulations are not known. Which ingredient would you like to examine more closely?\n\n${t("chatDisclaimer")}`,topicKey:"question:tool-comparison",domain:"product comparison"};
    }
    if(labContext){
      const values={contents:labContext.contents.join(", ")||t("labNothingSelected"),type:labContext.reactionType,
        equation:labContext.equation,pH:Number(labContext.pH).toFixed(1),temperature:Number(labContext.temperature).toFixed(1),
        pressure:Number(labContext.pressureAtm??1).toFixed(2),
        limiting:labContext.limitingReagent,yield:labContext.theoreticalYield,hazard:labContext.hazard||""};
      const text=t("labContextAnswer").replace(/\{(\w+)\}/g,(match,key)=>values[key]??match);
      return {text:`${text}\n\n${t("disclaimerGeneral")}\n\n${t("chatDisclaimer")}`,topicKey:"lab:virtual-reaction",domain:"laboratory simulation"};
    }
    const contextualAnswer=LOGIC_ENGINE.resolveFollowUpContext({question,...(chatContext||{})});
    if(contextualAnswer)return {text:`${contextualAnswer.text}\n\n${t("chatDisclaimer")}`,topicKey:`context:${normalize(contextualAnswer.topic)}`,domain:"contextual biochemistry"};
    if(/^(?:(?:hi|hello|hey)\b|សួស្តី)/i.test(question.trim())){
      return {text:t("welcomeBot"),topicKey:"question:greeting",domain:"general"};
    }
    const object=findObject(question);
    if(object)return answerObject(object,academic);
    if(/\b(latest|last|scan)\b/i.test(question)){
      const scan=currentUser()?.scans?.[0]||lastAnalysis;
      if(!scan)return {text:`${t("scanPrompt")}\n\n${t("chatDisclaimer")}`,topicKey:"scan:latest",domain:"product analysis"};
      const names=scan.items.slice(0,7).map(item=>item.name).join(", ");
      const text=academic
        ?`Your latest saved label is “${scan.product}”. The local guide recognized ${names||"no listed compounds"}. ${scan.items.length} entries were parsed; this label-based review cannot establish concentration, product efficacy, or personal suitability.`
        :`Your latest scan was “${scan.product}”. I recognized ${names||"no listed compounds"}. Ask me to explore an ingredient or product type.`;
      return {text:`${text}\n\n${t("disclaimerGeneral")}\n\n${t("chatDisclaimer")}`,topicKey:"scan:latest",domain:"product analysis"};
    }
    const found=mentionedEntries(question);
    if(/\b(vs|versus|compare|comparison|difference)\b/i.test(question)&&found.length>=2){
      const describe=entry=>`${entry.name} (${entry.formula}) — ${entry.chemicalClass}. ${language==="km"?(entry.mechanismKm||entry.mechanism):entry.mechanism}\nExposure: ${language==="km"?(entry.safetyAndExposureKm||entry.safetyAndExposure):entry.safetyAndExposure}`;
      const text=t("answerCompare").replace("{first}",describe(found[0])).replace("{second}",describe(found[1])).replace("{note}",t("answerCompareNote"));
      return {text:`${text}\n\n${disclaimerFor(`${found[0].domain} ${found[1].domain}`)}`,topicKey:`compare:${found[0].name}|${found[1].name}`,domain:found.map(entry=>entry.domain).join(" / ")};
    }
    const concept=findConcept(question);
    if(concept){
      const explanation=language==="km"?concept.km:concept.en;
      const domain=concept.key==="caffeine"?"Food":["insulin","neurotransmitters"].includes(concept.key)?"biology":"general";
      return {text:`${t("answerConcept").replace("{answer}",explanation)}\n\n${disclaimerFor(domain)}`,topicKey:`concept:${concept.key}`,domain:"core biology"};
    }
    if(found.length){
      const entry=found[0],text=renderedEntry(entry,academic);
      return {text:`${text}\n\n${disclaimerFor(entry.domain)}`,topicKey:`chemical:${entry.name}`,domain:entry.domain};
    }
    const pipelineResult=await LOGIC_ENGINE.resolveAskAnything({question,context:chatContext||{},language});
    const sourceDisclaimer=pipelineResult.sourceUrl?.includes("pubchem.ncbi.nlm.nih.gov")
      ?t("disclaimerPubChem")
      :pipelineResult.stage==="api"?"A public reference summary is a starting point, not a complete or product-specific safety assessment.":"";
    return {text:`${pipelineResult.text}\n\n${disclaimerFor(pipelineResult.domain||"general",sourceDisclaimer)}`,
      imageUrl:pipelineResult.imageUrl||"",imageAlt:pipelineResult.imageAlt||"",
      sourceUrl:pipelineResult.sourceUrl||"",topicKey:`${pipelineResult.stage}:${normalize(pipelineResult.topic)}`,domain:pipelineResult.domain||"general"};
  }
  return {answer};
})();

/* 4. RECOMMENDATION & UPDATES ALGORITHM */
const BioRecommender = (() => {
  const complementary={"Exfoliating acid (AHA)":{name:"Ceramide NP",why:"You have several exfoliating acids in saved scans. A barrier-lipid ingredient such as ceramide NP has a different, complementary role in the outer skin barrier."},"Exfoliating acid (BHA)":{name:"Panthenol",why:"Your saved scans include an exfoliating acid. Panthenol is a humectant/skin-conditioning ingredient that can support a hydration-focused routine."},"Retinoid":{name:"Ceramide NP",why:"Retinoids can be irritating for some people; barrier-supporting ingredients play a different role and may be worth learning about."},"Anionic surfactant":{name:"Glycerin",why:"Your saved scans feature a strong cleansing surfactant. Glycerin's humectant role is complementary when exploring gentler-feeling formulas."},"Humectant":{name:"Ceramide NP",why:"Pairing a water-binding humectant with barrier lipids is a common formulation approach with complementary roles."}};
  const focusClass={barrier:["Barrier lipid","Humectant / soothing"],hydration:["Humectant","Emollient"],brightening:["Antioxidant","Vitamin C derivative"],acne:["Exfoliating acid (BHA)","Oxidizing acne active"],sensitive:["Soothing agent","Barrier lipid"]};
  function compute(user){
    const scans=user?.scans||[], saved=new Set(user?.saved||[]), counts={}, names=new Set();
    scans.forEach(scan=>(scan.items||[]).forEach(item=>{if(item.known){counts[item.klass]=(counts[item.klass]||0)+1;names.add(item.name);}}));
    saved.forEach(name=>{const e=BioBotEngine.find(name);if(e){counts[e.klass]=(counts[e.klass]||0)+1;names.add(e.name);}});
    const suggestions=[];
    Object.keys(complementary).forEach(source=>{
      if(counts[source]){const pick=complementary[source];if(!names.has(pick.name)){suggestions.push({name:pick.name,why:pick.why,score:4+Math.min(counts[source],3),className:BioBotEngine.find(pick.name)?.klass||"Ingredient"});}}
    });
    const focus=user?.focus||"barrier";
    (focusClass[focus]||[]).forEach((klass,index)=>{
      if(!suggestions.some(s=>s.className===klass)){
        const entry=BioBotEngine.entries.find(e=>e.klass===klass&&!names.has(e.name));
        if(entry)suggestions.push({name:entry.name,why:`This ingredient's ${klass.toLowerCase()} role may be relevant to your selected focus. Learn about it; this is not a product or treatment recommendation.`,score:2+(index===0?1:0),className:klass});
      }
    });
    if(!suggestions.length){
      const additional={barrier:"Shea Butter",hydration:"Squalane",brightening:"Tocopherol",acne:"Azelaic Acid",sensitive:"Allantoin"};
      const entry=BioBotEngine.find(additional[focus]);
      if(entry&&!names.has(entry.name))suggestions.push({name:entry.name,why:`Your saved scans already include several ${focus.replace(/^\w/,c=>c.toUpperCase())}-related ingredient classes. Explore ${entry.name} to compare another ${entry.klass.toLowerCase()} role; this is not a product or treatment recommendation.`,score:1,className:entry.klass});
    }
    const details=user?.details||{},concerns=details.concerns||[];
    const concernClasses={
      dryness:["Humectant","Emollient","Barrier lipid"],
      sensitivity:["Soothing agent","Barrier lipid","Humectant / soothing"],
      blemishes:["Humectant","Barrier lipid","Soothing agent"],
      redness:["Soothing agent","Barrier lipid"],
      "uneven-tone":["Antioxidant","Vitamin C derivative"],
      barrier:["Barrier lipid","Humectant / soothing"]
    };
    const preferredClasses=new Set(concerns.flatMap(concern=>concernClasses[concern]||[]));
    suggestions.forEach(item=>{if(preferredClasses.has(item.className))item.score+=2;});
    const youngerUser=details.ageRange==="13-17";
    const sensitiveProfile=details.skinType==="sensitive"||concerns.includes("sensitivity");
    if(youngerUser){
      const generalClasses=new Set(["Barrier lipid","Humectant","Humectant / soothing","Soothing agent","Emollient","Emollient / occlusive"]);
      for(let index=suggestions.length-1;index>=0;index--)if(!generalClasses.has(suggestions[index].className))suggestions.splice(index,1);
      if(!suggestions.length){
        const entry=BioBotEngine.find("Panthenol");
        if(entry&&!names.has(entry.name))suggestions.push({name:entry.name,why:"A general educational example of a humectant/skin-conditioning class; this is not advice to treat a condition.",score:1,className:entry.klass});
      }
    }else if(sensitiveProfile){
      suggestions.forEach(item=>{if(["Barrier lipid","Soothing agent","Humectant / soothing"].includes(item.className))item.score+=2;});
    }
    suggestions.sort((a,b)=>b.score-a.score);
    const surfactantCount=counts["Anionic surfactant"]||0;
    const frequent=Object.entries(counts).sort((a,b)=>b[1]-a[1])[0];
    const topicCounts={};
    (user?.chemTopicHistory||[]).forEach(key=>{topicCounts[key]=(topicCounts[key]||0)+1;});
    const popularTopic=Object.entries(topicCounts).sort((a,b)=>b[1]-a[1])[0]?.[0];
    let topicTitle="",topicText="",topicTitleKm="",topicTextKm="";
    if(popularTopic){
      const separator=popularTopic.indexOf(":"),topicType=popularTopic.slice(0,separator),topicId=popularTopic.slice(separator+1);
      if(topicType==="chemical"){
        const entry=entries.find(item=>item.name.toLowerCase()===topicId.toLowerCase());
        if(entry){topicTitle=entry.name;topicTitleKm=entry.name;topicText=`You have explored ${entry.name} (${entry.chemicalClass}) in chat. ${entry.mechanism}`;topicTextKm=`អ្នកបានស្វែងយល់អំពី ${entry.name} (${entry.chemicalClass}) ក្នុង chat។ ${entry.mechanismKm||"ស្វែងយល់ពីតួនាទីរបស់វា និងពិនិត្យស្លាកផលិតផល។"}`;}
      }else if(topicType==="object"){
        const item=everydayObjects.find(object=>object.key===topicId);
        if(item){topicTitle=item.title;topicTitleKm=item.titleKm||item.title;topicText=item.en;topicTextKm=item.km;}
      }else if(topicType==="concept"){
        const item=bioConcepts.find(concept=>concept.key===topicId);
        if(item){topicTitle=topicId.replace(/-/g," ");topicTitleKm=translations?.[language]?.[`concept_${topicId}`]||topicTitle;topicText=item.en;topicTextKm=item.km;}
      }
    }
    const reads=user?.readUpdates||[];
    const feed=[
      {id:"formula-alert",type:"alert",icon:"⚑",surfactantCount,hasScans:Boolean(scans.length),title:"Formula pattern check",text:surfactantCount>=2?`Strong anionic surfactants appeared in ${surfactantCount} saved product scans. Repeated cleansing exposure can feel drying for some people; check product directions and your own experience.`:scans.length?`No repeated strong-surfactant pattern in your saved scans. This local rule checks ingredient labels only; it cannot measure exposure or predict a reaction.`:"Scan and save products to look for repeated high-caution surfactant labels across your local scan history.",kind:"alert"},
      {id:"spotlight",type:"spotlight",icon:"✦",spotlightClass:frequent?.[0]||"",spotlightTitleKm:topicTitleKm,
        title:topicTitle?`${topicTitle} · biochemistry spotlight`:frequent?`${frequent[0]} · biochemistry spotlight`:"Biochemistry spotlight",
        text:topicText|| (frequent?`A class you see often: ${frequent[0]}. ${BioBotEngine.entries.find(e=>e.klass===frequent[0])?.mechanism||"Explore how ingredient classes can work in a formula."}`:"Explore a science spotlight: ceramides are lipid building blocks in the outer skin barrier. Add a scan to get spotlights matched to ingredients you encounter."),
        spotlightTextKm:topicTextKm,kind:"spotlight"},
      {id:"app-update",type:"update",icon:"↗",title:"App & database notes",entryCount:BioBotEngine.entries.length,text:`Demo database v2 · ${BioBotEngine.entries.length} curated multi-domain entries. The offline guide uses transparent rules and curated explanations; no product catalog or live medical review is connected.`,kind:"update"}
    ].map(card=>Object.assign(card,{unread:!reads.includes(card.id)}));
    return {suggestions:suggestions.slice(0,4),feed,counts,profileNote:youngerUser?"young":sensitiveProfile?"sensitive":""};
  }
  return {compute};
})();

/* 5. UI RENDERING */
const $=s=>document.querySelector(s), $$=s=>Array.from(document.querySelectorAll(s));
let language=localStorage.getItem("molecule.language")||"en",authMode="signin",lastAnalysis=null,toastTimer=null;
const translations={
  en:{
    workspace:"Workspace",analyzer:"Analyzer",forYou:"For You & Updates",myBot:"My Bot & Profile",howWorks:"How It Works",scienceFirst:"Curiosity, with care.",sideNote:"Explore the science. Your skin and health are personal.",myProfile:"My profile",customizeBot:"Customize your bot",signIn:"Sign in",signOut:"Sign out",personalLab:"Your personal ingredient lab",analyzeTitle:"Understand what's in your routine.",analyzeSub:"Explore ingredient functions, biochemical mechanisms, and formulation interactions — one product at a time.",loadExample:"Load example formula",productAnalyzer:"Product analyzer",productDesc:"Paste an ingredient list to explore its biochemistry. Educational, not diagnostic.",productName:"Product name",productPlaceholder:"e.g. Daily Barrier Moisturizer",category:"Product focus",skinCare:"Skin care",hairCare:"Hair care",wellness:"General wellness",yourFocus:"Your focus",barrierSupport:"Barrier support",hydration:"Hydration",brightening:"Brightening",blemishCare:"Blemish care",sensitiveSkin:"Sensitive skin",ingredients:"Ingredients (comma or line separated)",ingredientPlaceholder:"Water, Glycerin, Niacinamide, Ceramide NP...",ingredientHelp:"Recognizes common names and INCI names. Unknown ingredients are still listed when you scan.",analyzeFormula:"Analyze formula",labNote:"A note from the lab",tipTitle:"Ingredients work in context.",tipBody:"Concentration, pH, the complete formula, and your own biology all shape how a product behaves. One ingredient name never tells the whole story.",quickGuide:"Quick guide",quickGuideDesc:"A few friendly reminders for reading a label.",orderMatters:"Order matters",orderDetail:"Ingredients are generally listed by concentration, with exceptions.",formulationMatters:"Formulation matters",formulaDetail:"pH and delivery systems can change ingredient behavior.",listenToSkin:"Listen to your skin",skinDetail:"Pause use and seek professional advice if concerned.",disclaimerTitle:"Professional guidance matters",disclaimerText:"This educational tool is not medical advice, diagnosis, or treatment. Ingredient data may be incomplete. Consult a qualified dermatologist, pharmacist, or healthcare professional about personal concerns, allergies, pregnancy, or treatment choices.",personalizedInsights:"Personalized insights",forYouTitle:"A little more context, just for you.",forYouSub:"Transparent suggestions based on the ingredients and product focus you choose to save.",markRead:"Mark updates as read",productsExplored:"Products explored",savedIngredients:"Saved ingredients",currentFocus:"Current focus",suggestions:"Suggestions for your routine",suggestionsSub:"Rule-based ideas, not a product prescription.",scienceUpdates:"Science & updates",scienceUpdatesSub:"Spotlights and alerts adapt to your saved scans.",yourLabPartner:"Your lab partner",botTitle:"Meet your personal BioBot.",botSub:"Choose a personality and look. Your bot uses the local science guide to explain ingredients in your preferred tone.",customizeBotBtn:"Customize your bot",editPersonality:"Edit personality",accountProfile:"Account profile",accountDesc:"Your science-fair demo data stays in this browser.",focusPreference:"Product focus",focusPreferenceSub:"Used to personalize suggestions",nothingSaved:"Nothing saved yet",view:"View",localKnowledge:"Local biochemistry guide · educational",online:"Ready",chatPlaceholder:"Ask about an ingredient or your latest scan...",send:"Send",openNotebook:"An open notebook",howTitle:"How the algorithms work.",howSub:"No mystery scores: here's what the local analyzer and recommender look at, and where their limits are.",normalization:"Name normalization",normalizationText:"Common names and spelling variants map to a canonical ingredient name before lookup (for example, Vitamin B3 → Niacinamide). Ingredient labels may use different INCI conventions; unknown names are kept visible rather than discarded.",knowledgeBase:"Biochemistry knowledge base",knowledgeText:"Each built-in entry describes a broad chemical class, a simplified mechanism, formulation context, cautions, and practical label-reading notes. It is educational, not a measurement of product efficacy or safety.",interactions:"Interaction rules",interactionsText:"Explicit, readable if/else rules look for potentially complementary groups and commonly irritating combinations. These flags are context prompts, not proof of incompatibility: concentration, product pH, formulation, schedule, and individual tolerance matter.",recommendationLogic:"Recommendation scoring",recommendationText:"The recommender counts ingredient classes in saved scans, compares them with complementary classes, and adds a small focus-match bonus. Repeated high-caution surfactant flags trigger a formula alert. No profile data is sent anywhere.",storagePrivacy:"Storage & privacy",storageText:"Demo accounts, scans, preferences, and bot settings are stored in this browser's localStorage. Data can be cleared by removing this site's local storage. This demo does not provide real authentication or encrypted cloud sync.",firebaseText:"Replace the marked AuthManager storage adapter with Firebase Authentication and Firestore rules; never treat client-only localStorage as secure account storage.",limitations:"Limits & professional care",limitationsText:"The knowledge base is intentionally compact and cannot verify an actual product's complete formula, concentration, purity, claims, or regulatory status. Do not use this app to diagnose or to start, stop, or replace treatment. Ask a qualified professional for personalized guidance.",welcome:"Welcome to molecule",signUp:"Create account",yourName:"Your name",email:"Email",password:"Password",continueDemo:"Continue as Demo User",localAccountNotice:"Demo only: account details stay in this browser. Do not use a real or reused password.",botName:"Bot name",avatar:"Profile picture",uploadPicture:"Or upload an image",botPersonality:"Personality & tone",friendlyTone:"Friendly & simple",academicTone:"Academic & detailed",avatarNote:"Uploaded images are resized to a small thumbnail and stored on this device.",saveChanges:"Save changes",guest:"Guest explorer",demoMode:"Demo mode",signedIn:"Signed in",guestMode:"Guest mode",scanFirst:"Scan a product first",unknownProduct:"Untitled product",analyzed:"Analysis complete",saved:"Saved",unsaved:"Removed from saved",saveIngredient:"Save ingredient",removeIngredient:"Saved · remove",unknown:"Not in demo guide",ingredient:"ingredient",ingredientsCount:"ingredients",noIngredients:"Add an ingredient list to begin your analysis.",riskLow:"Low",riskModerate:"Moderate",riskHigh:"Higher caution",interaction:"Formulation context",noHistory:"No scans yet",readDone:"Updates marked as read",demoLoaded:"Example formula loaded",accountCreated:"Demo account created",signedInToast:"Signed in on this device",signedOutToast:"Signed out",savedBot:"Bot settings saved",focusUpdated:"Focus preference updated",welcomeBot:"Hi! I'm your BioBot. Scan a product or ask me what an ingredient does.",signInRequired:"Sign in or continue as Demo User to save scans and personalize suggestions.",scan:"Scan",product:"Product",formulaAlert:"Formula alert",biochemistrySpotlight:"Biochemistry spotlight",appUpdate:"App & database update",learn:"Explore ingredient",howTheyWork:"How it works",pH:"Ideal pH context",solubility:"Solubility",caution:"Caution",practical:"Practical note",profile:"Profile",forYouNav:"For You & Updates",chatFallback:"I can explain ingredients in the demo knowledge base or discuss the latest product you scanned. Try asking about a compound name. My answer is educational, not medical advice.",chatDisclaimer:"If you're asking about a symptom, allergy, pregnancy, medicine, or treatment, please consult a qualified dermatologist, pharmacist, or healthcare professional.",botUnknown:"I don't have a detailed entry for that name in my compact local guide. Unknown here does not mean unsafe. Check the manufacturer information or ask a qualified professional.",scanPrompt:"I don't see a saved analysis yet. Paste a product ingredient list in the Analyzer tab and I'll help explain what the local guide recognizes.",noSuggestions:"Your saved ingredient set looks varied so far. Scan and save another product, or change your focus, to see more complementary ingredient classes.",recommendation:"Explore",registered:"Account created on this device",passwordHint:"Password must be at least 4 characters.",duplicateEmail:"An account with this email already exists in this browser.",authError:"Could not sign in with those details.",imageTooLarge:"Please choose an image smaller than 5 MB.",uploadError:"That image could not be loaded. Try a different image.",scanSaved:"Scan saved to this browser",unknownLabel:"Unknown"
  },
  km:{
    workspace:"ផ្ទាំងការងារ",analyzer:"វិភាគ",forYou:"សម្រាប់អ្នក និងព័ត៌មានថ្មី",myBot:"បូត និងប្រវត្តិរូប",howWorks:"របៀបដំណើរការ",scienceFirst:"ស្វែងយល់ដោយយកចិត្តទុកដាក់។",sideNote:"ស្វែងយល់ពីវិទ្យាសាស្ត្រ។ ស្បែក និងសុខភាពរបស់អ្នកមានលក្ខណៈផ្ទាល់ខ្លួន។",myProfile:"ប្រវត្តិរូបរបស់ខ្ញុំ",customizeBot:"កំណត់បូតរបស់អ្នក",signIn:"ចូលគណនី",signOut:"ចេញពីគណនី",personalLab:"មន្ទីរពិសោធន៍គ្រឿងផ្សំផ្ទាល់ខ្លួន",analyzeTitle:"ស្វែងយល់ពីគ្រឿងផ្សំក្នុងផលិតផលរបស់អ្នក។",analyzeSub:"ស្វែងយល់ពីតួនាទីគ្រឿងផ្សំ យន្តការជីវគីមី និងអន្តរកម្មក្នុងរូបមន្តផលិតផល — ម្តងមួយៗ។",loadExample:"បញ្ចូលរូបមន្តឧទាហរណ៍",productAnalyzer:"វិភាគផលិតផល",productDesc:"បិទភ្ជាប់បញ្ជីគ្រឿងផ្សំ ដើម្បីស្វែងយល់ពីជីវគីមី។ សម្រាប់ការអប់រំ មិនមែនការធ្វើរោគវិនិច្ឆ័យទេ។",productName:"ឈ្មោះផលិតផល",productPlaceholder:"ឧ. ក្រែមផ្តល់សំណើមការពារស្បែក",category:"ប្រភេទផលិតផល",skinCare:"ថែរក្សាស្បែក",hairCare:"ថែរក្សាសក់",wellness:"សុខភាពទូទៅ",yourFocus:"ចំណាប់អារម្មណ៍របស់អ្នក",barrierSupport:"គាំទ្ររបាំងការពារស្បែក",hydration:"ផ្តល់សំណើម",brightening:"ធ្វើឱ្យស្បែកភ្លឺថ្លា",blemishCare:"ថែរក្សាមុន",sensitiveSkin:"ស្បែកងាយប្រតិកម្ម",ingredients:"គ្រឿងផ្សំ (បំបែកដោយក្បៀស ឬបន្ទាត់)",ingredientPlaceholder:"Water, Glycerin, Niacinamide, Ceramide NP...",ingredientHelp:"ស្គាល់ឈ្មោះទូទៅ និងឈ្មោះ INCI។ ឈ្មោះដែលមិនស្គាល់ក៏នឹងបង្ហាញនៅពេលវិភាគ។",analyzeFormula:"វិភាគរូបមន្ត",labNote:"កំណត់សម្គាល់ពីមន្ទីរពិសោធន៍",tipTitle:"គ្រឿងផ្សំមានតួនាទីក្នុងបរិបទ។",tipBody:"កំហាប់ កម្រិត pH រូបមន្តទាំងមូល និងលក្ខណៈជីវសាស្ត្ររបស់អ្នក សុទ្ធតែមានឥទ្ធិពលលើផលិតផល។ ឈ្មោះគ្រឿងផ្សំតែមួយមិនអាចប្រាប់គ្រប់យ៉ាងបានទេ។",quickGuide:"មគ្គុទ្ទេសក៍ខ្លី",quickGuideDesc:"ចំណុចរំលឹកខ្លះៗសម្រាប់អានស្លាកផលិតផល។",orderMatters:"លំដាប់មានសារៈសំខាន់",orderDetail:"ជាទូទៅ គ្រឿងផ្សំរៀបតាមកំហាប់ ដោយមានករណីលើកលែង។",formulationMatters:"រូបមន្តមានសារៈសំខាន់",formulaDetail:"pH និងវិធីបញ្ជូនសារធាតុអាចប្តូរឥរិយាបថគ្រឿងផ្សំ។",listenToSkin:"សង្កេតប្រតិកម្មស្បែក",skinDetail:"ផ្អាកប្រើ និងស្វែងរកដំបូន្មានពីអ្នកជំនាញ ប្រសិនបើមានការព្រួយបារម្ភ។",disclaimerTitle:"សូមស្វែងរកការណែនាំពីអ្នកជំនាញ",disclaimerText:"ឧបករណ៍អប់រំនេះមិនមែនជាដំបូន្មានវេជ្ជសាស្ត្រ ការធ្វើរោគវិនិច្ឆ័យ ឬការព្យាបាលទេ។ ទិន្នន័យគ្រឿងផ្សំអាចមិនពេញលេញ។ សូមពិគ្រោះជាមួយវេជ្ជបណ្ឌិតឯកទេសសើស្បែក ឱសថការី ឬអ្នកជំនាញសុខភាពអំពីបញ្ហាផ្ទាល់ខ្លួន អាឡែស៊ី ការមានផ្ទៃពោះ ឬការព្យាបាល។",personalizedInsights:"ព័ត៌មានផ្ទាល់ខ្លួន",forYouTitle:"ព័ត៌មានបន្ថែម ដែលសមស្របសម្រាប់អ្នក។",forYouSub:"ការផ្តល់យោបល់បង្ហាញច្បាស់ ផ្អែកលើគ្រឿងផ្សំ និងចំណាប់អារម្មណ៍ផលិតផលដែលអ្នករក្សាទុក។",markRead:"សម្គាល់ព័ត៌មានថាបានអាន",productsExplored:"ផលិតផលដែលបានស្វែងយល់",savedIngredients:"គ្រឿងផ្សំដែលបានរក្សាទុក",currentFocus:"ចំណាប់អារម្មណ៍បច្ចុប្បន្ន",suggestions:"យោបល់សម្រាប់ការថែទាំរបស់អ្នក",suggestionsSub:"គំនិតផ្អែកលើច្បាប់ មិនមែនការណែនាំផលិតផលទេ។",scienceUpdates:"វិទ្យាសាស្ត្រ និងព័ត៌មានថ្មី",scienceUpdatesSub:"ចំណេះដឹង និងការជូនដំណឹង សម្របតាមការវិភាគដែលអ្នករក្សាទុក។",yourLabPartner:"ដៃគូមន្ទីរពិសោធន៍របស់អ្នក",botTitle:"សូមស្គាល់ BioBot ផ្ទាល់ខ្លួនរបស់អ្នក។",botSub:"ជ្រើសរើសបុគ្គលិកលក្ខណៈ និងរូបរាង។ បូតប្រើមគ្គុទ្ទេសក៍វិទ្យាសាស្ត្រក្នុងកម្មវិធី ដើម្បីពន្យល់តាមសម្លេងដែលអ្នកចូលចិត្ត។",customizeBotBtn:"កំណត់បូតរបស់អ្នក",editPersonality:"កែសម្រួលបុគ្គលិកលក្ខណៈ",accountProfile:"ប្រវត្តិរូបគណនី",accountDesc:"ទិន្នន័យសាកល្បងវិទ្យាសាស្ត្ររបស់អ្នក រក្សាទុកក្នុងកម្មវិធីរុករកនេះ។",focusPreference:"ចំណាប់អារម្មណ៍ផលិតផល",focusPreferenceSub:"ប្រើដើម្បីផ្តល់យោបល់ផ្ទាល់ខ្លួន",nothingSaved:"មិនទាន់រក្សាទុកទេ",view:"មើល",localKnowledge:"មគ្គុទ្ទេសក៍ជីវគីមីក្នុងកម្មវិធី · សម្រាប់ការអប់រំ",online:"រួចរាល់",chatPlaceholder:"សួរអំពីគ្រឿងផ្សំ ឬផលិតផលដែលបានវិភាគ...",send:"ផ្ញើ",openNotebook:"សៀវភៅកំណត់ត្រាបើកចំហ",howTitle:"របៀបដែលក្បួនដោះស្រាយដំណើរការ។",howSub:"ពិន្ទុបង្ហាញច្បាស់៖ នេះជាអ្វីដែលកម្មវិធីវិភាគ និងប្រព័ន្ធផ្តល់យោបល់ពិនិត្យ និងដែនកំណត់របស់វា។",normalization:"ការកំណត់ឈ្មោះស្តង់ដារ",normalizationText:"ឈ្មោះទូទៅ និងការសរសេរផ្សេងៗ ត្រូវបានបម្លែងទៅជាឈ្មោះគ្រឿងផ្សំស្តង់ដារមុនស្វែងរក (ឧ. Vitamin B3 → Niacinamide)។ ឈ្មោះមិនស្គាល់នៅតែបង្ហាញ មិនត្រូវបានលុបទេ។",knowledgeBase:"មូលដ្ឋានចំណេះដឹងជីវគីមី",knowledgeText:"ធាតុនីមួយៗពណ៌នាថ្នាក់គីមី យន្តការសាមញ្ញ បរិបទរូបមន្ត ការប្រុងប្រយ័ត្ន និងកំណត់សម្គាល់អានស្លាក។ វាជាព័ត៌មានអប់រំ មិនមែនការវាស់ប្រសិទ្ធភាព ឬសុវត្ថិភាពផលិតផលទេ។",interactions:"ច្បាប់អន្តរកម្ម",interactionsText:"ច្បាប់ if/else ស្វែងរកក្រុមដែលអាចបំពេញគ្នា និងការរួមបញ្ចូលដែលអាចបង្កការរលាក។ ការជូនដំណឹងមិនមែនជាភស្តុតាងថាមិនត្រូវគ្នាទេ៖ កំហាប់ pH រូបមន្ត កាលវិភាគប្រើ និងភាពស៊ាំរបស់មនុស្សម្នាក់ៗមានសារៈសំខាន់។",recommendationLogic:"ការគណនាពិន្ទុយោបល់",recommendationText:"ប្រព័ន្ធរាប់ថ្នាក់គ្រឿងផ្សំក្នុងការវិភាគដែលបានរក្សាទុក ប្រៀបធៀបជាមួយថ្នាក់ដែលបំពេញគ្នា និងបន្ថែមពិន្ទុតិចតួចតាមចំណាប់អារម្មណ៍។ ទិន្នន័យមិនត្រូវបានផ្ញើទៅកន្លែងណាទេ។",storagePrivacy:"ការរក្សាទុក និងឯកជនភាព",storageText:"គណនីសាកល្បង ការវិភាគ ចំណូលចិត្ត និងការកំណត់បូត រក្សាទុកក្នុង localStorage របស់កម្មវិធីរុករកនេះ។ កម្មវិធីសាកល្បងនេះមិនមានការផ្ទៀងផ្ទាត់ពិត ឬការធ្វើសមកាលកម្មលើពពកដែលបានអ៊ិនគ្រីបទេ។",firebaseText:"ជំនួសផ្នែករក្សាទុក AuthManager ដែលបានសម្គាល់ ដោយ Firebase Authentication និងច្បាប់ Firestore។ កុំចាត់ទុក localStorage ខាងម៉ាស៊ីនភ្ញៀវថាជាកន្លែងរក្សាគណនីដែលមានសុវត្ថិភាព។",limitations:"ដែនកំណត់ និងការថែទាំដោយអ្នកជំនាញ",limitationsText:"មូលដ្ឋានចំណេះដឹងមានទំហំតូច ហើយមិនអាចផ្ទៀងផ្ទាត់រូបមន្ត កំហាប់ ភាពបរិសុទ្ធ ការអះអាង ឬស្ថានភាពច្បាប់របស់ផលិតផលពិតបានទេ។ កុំប្រើកម្មវិធីនេះដើម្បីធ្វើរោគវិនិច្ឆ័យ ឬចាប់ផ្តើម បញ្ឈប់ ឬជំនួសការព្យាបាល។ សូមស្វែងរកការណែនាំពីអ្នកជំនាញ។",welcome:"សូមស្វាគមន៍មកកាន់ molecule",signUp:"បង្កើតគណនី",yourName:"ឈ្មោះរបស់អ្នក",email:"អ៊ីមែល",password:"ពាក្យសម្ងាត់",continueDemo:"បន្តជាអ្នកប្រើសាកល្បង",localAccountNotice:"សម្រាប់សាកល្បងប៉ុណ្ណោះ៖ ព័ត៌មានគណនីរក្សាទុកក្នុងកម្មវិធីរុករកនេះ។ កុំប្រើពាក្យសម្ងាត់ពិត ឬប្រើឡើងវិញ។",botName:"ឈ្មោះបូត",avatar:"រូបភាពប្រវត្តិរូប",uploadPicture:"ឬបង្ហោះរូបភាព",botPersonality:"បុគ្គលិកលក្ខណៈ និងសម្លេង",friendlyTone:"រួសរាយ និងសាមញ្ញ",academicTone:"បែបសិក្សា និងលម្អិត",avatarNote:"រូបភាពដែលបានបង្ហោះ នឹងបង្រួមជារូបភាពតូច និងរក្សាទុកក្នុងឧបករណ៍នេះ។",saveChanges:"រក្សាទុកការផ្លាស់ប្តូរ",guest:"អ្នកស្វែងយល់ភ្ញៀវ",demoMode:"របៀបសាកល្បង",signedIn:"បានចូលគណនី",guestMode:"របៀបភ្ញៀវ",scanFirst:"សូមវិភាគផលិតផលជាមុន",unknownProduct:"ផលិតផលគ្មានឈ្មោះ",analyzed:"ការវិភាគរួចរាល់",saved:"បានរក្សាទុក",unsaved:"បានដកចេញពីបញ្ជីរក្សាទុក",saveIngredient:"រក្សាទុកគ្រឿងផ្សំ",removeIngredient:"បានរក្សាទុក · ដកចេញ",unknown:"មិនមានក្នុងមគ្គុទ្ទេសក៍សាកល្បង",ingredient:"គ្រឿងផ្សំ",ingredientsCount:"គ្រឿងផ្សំ",noIngredients:"បន្ថែមបញ្ជីគ្រឿងផ្សំ ដើម្បីចាប់ផ្តើមវិភាគ។",riskLow:"ទាប",riskModerate:"មធ្យម",riskHigh:"ការប្រុងប្រយ័ត្នខ្ពស់",interaction:"បរិបទរូបមន្ត",noHistory:"មិនទាន់មានការវិភាគទេ",readDone:"បានសម្គាល់ព័ត៌មានថាបានអាន",demoLoaded:"បានបញ្ចូលរូបមន្តឧទាហរណ៍",accountCreated:"បានបង្កើតគណនីសាកល្បង",signedInToast:"បានចូលគណនីលើឧបករណ៍នេះ",signedOutToast:"បានចេញពីគណនី",savedBot:"បានរក្សាទុកការកំណត់បូត",focusUpdated:"បានធ្វើបច្ចុប្បន្នភាពចំណាប់អារម្មណ៍",welcomeBot:"សួស្តី! ខ្ញុំជា BioBot របស់អ្នក។ សូមវិភាគផលិតផល ឬសួរខ្ញុំអំពីតួនាទីគ្រឿងផ្សំ!",signInRequired:"ចូលគណនី ឬបន្តជាអ្នកប្រើសាកល្បង ដើម្បីរក្សាទុកការវិភាគ និងទទួលយោបល់ផ្ទាល់ខ្លួន។",scan:"វិភាគ",product:"ផលិតផល",formulaAlert:"ការជូនដំណឹងរូបមន្ត",biochemistrySpotlight:"ចំណេះដឹងជីវគីមី",appUpdate:"ព័ត៌មានកម្មវិធី និងទិន្នន័យ",learn:"ស្វែងយល់ពីគ្រឿងផ្សំ",howTheyWork:"របៀបដំណើរការ",pH:"បរិបទ pH សមស្រប",solubility:"ភាពរលាយ",caution:"ការប្រុងប្រយ័ត្ន",practical:"កំណត់សម្គាល់ប្រើប្រាស់",profile:"ប្រវត្តិរូប",forYouNav:"សម្រាប់អ្នក និងព័ត៌មានថ្មី",chatFallback:"ខ្ញុំអាចពន្យល់ពីគ្រឿងផ្សំក្នុងមូលដ្ឋានចំណេះដឹងសាកល្បង ឬផលិតផលដែលអ្នកបានវិភាគថ្មីៗ។ សាកសួរឈ្មោះសារធាតុ។ ចម្លើយរបស់ខ្ញុំសម្រាប់ការអប់រំ មិនមែនដំបូន្មានវេជ្ជសាស្ត្រទេ។",chatDisclaimer:"ប្រសិនបើអ្នកសួរអំពីរោគសញ្ញា អាឡែស៊ី ការមានផ្ទៃពោះ ថ្នាំ ឬការព្យាបាល សូមពិគ្រោះជាមួយវេជ្ជបណ្ឌិតសើស្បែក ឱសថការី ឬអ្នកជំនាញសុខភាព។",botUnknown:"ខ្ញុំមិនមានព័ត៌មានលម្អិតអំពីឈ្មោះនេះក្នុងមគ្គុទ្ទេសក៍តូចរបស់ខ្ញុំទេ។ ការមិនស្គាល់នៅទីនេះមិនមានន័យថាមិនមានសុវត្ថិភាពទេ។ ពិនិត្យព័ត៌មានពីក្រុមហ៊ុនផលិត ឬសួរអ្នកជំនាញ។",scanPrompt:"ខ្ញុំមិនទាន់ឃើញការវិភាគដែលបានរក្សាទុកទេ។ បិទភ្ជាប់បញ្ជីគ្រឿងផ្សំក្នុងផ្ទាំងវិភាគ រួចខ្ញុំនឹងពន្យល់ពីអ្វីដែលមគ្គុទ្ទេសក៍ស្គាល់។",noSuggestions:"គ្រឿងផ្សំដែលបានរក្សាទុករបស់អ្នកមានភាពចម្រុះ។ វិភាគ និងរក្សាទុកផលិតផលមួយទៀត ឬប្តូរចំណាប់អារម្មណ៍ ដើម្បីមើលថ្នាក់គ្រឿងផ្សំបន្ថែម។",recommendation:"ស្វែងយល់",registered:"បានបង្កើតគណនីលើឧបករណ៍នេះ",passwordHint:"ពាក្យសម្ងាត់ត្រូវមានយ៉ាងតិច ៤ តួអក្សរ។",duplicateEmail:"មានគណនីអ៊ីមែលនេះរួចហើយក្នុងកម្មវិធីរុករកនេះ។",authError:"មិនអាចចូលដោយព័ត៌មាននេះបានទេ។",imageTooLarge:"សូមជ្រើសរូបភាពតូចជាង ៥ MB។",uploadError:"មិនអាចបើករូបភាពនេះបានទេ។ សូមសាកល្បងរូបភាពផ្សេង។",scanSaved:"បានរក្សាទុកការវិភាគក្នុងកម្មវិធីរុករកនេះ",unknownLabel:"មិនស្គាល់"
  }
};
Object.assign(translations.en,{
  settings:"Settings",settingsEyebrow:"Your account, your choices",settingsTitle:"Settings & privacy.",settingsIntro:"Choose what to share, how suggestions are tailored, and which updates you receive. Personal details are optional.",
  personalizationTitle:"Personalization profile",personalizationDesc:"Only information you choose to provide is used. Gender is never used to infer ingredient safety or rank suggestions.",
  ageRange:"Age range (optional)",gender:"Gender (optional)",preferNot:"Prefer not to say",woman:"Woman",man:"Man",nonbinary:"Non-binary",selfDescribe:"Self-describe",genderDescription:"Optional description",skinType:"Skin type (optional)",notSure:"Not sure / prefer not to say",skinDry:"Dry",skinOily:"Oily",skinCombination:"Combination",skinBalanced:"Balanced",skinSensitive:"Sensitive",primaryFocus:"Main product focus",
  concerns:"What would you like to learn about? (optional)",concernDryness:"Dryness",concernSensitivity:"Sensitivity",concernBlemishes:"Blemishes",concernRedness:"Redness",concernTone:"Uneven tone",concernBarrier:"Barrier support",
  allergies:"Known ingredient allergies or sensitivities (optional)",allergyHelper:"Used only to flag exact name matches against a scan. This cannot identify hidden allergens or guarantee a product is safe.",
  profileConsent:"I understand that concerns and allergy notes are sensitive personal information and choose to save them to my account for ingredient-match alerts. I can clear them at any time.",
  saveProfile:"Save profile preferences",notificationSettings:"Notifications",notificationSettingsDesc:"In-app notices, optional browser push, and optional email updates.",
  inAppNotices:"In-app notifications",alwaysAvailable:"Available in your notification center",enabled:"On",browserPush:"Browser push",pushNotEnabled:"Not enabled on this device",enablePush:"Enable push",disablePush:"Turn off",emailUpdates:"Email updates",emailOff:"Off",emailOn:"On · verified address only",
  notificationConsent:"Push requires browser permission and HTTPS (or localhost). Email updates are sent only after email verification and require the deployed email provider.",
  appSettings:"App settings",language:"Language",languageDesc:"App display language",botSettings:"Bot appearance & tone",botSettingsDesc:"Name, avatar and explanation style",installApp:"Install app",installAppDesc:"Add molecule to your home screen",install:"Install",
  yourData:"Your data",yourDataDesc:"Download a copy or permanently remove this account and its app data.",exportData:"Export my data",exportDataDesc:"Download your profile, scans and saved items",download:"Download",deleteAccount:"Delete account & data",deleteAccountDesc:"Permanent; Firebase accounts require recent sign-in",delete:"Delete",
  profilePrivacyTitle:"Your health information deserves care",profilePrivacyText:"Only provide details you are comfortable storing. This app is educational, not a medical record or diagnosis tool. Do not include medication details or emergency information.",
  notifications:"Notifications",notificationsSub:"Updates for your account",noNotifications:"No notifications yet. New product updates will appear here.",markAsRead:"Mark as read",openUpdate:"Open update",notificationRead:"Notification marked as read",profileSaved:"Preferences saved",consentRequired:"Please agree before saving concerns or allergy notes.",clearHealthDataConfirm:"Unchecking consent will permanently clear your saved concerns and allergy notes. Continue?",pushEnabled:"Push notifications enabled on this device",pushDisabled:"Push notifications disabled on this device",signedInForSettings:"Sign in to manage account settings.",firebaseReady:"Firebase connected · account data syncs securely to your project.",firebaseMissing:"Firebase isn't configured. Demo mode works on this device; follow README.md to enable real accounts and delivery.",firebaseError:"Firebase setup could not finish. Check project settings and network access.",
  authConsent:"I am 13 or older and understand this account stores my profile and saved app data in Firebase. I will not enter emergency or medication information.",forgotPassword:"Forgot password?",verificationSent:"Verification email sent. Verify your address before enabling email updates.",verificationNeeded:"Verify your email address before turning on email updates.",passwordHint:"Use at least 8 characters.",scanAllergyWarning:"Possible exact ingredient-name match with your saved allergy/sensitivity notes. Labels can omit derivatives or contaminants; this is not a safety check. Do not use a product you know you react to; ask a qualified professional.",allergyMatchTitle:"Possible name match — please use caution",youngProfileNote:"Suggestions are limited to general supportive ingredient classes for this age range. Ask a caregiver and qualified healthcare professional for personal advice.",sensitiveProfileNote:"Your selected sensitivity preference changes which supportive classes are highlighted; it cannot predict irritation or determine what is safe for you.",agePrivacy:"Age is collected as a broad range only; this app is not designed for children under 13.",emailVerification:"Email verification",refreshStatus:"Refresh status",
  allergyPlaceholder:"Enter exact ingredient names, separated by commas.",
  profileLoadFailed:"Your account data could not be loaded. Check your connection and sign in again.",exported:"Your data export has been downloaded.",deleteConfirm:"Permanently delete your account and all saved data? This cannot be undone.",accountDeleted:"Account and app data deleted.",pushNeedsLogin:"Sign in to enable notifications across devices.",emailVerified:"Email verified",emailNotVerified:"Email not verified",sendVerification:"Send verification email",emailVerificationInfo:"A verified address is required before email notifications can be sent.",signedUp:"Account created. Check your email to verify it.",resetSent:"If the account exists, a password reset email has been sent.",configuredSignInRequired:"Real sign-in needs Firebase setup. Demo mode is available while you configure it."
});
Object.assign(translations.km,{
  settings:"ការកំណត់",settingsEyebrow:"គណនី និងជម្រើសរបស់អ្នក",settingsTitle:"ការកំណត់ និងឯកជនភាព។",settingsIntro:"ជ្រើសរើសព័ត៌មានដែលចែករំលែក វិធីកែសម្រួលយោបល់ និងព័ត៌មានថ្មីដែលអ្នកទទួល។ ព័ត៌មានផ្ទាល់ខ្លួនទាំងអស់សុទ្ធតែជាជម្រើស។",
  personalizationTitle:"ប្រវត្តិរូបសម្រាប់ការផ្តល់យោបល់",personalizationDesc:"ប្រើតែព័ត៌មានដែលអ្នកជ្រើសរើសផ្តល់ប៉ុណ្ណោះ។ មិនប្រើភេទដើម្បីសន្និដ្ឋានសុវត្ថិភាពគ្រឿងផ្សំ ឬរៀបលំដាប់យោបល់ទេ។",
  ageRange:"ក្រុមអាយុ (ជាជម្រើស)",gender:"ភេទ (ជាជម្រើស)",preferNot:"មិនចង់ប្រាប់",woman:"ស្ត្រី",man:"បុរស",nonbinary:"មិនកំណត់ត្រឹមភេទពីរប្រភេទ",selfDescribe:"ពិពណ៌នាដោយខ្លួនឯង",genderDescription:"ការពិពណ៌នាជាជម្រើស",skinType:"ប្រភេទស្បែក (ជាជម្រើស)",notSure:"មិនប្រាកដ / មិនចង់ប្រាប់",skinDry:"ស្ងួត",skinOily:"ខ្លាញ់",skinCombination:"ចម្រុះ",skinBalanced:"ធម្មតា",skinSensitive:"ងាយប្រតិកម្ម",primaryFocus:"ចំណាប់អារម្មណ៍ផលិតផលសំខាន់",
  concerns:"តើអ្នកចង់ស្វែងយល់អំពីអ្វី? (ជាជម្រើស)",concernDryness:"ស្បែកស្ងួត",concernSensitivity:"ភាពងាយប្រតិកម្ម",concernBlemishes:"មុន និងស្នាម",concernRedness:"ស្បែកក្រហម",concernTone:"ពណ៌ស្បែកមិនស្មើ",concernBarrier:"របាំងការពារស្បែក",
  allergies:"អាឡែស៊ី ឬភាពងាយប្រតិកម្មចំពោះគ្រឿងផ្សំ (ជាជម្រើស)",allergyHelper:"ប្រើសម្រាប់សម្គាល់តែឈ្មោះដែលត្រូវគ្នាជាក់លាក់ក្នុងការវិភាគ។ មិនអាចស្គាល់សារធាតុអាឡែស៊ីលាក់ ឬធានាសុវត្ថិភាពផលិតផលបានទេ។",
  profileConsent:"ខ្ញុំយល់ថាបញ្ហាស្បែក និងកំណត់សម្គាល់អាឡែស៊ីជាព័ត៌មានផ្ទាល់ខ្លួនរសើប ហើយជ្រើសរើសរក្សាទុកក្នុងគណនី ដើម្បីជូនដំណឹងអំពីឈ្មោះគ្រឿងផ្សំដែលត្រូវគ្នា។ ខ្ញុំអាចលុបពេលណាក៏បាន។",
  saveProfile:"រក្សាទុកចំណូលចិត្ត",notificationSettings:"ការជូនដំណឹង",notificationSettingsDesc:"ការជូនដំណឹងក្នុងកម្មវិធី ការជូនដំណឹងរុញតាមកម្មវិធីរុករក និងអ៊ីមែលជាជម្រើស។",
  inAppNotices:"ការជូនដំណឹងក្នុងកម្មវិធី",alwaysAvailable:"មាននៅក្នុងមជ្ឈមណ្ឌលជូនដំណឹង",enabled:"បើក",browserPush:"ការជូនដំណឹងរុញ",pushNotEnabled:"មិនទាន់បើកលើឧបករណ៍នេះ",enablePush:"បើកការជូនដំណឹង",disablePush:"បិទ",emailUpdates:"ព័ត៌មានតាមអ៊ីមែល",emailOff:"បិទ",emailOn:"បើក · អាសយដ្ឋានបានផ្ទៀងផ្ទាត់ប៉ុណ្ណោះ",
  notificationConsent:"ការជូនដំណឹងរុញត្រូវការការអនុញ្ញាតពីកម្មវិធីរុករក និង HTTPS (ឬ localhost)។ អ៊ីមែលផ្ញើបានតែបន្ទាប់ពីផ្ទៀងផ្ទាត់អ៊ីមែល និងកំណត់អ្នកផ្តល់សេវា។",
  appSettings:"ការកំណត់កម្មវិធី",language:"ភាសា",languageDesc:"ភាសាបង្ហាញក្នុងកម្មវិធី",botSettings:"រូបរាង និងសម្លេងបូត",botSettingsDesc:"ឈ្មោះ រូបតំណាង និងរបៀបពន្យល់",installApp:"ដំឡើងកម្មវិធី",installAppDesc:"បន្ថែម molecule ទៅអេក្រង់ដើម",install:"ដំឡើង",
  yourData:"ទិន្នន័យរបស់អ្នក",yourDataDesc:"ទាញយកច្បាប់ចម្លង ឬលុបគណនី និងទិន្នន័យកម្មវិធីជាអចិន្ត្រៃយ៍។",exportData:"នាំចេញទិន្នន័យរបស់ខ្ញុំ",exportDataDesc:"ទាញយកប្រវត្តិរូប ការវិភាគ និងធាតុរក្សាទុក",download:"ទាញយក",deleteAccount:"លុបគណនី និងទិន្នន័យ",deleteAccountDesc:"មិនអាចត្រឡប់ក្រោយបាន; ត្រូវចូលគណនីថ្មីសម្រាប់ Firebase",delete:"លុប",
  profilePrivacyTitle:"សូមការពារព័ត៌មានសុខភាពរបស់អ្នក",profilePrivacyText:"បញ្ចូលតែព័ត៌មានដែលអ្នកយល់ព្រមរក្សាទុក។ កម្មវិធីនេះសម្រាប់ការអប់រំ មិនមែនជាកំណត់ត្រាវេជ្ជសាស្ត្រ ឬឧបករណ៍ធ្វើរោគវិនិច្ឆ័យទេ។ កុំបញ្ចូលព័ត៌មានថ្នាំ ឬព័ត៌មានបន្ទាន់។",
  notifications:"ការជូនដំណឹង",notificationsSub:"ព័ត៌មានថ្មីៗសម្រាប់គណនីរបស់អ្នក",noNotifications:"មិនទាន់មានការជូនដំណឹងទេ។ ព័ត៌មានផលិតផលថ្មីនឹងបង្ហាញនៅទីនេះ។",markAsRead:"សម្គាល់ថាបានអាន",openUpdate:"បើកព័ត៌មាន",notificationRead:"បានសម្គាល់ការជូនដំណឹងថាបានអាន",profileSaved:"បានរក្សាទុកចំណូលចិត្ត",consentRequired:"សូមយល់ព្រមមុនពេលរក្សាទុកបញ្ហាស្បែក ឬកំណត់សម្គាល់អាឡែស៊ី។",clearHealthDataConfirm:"ការដកការយល់ព្រមនឹងលុបបញ្ហាស្បែក និងកំណត់សម្គាល់អាឡែស៊ីដែលបានរក្សាទុកជាអចិន្ត្រៃយ៍។ តើបន្តទេ?",pushEnabled:"បានបើកការជូនដំណឹងរុញលើឧបករណ៍នេះ",pushDisabled:"បានបិទការជូនដំណឹងរុញលើឧបករណ៍នេះ",signedInForSettings:"សូមចូលគណនីដើម្បីគ្រប់គ្រងការកំណត់។",firebaseReady:"បានភ្ជាប់ Firebase · ទិន្នន័យគណនីធ្វើសមកាលកម្មទៅគម្រោងរបស់អ្នក។",firebaseMissing:"មិនទាន់កំណត់ Firebase ទេ។ របៀបសាកល្បងដំណើរការលើឧបករណ៍នេះ។ អាន README.md ដើម្បីបើកគណនី និងការជូនដំណឹងពិត។",firebaseError:"មិនអាចបញ្ចប់ការកំណត់ Firebase បានទេ។ ពិនិត្យការកំណត់គម្រោង និងអ៊ីនធឺណិត។",
  authConsent:"ខ្ញុំមានអាយុ ១៣ ឆ្នាំឡើង ហើយយល់ថាគណនីនេះរក្សាទុកប្រវត្តិរូប និងទិន្នន័យកម្មវិធីក្នុង Firebase។ ខ្ញុំនឹងមិនបញ្ចូលព័ត៌មានបន្ទាន់ ឬព័ត៌មានថ្នាំទេ។",forgotPassword:"ភ្លេចពាក្យសម្ងាត់?",verificationSent:"បានផ្ញើអ៊ីមែលផ្ទៀងផ្ទាត់។ សូមផ្ទៀងផ្ទាត់អាសយដ្ឋាន មុនបើកការជូនដំណឹងតាមអ៊ីមែល។",verificationNeeded:"សូមផ្ទៀងផ្ទាត់អ៊ីមែល មុនបើកការជូនដំណឹងតាមអ៊ីមែល។",passwordHint:"ប្រើពាក្យសម្ងាត់យ៉ាងតិច ៨ តួអក្សរ។",scanAllergyWarning:"អាចមានឈ្មោះគ្រឿងផ្សំដែលត្រូវគ្នាជាក់លាក់នឹងកំណត់សម្គាល់អាឡែស៊ី/ប្រតិកម្មរបស់អ្នក។ ស្លាកអាចមិនបង្ហាញសារធាតុចម្លង ឬសារធាតុកខ្វក់។ នេះមិនមែនជាការត្រួតពិនិត្យសុវត្ថិភាពទេ។ កុំប្រើផលិតផលដែលអ្នកដឹងថាបង្កប្រតិកម្ម ហើយសូមសួរអ្នកជំនាញ។",allergyMatchTitle:"ឈ្មោះអាចត្រូវគ្នា — សូមប្រុងប្រយ័ត្ន",youngProfileNote:"យោបល់សម្រាប់ក្រុមអាយុនេះមានតែថ្នាក់គ្រឿងផ្សំគាំទ្រទូទៅប៉ុណ្ណោះ។ សូមសួរអ្នកថែទាំ និងអ្នកជំនាញសុខភាពសម្រាប់ដំបូន្មានផ្ទាល់ខ្លួន។",sensitiveProfileNote:"ចំណូលចិត្តអំពីភាពងាយប្រតិកម្មរបស់អ្នក ប្តូរថ្នាក់គ្រឿងផ្សំគាំទ្រដែលបង្ហាញ ប៉ុន្តែមិនអាចទាយប្រតិកម្ម ឬកំណត់សុវត្ថិភាពផ្ទាល់ខ្លួនបានទេ។",agePrivacy:"កម្មវិធីរក្សាទុកតែក្រុមអាយុទូលំទូលាយប៉ុណ្ណោះ។ កម្មវិធីនេះមិនត្រូវបានបង្កើតសម្រាប់កុមារក្រោមអាយុ ១៣ ឆ្នាំទេ។",emailVerification:"ការផ្ទៀងផ្ទាត់អ៊ីមែល",refreshStatus:"ធ្វើបច្ចុប្បន្នភាព",
  allergyPlaceholder:"បញ្ចូលឈ្មោះគ្រឿងផ្សំជាក់លាក់ ដោយបំបែកដោយក្បៀស។",
  exported:"បានទាញយកទិន្នន័យរបស់អ្នក។",deleteConfirm:"លុបគណនី និងទិន្នន័យដែលបានរក្សាទុកទាំងអស់ជាអចិន្ត្រៃយ៍មែនទេ? មិនអាចត្រឡប់ក្រោយបានទេ។",accountDeleted:"បានលុបគណនី និងទិន្នន័យកម្មវិធី។",pushNeedsLogin:"សូមចូលគណនី ដើម្បីបើកការជូនដំណឹងលើឧបករណ៍ផ្សេងៗ។",emailVerified:"បានផ្ទៀងផ្ទាត់អ៊ីមែល",emailNotVerified:"មិនទាន់ផ្ទៀងផ្ទាត់អ៊ីមែល",sendVerification:"ផ្ញើអ៊ីមែលផ្ទៀងផ្ទាត់",emailVerificationInfo:"ត្រូវផ្ទៀងផ្ទាត់អាសយដ្ឋាន មុនពេលផ្ញើការជូនដំណឹងតាមអ៊ីមែល។",signedUp:"បានបង្កើតគណនី។ សូមពិនិត្យអ៊ីមែលដើម្បីផ្ទៀងផ្ទាត់។",resetSent:"បើមានគណនី អ៊ីមែលកំណត់ពាក្យសម្ងាត់ឡើងវិញត្រូវបានផ្ញើ។",configuredSignInRequired:"ត្រូវកំណត់ Firebase ដើម្បីចូលគណនីពិត។ អ្នកអាចប្រើរបៀបសាកល្បងក្នុងពេលកំណត់។"
});
Object.assign(translations.en,{
  accountDesc:"Real accounts sync through the configured Firebase project. Demo data remains on this device.",
  recommendationText:"The recommender scores saved ingredient classes and the focus and concern preferences you selected. Broad age range can limit suggestions to general supportive classes. Gender is not used. Sensitive profile fields are optional, consent-gated, and stored with your signed-in account; they are not medical diagnoses.",
  storageText:"Demo profiles stay in this browser. Real accounts use Firebase Authentication and Firestore with user-scoped rules; push uses Firebase Cloud Messaging, and opted-in verified-email updates use Resend through a server function. Demo mode is not cloud sync.",
  firebaseText:"Set the public web-app values in firebase-config.js, deploy Firestore rules and Cloud Functions, and configure the notification provider secrets. Never put service-account keys or the Resend API key in browser code.",
  localAccountNotice:"Demo mode stores data only on this device. Real sign-in needs Firebase project setup.",
  privacyNotice:"Privacy notice",termsOfUse:"Terms of use",agePrivacy:"Age is collected as a broad range only; this app is not designed for children under 13."
});
Object.assign(translations.km,{
  accountDesc:"គណនីពិតធ្វើសមកាលកម្មតាមគម្រោង Firebase ដែលបានកំណត់។ ទិន្នន័យសាកល្បងនៅលើឧបករណ៍នេះ។",
  recommendationText:"ប្រព័ន្ធគណនាពិន្ទុថ្នាក់គ្រឿងផ្សំដែលបានរក្សាទុក ចំណាប់អារម្មណ៍ និងបញ្ហាដែលអ្នកបានជ្រើស។ ក្រុមអាយុអាចកំណត់យោបល់ឱ្យនៅត្រឹមថ្នាក់គាំទ្រទូទៅ។ មិនប្រើភេទទេ។ ព័ត៌មានរសើបជាជម្រើស ត្រូវការការយល់ព្រម និងរក្សាទុកក្នុងគណនីដែលបានចូល; វាមិនមែនជារោគវិនិច្ឆ័យទេ។",
  storageText:"ប្រវត្តិរូបសាកល្បងនៅក្នុងកម្មវិធីរុករកនេះ។ គណនីពិតប្រើ Firebase Authentication និង Firestore ជាមួយច្បាប់ការពារតាមអ្នកប្រើ។ ការជូនដំណឹងរុញប្រើ Firebase Cloud Messaging និងអ៊ីមែលដែលបានយល់ព្រមប្រើ Resend តាម server function។ របៀបសាកល្បងមិនធ្វើសមកាលកម្មលើពពកទេ។",
  firebaseText:"បញ្ចូលតម្លៃ web app សាធារណៈក្នុង firebase-config.js ដាក់ឱ្យដំណើរការច្បាប់ Firestore និង Cloud Functions ហើយកំណត់ secret របស់អ្នកផ្តល់ការជូនដំណឹង។ កុំដាក់ service-account key ឬ Resend API key ក្នុង browser code។",
  localAccountNotice:"របៀបសាកល្បងរក្សាទុកទិន្នន័យលើឧបករណ៍នេះប៉ុណ្ណោះ។ ការចូលគណនីពិតត្រូវការកំណត់ Firebase។",
  privacyNotice:"សេចក្តីជូនដំណឹងឯកជនភាព",termsOfUse:"លក្ខខណ្ឌប្រើប្រាស់"
});
Object.assign(translations.en,{
  knowledgeCatalogSummary:"{count} compound entries + everyday product guides & chemistry concepts",
  chatAnswerFailed:"I couldn't complete that answer. Please try again.",
  labInitError:"The virtual lab could not start in this browser."
});
Object.assign(translations.km,{
  knowledgeCatalogSummary:"ធាតុសមាសធាតុគីមី {count} + មគ្គុទ្ទេសក៍វត្ថុប្រចាំថ្ងៃ និងគំនិតគីមីវិទ្យា",
  chatAnswerFailed:"មិនអាចបញ្ចប់ចម្លើយនេះបានទេ។ សូមព្យាយាមម្តងទៀត។",
  labInitError:"មិនអាចចាប់ផ្តើមមន្ទីរពិសោធន៍និម្មិតក្នុងកម្មវិធីរុករកនេះបានទេ។"
});
Object.assign(translations.en,{
  ruleScore:"Rule score",exploratory:"exploratory",focusBarrier:"barrier support",focusHydration:"hydration",focusBrightening:"brightening",focusAcne:"blemish care",focusSensitive:"sensitive skin",
  unread:"Unread",
  suggestionComplement:"This ingredient has a complementary role to classes in your saved scans. Learn about it; this is not a product or treatment recommendation.",
  suggestionFocus:"This ingredient's {className} role may relate to your selected focus. Learn about it; this is not a product or treatment recommendation.",
  feedRepeated:"Strong anionic surfactants appeared in {count} saved product scans. Repeated cleansing exposure can feel drying for some people; check product directions and your own experience.",
  feedNoRepeat:"No repeated strong-surfactant pattern appeared in your saved scans. This local rule checks ingredient labels only; it cannot measure exposure or predict a reaction.",
  feedScanPrompt:"Scan and save products to look for repeated high-caution surfactant labels across your local scan history.",
  feedSpotlight:"A class you see often: {className}. Explore how this ingredient class works in a formula; ingredient presence alone does not establish product performance.",
  feedSpotlightEmpty:"Ceramides are lipid building blocks in the outer skin barrier. Add a scan to get spotlights matched to ingredients you encounter.",
  feedAppUpdate:"Demo database v2 · {count} curated multi-domain entries. This offline guide uses transparent rules and curated explanations; no product catalog or live medical review is connected.",
  classBarrier:"barrier lipid",classHumectant:"humectant",classSoothing:"soothing agent",classEmollient:"emollient",classEmollientOcclusive:"emollient / occlusive",classVitaminBarrier:"vitamin / barrier support",classHumectantSoothing:"humectant / soothing",classAha:"exfoliating acid (AHA)",classBha:"exfoliating acid (BHA)",classRetinoid:"retinoid",classSurfactant:"anionic surfactant",classAmphoteric:"amphoteric surfactant",classAntioxidant:"antioxidant",classVitaminC:"vitamin C derivative",classMineralFilter:"mineral UV filter",classAcneOxidizer:"oxidizing acne active",classDicarboxylic:"dicarboxylic acid",classSolvent:"solvent",classOther:"ingredient class"
});
Object.assign(translations.km,{
  ruleScore:"ពិន្ទុតាមច្បាប់",exploratory:"សម្រាប់ស្វែងយល់",unread:"មិនទាន់អាន",
  focusBarrier:"ជំនួយរបាំងស្បែក",focusHydration:"ផ្តល់សំណើម",focusBrightening:"ធ្វើឱ្យស្បែកភ្លឺ",focusAcne:"ថែទាំបញ្ហាមុន",focusSensitive:"ស្បែកងាយប្រតិកម្ម",
  suggestionComplement:"គ្រឿងផ្សំនេះមានតួនាទីខុសគ្នា ដែលអាចបំពេញបន្ថែមថ្នាក់គ្រឿងផ្សំក្នុងផលិតផលដែលអ្នកបានរក្សាទុក។ សូមស្វែងយល់បន្ថែម; នេះមិនមែនជាការណែនាំផលិតផល ឬការព្យាបាលទេ។",
  suggestionFocus:"តួនាទីជា {className} របស់គ្រឿងផ្សំនេះអាចពាក់ព័ន្ធនឹងចំណាប់អារម្មណ៍ដែលអ្នកបានជ្រើស។ សូមស្វែងយល់បន្ថែម; នេះមិនមែនជាការណែនាំផលិតផល ឬការព្យាបាលទេ។",
  feedRepeated:"បានរកឃើញសារធាតុសម្អាត anionic ខ្លាំងក្នុងផលិតផលដែលបានវិភាគ {count} មុខ។ ការប៉ះពាល់ម្តងហើយម្តងទៀតអាចធ្វើឱ្យស្បែកស្ងួតសម្រាប់មនុស្សមួយចំនួន។ សូមពិនិត្យការណែនាំផលិតផល និងប្រតិកម្មរបស់អ្នក។",
  feedNoRepeat:"មិនឃើញលំនាំសារធាតុសម្អាតខ្លាំងកើតឡើងដដែលក្នុងផលិតផលដែលបានរក្សាទុកទេ។ ច្បាប់នេះពិនិត្យតែឈ្មោះលើស្លាក មិនអាចវាស់ការប៉ះពាល់ ឬទាយប្រតិកម្មបានទេ។",
  feedScanPrompt:"ស្កេន និងរក្សាទុកផលិតផល ដើម្បីពិនិត្យលំនាំឈ្មោះសារធាតុសម្អាតដែលត្រូវប្រុងប្រយ័ត្នក្នុងប្រវត្តិវិភាគរបស់អ្នក។",
  feedSpotlight:"ថ្នាក់គ្រឿងផ្សំដែលអ្នកឃើញញឹកញាប់៖ {className}។ ស្វែងយល់ពីតួនាទីរបស់ថ្នាក់នេះក្នុងរូបមន្ត; ការមានគ្រឿងផ្សំមិនអាចបញ្ជាក់ប្រសិទ្ធភាពផលិតផលបានទេ។",
  feedSpotlightEmpty:"សេរ៉ាមីតជាខ្លាញ់សំខាន់មួយនៅក្នុងរបាំងការពារស្រទាប់ខាងក្រៅនៃស្បែក។ បន្ថែមការវិភាគ ដើម្បីទទួលបានចំណុចវិទ្យាសាស្ត្រដែលត្រូវនឹងគ្រឿងផ្សំដែលអ្នកជួបប្រទះ។",
  feedAppUpdate:"មូលដ្ឋានទិន្នន័យសាកល្បង v2 · មានធាតុពហុវិស័យដែលបានជ្រើសរើស {count}។ មគ្គុទ្ទេសក៍ក្រៅបណ្តាញនេះប្រើច្បាប់ដែលអាចពិនិត្យបាន និងការពន្យល់ដែលបានជ្រើសរើស; មិនមានកាតាឡុកផលិតផល ឬការពិនិត្យវេជ្ជសាស្ត្រផ្ទាល់ទេ។",
  classBarrier:"ជាតិខ្លាញ់ជំនួយរបាំងស្បែក",classHumectant:"សារធាតុទាក់ទាញសំណើម",classSoothing:"សារធាតុបន្ធូរស្បែក",classEmollient:"សារធាតុធ្វើឱ្យស្បែកទន់",classEmollientOcclusive:"សារធាតុធ្វើឱ្យទន់ និងទប់សំណើម",classVitaminBarrier:"វីតាមីន / ជំនួយរបាំងស្បែក",classHumectantSoothing:"សារធាតុផ្តល់សំណើម / បន្ធូរស្បែក",classAha:"អាស៊ីតជម្រុះកោសិកា (AHA)",classBha:"អាស៊ីតជម្រុះកោសិកា (BHA)",classRetinoid:"រ៉េទីណូអ៊ីត",classSurfactant:"សារធាតុសម្អាត anionic",classAmphoteric:"សារធាតុសម្អាត amphoteric",classAntioxidant:"សារធាតុប្រឆាំងអុកស៊ីតកម្ម",classVitaminC:"ដេរីវេវីតាមីន C",classMineralFilter:"តម្រងកាំរស្មី UV រ៉ែ",classAcneOxidizer:"សារធាតុអុកស៊ីតកម្មសម្រាប់បញ្ហាមុន",classDicarboxylic:"អាស៊ីត dicarboxylic",classSolvent:"សារធាតុរំលាយ",classOther:"ថ្នាក់គ្រឿងផ្សំ"
});
Object.assign(translations.en,{
  virtualLab:"Virtual Reaction Lab",labShort:"Lab",labTitle:"Explore chemistry in a virtual vessel.",labIntro:"A classroom-style simulation of reaction rules, not a physical-lab protocol or a measurement instrument.",
  labSafetyTitle:"Virtual simulation only — never mix these chemicals in real life.",labSafetyCopy:"Bleach combined with acids or ammonia can release dangerous toxic gases. These combinations are blocked here: no gas yield, recipe, or reaction quantities are shown. If accidental exposure occurs, leave the area and contact local emergency or poison-control services.",
  presetEnzyme:"Enzyme activity & heat",presetRedox:"Vitamin C color change",presetEmulsion:"Oil, water & lecithin",presetCO2:"Virtual CO₂ stoichiometry",presetBleachAcid:"Why never combine bleach & acid",presetBleachAmmonia:"Why never combine bleach & ammonia",
  labCanvasTitle:"Laboratory canvas",labCanvasSub:"Visual effects and the Arrhenius-style rate factor are illustrative; they are not measured kinetics or analytical readings.",glassBeaker:"Glass beaker",erlenmeyer:"Erlenmeyer flask",petriDish:"Petri / skin-surface dish",
  temperature:"Temperature",phReadout:"Virtual pH dial",pressureReadout:"Assumed gas pressure",pressureDial:"Assumed CO₂ pressure (ideal-gas calculation only)",reactionRate:"Illustrative rate factor",beakerContents:"Virtual beaker contents",selectReagents:"Select substances to explore. Hazardous combinations are detected and blocked.",simulationControls:"Simulation controls",phDial:"Illustrative pH dial (not calculated)",
  virtualBicarbonateMoles:"Virtual NaHCO₃ amount (mol)",virtualAcidMoles:"Virtual acetic acid amount (mol)",labMathLimit:"Hypothetical inputs only. The ideal-gas result is theoretical; real collection, dissolution, heat, concentration, and equilibrium are not modeled.",stirAgitate:"Stir / Agitate",resetVessel:"Reset vessel",reactionType:"Reaction type",balancedEquation:"Balanced equation / model",stoichiometry:"Stoichiometry (virtual)",labBotTitle:"Ask your bot about this simulated mixture",labBotSub:"The current contents, selected pH and temperature, and simulated products will be attached to a local chat prompt.",askLabBot:"Ask {botName} about this mixture",labDisclaimerTitle:"Limits of a virtual lab",labDisclaimerCopy:"This educational simulator is not a procedure, safety assessment, or real-time sensor. It does not predict exact final pH or temperature change. Follow product labels and qualified teacher or laboratory safety guidance; never perform the hazardous mixtures shown as alerts.",
  chipCorrection:"🖊️ Correction pen chemistry",chipCaffeine:"⚡ How caffeine works",chipMSG:"🍜 MSG & E-numbers",chipApples:"🧪 Why apples brown",
  chatPlaceholder:"Ask about an ingredient, everyday object, or science question...",
  answerCompound:"{name} · {formula}\nDomain: {domain}\nClass: {className}\nHow it works: {mechanism}\nExposure: {safety}\nPractical note: {advice}",
  answerCompoundFriendly:"{name} ({formula}) is a {className}. {mechanism}\nSafety: {safety}\n{advice}",
  answerObject:"{title}\nTypical components: {components}\n{description}\nSafety: {safety}",
  answerCompare:"Comparison (general, not product-specific):\n{first}\n\nCompared with:\n{second}\n\n{note}",
  answerCompareNote:"Their class, metabolism, and exposure routes differ; risk depends on the real product, amount, and route—not a simple good/bad label.",
  answerConcept:"{answer}",conceptUnknown:"I don't have a reliable built-in explanation for that exact broad question yet. Try a chemical name, product type, or a more specific mechanism. For a named chemical, ask “What is [name]?” to try the public PubChem lookup.",
  answerDeduction:"A naming clue for “{name}”: {className}. {detail}\nThis is only a naming heuristic, not a verified identity or safety assessment.",
  answerPubChem:"Public PubChem lookup for {name}:\nMolecular formula: {formula}\nMolecular weight: {weight} g/mol\nIUPAC name: {iupac}\nCID: {cid}\nThe query is sent to NIH PubChem. This database record does not establish product safety or exposure risk.",
  answerPubChemMissing:"PubChem did not return a matching record for “{name}”. {deduction}",
  answerPubChemError:"I couldn't reach PubChem right now ({error}). {deduction}",
  disclaimerSolvent:"Solvent / inhalation context: avoid deliberately breathing vapors, follow the exact product label and safety data sheet, ventilate as directed, and keep flammable products away from ignition. If exposed or unwell, move to fresh air and contact local emergency or poison-control services.",
  disclaimerFood:"Food / supplement context: product composition and serving amounts vary. For dietary restrictions, pregnancy, medicines, or health conditions, ask a qualified clinician or registered dietitian.",
  disclaimerSkin:"Topical-product context: formulas and concentrations vary. Stop using a product if concerned and ask a dermatologist or pharmacist for personal guidance.",
  disclaimerMedical:"Medical context: this is general education, not diagnosis or treatment. Do not start, stop, or change medicines from this explanation; consult a healthcare professional.",
  disclaimerGeneral:"General chemistry summary only; product formulas and exposure differ. Follow the product label and consult a qualified professional for personal safety questions.",
  disclaimerPubChem:"PubChem is a public chemical database; a database match is not a safety approval.",
  botLabPrompt:"Explain this virtual lab state.",chatThinking:"Checking the local chemistry guide…",structureLoadFailed:"The structure image could not be loaded from PubChem.",
  sourceLocalGuide:"Source: built-in educational guide",sourcePubChem:"Source: PubChem record",
  followupChipMechanism:"Explain the mechanism",followupChipExposure:"Exposure & safety",followupChipRelated:"Related compounds",followupChipLimits:"Limits & confidence",followupChipComponents:"What are its components?",followupChipLab:"Explain these lab results",
  followupUnknown:"I can't find this item in the local guide. Try a more specific name or a built-in topic.",
  followupNoRelated:"No other local entry in the same class is available for {name}.",
  followupLimits:"This is a curated educational summary, not a measured result or a product-specific assessment. Concentration, formulation, exposure route, and individual context can change the outcome.",
  followupExposureTitle:"Exposure and safety context",followupCompareTitle:"Related compounds",followupLimitsTitle:"Limits and confidence",followupMechanismTitle:"Mechanism",followupComponentsTitle:"Typical components",followupLabTitle:"Interpreting this virtual lab",
  followupLabText:"The displayed settings and ideal-gas calculation are hypothetical model outputs, not sensor readings. The model does not determine final pH, temperature change, real yield, or whether a real mixture is safe.",
  labContextAnswer:"Virtual lab snapshot:\nContents: {contents}\nSimulated reaction: {type}\nEquation / model: {equation}\nVirtual pH dial: {pH} (not a calculated final pH)\nSet temperature: {temperature} °C (not a measured temperature change)\nAssumed gas pressure: {pressure} atm\nLimiting reagent: {limiting}\nTheoretical output: {yield}\n{hazard}\nThese values are a simplified educational simulation, not a lab measurement or experimental procedure.",
  labNoRule:"No modeled reaction",labNoRuleNote:"This selected combination has no supported reaction rule in the demo; that does not prove compatibility.",
  labHazardBlocked:"Hazardous combination blocked",labBleachAcid:"Bleach with acids can release toxic gas. The simulator intentionally does not display reaction equations, quantities, yields, or gas animations. Never combine cleaning products.",
  labBleachAmmonia:"Bleach with ammonia can release toxic gases. The simulator intentionally does not display reaction equations, quantities, yields, or gas animations. Never combine cleaning products.",
  labCorrosiveBlocked:"Corrosive mixture blocked",labCorrosiveNote:"Strong acid/base mixtures are not modeled quantitatively here. Do not mix corrosive products outside an appropriately supervised laboratory.",
  labCo2Summary:"The balanced reaction uses a 1:1 mole ratio. The calculation panel shows the limiting-reagent step and ideal-gas equation.",labCo2Note:"The displayed volume uses the selected pressure and temperature. It is an ideal-gas estimate and ignores dissolved CO₂, collection losses, equilibrium, heat transfer, and equipment.",
  labModelLocal:"Result source: local educational model.",labModelPending:"Checking the calculation with the Python service…",labModelRemote:"Result source: Python model; inputs and ideal-gas result verified.",labModelFallback:"Python service unavailable or invalid; the local result remains displayed.",
  labEnzymeSummary:"Catalase can catalyze hydrogen-peroxide decomposition; this animation is qualitative only.",labEnzymeInactive:"The demo marks activity as reduced at this selected heat/pH setting. A single temperature or pH threshold is not universal for all enzyme sources.",labEnzymeActive:"The demo shows possible activity. Rate depends on enzyme source, concentration, substrate, pH, and temperature.",
  labRedoxReduced:"The model indicates that ascorbate can reduce iodine and fade the starch–iodine color.",labRedoxBlue:"Starch and iodine can form a deep blue-black complex.",labRedoxNote:"Color depends on concentration and formulation; this is a qualitative color model, not an analytical test.",
  labEmulsionStable:"Stirring with an amphiphilic emulsifier can disperse oil droplets in water.",labEmulsionLayers:"Oil and water remain in separate phases without sufficient emulsifier and agitation.",labEmulsionNote:"Droplet size and long-term stability depend on formulation and mixing; no actual product performance is predicted.",
  labSkincareCaution:"This combination can raise formulation and irritation questions, but no universal incompatibility or pH shift can be inferred from ingredient names alone.",labSkincareNote:"Concentration, product pH, packaging, timing, and skin tolerance matter; ask a dermatologist or pharmacist for personal guidance.",
  labPeroxideContext:"Hydrogen peroxide is an oxidizer; its behavior depends on concentration, formulation, and other ingredients.",labPeroxideNote:"No quantitative reaction or exposure model is available for this selection.",labNothingSelected:"No virtual reagents selected.",labNotApplicable:"Not applicable",labLimiting:"Limiting reagent: {name}",labYieldUnavailable:"Not calculated for this selection.",
  "No specific modeled reaction":"No specific modeled reaction","Acid–base neutralization / gas evolution":"Acid–base neutralization / gas evolution","Enzymatic catalysis":"Enzymatic catalysis","Complex formation / redox":"Complex formation / redox","Immiscible phases / emulsification":"Immiscible phases / emulsification","Formulation compatibility caution":"Formulation compatibility caution","Oxidizer safety context":"Oxidizer safety context","Hazard lockout":"Hazard lockout","Corrosive-mixture lockout":"Corrosive-mixture lockout"
});
Object.assign(translations.km,{
  virtualLab:"មន្ទីរពិសោធន៍ប្រតិកម្មនិម្មិត",labShort:"ពិសោធន៍",labTitle:"ស្វែងយល់គីមីវិទ្យាក្នុងធុងនិម្មិត។",labIntro:"ការក្លែងធ្វើសម្រាប់ការអប់រំ មិនមែនជានីតិវិធីពិសោធន៍ ឬឧបករណ៍វាស់ទេ។",
  labSafetyTitle:"ការក្លែងធ្វើនិម្មិតប៉ុណ្ណោះ — កុំលាយសារធាតុទាំងនេះក្នុងជីវិតពិត។",labSafetyCopy:"Bleach ដែលលាយជាមួយអាស៊ីត ឬអាម៉ូញាក់អាចបញ្ចេញឧស្ម័នពុលគ្រោះថ្នាក់។ កម្មវិធីនេះទប់ស្កាត់ការលាយទាំងនេះ ហើយមិនបង្ហាញបរិមាណ ឬទិន្នផលឧស្ម័នទេ។ បើមានការប៉ះពាល់ដោយចៃដន្យ សូមចាកចេញពីតំបន់ ហើយទាក់ទងសេវាសង្គ្រោះបន្ទាន់ ឬមជ្ឈមណ្ឌលពុលក្នុងតំបន់។",
  presetEnzyme:"សកម្មភាពអង់ស៊ីម និងកម្ដៅ",presetRedox:"ប្តូរពណ៌ដោយវីតាមីន C",presetEmulsion:"ប្រេង ទឹក និង lecithin",presetCO2:"ស្តូអ៊ីគីអូម៉ែត្រី CO₂ និម្មិត",presetBleachAcid:"ហេតុអ្វីកុំលាយ bleach និងអាស៊ីត",presetBleachAmmonia:"ហេតុអ្វីកុំលាយ bleach និងអាម៉ូញាក់",
  labCanvasTitle:"ផ្ទាំងមន្ទីរពិសោធន៍",labCanvasSub:"ចលនា ពណ៌ និងកត្តាល្បឿន Arrhenius សុទ្ធតែជាគំរូបង្ហាញ មិនមែនការវាស់ប្រតិកម្ម ឬការវិភាគទេ។",glassBeaker:"កែវប៊ីកเกอร์",erlenmeyer:"ដប Erlenmeyer",petriDish:"ចាន Petri / ផ្ទៃស្បែក",
  temperature:"សីតុណ្ហភាព",phReadout:"កំណត់ pH និម្មិត",pressureReadout:"សម្ពាធឧស្ម័នសន្មត",pressureDial:"សម្ពាធ CO₂ សន្មត (សម្រាប់គណនាច្បាប់ឧស្ម័នប៉ុណ្ណោះ)",reactionRate:"កត្តាល្បឿនបង្ហាញ",beakerContents:"សារធាតុក្នុងធុងនិម្មិត",selectReagents:"ជ្រើសសារធាតុសម្រាប់ស្វែងយល់។ ការរួមបញ្ចូលគ្រោះថ្នាក់នឹងត្រូវបានទប់ស្កាត់។",simulationControls:"ការគ្រប់គ្រងការក្លែងធ្វើ",phDial:"កំណត់ pH សម្រាប់បង្ហាញ (មិនបានគណនា)",
  virtualBicarbonateMoles:"បរិមាណ NaHCO₃ និម្មិត (mol)",virtualAcidMoles:"បរិមាណអាស៊ីតអាសេទិកនិម្មិត (mol)",labMathLimit:"តម្លៃស្មានសម្រាប់ការក្លែងធ្វើប៉ុណ្ណោះ។ ទិន្នផលឧស្ម័នតាមច្បាប់ឧស្ម័នគឺជាទ្រឹស្តី; មិនគណនាការរលាយ ការបាត់បង់កម្ដៅ កំហាប់ និងលំនឹងពិតទេ។",stirAgitate:"កូរ / រំញោច",resetVessel:"កំណត់ធុងឡើងវិញ",reactionType:"ប្រភេទប្រតិកម្ម",balancedEquation:"សមីការមានតុល្យភាព / គំរូ",stoichiometry:"ស្តូអ៊ីគីអូម៉ែត្រី (និម្មិត)",labBotTitle:"សួរបូតអំពីល្បាយក្លែងធ្វើនេះ",labBotSub:"មាតិកាបច្ចុប្បន្ន pH សីតុណ្ហភាព និងផលិតផលតាមគំរូនឹងត្រូវភ្ជាប់ក្នុងសារ chat ក្នុងកម្មវិធី។",askLabBot:"សួរ {botName} អំពីល្បាយនេះ",labDisclaimerTitle:"ដែនកំណត់នៃមន្ទីរពិសោធន៍និម្មិត",labDisclaimerCopy:"កម្មវិធីក្លែងធ្វើនេះមិនមែនជានីតិវិធី ការវាយតម្លៃសុវត្ថិភាព ឬឧបករណ៍ចាប់សញ្ញាពេលពិតទេ។ វាមិនទាយ pH ចុងក្រោយ ឬការប្រែប្រួលកម្ដៅជាក់លាក់ទេ។ អនុវត្តតាមស្លាក និងការណែនាំសុវត្ថិភាពពីគ្រូ ឬមន្ទីរពិសោធន៍; កុំសាកល្បងល្បាយគ្រោះថ្នាក់ដែលបង្ហាញជាការព្រមាន។",
  chipCorrection:"🖊️ គីមីវិទ្យាប៊ិចលុប",chipCaffeine:"⚡ Caffeine ដំណើរការយ៉ាងដូចម្តេច",chipMSG:"🍜 MSG និងលេខ E",chipApples:"🧪 ហេតុអ្វីផ្លែប៉ោមប្រែពណ៌",
  chatPlaceholder:"សួរអំពីគ្រឿងផ្សំ វត្ថុប្រចាំថ្ងៃ ឬវិទ្យាសាស្ត្រ...",
  answerCompound:"{name} · {formula}\nដែន៖ {domain}\nថ្នាក់៖ {className}\nរបៀបដំណើរការ៖ {mechanism}\nការប៉ះពាល់៖ {safety}\nចំណាំ៖ {advice}",
  answerCompoundFriendly:"{name} ({formula}) ជា {className}។ {mechanism}\nសុវត្ថិភាព៖ {safety}\n{advice}",
  answerObject:"{title}\nគ្រឿងផ្សំដែលអាចមាន៖ {components}\n{description}\nសុវត្ថិភាព៖ {safety}",
  answerCompare:"ការប្រៀបធៀបទូទៅ (មិនមែនសម្រាប់ផលិតផលជាក់លាក់)៖\n{first}\n\nប្រៀបធៀបនឹង៖\n{second}\n\n{note}",
  answerCompareNote:"ថ្នាក់គីមី មេតាបូលីស និងផ្លូវប៉ះពាល់ខុសគ្នា; ហានិភ័យអាស្រ័យលើផលិតផល បរិមាណ និងផ្លូវប៉ះពាល់ មិនអាចសង្ខេបថាល្អ/អាក្រក់តែមួយបានទេ។",
  answerConcept:"{answer}",conceptUnknown:"ខ្ញុំមិនទាន់មានការពន្យល់ដែលអាចទុកចិត្តបានសម្រាប់សំណួរទូលំទូលាយនេះទេ។ សាកសួរឈ្មោះសារធាតុ ប្រភេទផលិតផល ឬយន្តការជាក់លាក់។ ចំពោះសារធាតុមិនស្គាល់ សួរ “What is [name]?” ដើម្បីស្វែងរកក្នុង PubChem សាធារណៈ។",
  answerDeduction:"តម្រុយពីឈ្មោះ “{name}”៖ {className}។ {detail}\nនេះគ្រាន់តែជាច្បាប់ប៉ាន់ស្មានតាមឈ្មោះ មិនមែនការបញ្ជាក់អត្តសញ្ញាណ ឬសុវត្ថិភាពទេ។",
  answerPubChem:"លទ្ធផល PubChem សាធារណៈសម្រាប់ {name}៖\nរូបមន្តម៉ូលេគុល៖ {formula}\nម៉ាសម៉ូលេគុល៖ {weight} g/mol\nឈ្មោះ IUPAC៖ {iupac}\nCID៖ {cid}\nសំណួរនេះត្រូវបានផ្ញើទៅ NIH PubChem។ កំណត់ត្រាមិនបញ្ជាក់សុវត្ថិភាពផលិតផល ឬហានិភ័យនៃការប៉ះពាល់ទេ។",
  answerPubChemMissing:"PubChem មិនបានរកឃើញកំណត់ត្រាសម្រាប់ “{name}” ទេ។ {deduction}",
  answerPubChemError:"មិនអាចភ្ជាប់ PubChem ឥឡូវនេះ ({error})។ {deduction}",
  disclaimerSolvent:"ចំណាំអំពីសារធាតុរំលាយ/ការស្រូប៖ កុំស្រូបចំហាយដោយចេតនា។ អនុវត្តតាមស្លាក និងសន្លឹកទិន្នន័យសុវត្ថិភាពជាក់លាក់ ប្រើខ្យល់ចេញចូលតាមការណែនាំ និងរក្សាសារធាតុងាយឆេះឆ្ងាយពីភ្លើង។ បើមានការប៉ះពាល់ ឬមិនស្រួលខ្លួន សូមចាកចេញទៅខ្យល់ស្អាត ហើយទាក់ទងសេវាសង្គ្រោះបន្ទាន់ ឬមជ្ឈមណ្ឌលពុល។",
  disclaimerFood:"ចំណាំអាហារ/អាហារបំប៉ន៖ សមាសភាព និងបរិមាណបម្រើប្រែប្រួល។ សម្រាប់ការកំណត់របបអាហារ ការមានផ្ទៃពោះ ថ្នាំ ឬជំងឺ សូមសួរអ្នកជំនាញសុខភាព ឬអ្នកជំនាញអាហារូបត្ថម្ភ។",
  disclaimerSkin:"ចំណាំផលិតផលលាបស្បែក៖ រូបមន្ត និងកំហាប់ប្រែប្រួល។ បញ្ឈប់ការប្រើ ប្រសិនបើមានបញ្ហា ហើយសួរគ្រូពេទ្យសើស្បែក ឬឱសថការីសម្រាប់ដំបូន្មានផ្ទាល់ខ្លួន។",
  disclaimerMedical:"ចំណាំវេជ្ជសាស្ត្រ៖ នេះជាការអប់រំទូទៅ មិនមែនការធ្វើរោគវិនិច្ឆ័យ ឬព្យាបាលទេ។ កុំចាប់ផ្តើម បញ្ឈប់ ឬប្តូរថ្នាំតាមការពន្យល់នេះ; សូមពិគ្រោះអ្នកជំនាញសុខភាព។",
  disclaimerGeneral:"ជាការពន្យល់គីមីទូទៅប៉ុណ្ណោះ; រូបមន្ត និងការប៉ះពាល់ប្រែប្រួល។ អនុវត្តតាមស្លាក ហើយសួរអ្នកជំនាញសម្រាប់សំណួរសុវត្ថិភាពផ្ទាល់ខ្លួន។",
  disclaimerPubChem:"PubChem ជាមូលដ្ឋានទិន្នន័យគីមីសាធារណៈ; ការរកឃើញមិនមែនជាការអនុម័តសុវត្ថិភាពទេ។",
  botLabPrompt:"សូមពន្យល់ស្ថានភាពមន្ទីរពិសោធន៍និម្មិតនេះ។",chatThinking:"កំពុងពិនិត្យមគ្គុទ្ទេសក៍គីមីក្នុងកម្មវិធី…",structureLoadFailed:"មិនអាចទាញយករូបភាពរចនាសម្ព័ន្ធពី PubChem បានទេ។",
  sourceLocalGuide:"ប្រភព៖ មគ្គុទ្ទេសក៍អប់រំក្នុងកម្មវិធី",sourcePubChem:"ប្រភព៖ កំណត់ត្រា PubChem",
  followupChipMechanism:"ពន្យល់យន្តការ",followupChipExposure:"ការប៉ះពាល់ និងសុវត្ថិភាព",followupChipRelated:"សារធាតុពាក់ព័ន្ធ",followupChipLimits:"ដែនកំណត់ និងភាពជឿជាក់",followupChipComponents:"តើវាមានសមាសធាតុអ្វីខ្លះ?",followupChipLab:"ពន្យល់លទ្ធផលមន្ទីរពិសោធន៍",
  followupUnknown:"ខ្ញុំមិនឃើញធាតុនេះក្នុងមគ្គុទ្ទេសក៍ទេ។ សាកល្បងឈ្មោះជាក់លាក់ជាងនេះ ឬប្រធានបទដែលមានក្នុងកម្មវិធី។",
  followupNoRelated:"មិនមានធាតុផ្សេងទៀតក្នុងថ្នាក់ដូចគ្នាសម្រាប់ {name} ក្នុងមគ្គុទ្ទេសក៍ទេ។",
  followupLimits:"នេះជាសេចក្តីសង្ខេបសម្រាប់ការអប់រំ មិនមែនលទ្ធផលវាស់វែង ឬការវាយតម្លៃផលិតផលជាក់លាក់ទេ។ កំហាប់ រូបមន្ត ផ្លូវប៉ះពាល់ និងបរិបទផ្ទាល់ខ្លួនអាចប្តូរលទ្ធផលបាន។",
  followupExposureTitle:"បរិបទនៃការប៉ះពាល់ និងសុវត្ថិភាព",followupCompareTitle:"សារធាតុពាក់ព័ន្ធ",followupLimitsTitle:"ដែនកំណត់ និងភាពជឿជាក់",followupMechanismTitle:"យន្តការ",followupComponentsTitle:"សមាសធាតុដែលអាចមាន",followupLabTitle:"ការបកស្រាយមន្ទីរពិសោធន៍និម្មិតនេះ",
  followupLabText:"ការកំណត់ និងការគណនាឧស្ម័នឧត្តមគតិគឺជាលទ្ធផលពីគំរូស្មាន មិនមែនការអានពីឧបករណ៍ចាប់សញ្ញាទេ។ គំរូនេះមិនគណនា pH ចុងក្រោយ ការប្រែប្រួលសីតុណ្ហភាព ទិន្នផលពិត ឬសុវត្ថិភាពនៃល្បាយពិតទេ។",
  labContextAnswer:"សេចក្តីសង្ខេបល្បាយនិម្មិត៖\nមាតិកា៖ {contents}\nប្រតិកម្មតាមគំរូ៖ {type}\nសមីការ/គំរូ៖ {equation}\nកំណត់ pH និម្មិត៖ {pH} (មិនមែន pH ចុងក្រោយដែលបានគណនា)\nសីតុណ្ហភាពកំណត់៖ {temperature} °C (មិនមែនការវាស់ការប្រែប្រួលកម្ដៅ)\nសម្ពាធឧស្ម័នសន្មត៖ {pressure} atm\nសារធាតុកំណត់៖ {limiting}\nទិន្នផលទ្រឹស្តី៖ {yield}\n{hazard}\nតម្លៃទាំងនេះជាការក្លែងធ្វើសាមញ្ញ មិនមែនជាការវាស់ ឬនីតិវិធីពិសោធន៍ទេ។",
  labNoRule:"មិនមានប្រតិកម្មក្នុងគំរូ",labNoRuleNote:"ការជ្រើសរើសនេះមិនមានច្បាប់ប្រតិកម្មក្នុងកម្មវិធីទេ; វាមិនបញ្ជាក់ថាល្បាយមានសុវត្ថិភាពឡើយ។",
  labHazardBlocked:"បានទប់ស្កាត់ល្បាយគ្រោះថ្នាក់",labBleachAcid:"Bleach ជាមួយអាស៊ីតអាចបញ្ចេញឧស្ម័នពុល។ កម្មវិធីមិនបង្ហាញសមីការ បរិមាណ ទិន្នផល ឬចលនាឧស្ម័នទេ។ កុំលាយផលិតផលសម្អាត។",
  labBleachAmmonia:"Bleach ជាមួយអាម៉ូញាក់អាចបញ្ចេញឧស្ម័នពុល។ កម្មវិធីមិនបង្ហាញសមីការ បរិមាណ ទិន្នផល ឬចលនាឧស្ម័នទេ។ កុំលាយផលិតផលសម្អាត។",
  labCorrosiveBlocked:"បានទប់ស្កាត់ល្បាយច្រេះ",labCorrosiveNote:"មិនគណនាបរិមាណល្បាយអាស៊ីត/បាសខ្លាំងទេ។ កុំលាយផលិតផលច្រេះក្រៅមន្ទីរពិសោធន៍ដែលមានអ្នកគ្រប់គ្រង។",
  labCo2Summary:"សមីការមានសមាមាត្រ mol 1:1។ ផ្ទាំងគណនាបង្ហាញជំហានសារធាតុកំណត់ និងសមីការឧស្ម័នឧត្តមគតិ។",labCo2Note:"បរិមាណប្រើសម្ពាធ និងសីតុណ្ហភាពដែលបានជ្រើស។ វាជាការប៉ាន់ស្មានឧស្ម័នឧត្តមគតិ ហើយមិនរាប់ CO₂ ដែលរលាយ ការបាត់បង់ លំនឹង ការផ្ទេរកម្ដៅ និងឧបករណ៍ទេ។",
  labModelLocal:"ប្រភពលទ្ធផល៖ គំរូអប់រំក្នុងកម្មវិធី។",labModelPending:"កំពុងផ្ទៀងផ្ទាត់ការគណនាជាមួយសេវា Python…",labModelRemote:"ប្រភពលទ្ធផល៖ គំរូ Python; បានផ្ទៀងផ្ទាត់ធាតុចូល និងលទ្ធផលឧស្ម័នឧត្តមគតិ។",labModelFallback:"សេវា Python មិនអាចប្រើបាន ឬលទ្ធផលមិនត្រឹមត្រូវ; បន្តបង្ហាញលទ្ធផលក្នុងកម្មវិធី។",
  labEnzymeSummary:"Catalase អាចជំរុញការបំបែក hydrogen peroxide; ចលនានេះគ្រាន់តែជាគំរូគុណភាព។",labEnzymeInactive:"កម្មវិធីសម្គាល់សកម្មភាពថយចុះនៅកម្ដៅ/pH ដែលបានជ្រើស។ កម្រិតកម្ដៅ ឬ pH មួយមិនអាចតំណាងឱ្យប្រភពអង់ស៊ីមទាំងអស់ទេ។",labEnzymeActive:"គំរូបង្ហាញសកម្មភាពដែលអាចកើតមាន។ ល្បឿនអាស្រ័យលើប្រភពអង់ស៊ីម កំហាប់ សារធាតុដើម pH និងសីតុណ្ហភាព។",
  labRedoxReduced:"គំរូបង្ហាញថា ascorbate អាចកាត់បន្ថយ iodine និងធ្វើឱ្យពណ៌ម្សៅ–iodine ស្រអាប់។",labRedoxBlue:"ម្សៅ និង iodine អាចបង្កើតសមាសធាតុពណ៌ខៀវខ្មៅ។",labRedoxNote:"ពណ៌អាស្រ័យលើកំហាប់ និងរូបមន្ត; នេះជាគំរូពណ៌ មិនមែនការធ្វើតេស្តវិភាគទេ។",
  labEmulsionStable:"ការកូរជាមួយ emulsifier អាចបំបែកដំណក់ប្រេងក្នុងទឹក។",labEmulsionLayers:"ប្រេង និងទឹកនៅជាស្រទាប់ខុសគ្នា បើគ្មាន emulsifier និងការកូរគ្រប់គ្រាន់។",labEmulsionNote:"ទំហំដំណក់ និងលំនឹងរយៈពេលវែងអាស្រ័យលើរូបមន្ត និងការលាយ; មិនបានទាយប្រសិទ្ធភាពផលិតផលពិតទេ។",
  labSkincareCaution:"ល្បាយនេះអាចបង្កសំណួរអំពីរូបមន្ត និងការរំខាន ប៉ុន្តែមិនអាចសន្និដ្ឋានអំពីភាពមិនសមគ្នា ឬការប្រែប្រួល pH ជាសកលពីឈ្មោះគ្រឿងផ្សំបានទេ។",labSkincareNote:"កំហាប់ pH ការវេចខ្ចប់ ពេលវេលា និងភាពធន់ស្បែកសំខាន់; សួរគ្រូពេទ្យសើស្បែក ឬឱសថការីសម្រាប់ដំបូន្មានផ្ទាល់ខ្លួន។",
  labPeroxideContext:"Hydrogen peroxide ជាសារធាតុអុកស៊ីតកម្ម; ឥទ្ធិពលអាស្រ័យលើកំហាប់ រូបមន្ត និងគ្រឿងផ្សំផ្សេង។",labPeroxideNote:"មិនមានគំរូបរិមាណប្រតិកម្ម ឬការប៉ះពាល់សម្រាប់ការជ្រើសរើសនេះទេ។",
  labNothingSelected:"មិនទាន់ជ្រើសសារធាតុនិម្មិតទេ។",labNotApplicable:"មិនអនុវត្ត",labLimiting:"សារធាតុកំណត់៖ {name}",labYieldUnavailable:"មិនបានគណនាសម្រាប់ការជ្រើសរើសនេះទេ។",
  "No specific modeled reaction":"មិនមានប្រតិកម្មក្នុងគំរូ","Acid–base neutralization / gas evolution":"ប្រតិកម្មបន្សាបអាស៊ីត–បាស / កើតឧស្ម័ន","Enzymatic catalysis":"កាតាលីសដោយអង់ស៊ីម","Complex formation / redox":"ការបង្កើតស្មុគស្មាញ / redox","Immiscible phases / emulsification":"ដំណាក់កាលមិនលាយគ្នា / emulsion","Formulation compatibility caution":"ការប្រុងប្រយ័ត្នភាពសមគ្នានៃរូបមន្ត","Oxidizer safety context":"បរិបទសុវត្ថិភាពសារធាតុអុកស៊ីតកម្ម","Hazard lockout":"ទប់ស្កាត់គ្រោះថ្នាក់","Corrosive-mixture lockout":"ទប់ស្កាត់ល្បាយច្រេះ"
});
function t(key){return translations[language][key]||translations.en[key]||key;}
function escapeHtml(value){return String(value??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));}
function isSafeInternalUrl(value){
  try{return new URL(value,location.origin).origin===location.origin&&String(value).startsWith("/")&&!String(value).startsWith("//");}
  catch(error){return false;}
}
function classLabel(value){
  if(language!=="km")return value;
  const key={"Barrier lipid":"classBarrier","Humectant":"classHumectant","Soothing agent":"classSoothing","Humectant / soothing":"classHumectantSoothing","Emollient":"classEmollient","Emollient / occlusive":"classEmollientOcclusive","Vitamin / barrier support":"classVitaminBarrier","Exfoliating acid (AHA)":"classAha","Exfoliating acid (BHA)":"classBha","Retinoid":"classRetinoid","Anionic surfactant":"classSurfactant","Amphoteric surfactant":"classAmphoteric","Antioxidant":"classAntioxidant","Vitamin C derivative":"classVitaminC","Mineral UV filter":"classMineralFilter","Oxidizing acne active":"classAcneOxidizer","Dicarboxylic acid":"classDicarboxylic","Solvent":"classSolvent"}[value];
  return t(key||"classOther");
}
function localizedFeedCard(card){
  if(language!=="km")return card;
  if(card.id==="formula-alert")return {...card,title:"ពិនិត្យលំនាំរូបមន្ត",text:card.surfactantCount>=2?t("feedRepeated").replace("{count}",card.surfactantCount):card.hasScans?t("feedNoRepeat"):t("feedScanPrompt")};
  if(card.id==="spotlight"&&card.spotlightTitleKm)return {...card,title:`${card.spotlightTitleKm} · ចំណុចវិទ្យាសាស្ត្រ`,text:card.spotlightTextKm||t("feedSpotlightEmpty")};
  if(card.id==="spotlight")return {...card,title:card.spotlightClass?`${classLabel(card.spotlightClass)} · ចំណុចវិទ្យាសាស្ត្រ`:"ចំណុចវិទ្យាសាស្ត្រជីវគីមី",text:card.spotlightClass?t("feedSpotlight").replace("{className}",classLabel(card.spotlightClass)):t("feedSpotlightEmpty")};
  if(card.id==="app-update")return {...card,title:"ព័ត៌មានកម្មវិធី និងមូលដ្ឋានទិន្នន័យ",text:t("feedAppUpdate").replace("{count}",card.entryCount)};
  return card;
}
function suggestionExplanation(s,user){
  if(language!=="km")return s.why;
  const classes=new Set((user?.scans||[]).flatMap(scan=>(scan.items||[]).map(item=>item.klass)));
  if((s.name==="Ceramide NP"&&(classes.has("Exfoliating acid (AHA)")||classes.has("Exfoliating acid (BHA)")||classes.has("Retinoid")))||
    (s.name==="Panthenol"&&(classes.has("Exfoliating acid (BHA)")||classes.has("Retinoid"))))return t("suggestionComplement");
  return t("suggestionFocus").replace("{className}",classLabel(s.className));
}
function currentUser(){return AuthManager.getCurrent();}
function showToast(message){const el=$("#toast");el.textContent=message;el.classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove("show"),2600);}
function applyLanguage(){
  document.documentElement.lang=language;
  $$("[data-i18n]").forEach(el=>{const key=el.dataset.i18n;if(translations[language][key])el.textContent=translations[language][key];});
  $$("[data-i18n-placeholder]").forEach(el=>{const key=el.dataset.i18nPlaceholder;if(translations[language][key])el.placeholder=translations[language][key];});
  $("#langToggle").textContent=language==="en"?"ខ្មែរ":"English";
  const active=$(".page.active"),page=active?.id.replace("page-","");
  $("#crumbCurrent").textContent=page==="tools"?"Molecule Tools":t(({recommendations:"forYouNav",bot:"profile",algorithms:"howWorks",settings:"settings",lab:"virtualLab",analyzer:"analyzer"})[page]||"analyzer");
  renderAll();
}
function switchPage(page){
  $$(".page").forEach(el=>el.classList.toggle("active",el.id==="page-"+page));
  $$(".nav [data-page]").forEach(el=>el.classList.toggle("active",el.dataset.page===page));
  $("#crumbCurrent").textContent=page==="tools"?"Molecule Tools":t(({recommendations:"forYouNav",bot:"profile",algorithms:"howWorks",settings:"settings",lab:"virtualLab",analyzer:"analyzer"})[page]||"analyzer");
  if(virtualLab)virtualLab.setActive(page==="lab");
  if(page==="recommendations")renderRecommendations();
  if(page==="bot")renderBot();
  if(page==="settings")renderSettings();
  window.scrollTo({top:0,behavior:"smooth"});
}
$$(".nav [data-page]").forEach(btn=>btn.addEventListener("click",()=>switchPage(btn.dataset.page)));
$$("[data-page-link]").forEach(btn=>btn.addEventListener("click",()=>switchPage(btn.dataset.pageLink)));
$("#langToggle").addEventListener("click",()=>{language=language==="en"?"km":"en";localStorage.setItem("molecule.language",language);applyLanguage();});
function avatarMarkup(value){return value&&value.startsWith("data:image/")?`<img src="${value}" alt="">`:escapeHtml(value||"🧬");}
function renderUser(){
  const u=currentUser(),name=u?.name||t("guest"),email=u?.email||t("demoMode");
  $("#sideName").textContent=name;$("#sideEmail").textContent=u?(u.email==="demo@molecule.local"?t("demoMode"):u.email):t("guestMode");
  $("#topName").textContent=name;$("#topAvatar").innerHTML=avatarMarkup(u?.bot?.avatar||"◉");$("#sideAvatar").innerHTML=avatarMarkup(u?.bot?.avatar||"◉");
  $("#profileDisplayName").textContent=name;$("#profileDisplayEmail").textContent=u?.email||t("guestMode");
  $("#accountAction").textContent=u?t("signOut"):t("signIn");
  renderSettings();
  renderNotifications();
}
function openModal(id){$("#"+id).classList.add("open");}
function closeModal(id){$("#"+id).classList.remove("open");}
$$("[data-close]").forEach(b=>b.addEventListener("click",()=>closeModal(b.dataset.close)));
$$(".modal-backdrop").forEach(b=>b.addEventListener("click",e=>{if(e.target===b)closeModal(b.id);}));
$("#profileTrigger").addEventListener("click",()=>$("#profileMenu").classList.toggle("open"));
$("#sideProfile").addEventListener("click",()=>$("#profileMenu").classList.toggle("open"));
document.addEventListener("click",e=>{if(!e.target.closest(".profile-wrap")&&!e.target.closest("#sideProfile"))$("#profileMenu").classList.remove("open");});
function showAuth(mode){
  authMode=mode||"signin";
  $("#authTitle").textContent=authMode==="signup"?t("signUp"):t("welcome");
  $("#signInTab").classList.toggle("active",authMode==="signin");
  $("#signUpTab").classList.toggle("active",authMode==="signup");
  $("#nameField").style.display=authMode==="signup"?"block":"none";
  $("#authConsentRow").hidden=authMode!=="signup";
  $("#authConsent").required=authMode==="signup";
  $("#resetPassword").hidden=authMode==="signup";
  $("#authSubmit").textContent=authMode==="signup"?t("signUp"):t("signIn");
  $("#authPassword").autocomplete=authMode==="signup"?"new-password":"current-password";
  $("#authPassword").minLength=8;
  const canAuthenticate=firebaseIsConfigured();
  $("#authSubmit").disabled=!canAuthenticate;
  $("#resetPassword").disabled=!canAuthenticate||authMode==="signup";
  $("#signInTab").disabled=!canAuthenticate;
  $("#signUpTab").disabled=!canAuthenticate;
  openModal("authModal");
}
$("#signInTab").addEventListener("click",()=>showAuth("signin"));$("#signUpTab").addEventListener("click",()=>showAuth("signup"));
$("#profileMenu").addEventListener("click",e=>{const action=e.target.closest("[data-profile-action]")?.dataset.profileAction;if(!action)return;$("#profileMenu").classList.remove("open");if(action==="auth")showAuth("signin");if(action==="signout")doSignOut();if(action==="bot"){switchPage("bot");openBotModal();}if(action==="profile")switchPage("bot");if(action==="settings")switchPage("settings");});
$("#accountAction").addEventListener("click",()=>currentUser()?doSignOut():showAuth("signin"));
async function doSignOut(){try{await AuthManager.signOut();lastAnalysis=null;renderAll();showToast(t("signedOutToast"));}catch(error){showToast(error.message||t("authError"));}}
$("#authForm").addEventListener("submit",async e=>{
  e.preventDefault();
  const email=$("#authEmail").value,password=$("#authPassword").value;
  try{
    if(authMode==="signup"){
      if(password.length<8)throw new Error(t("passwordHint"));
      if(!$("#authConsent").checked)throw new Error(t("consentRequired"));
      await AuthManager.signUp($("#authName").value,email,password);
      showToast(t("signedUp"));
    }else{
      await AuthManager.signIn(email,password);
      showToast(t("signedInToast"));
    }
    closeModal("authModal");$("#authForm").reset();renderAll();
  }catch(error){showToast(error.message||t("authError"));}
});
$("#resetPassword").addEventListener("click",async()=>{
  const email=$("#authEmail").value.trim();
  if(!email){$("#authEmail").focus();showToast("Enter your email address first.");return;}
  try{await sendPasswordReset(email);showToast(t("resetSent"));}
  catch(error){showToast(error.message||t("authError"));}
});
$("#demoLogin").addEventListener("click",async()=>{
  try{await AuthManager.ensureDemo();closeModal("authModal");renderAll();showToast(t("accountCreated"));}
  catch(error){showToast(error.message||t("authError"));}
});
function exampleText(){return "Water, Glycerin, Niacinamide, Panthenol, Ceramide NP, Squalane, Sodium Hyaluronate, Tocopherol, Allantoin";}
$("#demoScan").addEventListener("click",()=>{$("#productName").value=language==="km"?"ឧទាហរណ៍ ក្រែមផ្តល់សំណើម":"Example Barrier Moisturizer";$("#ingredientsInput").value=exampleText();$("#productType").value="skincare";$("#focusSelect").value=currentUser()?.focus||"barrier";showToast(t("demoLoaded"));});
function riskTag(caution){if(caution==="Low")return `<span class="tag">${t("riskLow")}</span>`;if(/high/i.test(caution))return `<span class="tag care">${t("riskHigh")}</span>`;return `<span class="tag warn">${t("riskModerate")}</span>`;}
function analyzeCurrent(){
  const text=$("#ingredientsInput").value;
  if(!text.trim()){lastAnalysis=null;$("#scanResult").innerHTML=`<div class="empty">${t("noIngredients")}</div>`;return;}
  const result=BioBotEngine.analyze(text),user=currentUser(),scan={id:Date.now(),product:$("#productName").value.trim()||t("unknownProduct"),type:$("#productType").value,focus:$("#focusSelect").value,items:result.items,at:new Date().toISOString()};
  lastAnalysis=scan;
  if(user){
    AuthManager.update(u=>{u.scans.unshift(scan);u.scans=u.scans.slice(0,40);u.focus=scan.focus;});
    if(AuthManager.getMode()==="firebase")saveUserScan(user.uid,scan).catch(error=>{console.error("Could not save product scan.",error);showToast("Scan analyzed, but could not be saved to your account.");});
  }
  const allergyTerms=(user?.details?.allergies||"").split(/[,;\n]+/).map(x=>x.trim()).filter(Boolean).map(x=>BioBotEngine.normalizeName(x).toLowerCase());
  const allergyMatches=result.items.filter(item=>allergyTerms.includes(item.name.toLowerCase()));
  const known=result.items.filter(x=>x.known).length;
  $("#scanResult").innerHTML=`<div class="result-top"><div><span class="tag">${t("analyzed")}</span><h2 style="margin:9px 0 2px">${escapeHtml(scan.product)}</h2><span style="font-size:11px;color:#75817b">${result.items.length} ${t("ingredientsCount")} · ${known} ${t("known")||"recognized"}</span></div><div class="score" title="Recognized compounds">${known}/${result.items.length}</div></div>${allergyMatches.length?`<div class="interaction-box" style="background:#fff0ee;color:#843c37"><b>${t("allergyMatchTitle")}</b><br>${t("scanAllergyWarning")}<br><b>${allergyMatches.map(item=>escapeHtml(item.name)).join(", ")}</b></div>`:""}<div class="ingredient-list">${result.items.map((item,index)=>`<article class="ingredient"><div><h3>${escapeHtml(item.name)}${item.known?"":` <span class="tag" style="vertical-align:middle">${t("unknown")}</span>`}<small>${escapeHtml(item.klass)}</small></h3></div><div>${riskTag(item.caution)}<button class="button ghost small save-ingredient" data-name="${escapeHtml(item.name)}" style="display:block;margin-left:auto" ${user?"":"title=\""+t("signInRequired")+"\""}>${user&&user.saved.includes(item.name)?t("removeIngredient"):"＋ "+t("saveIngredient")}</button></div><p class="ingredient-more"><b>${t("howTheyWork")}:</b> ${escapeHtml(item.mechanism)}<br><b>${t("pH")}:</b> ${escapeHtml(item.ph)} · <b>${t("solubility")}:</b> ${escapeHtml(item.solubility)}<br><b>${t("practical")}:</b> ${escapeHtml(item.advice)}</p></article>`).join("")}</div><div class="section-title" style="margin:18px 0 8px"><div><h2>${t("interaction")}</h2></div></div>${result.interactions.map(n=>`<div class="interaction-box" style="${n.type==="caution"?"background:#fff0ee;color:#843c37":""}"><b>${escapeHtml(n.title)}</b><br>${escapeHtml(n.text)}</div>`).join("")}`;
  $$(".save-ingredient").forEach(btn=>btn.addEventListener("click",()=>toggleSaved(btn.dataset.name)));
  if(user)showToast(t("scanSaved"));renderUser();
}
$("#analyzeBtn").addEventListener("click",analyzeCurrent);
function toggleSaved(name){if(!currentUser()){showToast(t("signInRequired"));showAuth("signin");return;}AuthManager.update(u=>{const i=u.saved.indexOf(name);if(i<0)u.saved.push(name);else u.saved.splice(i,1);});renderAll();$$(".save-ingredient").forEach(btn=>{if(btn.dataset.name===name)btn.textContent=currentUser().saved.includes(name)?t("removeIngredient"):"＋ "+t("saveIngredient");});showToast(t(currentUser().saved.includes(name)?"saved":"unsaved"));}
function renderRecommendations(){
  const user=currentUser(),analysis=BioRecommender.compute(user);
  const focusKeys={barrier:"focusBarrier",hydration:"focusHydration",brightening:"focusBrightening",acne:"focusAcne",sensitive:"focusSensitive"};
  $("#statScans").textContent=user?.scans?.length||"0";$("#statSaved").textContent=user?.saved?.length||"0";$("#statFocus").textContent=user?t(focusKeys[user.focus]||"focusBarrier"):"—";
  const profileNote=analysis.profileNote==="young"?`<div class="interaction-box" style="grid-column:1/-1">${t("youngProfileNote")}</div>`:analysis.profileNote==="sensitive"?`<div class="interaction-box" style="grid-column:1/-1">${t("sensitiveProfileNote")}</div>`:"";
  $("#suggestionCards").innerHTML=profileNote+(analysis.suggestions.length?analysis.suggestions.map(s=>`<article class="card feed-card"><span class="feed-icon">✦</span><h3>${escapeHtml(s.name)} <span class="tag">${escapeHtml(classLabel(s.className))}</span></h3><p>${escapeHtml(suggestionExplanation(s,user))}</p><div class="feed-foot"><span class="notice">${t("ruleScore")} ${s.score} · ${t("exploratory")}</span><button class="button secondary small explore-ingredient" data-name="${escapeHtml(s.name)}">${t("recommendation")}</button></div></article>`).join(""):`<article class="card empty" style="grid-column:1/-1">${user?t("noSuggestions"):t("signInRequired")}</article>`);
  $$(".explore-ingredient").forEach(btn=>btn.addEventListener("click",()=>{const item=BioBotEngine.find(btn.dataset.name);if(!item)return;$("#productName").value=item.name;$("#ingredientsInput").value=item.name;switchPage("analyzer");analyzeCurrent();}));
  $("#feedCards").innerHTML=analysis.feed.map(rawCard=>{const card=localizedFeedCard(rawCard);return `<article class="card feed-card"><span class="feed-icon">${card.icon}</span><div style="display:flex;align-items:center;gap:7px"><span class="tag ${card.kind==="alert"?"warn":""}">${card.kind==="alert"?t("formulaAlert"):card.kind==="spotlight"?t("biochemistrySpotlight"):t("appUpdate")}</span>${card.unread?`<span class="badge new">${language==="km"?"ថ្មី":"NEW"}</span>`:""}</div><h3 style="margin-top:11px">${escapeHtml(card.title)}</h3><p>${escapeHtml(card.text)}</p><div class="feed-foot"><span class="notice">${card.unread?t("unread")||"Unread":" "}</span>${card.id==="spotlight"?`<button class="button ghost small" data-page-link="algorithms">${t("howTheyWork")} →</button>`:""}</div></article>`;}).join("");
  $$("[data-page-link]").forEach(btn=>btn.addEventListener("click",()=>switchPage(btn.dataset.pageLink)));
  const unread=analysis.feed.filter(x=>x.unread).length;$("#navUnread").textContent=unread;$("#navUnread").style.display=unread?"inline-grid":"none";
}
$("#markRead").addEventListener("click",()=>{if(currentUser())AuthManager.update(u=>{u.readUpdates=["formula-alert","spotlight","app-update"];});renderRecommendations();renderNotifications();showToast(t("readDone"));});
$("#profileFocus").addEventListener("change",e=>{if(!currentUser()){showToast(t("signInRequired"));return;}AuthManager.update(u=>u.focus=e.target.value);renderRecommendations();showToast(t("focusUpdated"));});
function renderBot(){
  const bot=BotProfile.current();$("#botDisplayName").textContent=bot.name;$("#chatName").textContent=bot.name;$("#botDisplayTone").textContent=t(bot.tone==="academic"?"academicTone":"friendlyTone");
  if($("#askLabBot"))$("#askLabBot").textContent=t("askLabBot").replace("{botName}",bot.name);
  $("#botBigAvatar").innerHTML=avatarMarkup(bot.avatar);$("#chatAvatar").innerHTML=avatarMarkup(bot.avatar);
  const u=currentUser();$("#profileFocus").value=u?.focus||"barrier";$("#savedListText").textContent=u?.saved?.length?u.saved.join(", "):t("nothingSaved");
}
function openBotModal(){
  const bot=BotProfile.current();$("#botNameInput").value=bot.name;$("#botTone").value=bot.tone;$("#avatarUpload").value="";
  $("#avatarOptions").innerHTML=BotProfile.presets.map(p=>`<button type="button" class="avatar-choice ${p===bot.avatar?"selected":""}" data-avatar="${p}" aria-label="Choose ${p}">${p}</button>`).join("");
  $$(".avatar-choice").forEach(btn=>btn.addEventListener("click",()=>{$$(".avatar-choice").forEach(x=>x.classList.toggle("selected",x===btn));$("#avatarUpload").value="";}));
  openModal("botModal");
}
$("#customizeBotBtn").addEventListener("click",()=>currentUser()?openBotModal():(showToast(t("signInRequired")),showAuth("signin")));
$("#editBotBtn").addEventListener("click",()=>currentUser()?openBotModal():(showToast(t("signInRequired")),showAuth("signin")));
$("#botForm").addEventListener("submit",e=>{e.preventDefault();if(!currentUser()){closeModal("botModal");showAuth("signin");return;}const selected=$(".avatar-choice.selected")?.dataset.avatar||BotProfile.current().avatar;BotProfile.save({name:$("#botNameInput").value.trim()||"BioBot",avatar:selected,tone:$("#botTone").value});closeModal("botModal");renderBot();renderUser();showToast(t("savedBot"));});
$("#avatarUpload").addEventListener("change",e=>{const file=e.target.files?.[0];if(!file)return;if(file.size>5*1024*1024){e.target.value="";showToast(t("imageTooLarge"));return;}if(!file.type.startsWith("image/")){e.target.value="";showToast(t("uploadError"));return;}const reader=new FileReader();reader.onerror=()=>showToast(t("uploadError"));reader.onload=()=>{const img=new Image();img.onerror=()=>showToast(t("uploadError"));img.onload=()=>{const canvas=document.createElement("canvas"),size=160;canvas.width=size;canvas.height=size;const ctx=canvas.getContext("2d");const scale=Math.max(size/img.width,size/img.height),w=img.width*scale,h=img.height*scale;ctx.drawImage(img,(size-w)/2,(size-h)/2,w,h);try{const thumb=canvas.toDataURL("image/jpeg",.78);BotProfile.save({avatar:thumb});$$(".avatar-choice").forEach(x=>x.classList.remove("selected"));$("#botBigAvatar").innerHTML=avatarMarkup(thumb);$("#chatAvatar").innerHTML=avatarMarkup(thumb);$("#topAvatar").innerHTML=avatarMarkup(thumb);$("#sideAvatar").innerHTML=avatarMarkup(thumb);}catch(error){showToast(t("uploadError"));}};img.src=reader.result;};reader.readAsDataURL(file);});
function addBubble(text,who,mediaUrl="",mediaAlt=""){
  const el=document.createElement("div");el.className="bubble "+who;el.textContent=text;
  if(mediaUrl){
    const image=document.createElement("img");image.className="chat-structure";image.src=mediaUrl;image.alt=mediaAlt;
    image.addEventListener("error",()=>{const note=document.createElement("small");note.textContent=t("structureLoadFailed");el.appendChild(note);image.remove();});
    el.appendChild(image);
  }
  $("#chatMessages").appendChild(el);$("#chatMessages").scrollTop=$("#chatMessages").scrollHeight;return el;
}
if(!$("#chatMessages").children.length)addBubble(t("welcomeBot"),"bot");
function recordChemTopic(topicKey){
  if(!/^(?:chemical|unknown|object|concept|compare|lab|scan|context|local|api|fallback):/.test(topicKey)||!currentUser())return;
  AuthManager.update(user=>{user.chemTopicHistory=[...(user.chemTopicHistory||[]),topicKey].slice(-30);});
  renderRecommendations();renderNotifications();
}
function renderBotFollowUps(bubble,result){
  if(!result.topicKey)return;
  const kind=result.topicKey.split(":",1)[0];
  const aspects=kind==="chemical"
    ?["mechanism","exposure","related","limits"]
    :kind==="object"?["components","exposure"]
    :kind==="concept"?["mechanism","limits"]
    :kind==="lab"?["lab"]:[];
  if(!aspects.length)return;
  const actions=document.createElement("div");
  actions.className="chat-followups";
  for(const aspect of aspects){
    const button=document.createElement("button");
    button.type="button";
    button.textContent=t(`followupChip${aspect[0].toUpperCase()}${aspect.slice(1)}`);
    button.addEventListener("click",()=>sendChat(button.textContent,null,{topicKey:result.topicKey,aspect}));
    actions.appendChild(button);
  }
  const source=document.createElement("small");
  source.className="chat-source";
  if(result.sourceUrl){
    try{
      const sourceUrl=new URL(result.sourceUrl);
      if(sourceUrl.protocol==="https:"&&["pubchem.ncbi.nlm.nih.gov","en.wikipedia.org","km.wikipedia.org"].includes(sourceUrl.hostname)){
        const link=document.createElement("a");
        link.href=sourceUrl.href;link.target="_blank";link.rel="noopener noreferrer";
        link.textContent=sourceUrl.hostname.includes("wikipedia.org")?"Wikipedia":t("sourcePubChem");
        source.appendChild(link);
      }else source.textContent=t("sourceLocalGuide");
    }catch(error){
      console.error("BioBot returned an invalid source URL.",error);
      source.textContent=t("sourceLocalGuide");
    }
  }else source.textContent=t("sourceLocalGuide");
  bubble.append(source,actions);
}
/* Records this turn in volatile memory and supplies the current scan and molecule for contextual follow-ups. */
async function sendChat(question,labContext=null,followUp=null,toolContext=null){
  const message=String(question||"").trim();if(!message)return;
  LOGIC_ENGINE.rememberConversationMessage("user",message);
  const chatContext={
    scan:lastAnalysis||currentUser()?.scans?.[0]||null,
    activeMolecule:STATE_MANAGER.molecule,
    recentMessages:STATE_MANAGER.recentMessages,
    context:STATE_MANAGER.context
  };
  addBubble(message,"user");const pending=addBubble(t("chatThinking"),"bot");
  try{
    const result=await BioBotBrain.answer(message,labContext,followUp,toolContext,chatContext);
    pending.remove();
    const reply=addBubble(result.text,"bot",result.imageUrl||"",result.imageAlt||"");
    renderBotFollowUps(reply,result);
    LOGIC_ENGINE.rememberConversationMessage("assistant",result.text);
    if(result.topicKey)recordChemTopic(result.topicKey);
  }catch(error){
    pending.textContent=t("chatAnswerFailed");
    LOGIC_ENGINE.rememberConversationMessage("assistant",pending.textContent);
    console.error("BioBot could not answer the question.",error);
  }
}
document.addEventListener("molecule:ask-bot",event=>{
  const details=event.detail;
  const prompt=details?.prompt;
  if(typeof prompt!=="string"||!prompt.trim())return;
  switchPage("bot");
  sendChat(prompt,null,null,details);
});
$("#chatForm").addEventListener("submit",e=>{e.preventDefault();const input=$("#chatInput"),question=input.value.trim();input.value="";sendChat(question);});
$("#chatSuggestions").addEventListener("click",event=>{const button=event.target.closest("[data-chat-prompt]");if(button)sendChat(button.dataset.chatPrompt);});
function askAboutLab(snapshot){
  switchPage("bot");
  const values={contents:snapshot.contents.join(", ")||t("labNothingSelected"),type:snapshot.reactionType,
    equation:snapshot.equation,pH:Number(snapshot.pH).toFixed(1),temperature:Number(snapshot.temperature).toFixed(1),
    pressure:Number(snapshot.pressureAtm).toFixed(2),
    limiting:snapshot.limitingReagent,yield:snapshot.theoreticalYield,hazard:snapshot.hazard||""};
  const context=t("labContextAnswer").replace(/\{(\w+)\}/g,(match,key)=>values[key]??match);
  sendChat(`${t("botLabPrompt")}\n${context}`,snapshot);
}
function renderAll(){
  renderUser();renderBot();renderRecommendations();virtualLab?.refresh();
  const summary=$("#knowledgeCatalogSummary");
  if(summary)summary.textContent=t("knowledgeCatalogSummary").replace("{count}",BioBotEngine.entries.length);
}
function renderSettings(){
  const u=currentUser(),profile=u||{details:{},notifications:{}},details=profile.details||{},prefs=profile.notifications||{};
  if(!$("#profileSettingsForm"))return;
  $("#ageRange").value=details.ageRange||"prefer-not";
  $("#gender").value=details.gender||"prefer-not";
  $("#genderSelfDescribe").hidden=$("#gender").value!=="self-describe";
  $("#genderSelfDescribe").value=details.genderSelfDescribe||"";
  $("#skinType").value=details.skinType||"unsure";
  $("#profileFocusSettings").value=profile.focus||"barrier";
  $$('input[name="concerns"]').forEach(input=>input.checked=(details.concerns||[]).includes(input.value));
  $("#allergyNotes").value=details.allergies||"";
  $("#healthDataConsent").checked=details.healthDataConsent===true;
  $("#emailNotifications").checked=prefs.email===true;
  $("#emailStatus").textContent=prefs.email?t("emailOn"):t("emailOff");
  const isFirebase=AuthManager.getMode()==="firebase";
  $("#pushToggle").textContent=prefs.push?t("disablePush"):t("enablePush");
  $("#pushStatus").textContent=prefs.push?t("pushEnabled"):t("pushNotEnabled");
  $("#pushToggle").disabled=!isFirebase;
  $("#emailNotifications").disabled=!isFirebase;
  $("#backendStatus").textContent=firebaseIsConfigured()?t("firebaseReady"):firebaseInitializationError?t("firebaseError"):t("firebaseMissing");
  $("#emailVerificationStatus").textContent=!isFirebase?t("signedInForSettings"):u.emailVerified?t("emailVerified"):t("emailNotVerified");
  $("#resendVerification").disabled=!isFirebase||u.emailVerified;
  $("#refreshVerification").disabled=!isFirebase;
  $("#exportDataButton").disabled=!u;
  $("#deleteAccountButton").disabled=!u;
}

function renderNotifications(){
  const list=$("#notificationList");
  if(!list)return;
  const user=currentUser(),remoteItems=activeNotifications||[];
  const localItems=user?BioRecommender.compute(user).feed.map(rawItem=>{
    const item=localizedFeedCard(rawItem);
    return {id:`local-${item.id}`,source:"local",title:item.title,body:item.text,
      readAt:(user.readUpdates||[]).includes(item.id)?new Date(0):null};
  }):[];
  const items=[...remoteItems.map(item=>({...item,source:"remote"})),...localItems];
  const unread=items.filter(item=>!item.readAt).length;
  $("#notificationCount").hidden=unread===0;
  $("#notificationCount").setAttribute("aria-label",unread?`${unread} unread notifications`:"Notifications");
  list.innerHTML=items.length?items.map(item=>{
    const time=item.createdAt?.toDate?item.createdAt.toDate():item.createdAt?new Date(item.createdAt):null;
    const link=item.url&&isSafeInternalUrl(item.url)?`<a class="button ghost small" href="${escapeHtml(item.url)}">${t("openUpdate")}</a>`:"";
    return `<article class="notification-item ${item.readAt?"":"unread"}" data-notification-id="${escapeHtml(item.id)}"><h3>${escapeHtml(item.title||"molecule update")}</h3><p>${escapeHtml(item.body||"")}</p><small>${time&&!Number.isNaN(time.getTime())?escapeHtml(time.toLocaleString(language==="km"?"km-KH":"en")):""}</small>${link}${!item.readAt?`<button class="button ghost small notification-read" data-id="${escapeHtml(item.id)}" data-source="${item.source}">${t("markAsRead")}</button>`:""}</article>`;
  }).join(""):`<div class="empty">${t("noNotifications")}</div>`;
  $("#notificationCount").hidden=unread===0||!user;
}

$("#notificationsButton").addEventListener("click",()=>{renderNotifications();openModal("notificationsModal");});
$("#notificationList").addEventListener("click",async event=>{
  const button=event.target.closest(".notification-read");
  if(!button)return;
  const id=button.dataset.id,user=currentUser();
  try{
    if(button.dataset.source==="remote"&&AuthManager.getMode()==="firebase")await markNotificationRead(user.uid,id);
    else if(user){const item=activeNotifications.find(entry=>entry.id===id);if(item)item.readAt=new Date().toISOString();const localId=id.replace(/^local-/,"");AuthManager.update(profile=>{profile.readUpdates=[...new Set([...(profile.readUpdates||[]),localId])];profile.notificationsList=activeNotifications;});}
    renderRecommendations();renderNotifications();
  }catch(error){showToast(error.message||"Could not mark notification as read.");}
});
$("#profileSettingsForm").addEventListener("submit",event=>{
  event.preventDefault();
  let concerns=$$('input[name="concerns"]:checked').map(input=>input.value),allergies=$("#allergyNotes").value.trim();
  const healthDataConsent=$("#healthDataConsent").checked;
  if((concerns.length||allergies)&&!healthDataConsent){
    if(currentUser()?.details?.healthDataConsent){
      if(!window.confirm(t("clearHealthDataConfirm"))){$("#healthDataConsent").checked=true;return;}
      concerns=[];allergies="";$$('input[name="concerns"]').forEach(input=>input.checked=false);$("#allergyNotes").value="";
    }else{showToast(t("consentRequired"));return;}
  }
  if(!currentUser()){showToast(t("signInRequired"));showAuth("signin");return;}
  const details={
    ageRange:$("#ageRange").value,gender:$("#gender").value,
    genderSelfDescribe:$("#gender").value==="self-describe"?$("#genderSelfDescribe").value.trim():"",
    skinType:$("#skinType").value,concerns:healthDataConsent?concerns:[],
    allergies:healthDataConsent?allergies:"",healthDataConsent
  };
  AuthManager.update(user=>{user.details=details;user.focus=$("#profileFocusSettings").value;});
  $("#profileFocus").value=$("#profileFocusSettings").value;
  renderAll();showToast(t("profileSaved"));
});
$("#gender").addEventListener("change",()=>{$("#genderSelfDescribe").hidden=$("#gender").value!=="self-describe";});
$("#emailNotifications").addEventListener("change",event=>{
  const user=currentUser();
  if(!user||AuthManager.getMode()!=="firebase"){event.target.checked=false;showToast(t("configuredSignInRequired"));return;}
  if(event.target.checked&&!user.emailVerified){event.target.checked=false;showToast(t("verificationNeeded"));return;}
  AuthManager.update(profile=>{profile.notifications.email=event.target.checked;});
  $("#emailStatus").textContent=event.target.checked?t("emailOn"):t("emailOff");
});
$("#pushToggle").addEventListener("click",async()=>{
  const user=currentUser();
  if(!user||AuthManager.getMode()!=="firebase"){showToast(t("pushNeedsLogin"));return;}
  const enabling=!user.notifications?.push;
  try{
    if(enabling)await enableBrowserPush(user.uid);else await clearPushDevice(user.uid);
    AuthManager.update(profile=>{profile.notifications.push=enabling;});
    renderSettings();showToast(t(enabling?"pushEnabled":"pushDisabled"));
  }catch(error){showToast(error.message||"Could not update push notification settings.");}
});
$("#resendVerification").addEventListener("click",async()=>{
  try{await resendVerificationEmail();showToast(t("verificationSent"));}
  catch(error){showToast(error.message||"Could not send verification email.");}
});
$("#refreshVerification").addEventListener("click",async()=>{
  try{
    const verified=await refreshEmailVerification();
    if(currentUser())currentUser().emailVerified=verified;
    renderSettings();
    showToast(t(verified?"emailVerified":"emailNotVerified"));
  }catch(error){showToast(error.message||"Could not refresh email verification status.");}
});
$("#settingsLanguage").addEventListener("click",()=>$("#langToggle").click());
$("#settingsBot").addEventListener("click",()=>currentUser()?openBotModal():(showToast(t("signInRequired")),showAuth("signin")));
$("#exportDataButton").addEventListener("click",async()=>{
  const user=currentUser();if(!user)return;
  try{
    const data=AuthManager.getMode()==="firebase"?await exportAccountData(user.uid):{profile:user,scans:user.scans||[],notifications:user.notificationsList||[]};
    const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});
    const link=document.createElement("a");link.href=URL.createObjectURL(blob);link.download="molecule-account-export.json";link.click();URL.revokeObjectURL(link.href);showToast(t("exported"));
  }catch(error){showToast(error.message||"Could not export account data.");}
});
$("#deleteAccountButton").addEventListener("click",async()=>{
  const user=currentUser();if(!user||!window.confirm(t("deleteConfirm")))return;
  try{
    if(AuthManager.getMode()==="firebase")await requestAccountDeletion();
    else AuthManager.deleteDemoAccount();
    await AuthManager.signOut();renderAll();showToast(t("accountDeleted"));
  }catch(error){showToast(error.message||"Account deletion failed. Sign in again and retry.");}
});
$("#installAppButton").addEventListener("click",async()=>{
  if(!deferredInstallPrompt){showToast("Use your browser menu to install this site, if available.");return;}
  deferredInstallPrompt.prompt();await deferredInstallPrompt.userChoice;deferredInstallPrompt=null;
});
window.addEventListener("beforeinstallprompt",event=>{event.preventDefault();deferredInstallPrompt=event;});
window.addEventListener("appinstalled",()=>{deferredInstallPrompt=null;showToast("molecule was installed.");});

async function initializeApplication(){
  const result=await initializeFirebase();
  firebaseInitializationError=result.error;
  if(result.configured){
    observeAuth(user=>AuthManager.activateFirebaseUser(user).catch(error=>{console.error("Could not activate account.",error);showToast(t("profileLoadFailed"));}));
  }else if(result.error){console.error(t("firebaseError"),result.error);}
  if("serviceWorker" in navigator&&location.protocol!=="file:"){
    navigator.serviceWorker.register("./service-worker.js").catch(error=>console.error("Offline app support could not be registered.",error));
  }
  try{
    virtualLab=initializeVirtualLab({translate:t,onAskBot:askAboutLab});
  }catch(error){
    console.error("Virtual reaction lab could not initialize.",error);
    showToast(t("labInitError"));
  }
  initializeIngredientTools();
  applyLanguage();
  renderAll();
}
initializeApplication().catch(error=>{console.error("molecule failed to initialize.",error);showToast(t("firebaseError"));});

