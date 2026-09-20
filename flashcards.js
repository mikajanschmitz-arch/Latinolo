/* ==========================================================================
   flashcards.js — Karteikarten-Feature
   ========================================================================== */

var Flashcards = (function () {
  "use strict";

  var el; // Root-Element (#view-flashcards)
  var state = {
    phase: "setup", // setup | session | summary
    selected: new Set(),
    queue: [],
    idx: 0,
    flipped: false,
    stats: { correct: 0, wrong: 0 },
    wrongIds: new Set(),
  };

  function init(rootEl) {
    el = rootEl;
    Data.ready.then(renderSetup);
  }

  function weightedShuffle(entries) {
    var progress = Store.getProgress();
    var lessonStats = {};
    entries.forEach(function (e) {
      var p = progress[e.id];
      (e.lessons || []).forEach(function (l) {
        var m = Data.lessonMain(l);
        if (!lessonStats[m]) lessonStats[m] = { seen: 0, wrong: 0 };
        if (p) { lessonStats[m].seen += p.seen; lessonStats[m].wrong += p.wrong; }
      });
    });
    function lessonErrorRate(m) {
      var s = lessonStats[m];
      if (!s || s.seen === 0) return 0;
      return s.wrong / s.seen;
    }
    function weight(e) {
      var p = progress[e.id];
      var w = 1;
      (e.lessons || []).forEach(function (l) { w += 2.5 * lessonErrorRate(Data.lessonMain(l)); });
      if (p) {
        w += p.wrong * 0.8;
        w *= Math.max(0.15, 1 - p.box * 0.15);
      } else {
        w *= 1.3;
      }
      return Math.max(0.05, w);
    }
    return entries
      .map(function (e) { return { e: e, key: -Math.log(Math.random()) / weight(e) }; })
      .sort(function (a, b) { return a.key - b.key; })
      .map(function (x) { return x.e; });
  }

  // ---------------- Setup-Ansicht ----------------

  function renderSetup() {
    state.phase = "setup";
    var lessons = Data.allLessons();
    var saved = new Set(Store.getLessonSelection());
    state.selected = saved.size ? saved : new Set();

    var chips = lessons.map(function (l) {
      var label = l.hasSubs ? l.subs.join("/") : String(l.main);
      return '<div class="lesson-chip" data-main="' + l.main + '">' + l.main + "</div>";
    }).join("");

    el.innerHTML =
      '<div class="card-panel">' +
      "<h2>Lektionen auswählen</h2>" +
      '<p style="color:var(--text-muted);font-size:0.88rem;">Wähle die Lektionen, die du üben möchtest.</p>' +
      '<div class="btn-row" style="margin-bottom:10px;">' +
      '<button class="btn" id="fc-select-all">Alle</button>' +
      '<button class="btn" id="fc-select-none">Keine</button>' +
      "</div>" +
      '<div class="lesson-grid" id="fc-lesson-grid">' + chips + "</div>" +
      "</div>" +
      '<button class="btn btn-primary btn-block" id="fc-start" style="font-size:1.05rem;padding:15px;">Karteikarten starten</button>';

    var grid = el.querySelector("#fc-lesson-grid");
    function refreshChips() {
      grid.querySelectorAll(".lesson-chip").forEach(function (chip) {
        var m = Number(chip.dataset.main);
        chip.classList.toggle("selected", state.selected.has(m));
      });
    }
    refreshChips();

    grid.querySelectorAll(".lesson-chip").forEach(function (chip) {
      chip.addEventListener("click", function () {
        var m = Number(chip.dataset.main);
        if (state.selected.has(m)) state.selected.delete(m); else state.selected.add(m);
        Store.setLessonSelection(Array.from(state.selected));
        refreshChips();
      });
    });
    el.querySelector("#fc-select-all").addEventListener("click", function () {
      lessons.forEach(function (l) { state.selected.add(l.main); });
      Store.setLessonSelection(Array.from(state.selected));
      refreshChips();
    });
    el.querySelector("#fc-select-none").addEventListener("click", function () {
      state.selected.clear();
      Store.setLessonSelection([]);
      refreshChips();
    });
    el.querySelector("#fc-start").addEventListener("click", startSession);
  }

  function startSession() {
    if (!state.selected.size) {
      alert("Bitte wähle mindestens eine Lektion aus.");
      return;
    }
    var entries = Data.entriesForMainLessons(Array.from(state.selected));
    if (!entries.length) { alert("Keine Vokabeln in dieser Auswahl gefunden."); return; }
    state.queue = weightedShuffle(entries);
    state.idx = 0;
    state.flipped = false;
    state.stats = { correct: 0, wrong: 0 };
    state.wrongIds = new Set();
    state.phase = "session";
    renderCard();
  }

  // ---------------- Session-Ansicht ----------------

  function currentEntry() { return state.queue[state.idx]; }

  function renderCard() {
    if (state.idx >= state.queue.length) { renderSummary(); return; }
    var entry = currentEntry();
    var total = state.queue.length;

    var frontHtml =
      '<div class="flash-top-row"></div>' +
      '<div class="flash-center">' +
      '<div class="flash-latin">' + LexUtil.firstForm(entry) + "</div>" +
      '<div class="flash-hint">Tippen zum Umdrehen</div>' +
      "</div>";

    var backHtml =
      '<div class="flash-top-row"><span class="flash-lesson-badge">Lektion ' + LexUtil.lessonLabel(entry) + "</span></div>" +
      '<div style="text-align:center;margin-top:6px;">' +
      '<div class="flash-latin-small">' + LexUtil.shortForm(entry) + "</div>" +
      '<div class="flash-pos">' + LexUtil.posLabel(entry) + "</div>" +
      "</div>" +
      '<div class="flash-center"><div class="flash-translation">' + entry.translation + "</div></div>" +
      '<div class="flash-answer-row btn-row">' +
      '<button class="btn btn-danger btn-block" id="fc-no">✗ Nicht gewusst</button>' +
      '<button class="btn btn-success btn-block" id="fc-yes">✓ Gewusst</button>' +
      "</div>";

    el.innerHTML =
      '<div class="flash-progress"><span>' + (state.idx + 1) + " / " + total + '</span><button class="btn" id="fc-cancel" style="padding:6px 14px;font-size:0.8rem;">Abbrechen</button></div>' +
      '<div class="flash-wrap"><div class="flashcard" id="fc-card">' + (state.flipped ? backHtml : frontHtml) + "</div></div>";

    el.querySelector("#fc-cancel").addEventListener("click", function (ev) {
      ev.stopPropagation();
      renderSetup();
    });

    var card = el.querySelector("#fc-card");
    if (!state.flipped) {
      card.addEventListener("click", function () { state.flipped = true; renderCard(); });
    } else {
      el.querySelector("#fc-yes").addEventListener("click", function (ev) { ev.stopPropagation(); answer(true); });
      el.querySelector("#fc-no").addEventListener("click", function (ev) { ev.stopPropagation(); answer(false); });
    }
  }

  function answer(wasCorrect) {
    var entry = currentEntry();
    Store.recordAnswer(entry.id, wasCorrect);
    if (wasCorrect) {
      state.stats.correct++;
      Streak.recordCorrect(1);
    } else {
      state.stats.wrong++;
      state.wrongIds.add(entry.id);
      // falsches Wort etwas spaeter in dieser Runde erneut einfuegen
      var reinsertAt = Math.min(state.queue.length, state.idx + 1 + Math.floor(Math.random() * 5) + 3);
      state.queue.splice(reinsertAt, 0, entry);
    }
    state.idx++;
    state.flipped = false;
    renderCard();
  }

  function renderSummary() {
    state.phase = "summary";
    var total = state.stats.correct + state.stats.wrong;
    var pct = total ? Math.round((state.stats.correct / total) * 100) : 0;
    el.innerHTML =
      '<div class="card-panel" style="text-align:center;">' +
      "<h2>Runde beendet 🎉</h2>" +
      '<p style="font-size:1.1rem;">' + state.stats.correct + " richtig, " + state.stats.wrong + " falsch (" + pct + " %)</p>" +
      "</div>" +
      '<div class="btn-row" style="margin-bottom:10px;">' +
      '<button class="btn btn-primary btn-block" id="fc-again">Neue Runde</button>' +
      "</div>" +
      '<button class="btn btn-block" id="fc-back">Zur Lektionsauswahl</button>';
    el.querySelector("#fc-again").addEventListener("click", startSession);
    el.querySelector("#fc-back").addEventListener("click", renderSetup);
  }

  return { init: init };
})();
