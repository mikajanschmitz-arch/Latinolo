/* ==========================================================================
   morphology.js
   Lateinische Formenlehre: Deklination (Substantiv, Adjektiv, Pronomen) und
   Konjugation (Verb). Reine Funktionen ohne DOM-Zugriff -> in Node testbar.
   ========================================================================== */

(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.Morph = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // ------------------------------------------------------------------
  // Hilfsfunktionen
  // ------------------------------------------------------------------

  function replaceEnd(str, oldSuf, newSuf) {
    if (!str.endsWith(oldSuf)) return str;
    return str.slice(0, str.length - oldSuf.length) + newSuf;
  }

  function splitLemmaParts(lemma) {
    // "ager, agrī" -> ["ager", "agrī"]; "servus" -> ["servus"]
    return lemma.split(",").map(function (s) { return s.trim(); });
  }

  // ==================================================================
  // 1) SUBSTANTIV (Nomen)
  // ==================================================================

  var GEN_SG_TO_DECL = [
    { suf: "ārum", decl: 1, isPluralGen: true },
    { suf: "ōrum", decl: 2, isPluralGen: true },
    { suf: "ium", decl: 3, isPluralGen: true },
    { suf: "um", decl: 3, isPluralGen: true },
    { suf: "uum", decl: 4, isPluralGen: true },
    { suf: "ērum", decl: 5, isPluralGen: true },
    { suf: "ae", decl: 1 },
    { suf: "ī", decl: 2 },
    { suf: "eī", decl: 5 },
    { suf: "ēī", decl: 5 },
    { suf: "ūs", decl: 4 },
    { suf: "is", decl: 3 },
  ];

  // Endungstabellen fuer den Singular (Suffix wird an den Stamm angehaengt;
  // der Stamm ist der Genitiv Singular ohne seine Endung).
  var SG_ENDINGS = {
    1: { gen: "ae", dat: "ae", akk: "am", abl: "ā" },
    2: { gen: "ī", dat: "ō", akk: "um", abl: "ō" },
    3: { gen: "is", dat: "ī", akk: "em", abl: "e" },
    4: { gen: "ūs", dat: "uī", akk: "um", abl: "ū" },
    5: { gen: "eī", dat: "eī", akk: "em", abl: "ē" },
  };

  var PL_ENDINGS = {
    1: { nom: "ae", gen: "ārum", dat: "īs", akk: "ās", abl: "īs", vok: "ae" },
    2: { nom: "ī", gen: "ōrum", dat: "īs", akk: "ōs", abl: "īs", vok: "ī" },
    3: { nom: "ēs", gen: "um", dat: "ibus", akk: "ēs", abl: "ibus", vok: "ēs" },
    4: { nom: "ūs", gen: "uum", dat: "ibus", akk: "ūs", abl: "ibus", vok: "ūs" },
    5: { nom: "ēs", gen: "ērum", dat: "ēbus", akk: "ēs", abl: "ēbus", vok: "ēs" },
  };

  // Bekannte echte Unregelmaessigkeiten, die sich nicht ueber Suffixregeln
  // ableiten lassen. Schluessel = normalisiertes Nominativ-Lemma.
  var NOUN_IRREGULARS = {
    "domus": {
      sg: { nom: "domus", gen: "domūs", dat: "domuī", akk: "domum", abl: "domō", vok: "domus" },
      pl: { nom: "domūs", gen: "domuum / domōrum", dat: "domibus", akk: "domūs / domōs", abl: "domibus", vok: "domūs" },
    },
    "vīs": {
      sg: { nom: "vīs", gen: "(vīs)", dat: "(vī)", akk: "vim", abl: "vī", vok: "vīs" },
      pl: { nom: "vīrēs", gen: "vīrium", dat: "vīribus", akk: "vīrēs", abl: "vīribus", vok: "vīrēs" },
    },
    "iuppiter": {
      sg: { nom: "Iuppiter", gen: "Iovis", dat: "Iovī", akk: "Iovem", abl: "Iove", vok: "Iuppiter" },
      pl: null,
    },
  };

  /**
   * Baut aus einem Vokabel-Eintrag (wie aus vocab.json) die Grunddaten fuer
   * die Deklination.
   */
  function analyzeNoun(entry) {
    var parts = splitLemmaParts(entry.lemma);
    var nom = parts[0];
    var key = nom.toLowerCase();
    if (NOUN_IRREGULARS[key]) {
      var irr = NOUN_IRREGULARS[key];
      return { irregular: true, gender: entry.gender, sg: irr.sg, pl: irr.pl };
    }

    var isPluraleTantum = / Pl\.$/.test((entry.grammar_note || "").trim());
    var givenGen = parts.length > 1 ? parts[1] : null;

    var iStem = /ium\b/.test(entry.irregular_note || "");
    var overrideAblSg = null, overrideAkkSg = null;
    if (entry.irregular_note) {
      var mAbl = entry.irregular_note.match(/Abl\.\s*Sg\.\s*-?([a-zA-Zāēīōū]+)/);
      if (mAbl) overrideAblSg = mAbl[1];
      var mAkk = entry.irregular_note.match(/Akk\.\s*(?:Sg\.)?\s*-?([a-zA-Zāēīōū]+)/);
      if (mAkk) overrideAkkSg = mAkk[1];
    }

    if (isPluraleTantum && givenGen) {
      // givenGen ist hier eigentlich der Genitiv PLURAL (z.B. "armōrum")
      var declPl = null;
      for (var i = 0; i < GEN_SG_TO_DECL.length; i++) {
        if (GEN_SG_TO_DECL[i].isPluralGen && givenGen.endsWith(GEN_SG_TO_DECL[i].suf)) {
          declPl = GEN_SG_TO_DECL[i].decl;
          break;
        }
      }
      if (!declPl) declPl = 3;
      var stemPl = replaceEnd(givenGen, PL_ENDINGS[declPl].gen, "");
      return {
        pluraleTantum: true, declension: declPl, gender: entry.gender,
        nomPl: nom, stemPl: stemPl, iStem: iStem,
      };
    }

    // Deklination bestimmen
    var decl = null, stem = null;
    if (givenGen) {
      for (var j = 0; j < GEN_SG_TO_DECL.length; j++) {
        var rule = GEN_SG_TO_DECL[j];
        if (rule.isPluralGen) continue;
        if (givenGen.endsWith(rule.suf)) { decl = rule.decl; break; }
      }
      if (decl) stem = replaceEnd(givenGen, SG_ENDINGS[decl].gen, "");
    } else {
      // kein Genitiv angegeben -> aus Nominativendung ableiten (einfache Faelle)
      if (nom.endsWith("us")) { decl = 2; stem = nom.slice(0, -2); }
      else if (nom.endsWith("um")) { decl = 2; stem = nom.slice(0, -2); }
      else if (nom.endsWith("a")) { decl = 1; stem = nom.slice(0, -1); }
      else if (nom.endsWith("er")) { decl = 2; stem = nom; } // Standardannahme: e bleibt erhalten
      else { decl = 3; stem = nom; }
    }

    return {
      gender: entry.gender, declension: decl, nom: nom, gen: givenGen || (stem + SG_ENDINGS[decl].gen),
      stem: stem, iStem: iStem, overrideAblSg: overrideAblSg, overrideAkkSg: overrideAkkSg,
    };
  }

  function declineNoun(entry) {
    var info = analyzeNoun(entry);
    var sg = {}, pl = {};

    if (info.irregular) {
      return { sg: info.sg, pl: info.pl, gender: info.gender, pluraleTantum: false, irregular: true };
    }

    if (info.pluraleTantum) {
      var e = PL_ENDINGS[info.declension];
      pl.nom = info.nomPl;
      pl.gen = info.stemPl + (info.iStem ? "ium" : e.gen);
      pl.dat = info.stemPl + e.dat;
      pl.akk = (info.gender === "n") ? pl.nom : info.stemPl + e.akk;
      pl.abl = info.stemPl + e.abl;
      pl.vok = pl.nom;
      return { sg: null, pl: pl, gender: info.gender, pluraleTantum: true, declension: info.declension };
    }

    var decl = info.declension, stem = info.stem;
    var se = SG_ENDINGS[decl], pe = PL_ENDINGS[decl];
    var isNeuter = info.gender === "n";

    sg.nom = info.nom;
    sg.gen = info.gen;
    sg.dat = stem + se.dat;
    sg.akk = isNeuter ? info.nom : stem + se.akk;
    sg.abl = stem + se.abl;
    // Vokativ
    if (decl === 2 && !isNeuter) {
      if (info.nom.endsWith("ius")) sg.vok = info.nom.slice(0, -3) + "ī";
      else if (info.nom.endsWith("us")) sg.vok = info.nom.slice(0, -2) + "e";
      else sg.vok = info.nom; // z.B. auf -er endende (vir -> vir)
    } else {
      sg.vok = info.nom;
    }
    if (info.overrideAblSg) sg.abl = stem + info.overrideAblSg;
    if (info.overrideAkkSg) sg.akk = stem + info.overrideAkkSg;

    pl.nom = isNeuter ? stem + (decl === 3 ? (info.iStem ? "ia" : "a") : "a") : stem + pe.nom;
    pl.gen = stem + (info.iStem ? "ium" : pe.gen);
    pl.dat = stem + pe.dat;
    pl.akk = isNeuter ? pl.nom : stem + pe.akk;
    pl.abl = stem + pe.abl;
    pl.vok = pl.nom;

    return { sg: sg, pl: pl, gender: info.gender, pluraleTantum: false, declension: decl };
  }

  // ==================================================================
  // 2) ADJEKTIV
  // ==================================================================

  function declineAdjective(entry) {
    var parts = splitLemmaParts(entry.lemma);
    var type = entry.adj_type;
    var out = { sg: { m: {}, f: {}, n: {} }, pl: { m: {}, f: {}, n: {} } };

    function fill1_2(stemM, stemF, stemN) {
      out.sg.m = { nom: stemM.nomForm, gen: stemM.stem + "ī", dat: stemM.stem + "ō", akk: stemM.stem + "um", abl: stemM.stem + "ō", vok: stemM.vok };
      out.sg.f = { nom: stemF.nomForm, gen: stemF.stem + "ae", dat: stemF.stem + "ae", akk: stemF.stem + "am", abl: stemF.stem + "ā", vok: stemF.nomForm };
      out.sg.n = { nom: stemN.nomForm, gen: stemM.stem + "ī", dat: stemM.stem + "ō", akk: stemN.nomForm, abl: stemM.stem + "ō", vok: stemN.nomForm };
      out.pl.m = { nom: stemM.stem + "ī", gen: stemM.stem + "ōrum", dat: stemM.stem + "īs", akk: stemM.stem + "ōs", abl: stemM.stem + "īs", vok: stemM.stem + "ī" };
      out.pl.f = { nom: stemF.stem + "ae", gen: stemF.stem + "ārum", dat: stemF.stem + "īs", akk: stemF.stem + "ās", abl: stemF.stem + "īs", vok: stemF.stem + "ae" };
      out.pl.n = { nom: stemM.stem + "a", gen: stemM.stem + "ōrum", dat: stemM.stem + "īs", akk: stemM.stem + "a", abl: stemM.stem + "īs", vok: stemM.stem + "a" };
    }

    if (type === "a_um" || type === "i_ae_a_pl") {
      // "bonus, a, um" -> Stamm = lemma ohne "us"; "multī, ae, a" (nur Plural
      // gegeben) -> Stamm = lemma ohne "ī"
      var stem = type === "i_ae_a_pl" ? parts[0].slice(0, -1) :
        (parts[0].endsWith("us") ? parts[0].slice(0, -2) : parts[0].slice(0, -1));
      var nomM = type === "i_ae_a_pl" ? stem + "us" : parts[0];
      fill1_2(
        { stem: stem, nomForm: nomM, vok: stem + "e" },
        { stem: stem, nomForm: stem + "a" },
        { stem: stem, nomForm: stem + "um" }
      );
      return out;
    }

    if (type === "er_a_um") {
      // "niger, nigra, nigrum" (drei volle Formen gegeben)
      var mNom = parts[0], fNom = parts[1], nNom = parts[2];
      var stemF = fNom.slice(0, -1); // "nigra" -> "nigr"
      var stemN = nNom.slice(0, -2); // "nigrum" -> "nigr"
      fill1_2(
        { stem: stemF, nomForm: mNom, vok: mNom },
        { stem: stemF, nomForm: fNom },
        { stem: stemN, nomForm: nNom }
      );
      return out;
    }

    if (type === "er_ris_re") {
      // "ācer, ācris, ācre" - 3. Deklination, 3 Endungen
      var stem3 = parts[1].slice(0, -2); // "ācris" -> "ācr"
      var common = { gen: stem3 + "is", dat: stem3 + "ī", abl: stem3 + "ī" };
      out.sg.m = { nom: parts[0], gen: common.gen, dat: common.dat, akk: stem3 + "em", abl: common.abl, vok: parts[0] };
      out.sg.f = { nom: parts[1], gen: common.gen, dat: common.dat, akk: stem3 + "em", abl: common.abl, vok: parts[1] };
      out.sg.n = { nom: parts[2], gen: common.gen, dat: common.dat, akk: parts[2], abl: common.abl, vok: parts[2] };
      var pl3 = { nom: stem3 + "ēs", gen: stem3 + "ium", dat: stem3 + "ibus", abl: stem3 + "ibus" };
      out.pl.m = { nom: pl3.nom, gen: pl3.gen, dat: pl3.dat, akk: pl3.nom, abl: pl3.abl, vok: pl3.nom };
      out.pl.f = out.pl.m;
      out.pl.n = { nom: stem3 + "ia", gen: pl3.gen, dat: pl3.dat, akk: stem3 + "ia", abl: pl3.abl, vok: stem3 + "ia" };
      return out;
    }

    if (type === "is_e") {
      // "brevis, e" - 3. Deklination, 2 Endungen
      var stemIE = parts[0].endsWith("is") ? parts[0].slice(0, -2) : parts[0];
      var g = { gen: stemIE + "is", dat: stemIE + "ī", abl: stemIE + "ī" };
      out.sg.m = { nom: parts[0], gen: g.gen, dat: g.dat, akk: stemIE + "em", abl: g.abl, vok: parts[0] };
      out.sg.f = out.sg.m;
      out.sg.n = { nom: stemIE + parts[1], gen: g.gen, dat: g.dat, akk: stemIE + parts[1], abl: g.abl, vok: stemIE + parts[1] };
      var p = { nom: stemIE + "ēs", gen: stemIE + "ium", dat: stemIE + "ibus", abl: stemIE + "ibus" };
      out.pl.m = { nom: p.nom, gen: p.gen, dat: p.dat, akk: p.nom, abl: p.abl, vok: p.nom };
      out.pl.f = out.pl.m;
      out.pl.n = { nom: stemIE + "ia", gen: p.gen, dat: p.dat, akk: stemIE + "ia", abl: p.abl, vok: stemIE + "ia" };
      return out;
    }

    if (type === "one_ending" || type === "comparative") {
      // "ingēns, ingentis" ODER "melior, melius (Gen. meliōris)"
      var genForm = type === "comparative" ? entry.adj_stem_gen : parts[1];
      var stemOE = genForm.endsWith("is") ? genForm.slice(0, -2) : genForm;
      var isComp = type === "comparative";
      var mfNom = parts[0];
      var nNomForm = isComp ? parts[1] : parts[0];
      var g2 = { gen: stemOE + "is", dat: stemOE + "ī" };
      var ablSg = isComp ? stemOE + "e" : stemOE + "ī"; // Komparative: Abl. -e; einendige Adj.: meist -ī (Schulgebrauch)
      var akkSgMF = stemOE + "em";
      out.sg.m = { nom: mfNom, gen: g2.gen, dat: g2.dat, akk: akkSgMF, abl: ablSg, vok: mfNom };
      out.sg.f = out.sg.m;
      out.sg.n = { nom: nNomForm, gen: g2.gen, dat: g2.dat, akk: nNomForm, abl: ablSg, vok: nNomForm };
      var plGen = isComp ? stemOE + "um" : stemOE + "ium";
      var plNomMF = stemOE + "ēs";
      var plNomN = isComp ? stemOE + "a" : stemOE + "ia";
      out.pl.m = { nom: plNomMF, gen: plGen, dat: stemOE + "ibus", akk: stemOE + "ēs", abl: stemOE + "ibus", vok: plNomMF };
      out.pl.f = out.pl.m;
      out.pl.n = { nom: plNomN, gen: plGen, dat: stemOE + "ibus", akk: plNomN, abl: stemOE + "ibus", vok: plNomN };
      return out;
    }

    return null; // Typ nicht unterstützt (z.B. indeklinable Zahladjektive)
  }

  // ==================================================================
  // 3) PRONOMEN (geschlossene, feste Paradigmen)
  // ==================================================================

  var PRONOUN_PARADIGMS = {
    "ego": { sg: { nom: "ego", gen: "meī", dat: "mihi", akk: "mē", abl: "mē" },
             pl: { nom: "nōs", gen: "nostrī / nostrum", dat: "nōbīs", akk: "nōs", abl: "nōbīs" } },
    "tū": { sg: { nom: "tū", gen: "tuī", dat: "tibi", akk: "tē", abl: "tē" },
            pl: { nom: "vōs", gen: "vestrī / vestrum", dat: "vōbīs", akk: "vōs", abl: "vōbīs" } },
    "sē": { sg: { nom: "–", gen: "suī", dat: "sibi", akk: "sē", abl: "sē" },
            pl: { nom: "–", gen: "suī", dat: "sibi", akk: "sē", abl: "sē" } },
    "is, ea, id": {
      sg: { m: { nom: "is", gen: "eius", dat: "eī", akk: "eum", abl: "eō" },
            f: { nom: "ea", gen: "eius", dat: "eī", akk: "eam", abl: "eā" },
            n: { nom: "id", gen: "eius", dat: "eī", akk: "id", abl: "eō" } },
      pl: { m: { nom: "eī / iī", gen: "eōrum", dat: "eīs / iīs", akk: "eōs", abl: "eīs / iīs" },
            f: { nom: "eae", gen: "eārum", dat: "eīs", akk: "eās", abl: "eīs" },
            n: { nom: "ea", gen: "eōrum", dat: "eīs", akk: "ea", abl: "eīs" } },
    },
    "hic, haec, hoc": {
      sg: { m: { nom: "hic", gen: "huius", dat: "huic", akk: "hunc", abl: "hōc" },
            f: { nom: "haec", gen: "huius", dat: "huic", akk: "hanc", abl: "hāc" },
            n: { nom: "hoc", gen: "huius", dat: "huic", akk: "hoc", abl: "hōc" } },
      pl: { m: { nom: "hī", gen: "hōrum", dat: "hīs", akk: "hōs", abl: "hīs" },
            f: { nom: "hae", gen: "hārum", dat: "hīs", akk: "hās", abl: "hīs" },
            n: { nom: "haec", gen: "hōrum", dat: "hīs", akk: "haec", abl: "hīs" } },
    },
    "ille, illa, illud": {
      sg: { m: { nom: "ille", gen: "illīus", dat: "illī", akk: "illum", abl: "illō" },
            f: { nom: "illa", gen: "illīus", dat: "illī", akk: "illam", abl: "illā" },
            n: { nom: "illud", gen: "illīus", dat: "illī", akk: "illud", abl: "illō" } },
      pl: { m: { nom: "illī", gen: "illōrum", dat: "illīs", akk: "illōs", abl: "illīs" },
            f: { nom: "illae", gen: "illārum", dat: "illīs", akk: "illās", abl: "illīs" },
            n: { nom: "illa", gen: "illōrum", dat: "illīs", akk: "illa", abl: "illīs" } },
    },
    "iste, ista, istud": {
      sg: { m: { nom: "iste", gen: "istīus", dat: "istī", akk: "istum", abl: "istō" },
            f: { nom: "ista", gen: "istīus", dat: "istī", akk: "istam", abl: "istā" },
            n: { nom: "istud", gen: "istīus", dat: "istī", akk: "istud", abl: "istō" } },
      pl: { m: { nom: "istī", gen: "istōrum", dat: "istīs", akk: "istōs", abl: "istīs" },
            f: { nom: "istae", gen: "istārum", dat: "istīs", akk: "istās", abl: "istīs" },
            n: { nom: "ista", gen: "istōrum", dat: "istīs", akk: "ista", abl: "istīs" } },
    },
    "ipse, ipsa, ipsum": {
      sg: { m: { nom: "ipse", gen: "ipsīus", dat: "ipsī", akk: "ipsum", abl: "ipsō" },
            f: { nom: "ipsa", gen: "ipsīus", dat: "ipsī", akk: "ipsam", abl: "ipsā" },
            n: { nom: "ipsum", gen: "ipsīus", dat: "ipsī", akk: "ipsum", abl: "ipsō" } },
      pl: { m: { nom: "ipsī", gen: "ipsōrum", dat: "ipsīs", akk: "ipsōs", abl: "ipsīs" },
            f: { nom: "ipsae", gen: "ipsārum", dat: "ipsīs", akk: "ipsās", abl: "ipsīs" },
            n: { nom: "ipsa", gen: "ipsōrum", dat: "ipsīs", akk: "ipsa", abl: "ipsīs" } },
    },
    "īdem, eadem, idem": {
      sg: { m: { nom: "īdem", gen: "eiusdem", dat: "eīdem", akk: "eundem", abl: "eōdem" },
            f: { nom: "eadem", gen: "eiusdem", dat: "eīdem", akk: "eandem", abl: "eādem" },
            n: { nom: "idem", gen: "eiusdem", dat: "eīdem", akk: "idem", abl: "eōdem" } },
      pl: { m: { nom: "eīdem / iīdem", gen: "eōrundem", dat: "eīsdem", akk: "eōsdem", abl: "eīsdem" },
            f: { nom: "eaedem", gen: "eārundem", dat: "eīsdem", akk: "eāsdem", abl: "eīsdem" },
            n: { nom: "eadem", gen: "eōrundem", dat: "eīsdem", akk: "eadem", abl: "eīsdem" } },
    },
    "quī, quae, quod": {
      sg: { m: { nom: "quī", gen: "cuius", dat: "cui", akk: "quem", abl: "quō" },
            f: { nom: "quae", gen: "cuius", dat: "cui", akk: "quam", abl: "quā" },
            n: { nom: "quod", gen: "cuius", dat: "cui", akk: "quod", abl: "quō" } },
      pl: { m: { nom: "quī", gen: "quōrum", dat: "quibus", akk: "quōs", abl: "quibus" },
            f: { nom: "quae", gen: "quārum", dat: "quibus", akk: "quās", abl: "quibus" },
            n: { nom: "quae", gen: "quōrum", dat: "quibus", akk: "quae", abl: "quibus" } },
    },
    "quis, quid": {
      sg: { nom: "quis / quid", gen: "cuius", dat: "cui", akk: "quem / quid", abl: "quō" },
      pl: { nom: "quī / quae", gen: "quōrum / quārum", dat: "quibus", akk: "quōs / quae", abl: "quibus" },
    },
  };

  function declinePronoun(entry) {
    var key = entry.lemma;
    if (PRONOUN_PARADIGMS[key]) return { table: PRONOUN_PARADIGMS[key], gendered: !!PRONOUN_PARADIGMS[key].sg.m };
    return null;
  }

  // ==================================================================
  // 4) VERB
  // ==================================================================

  var IMPF_ACT_ENDINGS = ["bam", "bās", "bat", "bāmus", "bātis", "bant"];
  var FUT_ACT_ENDINGS_12 = ["bō", "bis", "bit", "bimus", "bitis", "bunt"]; // 1./2. Konj.
  var FUT_ACT_ENDINGS_34 = ["am", "ēs", "et", "ēmus", "ētis", "ent"]; // 3./4. Konj.
  var PRES_SUBJ_ENDINGS_1 = ["em", "ēs", "et", "ēmus", "ētis", "ent"]; // 1. Konj (a->e)
  var PRES_SUBJ_ENDINGS_234 = ["am", "ās", "at", "āmus", "ātis", "ant"]; // 2./3./4. Konj
  var IMPF_SUBJ_ACT_ENDINGS = ["rem", "rēs", "ret", "rēmus", "rētis", "rent"]; // an Infinitiv angehängt
  var PERF_ACT_ENDINGS = ["ī", "istī", "it", "imus", "istis", "ērunt"];
  var PLUPERF_ACT_ENDINGS = ["eram", "erās", "erat", "erāmus", "erātis", "erant"];
  var FUT_PERF_ACT_ENDINGS = ["erō", "eris", "erit", "erimus", "eritis", "erint"];
  var PERF_SUBJ_ACT_ENDINGS = ["erim", "erīs", "erit", "erīmus", "erītis", "erint"];
  var PLUPERF_SUBJ_ACT_ENDINGS = ["issem", "issēs", "isset", "issēmus", "issētis", "issent"];

  var IMPF_PASS_ENDINGS = ["bar", "bāris", "bātur", "bāmur", "bāminī", "bantur"];
  var FUT_PASS_ENDINGS_12 = ["bor", "beris", "bitur", "bimur", "biminī", "buntur"];
  var FUT_PASS_ENDINGS_34 = ["ar", "ēris", "ētur", "ēmur", "ēminī", "entur"];
  var PRES_SUBJ_PASS_1 = ["er", "ēris", "ētur", "ēmur", "ēminī", "entur"];
  var PRES_SUBJ_PASS_234 = ["ar", "āris", "ātur", "āmur", "āminī", "antur"];
  var IMPF_SUBJ_PASS_ENDINGS = ["rer", "rēris", "rētur", "rēmur", "rēminī", "rentur"];

  var CONJ_INFO = {
    1: { presStem: function (inf) { return inf.slice(0, -3); } }, // amāre -> am
    2: { presStem: function (inf) { return inf.slice(0, -3); } }, // docēre -> doc
    3: { presStem: function (inf) { return inf.slice(0, -3); } }, // agere -> ag
    "3io": { presStem: function (inf) { return inf.slice(0, -3); } }, // capere -> cap
    4: { presStem: function (inf) { return inf.slice(0, -3); } }, // audīre -> aud
  };

  function detectConjugation(infinitive, pres1sg) {
    if (infinitive.endsWith("āre")) return 1;
    if (infinitive.endsWith("ēre")) return 2;
    if (infinitive.endsWith("īre")) return 4;
    if (infinitive.endsWith("ere")) {
      // Unterscheidung 3. vs. 3-io über das Präsens (agō vs. capiō)
      var stemFromInf = infinitive.slice(0, -3);
      if (pres1sg && pres1sg.endsWith("iō") && pres1sg.slice(0, -1) === stemFromInf + "i") return "3io";
      return 3;
    }
    return null;
  }

  function detectDeponentConjugation(infinitive, pres1sg) {
    if (infinitive.endsWith("ārī")) return "1dep";
    if (infinitive.endsWith("ērī")) return "2dep";
    if (infinitive.endsWith("īrī")) return "4dep";
    if (infinitive.endsWith("ī")) {
      // 3. Konjugation Deponens, evtl. -io-Typ (patior, morior, ingredior ...)
      var stemFromInf = infinitive.slice(0, -1);
      if (pres1sg && pres1sg.endsWith("ior")) {
        var stemFromPres = pres1sg.slice(0, -3);
        if (stemFromPres === stemFromInf) return "3iodep";
      }
      return "3dep";
    }
    return null;
  }

  // ---- Unregelmaessige Basisparadigmen (esse, posse, velle, nolle, ferre, ire, fieri) ----

  var IRREGULAR_BASE = {
    esse: {
      pres: ["sum", "es", "est", "sumus", "estis", "sunt"],
      impf: ["eram", "erās", "erat", "erāmus", "erātis", "erant"],
      fut: ["erō", "eris", "erit", "erimus", "eritis", "erunt"],
      presSubj: ["sim", "sīs", "sit", "sīmus", "sītis", "sint"],
      impfSubj: ["essem", "essēs", "esset", "essēmus", "essētis", "essent"],
      imper: ["es", "este"],
      infPres: "esse",
      perfEndingsOverride: null,
      partPres: null,
    },
    posse: {
      pres: ["possum", "potes", "potest", "possumus", "potestis", "possunt"],
      impf: ["poteram", "poterās", "poterat", "poterāmus", "poterātis", "poterant"],
      fut: ["poterō", "poteris", "poterit", "poterimus", "poteritis", "poterunt"],
      presSubj: ["possim", "possīs", "possit", "possīmus", "possītis", "possint"],
      impfSubj: ["possem", "possēs", "posset", "possēmus", "possētis", "possent"],
      imper: null,
      infPres: "posse",
      partPres: null,
    },
    velle: {
      pres: ["volō", "vīs", "vult", "volumus", "vultis", "volunt"],
      impf: ["volēbam", "volēbās", "volēbat", "volēbāmus", "volēbātis", "volēbant"],
      fut: ["volam", "volēs", "volet", "volēmus", "volētis", "volent"],
      presSubj: ["velim", "velīs", "velit", "velīmus", "velītis", "velint"],
      impfSubj: ["vellem", "vellēs", "vellet", "vellēmus", "vellētis", "vellent"],
      imper: null,
      infPres: "velle",
      partPres: "volēns",
    },
    "nōlle": {
      pres: ["nōlō", "nōn vīs", "nōn vult", "nōlumus", "nōn vultis", "nōlunt"],
      impf: ["nōlēbam", "nōlēbās", "nōlēbat", "nōlēbāmus", "nōlēbātis", "nōlēbant"],
      fut: ["nōlam", "nōlēs", "nōlet", "nōlēmus", "nōlētis", "nōlent"],
      presSubj: ["nōlim", "nōlīs", "nōlit", "nōlīmus", "nōlītis", "nōlint"],
      impfSubj: ["nōllem", "nōllēs", "nōllet", "nōllēmus", "nōllētis", "nōllent"],
      imper: ["nōlī", "nōlīte"],
      infPres: "nōlle",
      partPres: "nōlēns",
    },
    ferre: {
      pres: ["ferō", "fers", "fert", "ferimus", "fertis", "ferunt"],
      impf: ["ferēbam", "ferēbās", "ferēbat", "ferēbāmus", "ferēbātis", "ferēbant"],
      fut: ["feram", "ferēs", "feret", "ferēmus", "ferētis", "ferent"],
      presSubj: ["feram", "ferās", "ferat", "ferāmus", "ferātis", "ferant"],
      impfSubj: ["ferrem", "ferrēs", "ferret", "ferrēmus", "ferrētis", "ferrent"],
      imper: ["fer", "ferte"],
      infPres: "ferre",
      partPres: "ferēns",
      presPass: ["feror", "ferris", "fertur", "ferimur", "feriminī", "feruntur"],
      impfPass: ["ferēbar", "ferēbāris", "ferēbātur", "ferēbāmur", "ferēbāminī", "ferēbantur"],
      futPass: ["ferar", "ferēris", "ferētur", "ferēmur", "ferēminī", "ferentur"],
      presSubjPass: ["ferar", "ferāris", "ferātur", "ferāmur", "ferāminī", "ferantur"],
      impfSubjPass: ["ferrer", "ferrēris", "ferrētur", "ferrēmur", "ferrēminī", "ferrentur"],
      infPresPass: "ferrī",
    },
    "īre": {
      pres: ["eō", "īs", "it", "īmus", "ītis", "eunt"],
      impf: ["ībam", "ībās", "ībat", "ībāmus", "ībātis", "ībant"],
      fut: ["ībō", "ībis", "ībit", "ībimus", "ībitis", "ībunt"],
      presSubj: ["eam", "eās", "eat", "eāmus", "eātis", "eant"],
      impfSubj: ["īrem", "īrēs", "īret", "īrēmus", "īrētis", "īrent"],
      imper: ["ī", "īte"],
      infPres: "īre",
      partPres: "iēns, euntis",
      perfEndingsOverride: ["ī", "istī", "it", "imus", "istis", "ērunt"],
    },
    "fierī": {
      pres: ["fīō", "fīs", "fit", "fīmus", "fītis", "fīunt"],
      impf: ["fīēbam", "fīēbās", "fīēbat", "fīēbāmus", "fīēbātis", "fīēbant"],
      fut: ["fīam", "fīēs", "fīet", "fīēmus", "fīētis", "fīent"],
      presSubj: ["fīam", "fīās", "fīat", "fīāmus", "fīātis", "fīant"],
      impfSubj: ["fierem", "fierēs", "fieret", "fierēmus", "fierētis", "fierent"],
      imper: [null, "fīte"],
      infPres: "fierī",
      partPres: null,
    },
    "dare": {
      // "dare" ist 1. Konjugation mit kurzem a im Praesensstamm
      pres: ["dō", "dās", "dat", "damus", "datis", "dant"],
      impf: ["dabam", "dabās", "dabat", "dabāmus", "dabātis", "dabant"],
      fut: ["dabō", "dabis", "dabit", "dabimus", "dabitis", "dabunt"],
      presSubj: ["dem", "dēs", "det", "dēmus", "dētis", "dent"],
      impfSubj: ["darem", "darēs", "daret", "darēmus", "darētis", "darent"],
      imper: ["dā", "date"],
      infPres: "dare",
      partPres: "dāns, dantis",
      presPass: ["dor", "dāris", "datur", "damur", "daminī", "dantur"],
      impfPass: ["dabar", "dabāris", "dabātur", "dabāmur", "dabāminī", "dabantur"],
      futPass: ["dabor", "daberis", "dabitur", "dabimur", "dabiminī", "dabuntur"],
      presSubjPass: ["der", "dēris", "dētur", "dēmur", "dēminī", "dentur"],
      impfSubjPass: ["darer", "darēris", "darētur", "darēmur", "darēminī", "darentur"],
      infPresPass: "darī",
    },
  };

  function findIrregularFamily(infinitive) {
    if (infinitive === "dare") return "dare";
    if (IRREGULAR_BASE[infinitive]) return infinitive;
    if (infinitive.endsWith("esse")) return "esse";
    if (infinitive.endsWith("ferre")) return "ferre";
    if (infinitive.endsWith("īre") && infinitive !== "īre") return "īre-maybe";
    return null;
  }

  function applyPrefix(baseArr, prefix) {
    if (!baseArr) return baseArr;
    return baseArr.map(function (f) {
      if (f === null || f === undefined) return f;
      return prefix + f;
    });
  }

  // Perfektpassiv-System ist periphrastisch (PPP + Form von "esse"), z.B.
  // "amātus sum", "amātus eram", "amātus sim" ... Da das Partizip eigentlich
  // mit dem Subjekt übereinstimmt, wird hier - wie in Konjugationstabellen
  // ueblich - standardmaessig die maskuline Form verwendet.
  function buildPeriphrasticPassive(pppStem) {
    var sg = pppStem + "us", pl = pppStem + "ī";
    function combine(esseForms) {
      return [
        sg + " " + esseForms[0], sg + " " + esseForms[1], sg + " " + esseForms[2],
        pl + " " + esseForms[3], pl + " " + esseForms[4], pl + " " + esseForms[5],
      ];
    }
    return {
      perfPass: combine(IRREGULAR_BASE.esse.pres),
      pluperfPass: combine(IRREGULAR_BASE.esse.impf),
      futPerfPass: combine(IRREGULAR_BASE.esse.fut),
      perfSubjPass: combine(IRREGULAR_BASE.esse.presSubj),
      pluperfSubjPass: combine(IRREGULAR_BASE.esse.impfSubj),
    };
  }

  /**
   * Ermittelt fuer ein Verb aus vocab.json alle verfuegbaren Formen.
   */
  function analyzeVerb(entry) {
    var parts = entry.verb_forms || splitLemmaParts(entry.lemma);
    var infinitive = parts[0];
    var pres1sg = parts[1] || null;
    var perfect = parts[2] || null;
    var supine = parts[3] || null;

    var isDeponent = false;
    var deponentPastPart = null;
    for (var i = 1; i < parts.length; i++) {
      if (parts[i] && parts[i].endsWith(" sum")) {
        deponentPastPart = parts[i].replace(/ sum$/, "");
        isDeponent = true;
      }
    }

    var result = { infinitive: infinitive, pres1sg: pres1sg, isDeponent: isDeponent, raw: parts };

    // --- Unregelmaessige Familien ---
    var fam = findIrregularFamily(infinitive);
    if (fam === "īre-maybe") {
      fam = (pres1sg && pres1sg.endsWith("eō") && !pres1sg.endsWith("ieō")) ? "īre" : null;
    }
    if (fam) {
      var base = IRREGULAR_BASE[fam];
      var prefix = infinitive === base.infPres ? "" : infinitive.slice(0, infinitive.length - base.infPres.length);
      result.irregular = true;
      result.family = fam;
      result.prefix = prefix;
      result.pres = applyPrefix(base.pres, prefix);
      result.impf = applyPrefix(base.impf, prefix);
      result.fut = applyPrefix(base.fut, prefix);
      result.presSubj = applyPrefix(base.presSubj, prefix);
      result.impfSubj = applyPrefix(base.impfSubj, prefix);
      result.imper = base.imper ? base.imper.map(function (f) { return f ? prefix + f : f; }) : null;
      result.infPres = prefix + base.infPres;
      result.partPres = base.partPres ? prefix + base.partPres : null;
      if (base.presPass) {
        result.presPass = applyPrefix(base.presPass, prefix);
        result.impfPass = applyPrefix(base.impfPass, prefix);
        result.futPass = applyPrefix(base.futPass, prefix);
        result.presSubjPass = applyPrefix(base.presSubjPass, prefix);
        result.impfSubjPass = applyPrefix(base.impfSubjPass, prefix);
        result.infPresPass = prefix + base.infPresPass;
      }
      if (perfect) {
        var perfStem = perfect.endsWith("ī") ? perfect.slice(0, -1) : perfect;
        var pEnd = base.perfEndingsOverride || PERF_ACT_ENDINGS;
        result.perf = pEnd.map(function (e) { return perfStem + e; });
        result.pluperf = PLUPERF_ACT_ENDINGS.map(function (e) { return perfStem + e; });
        result.futPerf = FUT_PERF_ACT_ENDINGS.map(function (e) { return perfStem + e; });
        result.perfSubj = PERF_SUBJ_ACT_ENDINGS.map(function (e) { return perfStem + e; });
        result.pluperfSubj = PLUPERF_SUBJ_ACT_ENDINGS.map(function (e) { return perfStem + e; });
        result.infPerf = perfStem + "isse";
      }
      if (supine) {
        result.pppStem = supine.slice(0, -2);
        result.supine = supine;
        if (base.presPass) {
          // nur Verben mit echtem Passiv (ferre, dare) bekommen das
          // periphrastische Perfektpassiv-System
          Object.assign(result, buildPeriphrasticPassive(result.pppStem));
        }
      }
      result.hasPerfectData = !!perfect;
      result.hasSupineData = !!supine;
      return result;
    }

    // --- Deponentien (regelmaessig) ---
    var depConj = isDeponent ? detectDeponentConjugation(infinitive, pres1sg) : null;
    if (depConj) {
      var stemDep, themeDep;
      if (depConj === "1dep") { stemDep = infinitive.slice(0, -3); themeDep = "ā"; }
      else if (depConj === "2dep") { stemDep = infinitive.slice(0, -3); themeDep = "ē"; }
      else if (depConj === "4dep") { stemDep = infinitive.slice(0, -3); themeDep = "ī"; }
      else { stemDep = infinitive.slice(0, -1); themeDep = ""; } // 3dep / 3iodep

      result.conjClass = depConj;

      if (depConj === "1dep" || depConj === "2dep" || depConj === "4dep") {
        var depEndSets = {
          "1dep": ["or", "āris", "ātur", "āmur", "āminī", "antur"],
          "2dep": ["eor", "ēris", "ētur", "ēmur", "ēminī", "entur"],
          "4dep": ["ior", "īris", "ītur", "īmur", "īminī", "iuntur"],
        };
        var depEnds = depEndSets[depConj];
        result.pres = depEnds.map(function (e) { return stemDep + e; });
        result.impf = IMPF_PASS_ENDINGS.map(function (e) { return stemDep + themeDep + e; });
        result.fut = (depConj === "1dep" || depConj === "2dep")
          ? FUT_PASS_ENDINGS_12.map(function (e) { return stemDep + e; })
          : FUT_PASS_ENDINGS_34.map(function (e) { return stemDep + e; });
        result.presSubj = (depConj === "1dep")
          ? PRES_SUBJ_PASS_1.map(function (e) { return stemDep + e; })
          : PRES_SUBJ_PASS_234.map(function (e) { return stemDep + e; });
        result.impfSubj = IMPF_SUBJ_PASS_ENDINGS.map(function (e) { return stemDep + themeDep + e; });
        result.infPres = infinitive;
        result.imper = [stemDep + themeDep + "re", stemDep + themeDep + "minī"];
      } else if (depConj === "3iodep") {
        result.pres = [stemDep + "ior", stemDep + "eris", stemDep + "itur", stemDep + "imur", stemDep + "iminī", stemDep + "iuntur"];
        result.impf = [stemDep + "iēbar", stemDep + "iēbāris", stemDep + "iēbātur", stemDep + "iēbāmur", stemDep + "iēbāminī", stemDep + "iēbantur"];
        result.fut = [stemDep + "iar", stemDep + "iēris", stemDep + "iētur", stemDep + "iēmur", stemDep + "iēminī", stemDep + "ientur"];
        result.presSubj = [stemDep + "iar", stemDep + "iāris", stemDep + "iātur", stemDep + "iāmur", stemDep + "iāminī", stemDep + "iantur"];
        result.impfSubj = IMPF_SUBJ_PASS_ENDINGS.map(function (e) { return stemDep + "e" + e; });
        result.imper = [stemDep + "ere", stemDep + "iminī"];
        result.infPres = infinitive;
      } else {
        // 3dep
        result.pres = [stemDep + "or", stemDep + "eris", stemDep + "itur", stemDep + "imur", stemDep + "iminī", stemDep + "untur"];
        result.impf = [stemDep + "ēbar", stemDep + "ēbāris", stemDep + "ēbātur", stemDep + "ēbāmur", stemDep + "ēbāminī", stemDep + "ēbantur"];
        result.fut = [stemDep + "ar", stemDep + "ēris", stemDep + "ētur", stemDep + "ēmur", stemDep + "ēminī", stemDep + "entur"];
        result.presSubj = [stemDep + "ar", stemDep + "āris", stemDep + "ātur", stemDep + "āmur", stemDep + "āminī", stemDep + "antur"];
        result.impfSubj = IMPF_SUBJ_PASS_ENDINGS.map(function (e) { return stemDep + "e" + e; });
        result.imper = [stemDep + "ere", stemDep + "iminī"];
        result.infPres = infinitive;
      }

      if (deponentPastPart) {
        result.pppStem = deponentPastPart.replace(/us$/, "");
        result.perfPeriphrastic = true; // Perfekt = PPP + esse
      }
      result.hasPerfectData = !!deponentPastPart;
      result.hasSupineData = false;
      result.isDeponent = true;
      return result;
    }

    // --- Regelmaessige aktive Verben ---
    var conj = detectConjugation(infinitive, pres1sg);
    result.conjClass = conj;
    if (!conj) { result.unsupported = true; return result; }

    var stem = CONJ_INFO[conj].presStem(infinitive);

    function build(endArr, joiner) {
      return endArr.map(function (e) { return stem + joiner + e; });
    }

    if (conj === 1) {
      result.pres = ["ō", "ās", "at", "āmus", "ātis", "ant"].map(function (e) { return stem + e; });
      result.impf = build(IMPF_ACT_ENDINGS, "ā");
      result.fut = build(FUT_ACT_ENDINGS_12, "ā");
      result.presSubj = build(PRES_SUBJ_ENDINGS_1, "");
      result.impfSubj = build(IMPF_SUBJ_ACT_ENDINGS, "ā");
      result.imper = [stem + "ā", stem + "āte"];
      result.infPres = infinitive;
      result.partPres = stem + "āns, " + stem + "antis";
      result.presPass = ["or", "āris", "ātur", "āmur", "āminī", "antur"].map(function (e) { return stem + e; });
      result.impfPass = build(IMPF_PASS_ENDINGS, "ā");
      result.futPass = build(FUT_PASS_ENDINGS_12, "ā");
      result.presSubjPass = build(PRES_SUBJ_PASS_1, "");
      result.impfSubjPass = build(IMPF_SUBJ_PASS_ENDINGS, "ā");
      result.infPresPass = stem + "ārī";
    } else if (conj === 2) {
      result.pres = ["eō", "ēs", "et", "ēmus", "ētis", "ent"].map(function (e) { return stem + e; });
      result.impf = build(IMPF_ACT_ENDINGS, "ē");
      result.fut = build(FUT_ACT_ENDINGS_12, "ē");
      result.presSubj = build(PRES_SUBJ_ENDINGS_234, "");
      result.impfSubj = build(IMPF_SUBJ_ACT_ENDINGS, "ē");
      result.imper = [stem + "ē", stem + "ēte"];
      result.infPres = infinitive;
      result.partPres = stem + "ēns, " + stem + "entis";
      result.presPass = ["eor", "ēris", "ētur", "ēmur", "ēminī", "entur"].map(function (e) { return stem + e; });
      result.impfPass = build(IMPF_PASS_ENDINGS, "ē");
      result.futPass = build(FUT_PASS_ENDINGS_12, "ē");
      result.presSubjPass = build(PRES_SUBJ_PASS_234, "");
      result.impfSubjPass = build(IMPF_SUBJ_PASS_ENDINGS, "ē");
      result.infPresPass = stem + "ērī";
    } else if (conj === 3) {
      result.pres = [stem + "ō", stem + "is", stem + "it", stem + "imus", stem + "itis", stem + "unt"];
      result.impf = build(IMPF_ACT_ENDINGS, "ē");
      result.fut = build(FUT_ACT_ENDINGS_34, "");
      result.presSubj = build(PRES_SUBJ_ENDINGS_234, "");
      result.impfSubj = build(IMPF_SUBJ_ACT_ENDINGS, "e");
      result.imper = [stem + "e", stem + "ite"];
      result.infPres = infinitive;
      result.partPres = stem + "ēns, " + stem + "entis";
      result.presPass = [stem + "or", stem + "eris", stem + "itur", stem + "imur", stem + "iminī", stem + "untur"];
      result.impfPass = build(IMPF_PASS_ENDINGS, "ē");
      result.futPass = build(FUT_PASS_ENDINGS_34, "");
      result.presSubjPass = build(PRES_SUBJ_PASS_234, "");
      result.impfSubjPass = build(IMPF_SUBJ_PASS_ENDINGS, "e");
      result.infPresPass = stem + "ī";
    } else if (conj === "3io") {
      result.pres = [stem + "iō", stem + "is", stem + "it", stem + "imus", stem + "itis", stem + "iunt"];
      result.impf = build(IMPF_ACT_ENDINGS, "iē");
      result.fut = build(FUT_ACT_ENDINGS_34, "i");
      result.presSubj = build(PRES_SUBJ_ENDINGS_234, "i");
      result.impfSubj = build(IMPF_SUBJ_ACT_ENDINGS, "e");
      result.imper = [stem + "e", stem + "ite"];
      result.infPres = infinitive;
      result.partPres = stem + "iēns, " + stem + "ientis";
      result.presPass = [stem + "ior", stem + "eris", stem + "itur", stem + "imur", stem + "iminī", stem + "iuntur"];
      result.impfPass = build(IMPF_PASS_ENDINGS, "iē");
      result.futPass = build(FUT_PASS_ENDINGS_34, "i");
      result.presSubjPass = build(PRES_SUBJ_PASS_234, "i");
      result.impfSubjPass = build(IMPF_SUBJ_PASS_ENDINGS, "e");
      result.infPresPass = stem + "ī";
    } else if (conj === 4) {
      result.pres = ["iō", "īs", "it", "īmus", "ītis", "iunt"].map(function (e) { return stem + e; });
      result.impf = build(IMPF_ACT_ENDINGS, "iē");
      result.fut = build(FUT_ACT_ENDINGS_34, "i");
      result.presSubj = build(PRES_SUBJ_ENDINGS_234, "i");
      result.impfSubj = build(IMPF_SUBJ_ACT_ENDINGS, "ī");
      result.imper = [stem + "ī", stem + "īte"];
      result.infPres = infinitive;
      result.partPres = stem + "iēns, " + stem + "ientis";
      result.presPass = ["ior", "īris", "ītur", "īmur", "īminī", "iuntur"].map(function (e) { return stem + e; });
      result.impfPass = build(IMPF_PASS_ENDINGS, "iē");
      result.futPass = build(FUT_PASS_ENDINGS_34, "i");
      result.presSubjPass = build(PRES_SUBJ_PASS_234, "i");
      result.impfSubjPass = build(IMPF_SUBJ_PASS_ENDINGS, "ī");
      result.infPresPass = stem + "īrī";
    }

    if (isDeponent && deponentPastPart) {
      // Semideponens (audeo/gaudeo/soleo): aktives Praesenssystem (oben schon
      // gebaut), aber deponentisches Perfektsystem (PPP + esse) - keine
      // eigene Passivbedeutung, daher die generierten Passivformen verwerfen.
      delete result.presPass; delete result.impfPass; delete result.futPass;
      delete result.presSubjPass; delete result.impfSubjPass; delete result.infPresPass;
      result.pppStem = deponentPastPart.replace(/us$/, "");
      result.perfPeriphrastic = true;
      result.hasPerfectData = true;
      result.hasSupineData = false;
    } else if (perfect) {
      var perfStem2 = perfect.endsWith("ī") ? perfect.slice(0, -1) : perfect;
      result.perf = PERF_ACT_ENDINGS.map(function (e) { return perfStem2 + e; });
      result.pluperf = PLUPERF_ACT_ENDINGS.map(function (e) { return perfStem2 + e; });
      result.futPerf = FUT_PERF_ACT_ENDINGS.map(function (e) { return perfStem2 + e; });
      result.perfSubj = PERF_SUBJ_ACT_ENDINGS.map(function (e) { return perfStem2 + e; });
      result.pluperfSubj = PLUPERF_SUBJ_ACT_ENDINGS.map(function (e) { return perfStem2 + e; });
      result.infPerf = perfStem2 + "isse";
      result.hasPerfectData = true;
      if (supine) {
        result.pppStem = supine.slice(0, -2);
        result.supine = supine;
        result.hasSupineData = true;
        Object.assign(result, buildPeriphrasticPassive(result.pppStem));
      }
    }
    return result;
  }

  // ==================================================================
  // Öffentliche API
  // ==================================================================

  return {
    analyzeNoun: analyzeNoun,
    declineNoun: declineNoun,
    declineAdjective: declineAdjective,
    declinePronoun: declinePronoun,
    PRONOUN_PARADIGMS: PRONOUN_PARADIGMS,
    analyzeVerb: analyzeVerb,
    detectConjugation: detectConjugation,
    detectDeponentConjugation: detectDeponentConjugation,
    splitLemmaParts: splitLemmaParts,
  };
});
