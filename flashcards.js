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

  function buildQueue(entries) {
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
    function lessonErrorRate(e) {
      var worst = 0;
      (e.lessons || []).forEach(function (l) {
        var s = lessonStats[Data.lessonMain(l)];
        if (s && s.seen > 0) {
          // Bei wenig Datenpunkten (z.B. nur 1 markiertes Wort) die Quote
          // gedaempft gewichten, damit nicht sofort die halbe Lektion mitzieht.
          var confidence = Math.min(1, s.seen / 8);
          worst = Math.max(worst, (s.wrong / s.seen) * confidence);
        }
      });
      return worst;
    }
    // Wie oft taucht dieses Wort in dieser Runde auf? 1x im Normalfall, mehr
    // wenn das Wort selbst zuletzt falsch war/als "nicht gewusst" markiert
    // wurde, oder wenn es aus einer Lektion mit hoher Fehlerquote stammt.
    function repeatCount(e) {
      var p = progress[e.id];
      var extra = 0;
      var errRate = lessonErrorRate(e);
      if (errRate >= 0.6) extra += 2;
      else if (errRate >= 0.3) extra += 1;
      if (p) {
        if (p.box === 0 && p.wrong > 0) extra += 2; // frisch falsch / "nicht gewusst" markiert
        else if (p.box === 1) extra += 1;
      }
      return 1 + Math.min(3, extra); // max. 4x pro Runde, damit es nicht ausufert
    }

    var pool = [];
    entries.forEach(function (e) {
      var n = repeatCount(e);
      for (var i = 0; i < n; i++) pool.push(e);
    });

    // Fisher-Yates-Shuffle
    for (var i = pool.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = pool[i]; pool[i] = pool[j]; pool[j] = tmp;
    }
    // Duplikate auseinanderziehen, damit dasselbe Wort nicht kurz hintereinander kommt
    var minGap = Math.min(6, Math.max(2, Math.floor(pool.length / 6)));
    for (var idx = 1; idx < pool.length; idx++) {
      for (var back = 1; back <= minGap && idx - back >= 0; back++) {
        if (pool[idx].id === pool[idx - back].id) {
          var swapWith = idx + 1;
          while (swapWith < pool.length && pool[swapWith].id === pool[idx].id) swapWith++;
          if (swapWith < pool.length) {
            var t = pool[idx]; pool[idx] = pool[swapWith]; pool[swapWith] = t;
          }
          break;
        }
      }
    }
    return pool;
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
      '<div class="toggle-row" style="margin-top:12px;"><span>Redewendungen mitlernen</span>' +
      '<label class="switch"><input type="checkbox" id="fc-idioms"' + (Store.getFlashIdioms() ? " checked" : "") + '><span class="slider"></span></label></div>' +
      '<button class="btn btn-block" id="fc-disable-open" style="margin-top:12px;">🚫 Wörter deaktivieren' + (countInactive() ? " (" + countInactive() + ")" : "") + "</button>" +
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
    el.querySelector("#fc-disable-open").addEventListener("click", renderDisableManager);
    var idiomsToggle = el.querySelector("#fc-idioms");
    idiomsToggle.addEventListener("change", function () { Store.setFlashIdioms(idiomsToggle.checked); });
    el.querySelector("#fc-start").addEventListener("click", startSession);
  }

  function startSession() {
    if (!state.selected.size) {
      alert("Bitte wähle mindestens eine Lektion aus.");
      return;
    }
    var entries = Data.entriesForMainLessons(Array.from(state.selected));
    if (!Store.getFlashIdioms()) {
      entries = entries.filter(function (e) { return e.category !== "redewendung"; });
    }
    var before = entries.length;
    entries = entries.filter(isActiveEntry);
    if (!entries.length) {
      alert(before ? "Alle Wörter dieser Auswahl sind deaktiviert." : "Keine Vokabeln in dieser Auswahl gefunden.");
      return;
    }
    state.queue = buildQueue(entries);
    state.idx = 0;
    state.flipped = false;
    state.stats = { correct: 0, wrong: 0 };
    state.wrongIds = new Set();
    state.phase = "session";
    renderCard();
  }


  // ---------------- Woerter deaktivieren ----------------

  var DIS_IDS_KEY = "ll_fc_disabled_ids_v1";
  var DIS_GROUPS_KEY = "ll_fc_disabled_groups_v1";

  function loadSet(key) {
    try {
      var a = JSON.parse(localStorage.getItem(key) || "[]");
      return new Set(Array.isArray(a) ? a : []);
    } catch (e) { return new Set(); }
  }
  function saveSet(key, set) {
    try { localStorage.setItem(key, JSON.stringify(Array.from(set))); } catch (e) {}
  }
  var disabledIds = loadSet(DIS_IDS_KEY);
  var disabledGroups = loadSet(DIS_GROUPS_KEY);

  function isCapitalized(e) {
    var c = e.lemma.charAt(0);
    return c !== c.toLowerCase() && c === c.toUpperCase();
  }
  function posGroup(id, label, pos) {
    return { id: id, label: label, test: function (e) { return e.category !== "redewendung" && e.pos === pos; } };
  }
  var GROUPS = [
    { id: "names", label: "Eigennamen (Personen, Götter, Orte, Völker)",
      test: function (e) { return e.category !== "redewendung" && e.pos === "Substantiv" && isCapitalized(e); } },
    { id: "nameadj", label: "Namens-/Herkunftsadjektive (z. B. Gallus, Graecus)",
      test: function (e) { return e.category !== "redewendung" && e.pos === "Adjektiv" && isCapitalized(e); } },
    { id: "nouns", label: "Substantive (ohne Eigennamen)",
      test: function (e) { return e.category !== "redewendung" && e.pos === "Substantiv" && !isCapitalized(e); } },
    { id: "verbs", label: "Verben", test: function (e) { return e.category !== "redewendung" && e.pos === "Verb"; } },
    { id: "adjs", label: "Adjektive (ohne Namensadjektive)",
      test: function (e) { return e.category !== "redewendung" && e.pos === "Adjektiv" && !isCapitalized(e); } },
    posGroup("advs", "Adverbien", "Adverb"),
    posGroup("preps", "Präpositionen", "Präposition"),
    posGroup("conjs", "Konjunktionen", "Konjunktion"),
    posGroup("prons", "Pronomen", "Pronomen"),
    posGroup("nums", "Zahlwörter", "Zahlwort"),
    posGroup("interjs", "Ausrufe / Interjektionen", "Interjektion"),
    posGroup("exprs", "Feste Ausdrücke", "Ausdruck"),
    posGroup("parts", "Partikeln", "Partikel"),
  ];

  function isActiveEntry(e) {
    if (disabledIds.has(e.id)) return false;
    for (var i = 0; i < GROUPS.length; i++) {
      if (disabledGroups.has(GROUPS[i].id) && GROUPS[i].test(e)) return false;
    }
    return true;
  }

  function countInactive() {
    if (!disabledIds.size && !disabledGroups.size) return 0;
    return Data.vocab.filter(function (e) { return !isActiveEntry(e); }).length;
  }

  function renderDisableManager() {
    state.phase = "disable";
    var all = Data.vocab.slice().sort(function (a, b) {
      return Data.normalize(LexUtil.firstForm(a)).localeCompare(Data.normalize(LexUtil.firstForm(b)));
    });
    var LIMIT = 300;
    function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

    var groupRows = GROUPS.map(function (g) {
      var n = Data.vocab.filter(g.test).length;
      if (!n) return "";
      return '<div class="toggle-row"><span>' + esc(g.label) + ' <span style="color:var(--text-muted);font-size:0.8rem;">(' + n + ')</span></span>' +
        '<label class="switch"><input type="checkbox" data-group="' + g.id + '"' + (disabledGroups.has(g.id) ? " checked" : "") + '><span class="slider"></span></label></div>';
    }).join("");

    el.innerHTML =
      '<div style="position:sticky;top:0;z-index:5;background:var(--bg);padding:6px 0 8px;">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;">' +
      '<h2 style="margin:0;">Wörter deaktivieren</h2>' +
      '<button class="btn btn-primary" id="dm-done">Fertig</button>' +
      "</div>" +
      "</div>" +
      '<div class="card-panel">' +
      '<div class="section-title">Ganze Gruppen</div>' +
      '<p style="color:var(--text-muted);font-size:0.85rem;margin:0 0 6px;">Eingeschaltet = diese Gruppe wird bei den Karteikarten nicht abgefragt.</p>' +
      groupRows +
      "</div>" +
      '<div class="card-panel">' +
      '<div class="section-title">Einzelne Wörter</div>' +
      '<input type="text" id="dm-search" placeholder="Suchen (lateinisch) …" autocomplete="off" autocapitalize="off" spellcheck="false">' +
      '<div class="btn-row" style="margin:8px 0;">' +
      '<button class="btn" id="dm-off">Alle angezeigten deaktivieren</button>' +
      '<button class="btn" id="dm-on">Alle angezeigten aktivieren</button>' +
      "</div>" +
      '<p id="dm-count" style="color:var(--text-muted);font-size:0.85rem;margin:4px 0 8px;"></p>' +
      '<div id="dm-list"></div>' +
      "</div>" +
      '<button class="btn btn-danger btn-block" id="dm-reset">Alles wieder aktivieren</button>';

    var listEl = el.querySelector("#dm-list");
    var countEl = el.querySelector("#dm-count");
    var searchEl = el.querySelector("#dm-search");
    var shown = [];

    function updateCount() {
      countEl.textContent = countInactive() + " Wörter insgesamt deaktiviert" +
        (shown.length >= LIMIT ? " · nur die ersten " + LIMIT + " Treffer angezeigt – bitte Suche nutzen" : "");
    }

    function renderList() {
      var q = Data.normalize(searchEl.value.trim());
      var matches = all.filter(function (e) { return !q || Data.normalize(e.lemma).indexOf(q) !== -1; });
      shown = matches.slice(0, LIMIT);
      listEl.innerHTML = shown.map(function (e) {
        var off = disabledIds.has(e.id);
        var viaGroup = !off && !isActiveEntry(e);
        return '<label style="display:flex;gap:10px;align-items:flex-start;padding:9px 2px;border-bottom:1px solid var(--border);cursor:pointer;' + (off || viaGroup ? "opacity:0.55;" : "") + '">' +
          '<input type="checkbox" data-id="' + e.id + '"' + (off ? " checked" : "") + ' style="margin-top:4px;width:18px;height:18px;flex-shrink:0;">' +
          '<span style="min-width:0;"><span style="font-family:var(--font-latin);font-size:1.05rem;">' + esc(LexUtil.shortForm(e)) + "</span>" +
          ' <span style="color:var(--text-muted);font-size:0.78rem;">(' + esc(e.pos) + ", Lektion " + esc(LexUtil.lessonLabel(e)) + (viaGroup ? ", über Gruppe deaktiviert" : "") + ")</span><br>" +
          '<span style="font-size:0.9rem;">' + esc(e.translation) + "</span></span></label>";
      }).join("") || '<p class="empty-state">Keine Treffer.</p>';
      updateCount();
    }

    el.querySelectorAll("input[data-group]").forEach(function (cb) {
      cb.addEventListener("change", function () {
        if (cb.checked) disabledGroups.add(cb.dataset.group); else disabledGroups.delete(cb.dataset.group);
        saveSet(DIS_GROUPS_KEY, disabledGroups);
        renderList();
      });
    });
    listEl.addEventListener("change", function (ev) {
      var cb = ev.target.closest("input[type=checkbox]");
      if (!cb) return;
      if (cb.checked) disabledIds.add(cb.dataset.id); else disabledIds.delete(cb.dataset.id);
      saveSet(DIS_IDS_KEY, disabledIds);
      renderList();
    });
    var timer = null;
    searchEl.addEventListener("input", function () { clearTimeout(timer); timer = setTimeout(renderList, 150); });
    el.querySelector("#dm-off").addEventListener("click", function () {
      shown.forEach(function (e) { disabledIds.add(e.id); });
      saveSet(DIS_IDS_KEY, disabledIds); renderList();
    });
    el.querySelector("#dm-on").addEventListener("click", function () {
      shown.forEach(function (e) { disabledIds.delete(e.id); });
      saveSet(DIS_IDS_KEY, disabledIds); renderList();
    });
    el.querySelector("#dm-reset").addEventListener("click", function () {
      disabledIds.clear(); disabledGroups.clear();
      saveSet(DIS_IDS_KEY, disabledIds); saveSet(DIS_GROUPS_KEY, disabledGroups);
      renderDisableManager();
    });
    el.querySelector("#dm-done").addEventListener("click", renderSetup);
    renderList();
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
      '<div class="flash-latin"' + (entry.category === "redewendung" ? ' style="font-size:' + (entry.lemma.length > 28 ? "1.35rem" : "1.7rem") + ';"' : "") + ">" + LexUtil.firstForm(entry) + "</div>" +
      '<div class="flash-hint">Tippen zum Umdrehen</div>' +
      "</div>";

    var backHtml =
      '<div class="flash-top-row"><span class="flash-lesson-badge">Lektion ' + LexUtil.lessonLabel(entry) + "</span></div>" +
      '<div style="text-align:center;margin-top:6px;">' +
      '<div class="flash-latin-small"' + (entry.category === "redewendung" && entry.lemma.length > 28 ? ' style="font-size:1.15rem;"' : "") + ">" + LexUtil.shortForm(entry) + "</div>" +
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

  function reloadState() {
    disabledIds = loadSet(DIS_IDS_KEY);
    disabledGroups = loadSet(DIS_GROUPS_KEY);
    if (state.phase === "setup" && el && Data.vocab && Data.vocab.length) renderSetup();
  }

  return { init: init, reloadState: reloadState };
})();
