/* ==========================================================================
   forms.js — Formentrainer (Modus 1: Auswahlfelder, Modus 2: Eintippen)
   ========================================================================== */

var Forms = (function () {
  "use strict";

  var el;

  var KASUS_LABELS = { nom: "Nominativ", gen: "Genitiv", dat: "Dativ", akk: "Akkusativ", abl: "Ablativ", vok: "Vokativ" };
  var NUMERUS_LABELS = { sg: "Singular", pl: "Plural" };
  var GENUS_LABELS = { m: "Maskulinum", f: "Femininum", n: "Neutrum" };
  var TEMPUS_LABELS = { praes: "Präsens", impf: "Imperfekt", fut1: "Futur I", perf: "Perfekt", pqperf: "Plusquamperfekt", fut2: "Futur II" };
  var MODUS_LABELS = { ind: "Indikativ", konj: "Konjunktiv" };
  var GV_LABELS = { akt: "Aktiv", pass: "Passiv" };
  var PERSON_LABELS = { 1: "1. Person", 2: "2. Person", 3: "3. Person" };

  var VERB_FORM_MAP = [
    { key: "pres", tempus: "praes", modus: "ind", gv: "akt" },
    { key: "impf", tempus: "impf", modus: "ind", gv: "akt" },
    { key: "fut", tempus: "fut1", modus: "ind", gv: "akt" },
    { key: "presSubj", tempus: "praes", modus: "konj", gv: "akt" },
    { key: "impfSubj", tempus: "impf", modus: "konj", gv: "akt" },
    { key: "perf", tempus: "perf", modus: "ind", gv: "akt" },
    { key: "pluperf", tempus: "pqperf", modus: "ind", gv: "akt" },
    { key: "futPerf", tempus: "fut2", modus: "ind", gv: "akt" },
    { key: "perfSubj", tempus: "perf", modus: "konj", gv: "akt" },
    { key: "pluperfSubj", tempus: "pqperf", modus: "konj", gv: "akt" },
    { key: "presPass", tempus: "praes", modus: "ind", gv: "pass" },
    { key: "impfPass", tempus: "impf", modus: "ind", gv: "pass" },
    { key: "futPass", tempus: "fut1", modus: "ind", gv: "pass" },
    { key: "presSubjPass", tempus: "praes", modus: "konj", gv: "pass" },
    { key: "impfSubjPass", tempus: "impf", modus: "konj", gv: "pass" },
    { key: "perfPass", tempus: "perf", modus: "ind", gv: "pass" },
    { key: "pluperfPass", tempus: "pqperf", modus: "ind", gv: "pass" },
    { key: "futPerfPass", tempus: "fut2", modus: "ind", gv: "pass" },
    { key: "perfSubjPass", tempus: "perf", modus: "konj", gv: "pass" },
    { key: "pluperfSubjPass", tempus: "pqperf", modus: "konj", gv: "pass" },
  ];

  var DECLINABLE_POS = ["Substantiv", "Adjektiv", "Pronomen"];

  var state = {
    phase: "setup",
    lessons: new Set(),
    pos: new Set(["Substantiv", "Verb"]),
    known: {
      kasus: new Set(Object.keys(KASUS_LABELS)),
      tempus: new Set(Object.keys(TEMPUS_LABELS)),
      modus: new Set(Object.keys(MODUS_LABELS)),
      gv: new Set(Object.keys(GV_LABELS)),
    },
    includePPP: false,
    includePPA: false,
    includeNonFinite: false,
    mode: 1,
    pool: [],
    current: null,
    stats: { correct: 0, wrong: 0 },
  };

  function init(rootEl) {
    el = rootEl;
    Data.ready.then(renderSetup);
  }

  // ================= Setup =================

  function chipGroup(idPrefix, labelsObj, selectedSet) {
    return Object.keys(labelsObj).map(function (k) {
      return '<div class="chip' + (selectedSet.has(k) ? " selected" : "") + '" data-group="' + idPrefix + '" data-val="' + k + '">' + labelsObj[k] + "</div>";
    }).join("");
  }

  function renderSetup() {
    state.phase = "setup";
    var lessons = Data.allLessons();
    var lessonChips = lessons.map(function (l) {
      return '<div class="lesson-chip' + (state.lessons.has(l.main) ? " selected" : "") + '" data-main="' + l.main + '">' + l.main + "</div>";
    }).join("");

    var posChips = ["Substantiv", "Adjektiv", "Verb", "Pronomen"].map(function (p) {
      return '<div class="chip' + (state.pos.has(p) ? " selected" : "") + '" data-pos="' + p + '">' + p + "</div>";
    }).join("");

    var showNominal = DECLINABLE_POS.some(function (p) { return state.pos.has(p); });
    var showVerb = state.pos.has("Verb");

    el.innerHTML =
      '<div class="card-panel">' +
      "<h2>Formentrainer</h2>" +
      '<div class="section-title">Lektionen</div>' +
      '<div class="btn-row" style="margin-bottom:8px;">' +
      '<button class="btn" id="f-select-all-lessons">Alle</button>' +
      '<button class="btn" id="f-select-no-lessons">Keine</button>' +
      "</div>" +
      '<div class="lesson-grid" id="f-lesson-grid">' + lessonChips + "</div>" +

      '<div class="section-title">Wortart</div>' +
      '<div class="chip-grid" id="f-pos-grid">' + posChips + "</div>" +

      (showNominal ?
        '<div class="section-title">Bekannte Fälle (Substantiv/Adjektiv/Pronomen)</div>' +
        '<div class="chip-grid" id="f-kasus-grid">' + chipGroup("kasus", KASUS_LABELS, state.known.kasus) + "</div>"
        : "") +

      (showVerb ?
        '<div class="section-title">Bekannte Zeitformen (Verb)</div>' +
        '<div class="chip-grid" id="f-tempus-grid">' + chipGroup("tempus", TEMPUS_LABELS, state.known.tempus) + "</div>" +
        '<div class="section-title">Bekannter Modus (Verb)</div>' +
        '<div class="chip-grid" id="f-modus-grid">' + chipGroup("modus", MODUS_LABELS, state.known.modus) + "</div>" +
        '<div class="section-title">Bekanntes Genus Verbi</div>' +
        '<div class="chip-grid" id="f-gv-grid">' + chipGroup("gv", GV_LABELS, state.known.gv) + "</div>" +
        '<div class="toggle-row"><span>Auch PPP (Partizip Perfekt Passiv) üben</span>' +
        '<label class="switch"><input type="checkbox" id="f-ppp"' + (state.includePPP ? " checked" : "") + '><span class="slider"></span></label></div>' +
        '<div class="toggle-row"><span>Auch PPA (Partizip Präsens Aktiv) üben</span>' +
        '<label class="switch"><input type="checkbox" id="f-ppa"' + (state.includePPA ? " checked" : "") + '><span class="slider"></span></label></div>' +
        '<div class="toggle-row"><span>Auch Infinitiv/Imperativ (nur Modus 2)</span>' +
        '<label class="switch"><input type="checkbox" id="f-nonfinite"' + (state.includeNonFinite ? " checked" : "") + '><span class="slider"></span></label></div>'
        : "") +

      "</div>" +

      '<div class="btn-row">' +
      '<button class="btn btn-primary btn-block" id="f-start-1">Modus 1: Auswählen</button>' +
      '<button class="btn btn-primary btn-block" id="f-start-2">Modus 2: Eintippen</button>' +
      "</div>";

    el.querySelector("#f-lesson-grid").addEventListener("click", function (ev) {
      var chip = ev.target.closest(".lesson-chip");
      if (!chip) return;
      var m = Number(chip.dataset.main);
      if (state.lessons.has(m)) state.lessons.delete(m); else state.lessons.add(m);
      chip.classList.toggle("selected");
    });
    el.querySelector("#f-select-all-lessons").addEventListener("click", function () {
      lessons.forEach(function (l) { state.lessons.add(l.main); });
      renderSetup();
    });
    el.querySelector("#f-select-no-lessons").addEventListener("click", function () {
      state.lessons.clear();
      renderSetup();
    });
    el.querySelector("#f-pos-grid").addEventListener("click", function (ev) {
      var chip = ev.target.closest(".chip");
      if (!chip) return;
      var p = chip.dataset.pos;
      if (state.pos.has(p)) state.pos.delete(p); else state.pos.add(p);
      renderSetup();
    });
    ["kasus", "tempus", "modus", "gv"].forEach(function (group) {
      var gridEl = el.querySelector("#f-" + group + "-grid");
      if (!gridEl) return;
      gridEl.addEventListener("click", function (ev) {
        var chip = ev.target.closest(".chip");
        if (!chip) return;
        var v = chip.dataset.val;
        var set = state.known[group];
        if (set.has(v)) set.delete(v); else set.add(v);
        chip.classList.toggle("selected");
      });
    });
    var nf = el.querySelector("#f-nonfinite");
    if (nf) nf.addEventListener("change", function () { state.includeNonFinite = nf.checked; });
    var pppEl = el.querySelector("#f-ppp");
    if (pppEl) pppEl.addEventListener("change", function () { state.includePPP = pppEl.checked; });
    var ppaEl = el.querySelector("#f-ppa");
    if (ppaEl) ppaEl.addEventListener("change", function () { state.includePPA = ppaEl.checked; });

    el.querySelector("#f-start-1").addEventListener("click", function () { startQuiz(1); });
    el.querySelector("#f-start-2").addEventListener("click", function () { startQuiz(2); });
  }

  // ================= Pool & Fragen-Generierung =================

  function startQuiz(mode) {
    if (!state.lessons.size) { alert("Bitte wähle mindestens eine Lektion aus."); return; }
    if (!state.pos.size) { alert("Bitte wähle mindestens eine Wortart aus."); return; }
    var entries = Data.entriesForMainLessons(Array.from(state.lessons));
    entries = Data.byPos(entries, state.pos);
    // nur Woerter, die die Engine ueberhaupt beugen kann
    entries = entries.filter(canDecline);
    if (!entries.length) { alert("Keine passenden Wörter gefunden."); return; }
    state.pool = entries;
    state.mode = mode;
    state.stats = { correct: 0, wrong: 0 };
    state.phase = "quiz";
    nextQuestion();
  }

  function canDecline(entry) {
    if (entry.pos === "Substantiv") return true;
    if (entry.pos === "Adjektiv") return !!entry.adj_type;
    if (entry.pos === "Pronomen") return !!Morph.declinePronoun(entry);
    if (entry.pos === "Verb") {
      var v = Morph.analyzeVerb(entry);
      return !v.unsupported;
    }
    return false;
  }

  function buildNominalSlots(entry) {
    var slots = [];
    var table;
    if (entry.pos === "Substantiv") table = Morph.declineNoun(entry);
    else if (entry.pos === "Adjektiv") table = Morph.declineAdjective(entry);
    else { var p = Morph.declinePronoun(entry); table = p ? p.table : null; }
    if (!table) return slots;

    var gendered = entry.pos === "Adjektiv" || (entry.pos === "Pronomen" && table.sg && table.sg.m);
    ["sg", "pl"].forEach(function (num) {
      if (!table[num]) return;
      if (gendered) {
        ["m", "f", "n"].forEach(function (g) {
          var t = table[num][g];
          if (!t) return;
          Object.keys(KASUS_LABELS).forEach(function (k) {
            if (!state.known.kasus.has(k)) return;
            if (!t[k]) return;
            slots.push({ dims: { kasus: k, numerus: num, genus: g }, value: t[k], table: t });
          });
        });
      } else {
        var t = table[num];
        Object.keys(KASUS_LABELS).forEach(function (k) {
          if (!state.known.kasus.has(k)) return;
          if (!t[k]) return;
          slots.push({ dims: { kasus: k, numerus: num, genus: entry.gender || null }, value: t[k], table: t });
        });
      }
    });
    return slots;
  }

  function buildVerbSlots(entry, v) {
    var slots = [];
    VERB_FORM_MAP.forEach(function (map) {
      if (!v[map.key]) return;
      if (v.isDeponent && map.gv === "pass") return; // Deponens hat keine eigene Passivform
      if (!state.known.tempus.has(map.tempus)) return;
      if (!state.known.modus.has(map.modus)) return;
      if (!v.isDeponent && !state.known.gv.has(map.gv)) return;
      v[map.key].forEach(function (form, i) {
        slots.push({
          dims: { tempus: map.tempus, modus: map.modus, gv: v.isDeponent ? null : map.gv, person: String((i % 3) + 1), numerus: i < 3 ? "sg" : "pl" },
          value: form, isDeponent: v.isDeponent,
        });
      });
    });
    return slots;
  }

  function buildNonFiniteSlots(entry, v) {
    var slots = [];
    if (v.imper) {
      if (v.imper[0]) slots.push({ nonFinite: "imperativ", label: "Imperativ Singular" + (v.isDeponent ? "" : " Aktiv"), value: v.imper[0] });
      if (v.imper[1]) slots.push({ nonFinite: "imperativ", label: "Imperativ Plural" + (v.isDeponent ? "" : " Aktiv"), value: v.imper[1] });
    }
    if (v.infPres) slots.push({ nonFinite: "infinitiv", label: "Infinitiv Präsens" + (v.isDeponent ? " (Deponens)" : " Aktiv"), value: v.infPres });
    if (v.infPresPass) slots.push({ nonFinite: "infinitiv", label: "Infinitiv Präsens Passiv", value: v.infPresPass });
    if (v.infPerf) slots.push({ nonFinite: "infinitiv", label: "Infinitiv Perfekt Aktiv", value: v.infPerf });
    return slots;
  }

  // PPP/PPA werden wie vollstaendig deklinierte Adjektive behandelt (Kasus,
  // Numerus UND Genus bestimmbar) - nutzbar in Modus 1 (Auswahlfelder) und
  // Modus 2 (Eintippen).
  function buildParticipleSlots(entry, v) {
    var slots = [];
    function addDeclSlots(decl, partLabel) {
      if (!decl) return;
      ["m", "f", "n"].forEach(function (g) {
        ["sg", "pl"].forEach(function (num) {
          var t = decl[num] && decl[num][g];
          if (!t) return;
          Object.keys(KASUS_LABELS).forEach(function (k) {
            if (!state.known.kasus.has(k)) return;
            if (!t[k]) return;
            slots.push({ dims: { kasus: k, numerus: num, genus: g, partLabel: partLabel }, value: t[k] });
          });
        });
      });
    }
    if (state.includePPP && v.pppStem) {
      var pppLabel = v.isDeponent ? "Partizip Perfekt (Deponens)" : "Partizip Perfekt Passiv (PPP)";
      addDeclSlots(Morph.declineAdjective({ lemma: v.pppStem + "us, a, um", adj_type: "a_um" }), pppLabel);
    }
    if (state.includePPA && v.partPres) {
      addDeclSlots(Morph.declineAdjective({ lemma: v.partPres, adj_type: "one_ending" }), "Partizip Präsens Aktiv (PPA)");
    }
    return slots;
  }

  function dimsLabel(dims) {
    var out = [];
    if (dims.person) out.push(PERSON_LABELS[dims.person]);
    if (dims.numerus) out.push(NUMERUS_LABELS[dims.numerus]);
    if (dims.kasus) out.unshift(KASUS_LABELS[dims.kasus]);
    if (dims.tempus) out.push(TEMPUS_LABELS[dims.tempus]);
    if (dims.modus) out.push(MODUS_LABELS[dims.modus]);
    if (dims.gv) out.push(GV_LABELS[dims.gv]);
    if (dims.genus) out.push(GENUS_LABELS[dims.genus]);
    var text = out.join(", ");
    return dims.partLabel ? dims.partLabel + ": " + text : text;
  }

  function nextQuestion() {
    var attempts = 0, entry, slots;
    while (attempts < 60) {
      attempts++;
      entry = state.pool[Math.floor(Math.random() * state.pool.length)];
      if (DECLINABLE_POS.indexOf(entry.pos) !== -1) {
        slots = buildNominalSlots(entry);
      } else {
        var v = Morph.analyzeVerb(entry);
        slots = buildVerbSlots(entry, v);
        if (state.includePPP || state.includePPA) {
          slots = slots.concat(buildParticipleSlots(entry, v));
        }
        if (state.mode === 2 && state.includeNonFinite) {
          slots = slots.concat(buildNonFiniteSlots(entry, v));
        }
      }
      if (slots.length) break;
    }
    if (!slots || !slots.length) {
      el.innerHTML = '<p class="empty-state">Für diese Auswahl gibt es keine passenden Formen. Bitte wähle mehr Fälle/Zeitformen oder Lektionen aus.</p><button class="btn btn-block" id="f-back">Zurück</button>';
      el.querySelector("#f-back").addEventListener("click", renderSetup);
      return;
    }
    var target = slots[Math.floor(Math.random() * slots.length)];

    // Fuer Modus 1 (Analyse): alle Slots mit identischer Oberflaechenform sammeln
    var acceptableCombos = [];
    if (target.dims) {
      var targetNorm = Data.normalize(target.value);
      slots.forEach(function (s) {
        if (!s.dims) return;
        if (Data.normalize(s.value) === targetNorm) acceptableCombos.push(s.dims);
      });
    }

    state.current = { entry: entry, target: target, acceptableCombos: acceptableCombos };
    if (state.mode === 1) renderQuestionMode1();
    else renderQuestionMode2();
  }

  // ================= Modus 1: Auswahlfelder =================

  function renderQuestionMode1() {
    var c = state.current;
    var dims = c.target.dims;
    var selects = "";
    if (dims.kasus !== undefined) {
      selects += selectRow("kasus", "Fall", KASUS_LABELS);
      selects += selectRow("numerus", "Numerus", NUMERUS_LABELS);
      if (dims.genus) selects += selectRow("genus", "Geschlecht", GENUS_LABELS);
    } else {
      selects += selectRow("person", "Person", PERSON_LABELS);
      selects += selectRow("numerus", "Numerus", NUMERUS_LABELS);
      selects += selectRow("tempus", "Zeitform", TEMPUS_LABELS);
      selects += selectRow("modus", "Modus", MODUS_LABELS);
      if (!c.target.isDeponent) selects += selectRow("gv", "Genus Verbi", GV_LABELS);
    }

    el.innerHTML =
      '<div class="flash-progress"><span>✓ ' + state.stats.correct + " · ✗ " + state.stats.wrong + "</span></div>" +
      '<div class="card-panel" style="text-align:center;">' +
      '<div class="flash-latin">' + c.target.value + "</div>" +
      '<div class="flash-pos" style="margin-top:4px;">' + (dims.partLabel || c.entry.pos) + "</div>" +
      "</div>" +
      '<div class="card-panel">' + selects + "</div>" +
      '<button class="btn btn-primary btn-block" id="f-submit">Prüfen</button>' +
      '<div id="f-feedback" style="margin-top:12px;"></div>' +
      '<button class="btn btn-block" id="f-skip" style="margin-top:10px;">Wortauswahl ändern</button>';

    el.querySelector("#f-submit").addEventListener("click", checkMode1);
    el.querySelector("#f-skip").addEventListener("click", renderSetup);
  }

  function selectRow(key, label, labelsObj) {
    var opts = Object.keys(labelsObj).map(function (k) { return '<option value="' + k + '">' + labelsObj[k] + "</option>"; }).join("");
    return '<div class="quiz-slot-row"><span class="quiz-slot-label">' + label + '</span><select id="f-sel-' + key + '"><option value="">–</option>' + opts + "</select></div>";
  }

  function checkMode1() {
    var c = state.current;
    var dims = c.target.dims;
    var submitted = {};
    var keys = dims.kasus !== undefined ? ["kasus", "numerus"].concat(dims.genus ? ["genus"] : []) : ["person", "numerus", "tempus", "modus"].concat(!c.target.isDeponent ? ["gv"] : []);
    var incomplete = false;
    keys.forEach(function (k) {
      var sel = el.querySelector("#f-sel-" + k);
      submitted[k] = sel.value;
      if (!sel.value) incomplete = true;
    });
    if (incomplete) { alert("Bitte fülle alle Felder aus."); return; }

    var correct = c.acceptableCombos.some(function (combo) {
      return keys.every(function (k) { return (combo[k] || "") === submitted[k]; });
    });

    var analysisText = c.acceptableCombos.map(dimsLabel).join(" ODER ");
    showFeedback(correct, analysisText, null);
  }

  // ================= Modus 2: Eintippen =================

  function renderQuestionMode2() {
    var c = state.current;
    var label = c.target.dims ? dimsLabel(c.target.dims) : c.target.label;
    var lemmaDisplay = LexUtil.firstForm(c.entry);

    el.innerHTML =
      '<div class="flash-progress"><span>✓ ' + state.stats.correct + " · ✗ " + state.stats.wrong + "</span></div>" +
      '<div class="card-panel" style="text-align:center;">' +
      '<div class="flash-latin-small">' + lemmaDisplay + "</div>" +
      '<div class="flash-pos">' + c.entry.pos + "</div>" +
      '<div style="margin-top:14px;font-weight:700;font-size:1.1rem;">' + label + "</div>" +
      "</div>" +
      '<div class="field-row"><input type="text" id="f-input" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Antwort eintippen …"></div>' +
      '<button class="btn btn-primary btn-block" id="f-submit2">Prüfen</button>' +
      '<div id="f-feedback" style="margin-top:12px;"></div>' +
      '<button class="btn btn-block" id="f-skip2" style="margin-top:10px;">Wortauswahl ändern</button>';

    var input = el.querySelector("#f-input");
    input.focus();
    input.addEventListener("keydown", function (ev) { if (ev.key === "Enter") checkMode2(); });
    el.querySelector("#f-submit2").addEventListener("click", checkMode2);
    el.querySelector("#f-skip2").addEventListener("click", renderSetup);
  }

  function checkMode2() {
    var c = state.current;
    var input = el.querySelector("#f-input").value.trim();
    if (!input) return;
    var accepted = String(c.target.value).split(" / ").map(function (s) { return Data.normalize(s.trim()); });
    var correct = accepted.indexOf(Data.normalize(input)) !== -1;
    showFeedback(correct, c.target.value, null);
  }

  // ================= Feedback & weiter =================

  function showFeedback(correct, correctAnswer, extraInfo) {
    if (correct) state.stats.correct++; else state.stats.wrong++;
    var fb = el.querySelector("#f-feedback");
    var html = correct
      ? '<p class="quiz-feedback-correct">✓ Richtig!</p>'
      : '<p class="quiz-feedback-wrong">✗ Nicht ganz. Richtig wäre: <strong>' + correctAnswer + "</strong></p>";
    if (!correct && extraInfo) html += '<p style="color:var(--text-muted);font-size:0.85rem;">(' + extraInfo + ")</p>";
    html += '<button class="btn btn-primary btn-block" id="f-next" style="margin-top:8px;">Weiter</button>';
    fb.innerHTML = html;
    el.querySelectorAll("#f-submit, #f-submit2").forEach(function (b) { b.disabled = true; });
    fb.querySelector("#f-next").addEventListener("click", nextQuestion);
  }

  return { init: init };
})();
