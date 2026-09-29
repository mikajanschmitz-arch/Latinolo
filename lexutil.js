/* ==========================================================================
   lexutil.js — gemeinsame Formatierungs-Helfer für Vokabeleintraege
   ========================================================================== */

var LexUtil = (function () {
  "use strict";

  function firstForm(entry) {
    return entry.lemma.split(",")[0].trim();
  }

  function abbreviateGen(nom, gen, declension) {
    // 3./4. Deklination: immer die volle Form zeigen, keine Kürzung mit "-...".
    if (declension === 3 || declension === 4) {
      return nom + ", " + gen;
    }
    // 1. Deklination (nom endet auf "a", Genitiv ist nom+"e"): konventionell
    // wird "-ae" gezeigt (das auslautende "a" ersetzt), nicht nur "-e".
    if (declension === 1 && nom.endsWith("a") && gen === nom + "e") {
      return nom + ", -ae";
    }
    var i = 0;
    while (i < nom.length && i < gen.length && nom[i] === gen[i]) i++;
    if (i >= 2 && i >= nom.length - 3 && i < gen.length) {
      return nom + ", -" + gen.slice(i);
    }
    return nom + ", " + gen;
  }

  // Baut die "gekürzte Form" wie sie auf der Rückseite der Karteikarte und in
  // der Suche oben angezeigt wird, z.B. "servus, -ī m." / "bonus, a, um" /
  // "dīcere, dīcō, dīxī, dictum". Bei der 3. Deklination (z.B. "ōrdō, ōrdinis")
  // wird bewusst nicht gekürzt, weil sich der Stamm dort oft stark verändert.
  function shortForm(entry) {
    if (entry.pos === "Substantiv") {
      var parts = entry.lemma.split(",").map(function (s) { return s.trim(); });
      var nom = parts[0];
      var gen = parts[1] || null;
      var declension = null;
      var isPluraleTantum = false;
      if (typeof Morph !== "undefined") {
        var info = Morph.analyzeNoun(entry);
        isPluraleTantum = !!info.pluraleTantum;
        if (!info.irregular && !info.pluraleTantum) {
          declension = info.declension;
          if (!gen) gen = info.gen;
        }
      }
      var base = gen ? abbreviateGen(nom, gen, declension) : nom;
      var g = entry.gender ? entry.gender + "." : "";
      if (isPluraleTantum) g = (g ? g + " " : "") + "Pl.";
      var noteExtra = entry.irregular_note ? " (" + entry.irregular_note + ")" : "";
      return [base, g].filter(Boolean).join(" ") + noteExtra;
    }
    if (entry.pos === "Verb") {
      var forms = entry.verb_forms && entry.verb_forms.length ? entry.verb_forms : [entry.lemma];
      return forms.join(", ");
    }
    if (entry.pos === "Adjektiv") {
      var extra = entry.adj_stem_gen ? " (Gen. " + entry.adj_stem_gen + ")" : "";
      return entry.lemma + extra;
    }
    if (entry.pos === "Präposition" || entry.pos === "Konjunktion" || entry.pos === "Adverb") {
      return entry.lemma + (entry.grammar_note ? " (" + entry.grammar_note + ")" : "");
    }
    return entry.lemma;
  }

  function lessonLabel(entry) {
    return (entry.lessons || []).join(" / ");
  }

  function posLabel(entry) {
    return entry.pos + (entry.proper_noun ? ", Eigenname" : "");
  }

  return { firstForm: firstForm, shortForm: shortForm, lessonLabel: lessonLabel, posLabel: posLabel, abbreviateGen: abbreviateGen };
})();
