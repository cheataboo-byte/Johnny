import { bioConcepts, everydayObjects, extendedEntries, ChemicalResolver } from "./bio-knowledge.js";

/* DATA_STORE: curated educational facts, matching names, interaction rules, and quiz content. */
export const DATA_STORE = {
  compounds: extendedEntries,
  concepts: bioConcepts,
  productGuides: everydayObjects,
  mechanisms: [
    { key: "protein-folding", triggers: ["protein folding", "protein structure"], en: "A protein's amino-acid sequence and its environment shape its three-dimensional fold. Folding is stabilized by many interactions, including hydrogen bonds, ionic interactions, hydrophobic packing, and sometimes disulfide bonds. A protein's function depends on its structure, but folding is dynamic and context-dependent." },
    { key: "receptor-binding", triggers: ["receptor binding", "ligand binding", "how receptors work"], en: "A ligand binds a receptor through complementary shape and chemical interactions, often reversibly. Binding can change receptor activity or signaling, but affinity alone does not determine the size of a biological response; receptor abundance, cell type, and downstream pathways matter." },
    { key: "acid-base-buffering", triggers: ["buffering", "buffer solution", "acid base buffer", "how buffers work"], en: "A buffer contains a weak acid/base pair that can take up or release protons, reducing pH changes over a limited range. Buffer capacity is finite and depends on composition, concentration, and conditions; a buffer does not keep pH fixed under every addition." },
    { key: "micelles", triggers: ["micelle", "micelles", "micelle formation"], en: "Surfactants have water-compatible and oil-compatible regions. Under suitable conditions, groups of surfactants can form micelles with hydrophobic regions inside and water-facing regions outside; this helps disperse some oily material but does not guarantee removal of every contaminant." },
    { key: "enzyme-catalysis", triggers: ["enzyme catalysis", "enzyme catalyst", "activation energy"], en: "Enzymes accelerate reactions by stabilizing transition states and orienting reactants, lowering the activation barrier. They do not change the reaction's equilibrium position. Activity depends on the enzyme, substrate, temperature, pH, and other conditions." },
    { key: "enzyme-denaturation", triggers: ["enzyme denaturation", "denature an enzyme", "denaturation"], en: "Denaturation disrupts a protein's functional three-dimensional structure without necessarily cutting its peptide backbone. Heat, pH extremes, solvents, or salts can contribute, but effects and reversibility vary by protein and conditions." },
    { key: "oxidation-antioxidants", triggers: ["oxidation and antioxidants", "how antioxidants work", "antioxidant mechanism"], en: "Oxidation involves electron transfer and can occur through many pathways. Some antioxidants donate electrons or interrupt particular radical-chain reactions, but no single antioxidant prevents all oxidation; stability depends on the molecule and its environment." },
    { key: "cellular-respiration", triggers: ["cellular respiration", "how cells make energy", "aerobic respiration"], en: "Cellular respiration transfers energy from nutrients into ATP. Glycolysis occurs in the cytosol; pyruvate oxidation and the citric-acid cycle generate electron carriers; oxidative phosphorylation uses those carriers to help make ATP. Yield varies with cell type and conditions." },
    { key: "glycolysis", triggers: ["glycolysis", "glucose to pyruvate"], en: "Glycolysis converts one glucose into two pyruvate molecules in the cytosol, with a net gain of ATP and NADH. Oxygen is not directly consumed in glycolysis, though downstream metabolism depends on cellular conditions." },
    { key: "maillard-reaction", triggers: ["maillard reaction", "browning when cooking", "maillard browning"], en: "The Maillard reaction is a network of reactions between reducing sugars and amino groups. Heat, water activity, pH, and ingredients influence its rate and products, including many aromas and brown pigments. It differs from caramelization, which does not require amino compounds." }
  ],
  contexts: {
    skincare: {
      label: "Skincare & Personal Care",
      tip: "Read the complete product directions and consider concentration, product pH, and how often products are used. A label alone cannot predict personal tolerance."
    },
    food: {
      label: "Food & Nutrition",
      tip: "Distinguish food-grade ingredients from technical or household chemicals. Check serving information and local labeling; individual dietary needs vary."
    },
    household: {
      label: "Everyday & Household",
      tip: "Follow each product label and do not mix cleaning products. Ingredient lists do not reveal concentration or all reaction hazards."
    }
  },
  molecules: [
    { name: "Water", aliases: ["aqua"], formula: "H₂O", weight: "18.015", groups: ["No carbon-based functional groups"], polarity: "Polar; hydrophilic" },
    { name: "Glycerin", aliases: ["glycerol"], formula: "C₃H₈O₃", weight: "92.094", groups: ["3 hydroxyl groups (polyol)"], polarity: "Polar; hydrophilic", mechanism: "A small polyol that binds water and serves as a humectant in many formulations." },
    { name: "Niacinamide", aliases: ["nicotinamide", "vitamin b3"], formula: "C₆H₆N₂O", weight: "122.124", groups: ["Amide", "Aromatic pyridine ring"], polarity: "Polar; hydrophilic", mechanism: "A vitamin B3 form used in cellular NAD/NADP pathways; topical effects depend on the finished formula." },
    { name: "Ascorbic Acid", aliases: ["vitamin c", "l-ascorbic acid"], formula: "C₆H₈O₆", weight: "176.124", groups: ["Enediol / hydroxyl groups", "Cyclic ester (lactone)"], polarity: "Polar; hydrophilic", mechanism: "A water-soluble antioxidant and enzyme cofactor that can donate electrons; it is sensitive to oxidation." },
    { name: "Salicylic Acid", aliases: ["2-hydroxybenzoic acid", "bha"], formula: "C₇H₆O₃", weight: "138.121", groups: ["Carboxylic acid", "Phenolic hydroxyl", "Aromatic ring"], polarity: "Mixed; polar groups with an aromatic region", mechanism: "A lipophilic beta-hydroxy acid used in some topical formulas; product pH and concentration influence its behavior." },
    { name: "Glycolic Acid", aliases: ["hydroxyacetic acid"], formula: "C₂H₄O₃", weight: "76.051", groups: ["Carboxylic acid", "Hydroxyl"], polarity: "Polar; hydrophilic", mechanism: "A small alpha-hydroxy acid that can affect cohesion among surface skin cells in suitable formulations." },
    { name: "Lactic Acid", aliases: ["2-hydroxypropanoic acid"], formula: "C₃H₆O₃", weight: "90.078", groups: ["Carboxylic acid", "Hydroxyl"], polarity: "Polar; hydrophilic" },
    { name: "Caffeine", aliases: ["1,3,7-trimethylxanthine"], formula: "C₈H₁₀N₄O₂", weight: "194.191", groups: ["Amide-like carbonyl groups", "Fused aromatic heterocycle"], polarity: "Moderately polar; several heteroatoms", mechanism: "Adenosine-receptor antagonist that can temporarily reduce sleep-pressure signaling; effects vary with dose, timing, and sensitivity." },
    { name: "Glucose", aliases: ["dextrose"], formula: "C₆H₁₂O₆", weight: "180.156", groups: ["Multiple hydroxyl groups", "Aldehyde in open-chain form; mostly cyclic in water"], polarity: "Polar; hydrophilic", mechanism: "A six-carbon sugar used in glycolysis and other metabolic pathways; cells regulate its transport and oxidation." },
    { name: "Ethanol", aliases: ["ethyl alcohol"], formula: "C₂H₆O", weight: "46.069", groups: ["Hydroxyl (alcohol)"], polarity: "Polar and water-miscible; also has a small non-polar region" },
    { name: "Acetic Acid", aliases: ["ethanoic acid", "vinegar"], formula: "C₂H₄O₂", weight: "60.052", groups: ["Carboxylic acid"], polarity: "Polar; hydrophilic", mechanism: "A weak acid that partially ionizes in water and participates in acid-base equilibria." },
    { name: "Retinol", aliases: ["vitamin a"], formula: "C₂₀H₃₀O", weight: "286.454", groups: ["Hydroxyl (alcohol)", "Conjugated non-polar carbon chain"], polarity: "Mostly non-polar; lipophilic", mechanism: "A vitamin A derivative converted through retinaldehyde to retinoic acid, influencing cellular gene expression." },
    { name: "Tocopherol", aliases: ["vitamin e", "alpha-tocopherol"], formula: "C₂₉H₅₀O₂", weight: "430.710", groups: ["Phenolic hydroxyl", "Aromatic ring", "Long non-polar carbon chain"], polarity: "Mostly non-polar; lipophilic" }
  ],
  interactions: [
    {
      ingredients: ["glycerin", "ceramide np"],
      type: "positive",
      title: "Complementary hydration and barrier roles",
      explanation: "A humectant can bind water while barrier lipids contribute to the skin's lipid matrix. Their presence does not establish a product outcome; the complete formulation matters.",
      contexts: ["skincare"]
    },
    {
      ingredients: ["ascorbic acid", "tocopherol"],
      type: "context",
      title: "Antioxidants may have complementary formulation roles",
      explanation: "Vitamin C and vitamin E are both antioxidants and can be combined in some formulated systems. Stability, packaging, pH, and the specific derivatives matter; a label alone cannot confirm synergy."
    },
    {
      ingredients: ["retinol", "glycolic acid"],
      type: "caution",
      title: "Consider cumulative irritation",
      explanation: "Retinoids and exfoliating acids can each irritate some users. This is not a universal incompatibility; concentration, product directions, timing, and individual tolerance matter. Ask a dermatologist or pharmacist for personal guidance.",
      contexts: ["skincare"]
    },
    {
      ingredients: ["retinol", "salicylic acid"],
      type: "caution",
      title: "Consider cumulative irritation",
      explanation: "A retinoid and an exfoliating acid can both contribute to irritation. This label-level flag cannot determine whether two finished products are suitable together; check directions and ask a qualified professional if unsure.",
      contexts: ["skincare"]
    },
    {
      ingredients: ["retinol", "benzoyl peroxide"],
      type: "context",
      title: "Check the specific active and product directions",
      explanation: "Benzoyl peroxide may affect the stability of some retinoids in some formulations. Compatibility varies by molecule and product; do not infer a universal rule from ingredient names."
    },
    {
      ingredients: ["sodium hypochlorite", "acetic acid"],
      type: "critical",
      title: "Dangerous cleaner combination — never mix",
      explanation: "Bleach with acids can release toxic chlorine-containing gases. Do not mix cleaning products. If accidental mixing occurs, leave the area and contact local emergency or poison-control services."
    },
    {
      ingredients: ["sodium hypochlorite", "ammonia"],
      type: "critical",
      title: "Dangerous cleaner combination — never mix",
      explanation: "Bleach with ammonia can produce hazardous chloramine gases. Do not mix cleaning products. If accidental mixing occurs, leave the area and contact local emergency or poison-control services."
    },
    {
      ingredients: ["sodium hypochlorite", "citric acid"],
      type: "critical",
      title: "Dangerous cleaner combination — never mix",
      explanation: "Bleach with acids can release toxic chlorine-containing gases. Do not mix cleaning products. If accidental mixing occurs, leave the area and contact local emergency or poison-control services."
    }
  ],
  quiz: [
    { question: "Which functional group contains a carbonyl directly bonded to a hydroxyl?", choices: ["Ester", "Carboxylic acid", "Amide"], answer: 1, explanation: "A carboxylic acid contains the –C(=O)OH group." },
    { question: "Which feature most often increases a small molecule's ability to interact with water?", choices: ["Several hydroxyl groups", "A long hydrocarbon chain", "An isolated aromatic ring"], answer: 0, explanation: "Hydroxyl groups can form hydrogen bonds with water; overall solubility still depends on the whole molecule." },
    { question: "What does an ester group contain?", choices: ["Carbonyl bonded to oxygen bonded to carbon", "Nitrogen bonded to two carbonyls", "A carbon-carbon double bond only"], answer: 0, explanation: "An ester has the pattern R–C(=O)–O–R′." },
    { question: "Why can two active skincare ingredients feel irritating when used together?", choices: ["Their names always imply a chemical reaction", "Their effects can add to irritation even without direct incompatibility", "All acids destroy all vitamins"], answer: 1, explanation: "Cumulative irritation can occur without a direct chemical reaction. Formulation and individual tolerance matter." },
    { question: "Why should household bleach not be mixed with acids or ammonia?", choices: ["It always becomes harmless water", "Hazardous gases may form", "It only changes color"], answer: 1, explanation: "Certain bleach mixtures can release toxic gases; never mix cleaning products." },
    { question: "An aromatic ring is best described as:", choices: ["A stable conjugated ring system", "Any ring containing oxygen", "A chain of hydroxyl groups"], answer: 0, explanation: "Aromaticity describes a cyclic, conjugated electron system with characteristic stability." }
  ]
};

/* LOGIC_ENGINE: normalize lists, identify curated group annotations, and explain flagged pair rules. */
export const LOGIC_ENGINE = {
  /* Normalizes a user-entered name to its curated canonical name while retaining unknown names. */
  normalizeName(raw) {
    const input = String(raw).trim().replace(/^[\s•\-]+|[\s.;]+$/g, "");
    const normalized = input.toLowerCase();
    const molecule = DATA_STORE.molecules.find(item => [item.name, ...item.aliases].some(alias => alias.toLowerCase() === normalized));
    const entry = extendedEntries.find(item => [item.name, ...(item.aliases || [])].some(alias => alias.toLowerCase() === normalized));
    return molecule?.name || entry?.name || input;
  },
  /* Parses comma-, semicolon-, or line-separated ingredients, removing duplicates case-insensitively. */
  parseIngredients(text) {
    const seen = new Set();
    return String(text).split(/[,;\n\r•]+/).map(part => part.trim()).filter(Boolean)
      .map(raw => this.normalizeName(raw)).filter(name => {
        const key = name.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  },
  /* Evaluates only curated, named pair rules and adds qualified pH/stability context where relevant. */
  evaluateInteractions(names, context) {
    const keys = new Set(names.map(name => name.toLowerCase()));
    const matches = DATA_STORE.interactions.filter(rule =>
      (!rule.contexts || rule.contexts.includes(context)) &&
      rule.ingredients.every(name => keys.has(this.normalizeName(name).toLowerCase()))
    );
    if (names.some(name => /acid/i.test(name))) {
      matches.push({
        type: "context",
        title: "pH and stability depend on the finished formula",
        explanation: "Acid activity and ingredient stability can depend on the final product's pH, concentration, vehicle, and packaging. Ingredient names alone do not reveal those values."
      });
    }
    return matches.length ? matches : [{
      type: "neutral",
      title: "No specific rule in this small guide matched",
      explanation: "This is not evidence that the ingredients are compatible or suitable for a particular person. Concentration, formulation, use directions, and exposure route are not known."
    }];
  },
  /* Compares two parsed lists and returns stable shared and unique ingredient arrays. */
  compareLists(first, second) {
    const right = new Set(second.map(name => name.toLowerCase()));
    const left = new Set(first.map(name => name.toLowerCase()));
    return {
      shared: first.filter(name => right.has(name.toLowerCase())),
      onlyFirst: first.filter(name => !right.has(name.toLowerCase())),
      onlySecond: second.filter(name => !left.has(name.toLowerCase()))
    };
  },
  /* Returns curated structural annotations or a cautious polarity estimate from a PubChem formula. */
  describeMolecule(name, record = null) {
    const key = this.normalizeName(name).toLowerCase();
    const curated = DATA_STORE.molecules.find(item => item.name.toLowerCase() === key);
    if (curated) return { ...curated, formula: record?.MolecularFormula || curated.formula, weight: record?.MolecularWeight || curated.weight, groupSource: "Curated guide" };
    const formula = record?.MolecularFormula || "Not available";
    const heteroatoms = /[ONSP]/.test(formula);
    return {
      name, formula,
      weight: record?.MolecularWeight || "Not available",
      groups: ["No curated functional-group annotation for this compound"],
      polarity: heteroatoms
        ? "Formula contains heteroatoms; this is only a coarse polarity clue, not a structure analysis"
        : "Polarity not determined from the available data",
      groupSource: "Not structure-verified"
    };
  },
  /* Keeps only the latest five turns in memory for pronoun resolution; nothing is persisted. */
  rememberConversationMessage(role, text) {
    STATE_MANAGER.recentMessages.push({ role, text: String(text).slice(0, 1200) });
    STATE_MANAGER.recentMessages = STATE_MANAGER.recentMessages.slice(-5);
  },
  /* Finds known compound and product names mentioned in text, preferring longer unambiguous aliases. */
  findMentionedRecords(text) {
    const normalized = String(text).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    const records = [
      ...DATA_STORE.compounds.map(record => ({ ...record, kind: "compound", aliases: record.aliases || [] })),
      ...DATA_STORE.molecules.map(record => ({ ...record, kind: "compound", aliases: record.aliases || [] })),
      ...DATA_STORE.productGuides.map(record => ({ ...record, kind: "product", aliases: record.aliases || [] })),
      ...DATA_STORE.mechanisms.map(record => ({ ...record, kind: "mechanism" })),
      ...DATA_STORE.concepts.map(record => ({ ...record, kind: "concept", aliases: [] }))
    ];
    return records.filter(record => {
      const names = [record.name, record.title, record.key?.replace(/-/g, " "), ...(record.aliases || []), ...(record.triggers || [])].filter(Boolean);
      return names.some(alias => {
        const key = alias.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
        return key.length > 2 && (` ${normalized} `).includes(` ${key} `);
      });
    }).sort((a, b) => {
      const length = record => Math.max(0, ...(record.aliases || []).map(alias => alias.length), record.name?.length || 0, record.title?.length || 0);
      return length(b) - length(a);
    });
  },
  /* Resolves pronouns against the active molecule, the last five chat messages, and the latest scan. */
  resolveFollowUpContext({ question, scan, activeMolecule, recentMessages = STATE_MANAGER.recentMessages, context = "skincare" }) {
    const text = String(question).trim();
    const hasReference = /\b(it|this|that|they|them|those|these|either|both|its|their)\b/i.test(text);
    const followUpIntent = /\b(what|why|how|can|could|would|is|are|does|do|safe|mix|combine|work|mean|happen)\b/i.test(text);
    if (!hasReference || !followUpIntent || /\b(compare|versus|vs)\b/i.test(text) || this.findMentionedRecords(text).length) return null;

    const priorUserMessages = recentMessages.filter(message =>
      message.role === "user" && message.text.trim().toLowerCase() !== text.toLowerCase()
    ).map(message => message.text);
    const mentioned = priorUserMessages.flatMap(message => this.findMentionedRecords(message));
    const uniqueByName = new Map();
    mentioned.forEach(record => {
      const key = `${record.kind}:${record.key || record.name || record.title}`;
      if (!uniqueByName.has(key)) uniqueByName.set(key, record);
    });
    const uniqueMentioned = [...uniqueByName.values()];
    const scanItems = (scan?.items || []).map(item => this.normalizeName(item.name));
    const scanRecords = scanItems.map(name => {
      const record = [...DATA_STORE.compounds, ...DATA_STORE.molecules].find(item =>
        item.name.toLowerCase() === name.toLowerCase() || (item.aliases || []).some(alias => alias.toLowerCase() === name.toLowerCase())
      );
      return record ? { ...record, kind: "compound" } : null;
    }).filter(Boolean);
    const activeMatch = activeMolecule
      ? [...DATA_STORE.compounds, ...DATA_STORE.molecules].find(record => record.name.toLowerCase() === activeMolecule.name?.toLowerCase())
      : null;
    const activeRecord = activeMatch
      ? { ...activeMatch, kind: "compound" }
      : activeMolecule?.name ? { ...activeMolecule, kind: "compound" } : null;
    let targets = uniqueMentioned;
    const asksAboutPair = /\b(those|these|both|either|two|mix|combine)\b/i.test(text);
    if (asksAboutPair && targets.length < 2) {
      if (!targets.length && scanRecords.length >= 2) targets = scanRecords.slice(0, 2);
      else if (!targets.length && activeRecord) targets = [activeRecord];
      else if (targets.length === 1 && activeRecord &&
          (activeRecord.name || "").toLowerCase() !== (targets[0].name || "").toLowerCase()) targets.push(activeRecord);
    } else if (!targets.length && activeRecord) {
      targets = [activeRecord];
    } else if (!targets.length && scanRecords.length) {
      targets = [scanRecords[0]];
    }
    if (asksAboutPair && targets.length < 2) {
      const knownName = targets[0]?.name || targets[0]?.title || targets[0]?.key;
      return {
        stage: "context",
        topic: knownName || "ingredient compatibility",
        text: knownName
          ? `I can identify ${knownName} from the recent context, but I can't reliably tell which second ingredient “those two” refers to. Please name both ingredients or paste the full label; I won't infer a mixture or personal safety from an incomplete reference.`
          : "I can't reliably identify the two ingredients from the recent context. Please name both ingredients or paste the full label so I can check the limited educational rules without guessing."
      };
    }
    if (!targets.length) return null;

    if (/\b(mix|combine|together|compatible)\b/i.test(text) && targets.length >= 2) {
      const names = targets.slice(0, 2).map(record => record.name || record.title || record.key);
      const findings = this.evaluateInteractions(names, context);
      return {
        stage: "context",
        topic: names.join(" + "),
        text: `About ${names.join(" and ")}: ${findings.map(note => `${note.title}. ${note.explanation}`).join(" ")} This is a limited label-level check, not a complete compatibility or personal-safety assessment.`
      };
    }

    const target = targets[0];
    const title = target.name || target.title || target.key?.replace(/-/g, " ") || "the referenced topic";
    if (/\b(safe|sensitive|allergy|irritat|harm|risk)\b/i.test(text)) {
      const caution = target.safetyAndExposure || target.safetyEn || target.advice || "The guide does not establish personal safety or suitability.";
      return {
        stage: "context",
        topic: title,
        text: `${title}: ${caution} A name or ingredient list cannot determine whether something is safe for a particular person, especially with sensitive skin, allergies, medicines, or health conditions. Please consult a qualified professional for personal advice.`
      };
    }
    const explanation = target.mechanism || target.en || target.description || target.advice;
    if (explanation) {
      return {
        stage: "context",
        topic: title,
        text: `${title}: ${explanation} The exact effect depends on the specific product or biological context.`
      };
    }
    if (target.kind === "compound" && target.groups?.length) {
      return {
        stage: "context",
        topic: title,
        text: `${title}: the local structural guide lists ${target.formula || "no formula"} and the functional-group notes ${target.groups.join(", ")}. These features can suggest broad chemical behavior, but they do not by themselves establish biological effects or personal safety.`
      };
    }
    if (activeMolecule && title.toLowerCase() === activeMolecule.name?.toLowerCase()) {
      const groups = (activeMolecule.groups || []).join(", ") || "no curated functional-group notes";
      return {
        stage: "context",
        topic: title,
        text: `${title}: the visualizer lists formula ${activeMolecule.formula || "not available"} and the structural notes ${groups}. These describe structure, not biological effect or personal safety. Ask about a specific property or share the product context for a more focused explanation.`
      };
    }
    if (scan?.product) {
      const names = scan.items.slice(0, 8).map(item => item.name).join(", ");
      return {
        stage: "context",
        topic: scan.product,
        text: `Your latest scanned product is “${scan.product}”. The label entries available here are ${names || "not available"}; I can explain a specific ingredient, but the list alone cannot establish the finished product's effects or personal suitability.`
      };
    }
    return null;
  },
  /* Finds a curated mechanism or everyday-product guide without relying on broad word-suffix guesses. */
  answerLocalKnowledge(question, language = "en") {
    const matches = this.findMentionedRecords(question);
    if (!matches.length) return null;
    const record = matches[0];
    if (record.kind === "mechanism" || record.kind === "concept") {
      return {
        stage: "local",
        topic: record.key,
        text: language === "km" && record.km ? record.km : record.en
      };
    }
    if (record.kind === "compound") {
      return {
        stage: "local",
        topic: record.name,
        text: record.mechanism
          ? `${record.name}: ${record.mechanism}`
          : `${record.name} has formula ${record.formula || "not available"} and the guide notes ${record.groups?.join(", ") || "no curated functional-group annotation"}. These are structural clues, not a full explanation of biological effect or safety.`
      };
    }
    if (record.kind === "product") {
      const components = (record.components || []).map(name => {
        const compound = DATA_STORE.compounds.find(item => item.name.toLowerCase() === name.toLowerCase());
        return compound ? `${compound.name} (${compound.formula || "formula varies"})` : name;
      });
      return {
        stage: "local",
        topic: record.key,
        text: `${record.title}: ${language === "km" && record.km ? record.km : record.en}${components.length ? `\nCommonly listed components in the guide: ${components.join(", ")}.` : ""}\nExact ingredients vary by brand and formulation; check the package label. ${language === "km" && record.safetyKm ? record.safetyKm : record.safetyEn || ""}`
      };
    }
    return null;
  },
  /* Extracts a short topic for public lookups while rejecting private-looking or medical-personal text. */
  extractExternalTopic(question) {
    const cleaned = String(question).trim()
      .replace(/^(?:please\s+)?(?:what\s+(?:is|are)|what's|what\s+does|who\s+is|explain|define|describe|tell\s+me\s+about|how\s+(?:does|do)\s+|why\s+(?:does|do)\s+)/i, "")
      .replace(/[?!.]+$/g, "").replace(/\s+(?:do|does|work|works|mean|means|happen|happens)$/i, "").trim();
    if (cleaned.length < 3 || cleaned.length > 80 ||
        /\b(?:it|this|that|they|them|these|those|either|both|something|anything|everything)\b/i.test(cleaned) ||
        /@|\b(?:my|i am|i'm|me|myself|address|phone|email|password|symptom|diagnos|prescription|medication|medicine|dosage|dose|medical record)\b/i.test(cleaned) ||
        /\b\d{7,}\b/.test(cleaned)) return null;
    return cleaned;
  },
  /* Tries PubChem for a named compound, then Wikipedia for a short topic; sends no chat history. */
  async fetchExternalKnowledge(question, language = "en") {
    const topic = this.extractExternalTopic(question);
    if (!topic) return null;
    const candidate = ChemicalResolver.extractCandidate(question);
    if (candidate) {
      try {
        const result = await ChemicalResolver.fetchPubChem(candidate);
        if (result.found) {
          const record = result.record;
          return {
            stage: "api",
            topic: candidate,
            imageUrl: result.imageUrl,
            imageAlt: `PubChem 2D structure for ${candidate}`,
            sourceUrl: record.CID ? `https://pubchem.ncbi.nlm.nih.gov/compound/${encodeURIComponent(String(record.CID))}` : "",
            text: `PubChem record for ${candidate}: molecular formula ${record.MolecularFormula || "not provided"}; molecular weight ${record.MolecularWeight || "not provided"} g/mol; IUPAC name ${record.IUPACName || "not provided"}. This database record identifies a compound, but does not establish a product's concentration, safety, or biological effect.`
          };
        }
      } catch (error) {
        console.info("PubChem lookup did not return a usable record.", error.message);
      }
    }
    const host = language === "km" ? "https://km.wikipedia.org" : "https://en.wikipedia.org";
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4500);
    try {
      const searchUrl = `${host}/w/api.php?action=opensearch&search=${encodeURIComponent(topic)}&limit=1&namespace=0&format=json&origin=*`;
      const searchResponse = await fetch(searchUrl, { signal: controller.signal, headers: { Accept: "application/json" } });
      if (!searchResponse.ok) return null;
      const searchData = await searchResponse.json();
      const title = Array.isArray(searchData?.[1]) ? searchData[1][0] : "";
      if (!title) return null;
      const summaryUrl = `${host}/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, "_"))}`;
      const summaryResponse = await fetch(summaryUrl, { signal: controller.signal, headers: { Accept: "application/json" } });
      if (!summaryResponse.ok) return null;
      const summary = await summaryResponse.json();
      const extract = String(summary?.extract || "").trim().slice(0, 900);
      if (!extract) return null;
      return {
        stage: "api",
        topic: summary.title || title,
        sourceUrl: summary.content_urls?.desktop?.page || "",
        text: `${summary.title || title}: ${extract}\n\nThis is a brief general reference summary, not product-specific, medical, or safety advice.`
      };
    } catch (error) {
      if (error.name !== "AbortError") console.info("Wikipedia topic lookup is unavailable.", error.message);
      return null;
    } finally {
      clearTimeout(timeout);
    }
  },
  /* Gives a useful next step grounded in current scan or molecule context without inventing an answer. */
  buildContextualFallback(question, { scan, activeMolecule, recentMessages = STATE_MANAGER.recentMessages } = {}) {
    const topic = this.extractExternalTopic(question);
    if (scan?.items?.length) {
      const names = scan.items.slice(0, 5).map(item => item.name).join(", ");
      return {
        stage: "fallback",
        topic: scan.product || "recent product",
        text: `I can't verify that exact detail from the local guide. Your latest scan includes ${names}. I can explain a named ingredient or compare two labels; concentrations and the full formulation are not available here. What part would you like to examine?`
      };
    }
    if (activeMolecule?.name) {
      return {
        stage: "fallback",
        topic: activeMolecule.name,
        text: `I can't verify that exact detail for ${activeMolecule.name} from the available guide. I can still discuss its displayed formula (${activeMolecule.formula || "not available"}) and the functional-group notes shown in Molecule Tools. Which property or mechanism are you asking about?`
      };
    }
    const priorTopics = recentMessages.filter(message => message.role === "user")
      .flatMap(message => this.findMentionedRecords(message.text))
      .map(record => record.name || record.title || record.key)
      .filter(Boolean);
    const topicHint = topic || priorTopics[0];
    return {
      stage: "fallback",
      topic: topicHint || "general chemistry",
      text: topicHint
        ? `I can't verify a specific mechanism for “${topicHint}” from the current sources. I can help if you share the exact compound, product label, or a more specific question; for a product, include its ingredient list and intended use.`
        : "I can help with chemistry, biochemistry, and everyday product questions. For a precise answer, tell me the compound, pathway, product label, or what two ingredients you want compared. I won't guess at unknown product contents or personal safety.",
      suggestions: ["Explain glycolysis", "What is in a permanent marker?", "Compare two ingredient lists"]
    };
  },
  /* Runs the local guide, public references, and grounded fallback in order after context resolution. */
  async resolveAskAnything({ question, context = {}, language = "en" }) {
    const localAnswer = this.answerLocalKnowledge(question, language);
    if (localAnswer) return localAnswer;
    const publicAnswer = await this.fetchExternalKnowledge(question, language);
    if (publicAnswer) return publicAnswer;
    return this.buildContextualFallback(question, context);
  }
};

/* STATE_MANAGER: holds the current view, lookup request generation, selected context, and quiz progress. */
export const STATE_MANAGER = {
  context: "skincare",
  molecule: null,
  requestId: 0,
  quizIndex: Math.floor(Math.random() * DATA_STORE.quiz.length),
  selectedQuizAnswer: null,
  recentMessages: []
};

/* UI_RENDERER: binds the independent tools page, renders safe results, and keeps asynchronous lookups race-safe. */
export function initializeIngredientTools() {
  const root = document.querySelector("#page-tools");
  if (!root) return;
  const byId = id => root.querySelector(`#${id}`);
  let latestInteractionSummary = "";
  let latestComparisonSummary = "";
  const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);

  /* Produces an explicitly illustrative SVG when PubChem's real structure image cannot load. */
  function renderFallbackStructure(molecule) {
    const title = escapeHtml(molecule.name);
    const groups = molecule.groups.slice(0, 3);
    const nodes = groups.map((group, index) => {
      const x = 106 + index * 152;
      const label = group.startsWith("No curated") ? "?" : escapeHtml(group.split(" ")[0]);
      return `<g><circle cx="${x}" cy="92" r="31" fill="${index % 2 ? "#e5f0e9" : "#f4eddc"}" stroke="#709985" stroke-width="2"/><text x="${x}" y="97" text-anchor="middle" font-size="12" fill="#284c3c">${label}</text></g>`;
    }).join("");
    const links = groups.slice(1).map((_, index) =>
      `<line x1="${137 + index * 152}" y1="92" x2="${75 + (index + 1) * 152}" y2="92" stroke="#658878" stroke-width="3"/>`
    ).join("");
    return `<svg viewBox="0 0 520 170" role="img" aria-label="Illustrative functional-group diagram for ${title}"><rect width="520" height="170" rx="14" fill="#f7faf6"/>${links}${nodes}<text x="260" y="151" text-anchor="middle" font-size="11" fill="#68796f">Illustrative group map · not an exact bond structure</text></svg>`;
  }

  /* Draws either PubChem's 2D structure image or a labeled fallback, without claiming exact fallback bonds. */
  function renderMolecule(molecule, imageUrl = "") {
    const visual = byId("moleculeVisual");
    const title = escapeHtml(molecule.name);
    const image = imageUrl
      ? `<img class="molecule-image" src="${escapeHtml(imageUrl)}" alt="PubChem 2D structure for ${title}"><span class="molecule-source">PubChem 2D structure</span>`
      : `${renderFallbackStructure(molecule)}<span class="molecule-source">Offline illustrative group map — not an exact structure</span>`;
    visual.innerHTML = `<div class="molecule-visual-head"><b>${title}</b><span class="tag">${escapeHtml(molecule.groupSource || "PubChem / local guide")}</span></div>${image}<div class="molecule-facts"><span><small>Molecular formula</small><b>${escapeHtml(molecule.formula)}</b></span><span><small>Molecular weight</small><b>${escapeHtml(molecule.weight)}${molecule.weight === "Not available" ? "" : " g/mol"}</b></span><span><small>Overall polarity</small><b>${escapeHtml(molecule.polarity)}</b></span></div>`;
    const img = visual.querySelector(".molecule-image");
    if (img) img.addEventListener("error", () => {
      if (STATE_MANAGER.molecule?.name === molecule.name) {
        visual.innerHTML = `<div class="molecule-visual-head"><b>${title}</b><span class="tag">Offline fallback</span></div>${renderFallbackStructure(molecule)}<span class="molecule-source">Illustrative group map — not an exact structure</span><div class="molecule-facts"><span><small>Molecular formula</small><b>${escapeHtml(molecule.formula)}</b></span><span><small>Molecular weight</small><b>${escapeHtml(molecule.weight)}${molecule.weight === "Not available" ? "" : " g/mol"}</b></span><span><small>Overall polarity</small><b>${escapeHtml(molecule.polarity)}</b></span></div>`;
      }
    }, { once: true });
    renderGroupBreakdown(molecule);
  }

  /* Renders clickable group tags and distinguishes curated details from coarse formula-only clues. */
  function renderGroupBreakdown(molecule) {
    byId("groupBreakdown").innerHTML = `<p><b>${escapeHtml(molecule.name)}</b> · ${escapeHtml(molecule.groupSource || "Guide annotation")}</p><div class="polarity-legend"><span><i class="legend-polar"></i>Polar / hydrophilic tendency</span><span><i class="legend-nonpolar"></i>Non-polar / hydrophobic tendency</span><span><i class="legend-mixed"></i>Mixed / ring system</span></div><div class="group-pills">${molecule.groups.map((group, index) => {
      const region = /long non-polar|carbon chain|non-polar region/i.test(group) ? "nonpolar" : /aromatic/i.test(group) ? "mixed" : "polar";
      return `<button type="button" class="group-pill ${region}" aria-pressed="false" data-group="${index}">${escapeHtml(group)}</button>`;
    }).join("")}</div><p class="group-note">${escapeHtml(molecule.polarity)}. Region colors are a qualitative teaching aid; they are not a calculated electrostatic surface.</p><div class="interaction-box"><b>Hydrophilic / polar</b> regions commonly contain oxygen or nitrogen groups. <b>Hydrophobic / non-polar</b> regions are often carbon-rich. This guide's group map is qualitative.</div>`;
    byId("groupBreakdown").querySelectorAll(".group-pill").forEach(button => button.addEventListener("click", () => {
      const active = button.getAttribute("aria-pressed") !== "true";
      button.setAttribute("aria-pressed", String(active));
      button.classList.toggle("selected", active);
    }));
  }

  /* Looks up PubChem formula and weight; errors and missing records fall back to local curated data. */
  async function lookupMolecule(rawName) {
    const name = String(rawName).trim();
    if (!name) {
      byId("moleculeStatus").textContent = "Enter a compound name to visualize.";
      return;
    }
    const requestId = ++STATE_MANAGER.requestId;
    byId("moleculeStatus").textContent = "Looking up PubChem properties…";
    const known = LOGIC_ENGINE.describeMolecule(LOGIC_ENGINE.normalizeName(name));
    let record = null, imageUrl = "";
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 9000);
      try {
        const url = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${encodeURIComponent(name)}/property/MolecularFormula,MolecularWeight/JSON`;
        const response = await fetch(url, { signal: controller.signal, headers: { Accept: "application/json" } });
        if (response.ok) record = (await response.json())?.PropertyTable?.Properties?.[0] || null;
        else if (response.status !== 404) throw new Error(`PubChem returned HTTP ${response.status}.`);
        if (record) imageUrl = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${encodeURIComponent(name)}/PNG?image_size=400x400`;
      } finally {
        clearTimeout(timeout);
      }
    } catch (error) {
      if (error.name !== "AbortError") console.info("PubChem lookup unavailable; showing the local guide.", error.message);
    }
    if (requestId !== STATE_MANAGER.requestId) return;
    const molecule = LOGIC_ENGINE.describeMolecule(known.name || name, record);
    if (!record && known.groupSource === "Not structure-verified") {
      molecule.groupSource = "Offline; no curated structure record";
    }
    STATE_MANAGER.molecule = molecule;
    renderMolecule(molecule, imageUrl);
    byId("moleculeStatus").textContent = record
      ? "PubChem properties found. Structure image loads separately and falls back automatically if unavailable."
      : "Showing available local information. Exact structure and properties require an available PubChem match.";
  }

  /* Displays the interaction rules matched to a parsed list and the selected practical context. */
  function renderInteractions(names) {
    const results = LOGIC_ENGINE.evaluateInteractions(names, STATE_MANAGER.context);
    latestInteractionSummary = `Context: ${DATA_STORE.contexts[STATE_MANAGER.context].label}. Ingredients: ${names.join(", ") || "none"}. Findings: ${results.map(item => `${item.title}: ${item.explanation}`).join(" ")}`;
    byId("interactionResults").innerHTML = `<p class="tool-summary">${names.length} distinct ingredient${names.length === 1 ? "" : "s"} checked. The rule set is educational and not exhaustive.</p>${results.map(item => `<article class="interaction-box interaction-${escapeHtml(item.type)}"><b>${escapeHtml(item.title)}</b><p>${escapeHtml(item.explanation)}</p></article>`).join("")}<p class="helper">Matched names: ${names.map(escapeHtml).join(", ") || "none"}</p><button class="button secondary small ask-interaction-bot" type="button">Ask BioBot to explain these notes</button>`;
    byId("interactionResults").querySelector(".ask-interaction-bot").addEventListener("click", () => {
      document.dispatchEvent(new CustomEvent("molecule:ask-bot", { detail: { type: "interaction", summary: latestInteractionSummary, prompt: `Please explain this ingredient interaction check in more depth, including what is known versus uncertain: ${latestInteractionSummary}` } }));
    });
  }

  /* Renders the side-by-side overlap and differences for two normalized ingredient lists. */
  function renderComparison(firstText, secondText) {
    const first = LOGIC_ENGINE.parseIngredients(firstText), second = LOGIC_ENGINE.parseIngredients(secondText);
    if (!first.length || !second.length) {
      byId("comparisonResults").innerHTML = `<div class="empty">Enter both ingredient lists to compare them.</div>`;
      return;
    }
    const result = LOGIC_ENGINE.compareLists(first, second);
    const list = names => names.length ? `<ul>${names.map(name => `<li>${escapeHtml(name)}</li>`).join("")}</ul>` : `<p class="empty">None</p>`;
    latestComparisonSummary = `Product A: ${first.join(", ")}. Product B: ${second.join(", ")}. Shared: ${result.shared.join(", ") || "none"}. Unique to A: ${result.onlyFirst.join(", ") || "none"}. Unique to B: ${result.onlySecond.join(", ") || "none"}.`;
    byId("comparisonResults").innerHTML = `<p class="tool-summary">${first.length} ingredients in Product A · ${second.length} in Product B · ${result.shared.length} shared</p><div class="grid comparison-grid"><article class="card comparison-column"><span class="tag">Shared</span><h3>In both products</h3>${list(result.shared)}</article><article class="card comparison-column"><span class="tag">Product A</span><h3>Unique to A</h3>${list(result.onlyFirst)}</article><article class="card comparison-column"><span class="tag">Product B</span><h3>Unique to B</h3>${list(result.onlySecond)}</article></div><button class="button secondary small ask-comparison-bot" type="button">Ask BioBot to explain this comparison</button>`;
    byId("comparisonResults").querySelector(".ask-comparison-bot").addEventListener("click", () => {
      document.dispatchEvent(new CustomEvent("molecule:ask-bot", { detail: { type: "comparison", summary: latestComparisonSummary, prompt: `Please interpret this side-by-side ingredient comparison. Explain overlap and differences without inferring product quality or personal suitability: ${latestComparisonSummary}` } }));
    });
  }

  /* Updates practical guidance for the selected domain and repeats the appropriate professional boundary. */
  function renderContext() {
    const context = DATA_STORE.contexts[STATE_MANAGER.context];
    byId("contextGuidance").innerHTML = `<p>${escapeHtml(context.tip)}</p><p class="professional-reminder">For personal decisions, consult a qualified ${STATE_MANAGER.context === "food" ? "doctor or nutritionist" : STATE_MANAGER.context === "household" ? "product-safety professional, pharmacist, or local poison-control service" : "dermatologist, doctor, or pharmacist"}.</p>`;
  }

  /* Displays one question from the curated quiz bank and clears feedback for the next answer. */
  function renderQuiz() {
    const item = DATA_STORE.quiz[STATE_MANAGER.quizIndex];
    STATE_MANAGER.selectedQuizAnswer = null;
    byId("quizFeedback").textContent = "";
    byId("quizQuestion").textContent = item.question;
    byId("quizChoices").innerHTML = item.choices.map((choice, index) => `<button type="button" class="quiz-choice" data-answer="${index}">${escapeHtml(choice)}</button>`).join("");
  }

  /* Checks the selected quiz choice against DATA_STORE and gives the stored explanation. */
  function checkQuiz(answer) {
    const item = DATA_STORE.quiz[STATE_MANAGER.quizIndex];
    const correct = Number(answer) === item.answer;
    STATE_MANAGER.selectedQuizAnswer = Number(answer);
    byId("quizFeedback").textContent = `${correct ? "Correct. " : "Not quite. "}${item.explanation}`;
    byId("quizChoices").querySelectorAll("button").forEach(button => {
      button.disabled = true;
      if (Number(button.dataset.answer) === item.answer) button.classList.add("correct");
      else if (Number(button.dataset.answer) === Number(answer)) button.classList.add("incorrect");
    });
  }

  byId("contextMode").addEventListener("change", event => {
    STATE_MANAGER.context = event.target.value;
    renderContext();
  });
  byId("moleculeForm").addEventListener("submit", event => {
    event.preventDefault();
    lookupMolecule(byId("moleculeName").value);
  });
  byId("visualizerTabs").addEventListener("click", event => {
    const button = event.target.closest("[data-visual-tab]");
    if (!button) return;
    const structureActive = button.dataset.visualTab === "structure";
    byId("visualizerTabs").querySelectorAll("button").forEach(tab => {
      tab.classList.toggle("active", tab === button);
      tab.setAttribute("aria-selected", String(tab === button));
    });
    byId("moleculeVisual").hidden = !structureActive;
    byId("groupBreakdown").hidden = structureActive;
  });
  byId("interactionForm").addEventListener("submit", event => {
    event.preventDefault();
    renderInteractions(LOGIC_ENGINE.parseIngredients(byId("interactionIngredients").value));
  });
  byId("compareForm").addEventListener("submit", event => {
    event.preventDefault();
    renderComparison(byId("productAIngredients").value, byId("productBIngredients").value);
  });
  byId("quizChoices").addEventListener("click", event => {
    const button = event.target.closest("[data-answer]");
    if (button && STATE_MANAGER.selectedQuizAnswer === null) checkQuiz(button.dataset.answer);
  });
  byId("nextQuizQuestion").addEventListener("click", () => {
    STATE_MANAGER.quizIndex = (STATE_MANAGER.quizIndex + 1) % DATA_STORE.quiz.length;
    renderQuiz();
  });
  renderContext();
  renderQuiz();
}
