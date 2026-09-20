const Morph = require("../js/morphology.js");

let failures = 0, checks = 0;

function check(label, actual, expected) {
  checks++;
  if (actual !== expected) {
    failures++;
    console.log(`FAIL ${label}: got "${actual}", expected "${expected}"`);
  }
}

function nounEntry(lemma, gender, grammar_note, irregular_note) {
  return { lemma, gender, grammar_note: grammar_note || gender, pos: "Substantiv", irregular_note };
}

console.log("--- Substantiv ---");

// servus (bare, kein Genitiv gegeben)
let d = Morph.declineNoun(nounEntry("servus", "m"));
check("servus gen", d.sg.gen, "servī");
check("servus dat", d.sg.dat, "servō");
check("servus akk", d.sg.akk, "servum");
check("servus abl", d.sg.abl, "servō");
check("servus vok", d.sg.vok, "serve");
check("servus pl.nom", d.pl.nom, "servī");
check("servus pl.gen", d.pl.gen, "servōrum");
check("servus pl.dat", d.pl.dat, "servīs");

// puella (bare, 1. Deklination)
d = Morph.declineNoun(nounEntry("puella", "f"));
check("puella gen", d.sg.gen, "puellae");
check("puella akk", d.sg.akk, "puellam");
check("puella abl", d.sg.abl, "puellā");
check("puella pl.gen", d.pl.gen, "puellārum");

// ager, agrī (Genitiv gegeben, Stamm-Kontraktion)
d = Morph.declineNoun(nounEntry("ager, agrī", "m"));
check("ager nom", d.sg.nom, "ager");
check("ager gen", d.sg.gen, "agrī");
check("ager dat", d.sg.dat, "agrō");
check("ager pl.nom", d.pl.nom, "agrī");
check("ager pl.gen", d.pl.gen, "agrōrum");

// filius -> vokativ fili
d = Morph.declineNoun(nounEntry("fīlius", "m"));
check("filius vok", d.sg.vok, "fīlī");

// rex, regis (3. Dekl, kein i-Stamm)
d = Morph.declineNoun(nounEntry("rēx, rēgis", "m"));
check("rex gen", d.sg.gen, "rēgis");
check("rex dat", d.sg.dat, "rēgī");
check("rex akk", d.sg.akk, "rēgem");
check("rex abl", d.sg.abl, "rēge");
check("rex pl.nom", d.pl.nom, "rēgēs");
check("rex pl.gen", d.pl.gen, "rēgum");

// urbs, urbis (i-Stamm, Gen.Pl. -ium)
d = Morph.declineNoun(nounEntry("urbs, urbis", "f", "f (Gen. Pl. -ium)", "Gen. Pl. -ium"));
check("urbs pl.gen (i-Stamm)", d.pl.gen, "urbium");

// corpus, corporis (Neutrum, 3. Dekl)
d = Morph.declineNoun(nounEntry("corpus, corporis", "n"));
check("corpus akk = nom", d.sg.akk, "corpus");
check("corpus pl.nom", d.pl.nom, "corpora");
check("corpus pl.gen", d.pl.gen, "corporum");

// domus (unregelmaessig)
d = Morph.declineNoun(nounEntry("domus, domūs", "f"));
check("domus akk", d.sg.akk, "domum");
check("domus abl", d.sg.abl, "domō");

console.log(checks + " Prüfungen, " + failures + " Fehler bisher");

console.log("--- Adjektiv ---");

function adjEntry(lemma, adj_type, adj_stem_gen) {
  return { lemma, adj_type, adj_stem_gen, pos: "Adjektiv" };
}

let a = Morph.declineAdjective(adjEntry("bonus, a, um", "a_um"));
check("bonus sg.m.nom", a.sg.m.nom, "bonus");
check("bonus sg.f.nom", a.sg.f.nom, "bona");
check("bonus sg.n.nom", a.sg.n.nom, "bonum");
check("bonus sg.m.gen", a.sg.m.gen, "bonī");
check("bonus pl.m.nom", a.pl.m.nom, "bonī");
check("bonus pl.f.nom", a.pl.f.nom, "bonae");

a = Morph.declineAdjective(adjEntry("ācer, ācris, ācre", "er_ris_re"));
check("acer sg.n.nom", a.sg.n.nom, "ācre");
check("acer sg.m.gen", a.sg.m.gen, "ācris");
check("acer pl.n.nom", a.pl.n.nom, "ācria");

a = Morph.declineAdjective(adjEntry("brevis, e", "is_e"));
check("brevis sg.n.nom", a.sg.n.nom, "breve");
check("brevis sg.m.gen", a.sg.m.gen, "brevis");
check("brevis pl.m.nom", a.pl.m.nom, "brevēs");

a = Morph.declineAdjective(adjEntry("ingēns, ingentis", "one_ending"));
check("ingens sg.n.nom", a.sg.n.nom, "ingēns");
check("ingens sg.m.gen", a.sg.m.gen, "ingentis");
check("ingens pl.m.nom", a.pl.m.nom, "ingentēs");
check("ingens pl.n.nom", a.pl.n.nom, "ingentia");

a = Morph.declineAdjective(adjEntry("melior, melius", "comparative", "meliōris"));
check("melior sg.m.nom", a.sg.m.nom, "melior");
check("melior sg.n.nom", a.sg.n.nom, "melius");
check("melior sg.m.gen", a.sg.m.gen, "meliōris");
check("melior pl.n.nom", a.pl.n.nom, "meliōra");

console.log(checks + " Prüfungen, " + failures + " Fehler bisher");

console.log("--- Verb ---");

function verbEntry(forms) {
  return { lemma: forms.join(", "), verb_forms: forms, pos: "Verb" };
}

let v = Morph.analyzeVerb(verbEntry(["amāre", "amō"]));
check("amare pres 1sg", v.pres[0], "amō");
check("amare pres 3pl", v.pres[5], "amant");
check("amare impf 1sg", v.impf[0], "amābam");
check("amare fut 1sg", v.fut[0], "amābō");
check("amare presSubj 1sg", v.presSubj[0], "amem");

v = Morph.analyzeVerb(verbEntry(["docēre", "doceō", "docuī", "doctum"]));
check("docere pres 1sg", v.pres[0], "doceō");
check("docere perf 1sg", v.perf[0], "docuī");
check("docere perf 3pl", v.perf[5], "docuērunt");
check("docere fut 1sg", v.fut[0], "docēbō");

v = Morph.analyzeVerb(verbEntry(["agere", "agō", "ēgī", "āctum"]));
check("agere pres 1sg", v.pres[0], "agō");
check("agere pres 2sg", v.pres[1], "agis");
check("agere fut 1sg", v.fut[0], "agam");
check("agere fut 2sg", v.fut[1], "agēs");
check("agere perf 1sg", v.perf[0], "ēgī");

v = Morph.analyzeVerb(verbEntry(["capere", "capiō", "cēpī", "captum"]));
check("capere conjClass", v.conjClass, "3io");
check("capere pres 1sg", v.pres[0], "capiō");
check("capere pres 3pl", v.pres[5], "capiunt");
check("capere fut 1sg", v.fut[0], "capiam");
check("capere impf 1sg", v.impf[0], "capiēbam");

v = Morph.analyzeVerb(verbEntry(["audīre", "audiō", "audīvī", "audītum"]));
check("audire pres 1sg", v.pres[0], "audiō");
check("audire pres 3pl", v.pres[5], "audiunt");
check("audire fut 1sg", v.fut[0], "audiam");

v = Morph.analyzeVerb(verbEntry(["arbitrārī", "arbitror", "arbitrātus sum"]));
check("arbitrari pres 1sg", v.pres[0], "arbitror");
check("arbitrari pres 3sg", v.pres[2], "arbitrātur");
check("arbitrari isDeponent", v.isDeponent, true);

v = Morph.analyzeVerb(verbEntry(["loquī", "loquor", "locūtus sum"]));
check("loqui pres 1sg", v.pres[0], "loquor");
check("loqui pres 2sg", v.pres[1], "loqueris");
check("loqui pres 3pl", v.pres[5], "loquuntur");

v = Morph.analyzeVerb(verbEntry(["patī", "patior", "passus sum"]));
check("pati pres 1sg", v.pres[0], "patior");
check("pati pres 2sg", v.pres[1], "pateris");
check("pati pres 3pl", v.pres[5], "patiuntur");

v = Morph.analyzeVerb(verbEntry(["esse", "sum", "fuī"]));
check("esse pres 1sg", v.pres[0], "sum");
check("esse pres 3pl", v.pres[5], "sunt");
check("esse perf 1sg", v.perf[0], "fuī");
check("esse perf 3pl", v.perf[5], "fuērunt");

v = Morph.analyzeVerb(verbEntry(["abesse", "absum", "āfuī"]));
check("abesse pres 1sg", v.pres[0], "absum");
check("abesse pres 3sg", v.pres[2], "abest");
check("abesse perf 1sg", v.perf[0], "āfuī");

v = Morph.analyzeVerb(verbEntry(["afferre", "afferō", "attulī", "allātum"]));
check("afferre pres 1sg", v.pres[0], "afferō");
check("afferre pres 2sg", v.pres[1], "affers");
check("afferre perf 1sg", v.perf[0], "attulī");
check("afferre pppStem", v.pppStem, "allāt");

v = Morph.analyzeVerb(verbEntry(["abīre", "abeō", "abiī"]));
check("abire pres 1sg", v.pres[0], "abeō");
check("abire pres 3pl", v.pres[5], "abeunt");
check("abire perf 1sg", v.perf[0], "abiī");

v = Morph.analyzeVerb(verbEntry(["velle", "volō", "voluī"]));
check("velle pres 2sg", v.pres[1], "vīs");
check("velle pres 3sg", v.pres[2], "vult");

v = Morph.analyzeVerb(verbEntry(["nōlle", "nōlō", "nōluī"]));
check("nolle pres 2sg", v.pres[1], "nōn vīs");
check("nolle pres 3sg", v.pres[2], "nōn vult");

v = Morph.analyzeVerb(verbEntry(["fierī", "fīō", "factus sum"]));
check("fieri pres 1sg", v.pres[0], "fīō");
check("fieri pres 3pl", v.pres[5], "fīunt");

v = Morph.analyzeVerb(verbEntry(["dare", "dō", "dedī", "datum"]));
check("dare pres 1sg", v.pres[0], "dō");
check("dare pres 3sg", v.pres[2], "dat");
check("dare perf 1sg", v.perf[0], "dedī");

console.log(checks + " Prüfungen insgesamt, " + failures + " Fehler");
process.exit(failures > 0 ? 1 : 0);
