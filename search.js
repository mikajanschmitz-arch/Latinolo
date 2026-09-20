/* ==========================================================================
   search.js — Vokabelsuche mit Formenerkennung
   ========================================================================== */

var Search = (function () {
  "use strict";

  var el;
  var morphIndex = null; // normalisierte Form -> [{entry, description, surface}]
  var indexBuilding = null;

  var CASE_LABELS = { nom: "Nominativ", gen: "Genitiv", dat: "Dativ", akk: "Akkusativ", abl: "Ablativ", vok: "Vokativ" };
  var GENDER_LABELS = { m: "Maskulinum", f: "Femininum", n: "Neutrum", "m/f": "Maskulinum/Femininum" };
  var PERSON_LABELS = ["1. Person Singular", "2. Person Singular", "3. Person Singular", "1. Person Plural", "2. Person Plural", "3. Person Plural"];

  function init(rootEl) {
    el = rootEl;
    render();
    Data.ready.then(function () {
      indexBuilding = buildMorphIndexAsync();
    });
  }

  function registerForm(index, rawForm, entry, description) {
    if (!rawForm) return;
    String(rawForm).split(" / ").forEach(function (variant) {
      var clean = variant.replace(/^\(|\)$/g, "").trim();
      if (!clean || clean === "–" || clean === "-") return;
      var key = Data.normalize(clean);
      if (!index[key]) index[key] = [];
      index[key].push({ entry: entry, description: description, surface: clean });
      if (clean.indexOf(" ") !== -1) {
        var lastWord = clean.split(" ").pop();
        var lastKey = Data.normalize(lastWord);
        if (!index[lastKey]) index[lastKey] = [];
        index[lastKey].push({ entry: entry, description: description + " (Teil von „" + clean + "“)", surface: clean });
      }
    });
  }

  function indexNounLike(index, entry, table) {
    if (!table) return;
    if (table.sg) {
      Object.keys(CASE_LABELS).forEach(function (c) {
        if (table.sg[c] === undefined) return;
        var g = entry.gender ? ", " + GENDER_LABELS[entry.gender] || "" : "";
        registerForm(index, table.sg[c], entry, CASE_LABELS[c] + " Singular" + g);
      });
    }
    if (table.pl) {
      Object.keys(CASE_LABELS).forEach(function (c) {
        if (table.pl[c] === undefined) return;
        var g = entry.gender ? ", " + GENDER_LABELS[entry.gender] || "" : "";
        registerForm(index, table.pl[c], entry, CASE_LABELS[c] + " Plural" + g);
      });
    }
  }

  function indexAdjective(index, entry, decl) {
    if (!decl) return;
    ["m", "f", "n"].forEach(function (gen) {
      ["sg", "pl"].forEach(function (num) {
        var table = decl[num] && decl[num][gen];
        if (!table) return;
        Object.keys(CASE_LABELS).forEach(function (c) {
          if (!table[c]) return;
          var numLabel = num === "sg" ? "Singular" : "Plural";
          registerForm(index, table[c], entry, CASE_LABELS[c] + " " + numLabel + ", " + GENDER_LABELS[gen]);
        });
      });
    });
  }

  function indexPronoun(index, entry, para) {
    if (!para) return;
    if (para.table.sg && para.table.sg.nom !== undefined && !para.gendered) {
      ["sg", "pl"].forEach(function (num) {
        var table = para.table[num];
        if (!table) return;
        Object.keys(CASE_LABELS).forEach(function (c) {
          if (!table[c]) return;
          registerForm(index, table[c], entry, CASE_LABELS[c] + " " + (num === "sg" ? "Singular" : "Plural") + " (Pronomen)");
        });
      });
      return;
    }
    ["m", "f", "n"].forEach(function (gen) {
      ["sg", "pl"].forEach(function (num) {
        var table = para.table[num] && para.table[num][gen];
        if (!table) return;
        Object.keys(CASE_LABELS).forEach(function (c) {
          if (!table[c]) return;
          registerForm(index, table[c], entry, CASE_LABELS[c] + " " + (num === "sg" ? "Singular" : "Plural") + ", " + GENDER_LABELS[gen]);
        });
      });
    });
  }

  function indexVerb(index, entry, v) {
    if (!v || v.unsupported) return;
    var dep = v.isDeponent;
    function actLabel(base) { return dep ? base.replace(" Aktiv", " (Deponens)") : base; }

    var finiteSets = [
      ["pres", "Präsens Indikativ Aktiv"],
      ["impf", "Imperfekt Indikativ Aktiv"],
      ["fut", "Futur I Indikativ Aktiv"],
      ["presSubj", "Präsens Konjunktiv Aktiv"],
      ["impfSubj", "Imperfekt Konjunktiv Aktiv"],
      ["perf", "Perfekt Indikativ Aktiv"],
      ["pluperf", "Plusquamperfekt Indikativ Aktiv"],
      ["futPerf", "Futur II Indikativ Aktiv"],
      ["perfSubj", "Perfekt Konjunktiv Aktiv"],
      ["pluperfSubj", "Plusquamperfekt Konjunktiv Aktiv"],
      ["presPass", "Präsens Indikativ Passiv"],
      ["impfPass", "Imperfekt Indikativ Passiv"],
      ["futPass", "Futur I Indikativ Passiv"],
      ["presSubjPass", "Präsens Konjunktiv Passiv"],
      ["impfSubjPass", "Imperfekt Konjunktiv Passiv"],
    ];
    finiteSets.forEach(function (pair) {
      var key = pair[0], label = pair[1];
      if (!v[key]) return;
      var isPassiveLabel = label.indexOf("Passiv") !== -1;
      var finalLabel = dep && !isPassiveLabel ? label.replace(" Aktiv", " (Deponens)") : label;
      v[key].forEach(function (form, i) {
        registerForm(index, form, entry, PERSON_LABELS[i] + ", " + finalLabel);
      });
    });

    if (v.imper) {
      if (v.imper[0]) registerForm(index, v.imper[0], entry, "Imperativ Singular" + (dep ? " (Deponens)" : " Aktiv"));
      if (v.imper[1]) registerForm(index, v.imper[1], entry, "Imperativ Plural" + (dep ? " (Deponens)" : " Aktiv"));
    }
    if (v.infPres) registerForm(index, v.infPres, entry, "Infinitiv Präsens" + (dep ? " (Deponens)" : " Aktiv"));
    if (v.infPresPass) registerForm(index, v.infPresPass, entry, "Infinitiv Präsens Passiv");
    if (v.infPerf) registerForm(index, v.infPerf, entry, "Infinitiv Perfekt Aktiv");
    if (v.partPres) {
      var pp = v.partPres.split(",").map(function (s) { return s.trim(); });
      registerForm(index, pp[0], entry, "Partizip Präsens Aktiv (Nominativ)");
      if (pp[1]) registerForm(index, pp[1], entry, "Partizip Präsens Aktiv (Genitiv-Stamm)");
    }
    if (v.pppStem) {
      var label = dep ? "Partizip Perfekt (Deponens, aktive Bedeutung)" : "Partizip Perfekt Passiv (PPP)";
      registerForm(index, v.pppStem + "us", entry, label + ", Maskulinum");
      registerForm(index, v.pppStem + "a", entry, label + ", Femininum");
      registerForm(index, v.pppStem + "um", entry, label + ", Neutrum");
    }
    if (v.supine) registerForm(index, v.supine, entry, "Supinum");
  }

  function buildMorphIndexAsync() {
    return new Promise(function (resolve) {
      var index = {};
      Data.vocab.forEach(function (entry) {
        // Grundform selbst immer indexieren
        registerForm(index, LexUtil.firstForm(entry), entry, "Grundform (" + entry.pos + ")");
        try {
          if (entry.pos === "Substantiv") {
            var decl = Morph.declineNoun(entry);
            indexNounLike(index, entry, decl);
          } else if (entry.pos === "Adjektiv" && entry.adj_type) {
            var adecl = Morph.declineAdjective(entry);
            indexAdjective(index, entry, adecl);
          } else if (entry.pos === "Pronomen") {
            var pdecl = Morph.declinePronoun(entry);
            if (pdecl) indexPronoun(index, entry, pdecl);
          } else if (entry.pos === "Verb") {
            var v = Morph.analyzeVerb(entry);
            indexVerb(index, entry, v);
          }
        } catch (err) {
          // Einzelne fehlerhafte Eintraege sollen den Index nicht komplett stoppen
          console.warn("Formenindex-Fehler bei", entry.lemma, err);
        }
      });
      morphIndex = index;
      resolve(index);
    });
  }

  function render() {
    el.innerHTML =
      '<div class="field-row">' +
      '<input type="text" id="search-input" placeholder="z.B. servi, amabam, meliora …" autocomplete="off" autocapitalize="off" spellcheck="false">' +
      "</div>" +
      '<div id="search-results"></div>';

    var input = el.querySelector("#search-input");
    var resultsEl = el.querySelector("#search-results");
    var timer = null;
    input.addEventListener("input", function () {
      clearTimeout(timer);
      timer = setTimeout(function () { runSearch(input.value, resultsEl); }, 150);
    });
    input.focus();
  }

  function runSearch(query, resultsEl) {
    query = query.trim();
    if (!query) { resultsEl.innerHTML = ""; return; }
    if (!morphIndex) {
      resultsEl.innerHTML = '<p class="empty-state">Formenindex wird geladen …</p>';
      (indexBuilding || Promise.resolve()).then(function () { runSearch(query, resultsEl); });
      return;
    }

    var qNorm = Data.normalize(query);
    var exact = morphIndex[qNorm] || [];

    // Gruppieren nach Eintrag
    var byEntry = new Map();
    exact.forEach(function (hit) {
      if (!byEntry.has(hit.entry.id)) byEntry.set(hit.entry.id, { entry: hit.entry, forms: [] });
      byEntry.get(hit.entry.id).forms.push(hit);
    });

    // Zusaetzlich: Substring-Treffer im Grundwortschatz (falls z.B. nur Wortanfang getippt)
    var substringMatches = [];
    if (qNorm.length >= 2) {
      Data.vocab.forEach(function (entry) {
        if (byEntry.has(entry.id)) return;
        var normLemma = Data.normalize(LexUtil.firstForm(entry));
        if (normLemma.indexOf(qNorm) === 0) substringMatches.push(entry);
      });
    }

    var groups = Array.from(byEntry.values());
    // Grundform-Treffer zuerst, dann alphabetisch
    groups.sort(function (a, b) {
      var aBase = a.forms.some(function (f) { return f.description.indexOf("Grundform") === 0; });
      var bBase = b.forms.some(function (f) { return f.description.indexOf("Grundform") === 0; });
      if (aBase !== bBase) return aBase ? -1 : 1;
      return LexUtil.firstForm(a.entry).localeCompare(LexUtil.firstForm(b.entry));
    });

    if (!groups.length && !substringMatches.length) {
      resultsEl.innerHTML = '<p class="empty-state">Keine Treffer für „' + escapeHtml(query) + '“.</p>';
      return;
    }

    var html = "";
    groups.slice(0, 25).forEach(function (g) {
      html += renderResultCard(g.entry, g.forms);
    });
    if (substringMatches.length) {
      html += '<div class="section-title">Weitere Wörter, die mit „' + escapeHtml(query) + '“ beginnen</div>';
      substringMatches.slice(0, 15).forEach(function (entry) {
        html += renderResultCard(entry, []);
      });
    }
    resultsEl.innerHTML = html;
  }

  function renderResultCard(entry, forms) {
    var nonBase = forms.filter(function (f) { return f.description.indexOf("Grundform") !== 0; });
    var formsHtml = "";
    if (nonBase.length) {
      var seen = new Set();
      var items = nonBase.filter(function (f) {
        var k = f.description;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      }).map(function (f) { return "<li>" + f.description + "</li>"; }).join("");
      formsHtml =
        '<div class="search-forms-title">Mögliche Formen:</div>' +
        '<ul class="search-forms-list">' + items + "</ul>";
    }
    return (
      '<div class="search-result">' +
      '<div class="search-result-head">' +
      '<span class="search-lemma">' + LexUtil.shortForm(entry) + "</span>" +
      '<span class="search-pos">(' + LexUtil.posLabel(entry) + ")</span>" +
      "</div>" +
      '<div class="search-translation">' + entry.translation + "</div>" +
      '<div class="search-lesson-tag">Lektion ' + LexUtil.lessonLabel(entry) + "</div>" +
      formsHtml +
      "</div>"
    );
  }

  function escapeHtml(s) {
    var d = document.createElement("div");
    d.textContent = s;
    return d.innerHTML;
  }

  return { init: init };
})();
