/* ==========================================================================
   app.js — Navigation, Streak-Ansicht, Einstellungen, Start
   ========================================================================== */

(function () {
  "use strict";

  var TITLES = { flashcards: "Karteikarten", search: "Suche", forms: "Formentrainer", streak: "Streak", settings: "Einstellungen" };
  var lastMainTab = "flashcards";

  function applyTheme() {
    var s = Store.getSettings();
    document.documentElement.setAttribute("data-theme", s.darkMode ? "dark" : "light");
  }

  function showView(name) {
    document.querySelectorAll(".view").forEach(function (v) { v.classList.remove("active"); });
    document.getElementById("view-" + name).classList.add("active");
    document.querySelectorAll(".tab-btn").forEach(function (b) { b.classList.toggle("active", b.dataset.view === name); });
    document.getElementById("page-title").textContent = TITLES[name];
    if (name !== "settings") lastMainTab = name;
    if (name === "streak") renderStreakView();
    if (name === "settings") renderSettingsView();
  }

  // ---------------- Streak-Ansicht ----------------

  function renderStreakView() {
    var root = document.getElementById("view-streak");
    var s = Store.getStreak();
    var streakCount = Streak.currentStreak(s);
    var days = Streak.last7Days(s);
    var today = Streak.todayCount(s);
    var goalMet = Streak.goalMetToday(s);
    var editable = Streak.canEditSettings(s);

    var dayDots = days.map(function (d) {
      var cls = "day-dot";
      if (d.status === "done") cls += " done";
      else if (d.status === "rest") cls += " rest";
      else if (d.status === "missed") cls += " missed";
      if (d.isToday) cls += " today";
      var icon = d.status === "done" ? "✓" : d.status === "rest" ? "⏸" : d.status === "missed" ? "✕" : "";
      return '<div style="text-align:center;"><div class="' + cls + '">' + icon + '</div><div style="font-size:0.7rem;color:var(--text-muted);margin-top:4px;">' + d.label + "</div></div>";
    }).join("");

    var restDayChips = Streak.WEEKDAY_NAMES.map(function (name, idx) {
      var checked = s.restDays.indexOf(idx) !== -1;
      return '<div class="chip' + (checked ? " selected" : "") + '" data-weekday="' + idx + '" style="' + (editable ? "" : "opacity:0.5;pointer-events:none;") + '">' + name + "</div>";
    }).join("");

    root.innerHTML =
      '<div class="streak-hero">' +
      '<div class="streak-flame">🔥</div>' +
      '<div class="streak-count">' + streakCount + " Tag" + (streakCount === 1 ? "" : "e") + "</div>" +
      '<div style="color:var(--text-muted);">aktueller Streak</div>' +
      "</div>" +

      '<div class="card-panel">' +
      '<div class="section-title">Heute</div>' +
      "<p>" + today + " / " + s.dailyGoal + " Karteikarten richtig beantwortet" + (goalMet ? " — Ziel erreicht! 🎉" : "") + "</p>" +
      '<div class="progress-bar-track"><div class="progress-bar-fill" style="width:' + Math.min(100, Math.round((today / s.dailyGoal) * 100)) + '%;"></div></div>' +
      "</div>" +

      '<div class="card-panel">' +
      '<div class="section-title">Letzte 7 Tage</div>' +
      '<div class="week-strip">' + dayDots + "</div>" +
      "</div>" +

      '<div class="card-panel">' +
      '<div class="section-title">Tagesziel</div>' +
      (editable ? "" : '<p style="color:var(--text-muted);font-size:0.85rem;">Du kannst dein Tagesziel erst ändern, wenn du es heute erreicht hast (oder heute ein Pausentag ist).</p>') +
      '<div class="field-row"><label>Karteikarten pro Tag</label><input type="text" inputmode="numeric" id="streak-goal-input" value="' + s.dailyGoal + '" ' + (editable ? "" : "disabled") + "></div>" +
      '<div class="section-title">Pausentage</div>' +
      '<div class="chip-grid" id="streak-restday-grid">' + restDayChips + "</div>" +
      '<button class="btn btn-primary btn-block" id="streak-save" style="margin-top:12px;" ' + (editable ? "" : "disabled") + ">Speichern</button>" +
      "</div>";

    if (editable) {
      root.querySelector("#streak-restday-grid").addEventListener("click", function (ev) {
        var chip = ev.target.closest(".chip");
        if (!chip) return;
        chip.classList.toggle("selected");
      });
      root.querySelector("#streak-save").addEventListener("click", function () {
        var goalVal = parseInt(root.querySelector("#streak-goal-input").value, 10);
        if (!goalVal || goalVal < 1) { alert("Bitte eine gültige Zahl eingeben."); return; }
        var rest = Array.from(root.querySelectorAll("#streak-restday-grid .chip.selected")).map(function (c) { return Number(c.dataset.weekday); });
        var cur = Store.getStreak();
        cur.dailyGoal = goalVal;
        cur.restDays = rest;
        cur.setupDone = true;
        Store.setStreak(cur);
        renderStreakView();
      });
    }
  }

  // ---------------- Einstellungen ----------------

  function renderSettingsView() {
    var root = document.getElementById("view-settings");
    var s = Store.getSettings();
    root.innerHTML =
      '<div class="card-panel">' +
      '<div class="toggle-row"><span>Dark Mode</span><label class="switch"><input type="checkbox" id="set-dark" ' + (s.darkMode ? "checked" : "") + '><span class="slider"></span></label></div>' +
      "</div>" +
      '<div class="card-panel">' +
      '<div class="section-title">Schriftgröße</div>' +
      '<input type="range" id="set-font" min="0.85" max="1.3" step="0.05" value="' + (s.fontScale || 1) + '" style="width:100%;">' +
      "</div>" +
      '<div class="card-panel">' +
      '<div class="section-title">Daten</div>' +
      '<p style="color:var(--text-muted);font-size:0.85rem;">Setzt deinen gesamten Lernfortschritt, Streak und alle Einstellungen auf diesem Gerät zurück.</p>' +
      '<button class="btn btn-danger btn-block" id="set-reset">Fortschritt zurücksetzen</button>' +
      "</div>" +
      '<footer class="legal">Latein-Vokabeltrainer · lokal auf diesem Gerät gespeichert</footer>';

    root.querySelector("#set-dark").addEventListener("change", function (ev) {
      var cur = Store.getSettings();
      cur.darkMode = ev.target.checked;
      Store.setSettings(cur);
      applyTheme();
    });
    root.querySelector("#set-font").addEventListener("input", function (ev) {
      var cur = Store.getSettings();
      cur.fontScale = parseFloat(ev.target.value);
      Store.setSettings(cur);
      document.documentElement.style.fontSize = (cur.fontScale * 100) + "%";
    });
    root.querySelector("#set-reset").addEventListener("click", function () {
      if (confirm("Wirklich den gesamten Fortschritt löschen? Das kann nicht rückgängig gemacht werden.")) {
        localStorage.clear();
        location.reload();
      }
    });
  }

  // ---------------- Start ----------------

  document.addEventListener("DOMContentLoaded", function () {
    applyTheme();
    var s0 = Store.getSettings();
    if (s0.fontScale) document.documentElement.style.fontSize = (s0.fontScale * 100) + "%";

    Data.load("data/vocab.json").catch(function (err) {
      console.error("Konnte vocab.json nicht laden:", err);
      document.getElementById("view-flashcards").innerHTML =
        '<div class="empty-state">Die Vokabeldatei (data/vocab.json) konnte nicht geladen werden.<br>Falls du die Seite lokal per Doppelklick geöffnet hast, starte stattdessen einen kleinen lokalen Server (z. B. <code>python3 -m http.server</code>) oder nutze GitHub Pages.</div>';
    });

    Flashcards.init(document.getElementById("view-flashcards"));
    Search.init(document.getElementById("view-search"));
    Forms.init(document.getElementById("view-forms"));

    document.querySelectorAll(".tab-btn").forEach(function (btn) {
      btn.addEventListener("click", function () { showView(btn.dataset.view); });
    });
    document.getElementById("settings-btn").addEventListener("click", function () {
      var settingsView = document.getElementById("view-settings");
      if (settingsView.classList.contains("active")) { showView(lastMainTab); }
      else { showView("settings"); }
    });
  });
})();
