/* Virtual-only reaction models. Hazardous mixtures never receive stoichiometry,
   product yields, or gas animations. Values not supported by the inputs are
   reported as not modeled rather than guessed. */
import { calculateCO2WithPython, SCIENCE_API_BASE_URL } from "./science-api-client.js";

const reagents = [
  {id:"water",name:"Water",formula:"H₂O",category:"Everyday & food",chemicalClass:"Solvent",molarMass:18.015,density:0.998,pKa:null,solubilityPhase:"aqueous",enthalpyFactor:null,hazardClass:"low"},
  {id:"glucose",name:"Glucose",formula:"C₆H₁₂O₆",category:"Everyday & food",chemicalClass:"Monosaccharide",molarMass:180.156,density:1.54,pKa:null,solubilityPhase:"aqueous",enthalpyFactor:null,hazardClass:"low"},
  {id:"starch",name:"Starch solution",formula:"(C₆H₁₀O₅)ₙ",category:"Everyday & food",chemicalClass:"Polysaccharide colloid",molarMass:null,density:null,pKa:null,solubilityPhase:"aqueous",enthalpyFactor:null,hazardClass:"low"},
  {id:"iodine",name:"Iodine tincture / solution",formula:"I₂ (formulation varies)",category:"Everyday & food",chemicalClass:"Halogen / indicator",molarMass:253.809,density:null,pKa:null,solubilityPhase:"mixed",enthalpyFactor:null,hazardClass:"irritant"},
  {id:"ascorbic-acid",name:"Ascorbic acid (Vitamin C)",formula:"C₆H₈O₆",category:"Everyday & food",chemicalClass:"Antioxidant / weak acid",molarMass:176.124,density:1.65,pKa:4.10,solubilityPhase:"aqueous",enthalpyFactor:null,hazardClass:"low"},
  {id:"hydrogen-peroxide",name:"Hydrogen peroxide",formula:"H₂O₂ (solution strength varies)",category:"Everyday & food",chemicalClass:"Oxidizer",molarMass:34.014,density:null,pKa:11.62,solubilityPhase:"aqueous",enthalpyFactor:null,hazardClass:"oxidizer"},
  {id:"catalase",name:"Catalase (potato/liver extract)",formula:"Protein mixture",category:"Everyday & food",chemicalClass:"Enzyme",molarMass:null,density:null,pKa:null,solubilityPhase:"aqueous",enthalpyFactor:null,hazardClass:"biological mixture"},
  {id:"indicator",name:"Universal indicator / anthocyanin",formula:"Mixture",category:"Everyday & food",chemicalClass:"pH-sensitive dye mixture",molarMass:null,density:null,pKa:null,solubilityPhase:"aqueous",enthalpyFactor:null,hazardClass:"low"},
  {id:"vegetable-oil",name:"Vegetable oil (triglycerides)",formula:"Mixture; fatty-acid profile varies",category:"Everyday & food",chemicalClass:"Lipid mixture",molarMass:null,density:0.92,pKa:null,solubilityPhase:"lipid",enthalpyFactor:null,hazardClass:"low"},
  {id:"soy-lecithin",name:"Soy lecithin",formula:"Phospholipid mixture",category:"Everyday & food",chemicalClass:"Amphiphilic emulsifier",molarMass:null,density:null,pKa:null,solubilityPhase:"amphiphilic",enthalpyFactor:null,hazardClass:"allergen note"},
  {id:"ethanol",name:"Ethanol",formula:"C₂H₆O",category:"Everyday & household",chemicalClass:"Volatile alcohol / solvent",molarMass:46.069,density:0.789,pKa:15.9,solubilityPhase:"aqueous",enthalpyFactor:null,hazardClass:"flammable"},
  {id:"sodium-bicarbonate",name:"Sodium bicarbonate (baking soda)",formula:"NaHCO₃",category:"Everyday & food",chemicalClass:"Bicarbonate base",molarMass:84.007,density:2.20,pKa:10.33,solubilityPhase:"aqueous",enthalpyFactor:null,hazardClass:"low"},
  {id:"acetic-acid",name:"Acetic acid / vinegar",formula:"CH₃COOH (vinegar concentration varies)",category:"Everyday & food",chemicalClass:"Weak acid",molarMass:60.052,density:1.049,pKa:4.76,solubilityPhase:"aqueous",enthalpyFactor:null,hazardClass:"irritant"},
  {id:"citric-acid",name:"Citric acid",formula:"C₆H₈O₇",category:"Everyday & food",chemicalClass:"Triprotic organic acid",molarMass:192.124,density:1.665,pKa:3.13,solubilityPhase:"aqueous",enthalpyFactor:null,hazardClass:"irritant"},
  {id:"bleach",name:"Sodium hypochlorite (bleach)",formula:"NaClO (product concentration varies)",category:"Household",chemicalClass:"Oxidizer / cleaner",molarMass:74.442,density:null,pKa:7.53,solubilityPhase:"aqueous",enthalpyFactor:null,hazardClass:"corrosive / oxidizer"},
  {id:"ammonia",name:"Ammonia",formula:"NH₃ (product concentration varies)",category:"Household",chemicalClass:"Weak base / cleaner",molarMass:17.031,density:null,pKa:9.25,solubilityPhase:"aqueous",enthalpyFactor:null,hazardClass:"toxic / irritant"},
  {id:"sodium-hydroxide",name:"Sodium hydroxide",formula:"NaOH",category:"Household",chemicalClass:"Strong base",molarMass:39.997,density:2.13,pKa:null,solubilityPhase:"aqueous",enthalpyFactor:null,hazardClass:"corrosive"},
  {id:"hydrochloric-acid",name:"Hydrochloric acid",formula:"HCl (solution concentration varies)",category:"Household",chemicalClass:"Strong acid",molarMass:36.461,density:null,pKa:-6.3,solubilityPhase:"aqueous",enthalpyFactor:null,hazardClass:"corrosive"},
  {id:"acetone",name:"Acetone",formula:"C₃H₆O",category:"Household & stationery",chemicalClass:"Volatile ketone solvent",molarMass:58.080,density:0.785,pKa:19.2,solubilityPhase:"aqueous",enthalpyFactor:null,hazardClass:"flammable / inhalation"},
  {id:"isopropyl-alcohol",name:"Isopropyl alcohol",formula:"C₃H₈O",category:"Household",chemicalClass:"Volatile alcohol / solvent",molarMass:60.096,density:0.785,pKa:17.1,solubilityPhase:"aqueous",enthalpyFactor:null,hazardClass:"flammable / inhalation"},
  {id:"xylene",name:"Xylene",formula:"C₈H₁₀ (isomer mixture)",category:"Stationery & household",chemicalClass:"Aromatic solvent",molarMass:106.165,density:0.86,pKa:null,solubilityPhase:"lipid",enthalpyFactor:null,hazardClass:"flammable / inhalation"},
  {id:"toluene",name:"Toluene",formula:"C₇H₈",category:"Stationery & household",chemicalClass:"Aromatic solvent",molarMass:92.141,density:0.867,pKa:null,solubilityPhase:"lipid",enthalpyFactor:null,hazardClass:"flammable / inhalation"},
  {id:"naphtha",name:"Naphtha",formula:"Variable petroleum mixture",category:"Stationery & household",chemicalClass:"Hydrocarbon solvent mixture",molarMass:null,density:null,pKa:null,solubilityPhase:"lipid",enthalpyFactor:null,hazardClass:"flammable / inhalation"},
  {id:"methylcyclohexane",name:"Methylcyclohexane",formula:"C₇H₁₄",category:"Stationery & household",chemicalClass:"Volatile hydrocarbon solvent",molarMass:98.189,density:0.77,pKa:null,solubilityPhase:"lipid",enthalpyFactor:null,hazardClass:"flammable / inhalation"},
  {id:"pva-glue",name:"Polyvinyl acetate (PVA glue)",formula:"(C₄H₆O₂)ₙ; glue is a formulation",category:"Stationery & household",chemicalClass:"Polymer dispersion",molarMass:null,density:null,pKa:null,solubilityPhase:"aqueous dispersion",enthalpyFactor:null,hazardClass:"product-specific"},
  {id:"salicylic-acid",name:"Salicylic acid",formula:"C₇H₆O₃",category:"Personal care",chemicalClass:"Aromatic weak acid",molarMass:138.121,density:1.44,pKa:2.97,solubilityPhase:"mixed",enthalpyFactor:null,hazardClass:"irritant"},
  {id:"sodium-lauryl-sulfate",name:"Sodium lauryl sulfate",formula:"C₁₂H₂₅NaO₄S",category:"Household & personal care",chemicalClass:"Anionic surfactant",molarMass:288.38,density:null,pKa:null,solubilityPhase:"amphiphilic",enthalpyFactor:null,hazardClass:"irritant"},
  {id:"niacinamide",name:"Niacinamide",formula:"C₆H₆N₂O",category:"Personal care",chemicalClass:"Vitamin B₃ amide",molarMass:122.124,density:1.40,pKa:null,solubilityPhase:"aqueous",enthalpyFactor:null,hazardClass:"low"},
  {id:"retinol",name:"Retinol",formula:"C₂₀H₃₀O",category:"Personal care",chemicalClass:"Retinoid",molarMass:286.452,density:null,pKa:null,solubilityPhase:"lipid",enthalpyFactor:null,hazardClass:"irritant / light-sensitive"},
  {id:"titanium-dioxide",name:"Titanium dioxide",formula:"TiO₂",category:"Personal care & pigments",chemicalClass:"Inorganic pigment / UV filter",molarMass:79.866,density:4.23,pKa:null,solubilityPhase:"solid dispersion",enthalpyFactor:null,hazardClass:"inhalation dust"}
];

const ChemReactionEngine = (() => {
  const R = 0.082057366;
  const has = (set, ...ids) => ids.every(id => set.has(id));
  function evaluate(input) {
    const selected = new Set(input.reagents);
    const base = {
      blocked:false, type:"No specific modeled reaction", equation:"—",
      summaryKey:"labNoRule", noteKey:"labNoRuleNote", limiting:"—",
      yieldText:"—", calculationText:"", color:"clear", bubbles:"", layers:false,
      emulsified:false, micelles:false, hazardKey:"", co2Moles:0
    };
    const bleach = selected.has("bleach");
    const acid = selected.has("acetic-acid") || selected.has("citric-acid") || selected.has("salicylic-acid") || selected.has("ascorbic-acid");
    if (bleach && (acid || selected.has("ammonia"))) {
      return {...base,blocked:true,type:"Hazard lockout",equation:"—",summaryKey:"labHazardBlocked",
        noteKey:selected.has("ammonia")?"labBleachAmmonia":"labBleachAcid",
        hazardKey:selected.has("ammonia")?"labBleachAmmonia":"labBleachAcid",
        color:"hazard",bubbles:""};
    }
    if (selected.has("hydrochloric-acid") && selected.has("sodium-hydroxide")) {
      return {...base,blocked:true,type:"Corrosive-mixture lockout",summaryKey:"labCorrosiveBlocked",
        noteKey:"labCorrosiveNote",hazardKey:"labCorrosiveNote",color:"hazard"};
    }
    const temperature = input.temperature, pH = input.pH;
    const pressureAtm=Number.isFinite(input.pressureAtm)&&input.pressureAtm>0?input.pressureAtm:1;
    if (has(selected,"sodium-bicarbonate","acetic-acid")) {
      const nBase=Math.max(0,input.bicarbonateMoles),nAcid=Math.max(0,input.aceticAcidMoles);
      const produced=Math.min(nBase,nAcid);
      const kelvin=temperature+273.15,volume=produced*R*kelvin;
      const gasVolume=volume/pressureAtm;
      const limiting=nBase<nAcid?"Sodium bicarbonate":nAcid<nBase?"Acetic acid":"Equal virtual amounts";
      return {...base,type:"Acid–base neutralization / gas evolution",
        equation:"NaHCO₃ + CH₃COOH → CH₃COONa + H₂O + CO₂",
        summaryKey:"labCo2Summary",noteKey:"labCo2Note",limiting,
        yieldText:`${produced.toPrecision(4)} mol CO₂ · ${gasVolume.toPrecision(4)} L ideal gas at ${pressureAtm.toFixed(2)} atm and ${temperature.toFixed(1)} °C`,
        calculationText:`n(CO₂) = min(${nBase.toPrecision(4)}, ${nAcid.toPrecision(4)}) = ${produced.toPrecision(4)} mol; V = nRT/P, T = ${kelvin.toFixed(2)} K.`,
        co2Moles:produced,bubbles:produced>0?"CO₂":"",color:selected.has("indicator")?"indicator":"clear"};
    }
    if (has(selected,"hydrogen-peroxide","catalase")) {
      const denatured=temperature>=55||pH<=3||pH>=11;
      return {...base,type:"Enzymatic catalysis",equation:"2 H₂O₂ → 2 H₂O + O₂  (catalase catalyst)",
        summaryKey:"labEnzymeSummary",noteKey:denatured?"labEnzymeInactive":"labEnzymeActive",
        bubbles:denatured?"":"O₂",color:selected.has("indicator")?"indicator":"clear"};
    }
    if (has(selected,"starch","iodine")) {
      const reduced=selected.has("ascorbic-acid");
      return {...base,type:"Complex formation / redox",equation:reduced
        ?"C₆H₈O₆ + I₂ → C₆H₆O₆ + 2 H⁺ + 2 I⁻  (starch–iodine color fades)"
        :"Starch + iodine → deep blue-black starch–iodine complex",
        summaryKey:reduced?"labRedoxReduced":"labRedoxBlue",noteKey:"labRedoxNote",
        color:reduced?"clear":"iodine"};
    }
    if (has(selected,"water","vegetable-oil")) {
      const emulsifier=selected.has("soy-lecithin")||selected.has("sodium-lauryl-sulfate");
      const emulsified=emulsifier&&input.stirred;
      return {...base,type:"Immiscible phases / emulsification",
        equation:emulsified?"No chemical equation — physical dispersion":"Water + oil → separate liquid phases",
        summaryKey:emulsified?"labEmulsionStable":"labEmulsionLayers",noteKey:"labEmulsionNote",
        layers:!emulsified,emulsified,micelles:emulsified,color:emulsified?"milky":"layers"};
    }
    if ((selected.has("salicylic-acid")||selected.has("ascorbic-acid"))&&
        (selected.has("retinol")||selected.has("niacinamide"))) {
      return {...base,type:"Formulation compatibility caution",equation:"No single balanced equation applies to a multi-ingredient cosmetic formula",
        summaryKey:"labSkincareCaution",noteKey:"labSkincareNote",color:selected.has("indicator")?"indicator":"clear"};
    }
    if (selected.has("hydrogen-peroxide")) {
      return {...base,type:"Oxidizer safety context",summaryKey:"labPeroxideContext",noteKey:"labPeroxideNote"};
    }
    return {...base,color:selected.has("indicator")?"indicator":"clear"};
  }
  function relativeRate(tempC) {
    const Rg=8.314, activationEnergy=40000, referenceK=298.15, actualK=tempC+273.15;
    return Math.exp((-activationEnergy/Rg)*(1/actualK-1/referenceK));
  }
  return {reagents,evaluate,relativeRate};
})();

function createLabCanvasRenderer(canvas) {
  const context=canvas.getContext("2d");
  if (!context) throw new Error("This browser cannot create a 2D laboratory canvas.");
  let state={vessel:"beaker",pH:7,color:"indicator",layers:false,emulsified:false,
    bubbles:"",rate:1,co2Moles:0,stirred:false,active:false};
  let animationId=0,activeRequested=false;
  const particles=Array.from({length:46},(_,index)=>({
    x:0.37+(index%8)*0.035,y:0.31+((index*17)%61)/100,
    radius:1.8+(index%4)*0.65,speed:0.035+(index%5)*0.014,phase:index*1.7
  }));
  const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
  function indicatorColor(ph) {
    const stops=[[0,239,83,74],[3,239,130,61],[5,240,198,70],[7,111,190,115],[9,65,167,174],[11,61,112,199],[14,129,91,185]];
    const p=clamp(ph,0,14);
    for(let i=0;i<stops.length-1;i++){
      const a=stops[i],b=stops[i+1];
      if(p<=b[0]){const k=(p-a[0])/(b[0]-a[0]);return `rgb(${Math.round(a[1]+(b[1]-a[1])*k)},${Math.round(a[2]+(b[2]-a[2])*k)},${Math.round(a[3]+(b[3]-a[3])*k)})`;}
    }
    return "rgb(129,91,185)";
  }
  function vesselPath(ctx,w,h,type) {
    ctx.beginPath();
    if(type==="dish"){
      ctx.ellipse(w*.5,h*.73,w*.28,h*.105,0,0,Math.PI*2);
      return;
    }
    if(type==="flask"){
      ctx.moveTo(w*.44,h*.12);ctx.lineTo(w*.56,h*.12);ctx.lineTo(w*.56,h*.39);
      ctx.lineTo(w*.73,h*.73);ctx.quadraticCurveTo(w*.76,h*.81,w*.66,h*.83);
      ctx.lineTo(w*.34,h*.83);ctx.quadraticCurveTo(w*.24,h*.81,w*.27,h*.73);
      ctx.lineTo(w*.44,h*.39);ctx.closePath();
      return;
    }
    ctx.moveTo(w*.34,h*.16);ctx.lineTo(w*.66,h*.16);ctx.lineTo(w*.66,h*.78);
    ctx.quadraticCurveTo(w*.66,h*.84,w*.60,h*.84);ctx.lineTo(w*.40,h*.84);
    ctx.quadraticCurveTo(w*.34,h*.84,w*.34,h*.78);ctx.closePath();
  }
  function draw(now) {
    const bounds=canvas.getBoundingClientRect(),dpr=Math.max(1,window.devicePixelRatio||1);
    if(!bounds.width||!bounds.height)return;
    const width=bounds.width,height=bounds.height;
    if(canvas.width!==Math.round(width*dpr)||canvas.height!==Math.round(height*dpr)){
      canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);
    }
    context.setTransform(dpr,0,0,dpr,0,0);
    const ctx=context;
    const background=ctx.createLinearGradient(0,0,width,height);
    background.addColorStop(0,"#ecf6f2");background.addColorStop(1,"#dbe9ed");
    ctx.fillStyle=background;ctx.fillRect(0,0,width,height);
    ctx.fillStyle="#ffffff80";
    for(let i=0;i<32;i++){const x=((i*79)%997)/997*width,y=((i*43)%389)/389*height;ctx.beginPath();ctx.arc(x,y,1.1,0,Math.PI*2);ctx.fill();}
    const time=now/1000,fluid=state.color==="iodine"?"#192d80":state.color==="clear"?"#dcefe9":state.color==="milky"?"#d8e6d9":state.color==="hazard"?"#c7ce88":indicatorColor(state.pH);
    const vessel=vesselPath.bind(null,ctx,width,height);
    if(state.vessel==="dish"){
      const x=width*.22,y=height*.53,rx=width*.28,ry=height*.105;
      const dishGrad=ctx.createLinearGradient(0,y-ry,0,y+ry);dishGrad.addColorStop(0,"#ffffffcc");dishGrad.addColorStop(1,"#b2c8ce70");
      ctx.fillStyle=dishGrad;ctx.beginPath();ctx.ellipse(width*.5,height*.73,rx,ry,0,0,Math.PI*2);ctx.fill();
      ctx.save();ctx.beginPath();ctx.ellipse(width*.5,height*.73,rx*.92,ry*.72,0,0,Math.PI*2);ctx.clip();
      ctx.fillStyle=state.layers?"#82c7ddbd":`${fluid}b8`;ctx.fillRect(width*.22,height*.66,width*.56,height*.16);
      if(state.layers){ctx.fillStyle="#d5a45bcc";ctx.fillRect(width*.22,height*.66,width*.56,height*.055);}
      if(state.emulsified){ctx.fillStyle="#ffffff80";for(let i=0;i<36;i++){ctx.beginPath();ctx.arc(width*(.26+(i*29%470)/1000),height*(.68+(i*13%65)/500),2.3,0,Math.PI*2);ctx.fill();}}
      ctx.restore();ctx.strokeStyle="#ffffffdd";ctx.lineWidth=4;ctx.beginPath();ctx.ellipse(width*.5,height*.73,rx,ry,0,0,Math.PI*2);ctx.stroke();
    }else{
      ctx.save();vessel(state.vessel);const vesselGradient=ctx.createLinearGradient(width*.32,0,width*.68,0);
      vesselGradient.addColorStop(0,"#ffffff77");vesselGradient.addColorStop(.15,"#ffffff1d");vesselGradient.addColorStop(.84,"#ffffff35");vesselGradient.addColorStop(1,"#ffffff86");
      ctx.fillStyle=vesselGradient;ctx.fill();ctx.clip();
      const top=state.vessel==="flask"?height*.51:height*.42,amplitude=state.stirred?height*.018:height*.006;
      ctx.beginPath();ctx.moveTo(width*.24,height);
      for(let x=width*.24;x<=width*.76;x+=5){const wave=state.stirred?Math.sin(x*.045+time*3)*amplitude:Math.sin(x*.026+time*1.5)*amplitude;ctx.lineTo(x,top+wave);}
      ctx.lineTo(width*.76,height);ctx.closePath();
      ctx.fillStyle=state.layers?"#82c7ddbd":`${fluid}c9`;ctx.fill();
      if(state.layers){ctx.fillStyle="#d5a45bcc";ctx.fillRect(width*.25,top,width*.5,height*.055);}
      if(state.emulsified){ctx.fillStyle="#ffffff78";for(let i=0;i<45;i++){ctx.beginPath();ctx.arc(width*(.36+(i*31%270)/1000),height*(.48+(i*19%280)/420),2.1,0,Math.PI*2);ctx.fill();}}
      if(state.bubbles&&!state.layers&&!state.emulsified){
        const quantity=clamp(Math.round(5+state.rate*3+Math.log10(1+state.co2Moles*10000)*2),4,28);
        for(let i=0;i<quantity;i++){
          const particle=particles[i];particle.y-=particle.speed*state.rate*(state.stirred?1.7:1);
          if(particle.y<top/height+.02)particle.y=.78;
          const px=width*(.39+(i%7)*.035+Math.sin(time+particle.phase)*.008),py=height*particle.y;
          ctx.beginPath();ctx.arc(px,py,particle.radius,0,Math.PI*2);ctx.fillStyle="#ffffffa5";ctx.fill();
          ctx.strokeStyle="#ffffffdb";ctx.lineWidth=1;ctx.stroke();
        }
      }
      ctx.restore();
      ctx.save();vessel(state.vessel);ctx.strokeStyle="#ffffffde";ctx.lineWidth=5;ctx.stroke();ctx.restore();
      ctx.fillStyle="#ffffffa6";ctx.fillRect(width*.345,height*.22,width*.018,height*.48);
      ctx.fillRect(width*.637,height*.22,width*.012,height*.38);
    }
    ctx.fillStyle="#365b56";ctx.font="600 12px sans-serif";ctx.textAlign="center";
    ctx.fillText(state.bubbles?`virtual ${state.bubbles} bubbles · illustrative only`:state.layers?"two immiscible phases":state.emulsified?"dispersed emulsion":"virtual solution",width*.5,height*.95);
    animationId=requestAnimationFrame(draw);
  }
  function setState(next){state={...state,...next};}
  function setActive(active){
    activeRequested=active;state.active=active&&!document.hidden;
    if(state.active&&!animationId)animationId=requestAnimationFrame(draw);
    if(!state.active&&animationId){cancelAnimationFrame(animationId);animationId=0;}
  }
  const resizeObserver=new ResizeObserver(()=>{if(state.active){draw(performance.now());}});
  resizeObserver.observe(canvas);
  document.addEventListener("visibilitychange",()=>setActive(activeRequested));
  if(document.hidden)state.active=false;
  return {setState,setActive};
}

export function initializeVirtualLab({translate,onAskBot}) {
  const $=selector=>document.querySelector(selector);
  const canvas=$("#labCanvas");
  if(!canvas)return null;
  const renderer=createLabCanvasRenderer(canvas);
  let stirred=false,lastResult=null,remoteRequestId=0,remoteTimer=0,remoteController=null;
  function renderReagentOptions() {
    const groups=new Map();
    for(const reagent of reagents){
      if(!groups.has(reagent.category))groups.set(reagent.category,[]);
      groups.get(reagent.category).push(reagent);
    }
    $("#labReagentOptions").innerHTML=Array.from(groups.entries()).map(([category,items])=>
      `<div class="lab-reagent-group"><b>${category}</b>${items.map(item=>`<label title="${item.formula} · ${item.hazardClass}"><input type="checkbox" value="${item.id}" aria-label="${item.name}"><span>${item.name}</span><small>${item.formula}</small></label>`).join("")}</div>`
    ).join("");
  }
  function selectedReagents(){return Array.from($("#labReagentOptions").querySelectorAll('input[type="checkbox"]:checked')).map(input=>input.value);}
  function renderStoichiometry(result) {
    $("#labCalculation").textContent=result.calculationText||"";
    $("#labCalculation").hidden=!result.calculationText;
    $("#labLimitingReagent").textContent=result.limiting==="—"?translate("labNotApplicable"):translate("labLimiting").replace("{name}",result.limiting);
    $("#labYield").textContent=result.yieldText==="—"?translate("labYieldUnavailable"):result.yieldText;
  }
  function update() {
    const requestId=++remoteRequestId;
    window.clearTimeout(remoteTimer);
    remoteController?.abort();
    remoteController=null;
    const ids=selectedReagents(),temperature=Number($("#labTemperature").value),pH=Number($("#labPH").value),pressureAtm=Number($("#labPressure").value);
    const bicarbonateMoles=Number($("#labBicarbonateMoles").value)||0;
    const aceticAcidMoles=Number($("#labAceticAcidMoles").value)||0;
    const rate=ChemReactionEngine.relativeRate(temperature);
    const result=ChemReactionEngine.evaluate({reagents:ids,temperature,pH,stirred,
      bicarbonateMoles,aceticAcidMoles,pressureAtm});
    lastResult=result;
    const names=ids.map(id=>reagents.find(item=>item.id===id)?.name).filter(Boolean);
    $("#labTempReadout").value=temperature.toFixed(1);$("#labPhReadout").value=pH.toFixed(1);$("#labPressureReadout").value=pressureAtm.toFixed(2);
    $("#labRateReadout").value=`${rate.toFixed(2)}×`;
    $("#labSelectionSummary").textContent=names.length?names.join(" · "):translate("labNothingSelected");
    $("#labReactionType").textContent=translate(result.typeKey||result.type);
    $("#labReactionSummary").textContent=translate(result.summaryKey);
    $("#labEquation").textContent=result.equation;
    $("#labEquationNote").textContent=translate(result.noteKey);
    renderStoichiometry(result);
    const modelStatus=$("#labModelStatus");
    modelStatus.textContent=translate("labModelLocal");
    const hazard=$("#labHazard");
    hazard.hidden=!result.blocked;
    hazard.textContent=result.blocked?translate(result.hazardKey):"";
    $("#askLabBot").textContent=translate("askLabBot").replace("{botName}",document.querySelector("#botDisplayName")?.textContent||"BioBot");
    renderer.setState({vessel:$("#labVessel").value,pH,color:result.color,layers:result.layers,
      emulsified:result.emulsified,bubbles:result.bubbles,rate,co2Moles:result.co2Moles,stirred});
    if(!SCIENCE_API_BASE_URL||result.blocked||!ids.includes("sodium-bicarbonate")||!ids.includes("acetic-acid"))return;
    modelStatus.textContent=translate("labModelPending");
    remoteTimer=window.setTimeout(async()=>{
      const controller=new AbortController();
      remoteController=controller;
      let timedOut=false;
      const timeout=window.setTimeout(()=>{timedOut=true;controller.abort();},6000);
      try{
        const remote=await calculateCO2WithPython({
          bicarbonateMoles,aceticAcidMoles,temperature,pressureAtm
        },controller.signal);
        if(requestId!==remoteRequestId)return;
        lastResult={...result,limiting:remote.limiting_reagent,
          yieldText:`${remote.co2_moles.toPrecision(4)} mol CO₂ · ${remote.gas_volume_l.toPrecision(4)} L ideal gas at ${remote.pressure_atm.toFixed(2)} atm and ${temperature.toFixed(1)} °C`,
          calculationText:remote.calculation_steps.join(" ")};
        renderStoichiometry(lastResult);
        modelStatus.textContent=translate("labModelRemote");
      }catch(error){
        if(requestId!==remoteRequestId||(error.name==="AbortError"&&!timedOut))return;
        modelStatus.textContent=translate("labModelFallback");
        console.error("Python lab calculation unavailable; the local model remains visible.",error);
      }finally{
        window.clearTimeout(timeout);
        if(requestId===remoteRequestId)remoteController=null;
      }
    },250);
  }
  function selectPreset(name) {
    const presets={
      enzyme:{reagents:["hydrogen-peroxide","catalase","indicator"],pH:7,temp:60,vessel:"beaker"},
      redox:{reagents:["starch","iodine","ascorbic-acid"],pH:4,temp:25,vessel:"beaker"},
      emulsion:{reagents:["water","vegetable-oil","soy-lecithin"],pH:7,temp:25,vessel:"dish"},
      co2:{reagents:["sodium-bicarbonate","acetic-acid","indicator"],pH:5,temp:25,vessel:"flask"},
      "bleach-acid":{reagents:["bleach","acetic-acid"],pH:7,temp:25,vessel:"beaker"},
      "bleach-ammonia":{reagents:["bleach","ammonia"],pH:7,temp:25,vessel:"beaker"}
    };
    const preset=presets[name];if(!preset)return;
    $("#labReagentOptions").querySelectorAll('input[type="checkbox"]').forEach(input=>{input.checked=preset.reagents.includes(input.value);});
    $("#labTemperature").value=String(preset.temp);$("#labPH").value=String(preset.pH);
    $("#labVessel").value=preset.vessel;stirred=false;
    if(name==="co2"){ $("#labBicarbonateMoles").value="0.001";$("#labAceticAcidMoles").value="0.001";$("#labPressure").value="1.00"; }
    update();
  }
  renderReagentOptions();
  $("#labReagentOptions").addEventListener("change",()=>{stirred=false;update();});
  ["#labTemperature","#labPH","#labPressure","#labBicarbonateMoles","#labAceticAcidMoles","#labVessel"].forEach(selector=>$(selector).addEventListener("input",update));
  document.querySelectorAll("[data-lab-preset]").forEach(button=>button.addEventListener("click",()=>selectPreset(button.dataset.labPreset)));
  $("#labStir").addEventListener("click",()=>{stirred=true;update();});
  $("#labReset").addEventListener("click",()=>{ $("#labReagentOptions").querySelectorAll('input[type="checkbox"]').forEach(input=>{input.checked=false;});$("#labTemperature").value="25";$("#labPH").value="7";$("#labPressure").value="1.00";$("#labVessel").value="beaker";$("#labBicarbonateMoles").value="0.001";$("#labAceticAcidMoles").value="0.001";stirred=false;update();});
  $("#askLabBot").addEventListener("click",()=>{
    if(!lastResult)return;
    const ids=selectedReagents(),contents=ids.map(id=>reagents.find(item=>item.id===id)?.name).filter(Boolean);
    onAskBot({contents,temperature:Number($("#labTemperature").value),pH:Number($("#labPH").value),pressureAtm:Number($("#labPressure").value),
      reactionType:lastResult.type,equation:lastResult.blocked?"Not calculated for safety":lastResult.equation,
      limitingReagent:lastResult.blocked?"Not calculated":lastResult.limiting,
      theoreticalYield:lastResult.blocked?"Not calculated":lastResult.yieldText,
      hazard:lastResult.blocked?translate(lastResult.hazardKey):""});
  });
  update();
  return {setActive:renderer.setActive,refresh:update,engine:ChemReactionEngine};
}
