/* ==========================================================================
   app.js — Navigation, Streak-Ansicht, Einstellungen, Start
   ========================================================================== */

(function () {
  "use strict";

  var TITLES = { home: "Latinolo", flashcards: "Karteikarten", search: "Suche", forms: "Formentrainer", streak: "Streak", settings: "Einstellungen" };
  var lastMainTab = "home";

  function applyTheme() {
    var s = Store.getSettings();
    document.documentElement.setAttribute("data-theme", s.darkMode ? "dark" : "light");
  }

  function showView(name) {
    document.querySelectorAll(".view").forEach(function (v) { v.classList.remove("active"); });
    document.getElementById("view-" + name).classList.add("active");
    document.querySelectorAll(".tab-btn").forEach(function (b) { b.classList.toggle("active", b.dataset.view === name); });
    document.getElementById("page-title").textContent = TITLES[name];
    document.getElementById("page-subtitle").classList.toggle("visible", name === "home");
    if (name !== "settings") lastMainTab = name;
    if (name === "home") renderHomeView();
    if (name === "streak") renderStreakView();
    if (name === "settings") renderSettingsView();
  }

  // ---------------- Start-Menü ----------------

  var MENU_ITEMS = [
    { view: "flashcards", icon: "🗂️", title: "Karteikarten", desc: "Vokabeln nach Lektion lernen" },
    { view: "search", icon: "🔍", title: "Suche", desc: "Formen einer Vokabel nachschlagen" },
    { view: "forms", icon: "✏️", title: "Formentrainer", desc: "Deklination & Konjugation üben" },
    { view: "streak", icon: "🔥", title: "Streak", desc: "Tagesziel & Lernserie ansehen" },
    { view: "settings", icon: "⚙️", title: "Einstellungen", desc: "Dark Mode, Schriftgröße, Fortschritt" },
  ];

  function renderHomeView() {
    var root = document.getElementById("view-home");
    var s = Store.getStreak();
    var streakCount = Streak.currentStreak(s);
    var cards = MENU_ITEMS.map(function (item) {
      return (
        '<button class="menu-card" data-goto="' + item.view + '">' +
        '<span class="menu-card-icon">' + item.icon + "</span>" +
        '<span class="menu-card-text"><span class="menu-card-title">' + item.title + '</span><span class="menu-card-desc">' + item.desc + "</span></span>" +
        "</button>"
      );
    }).join("");

    root.innerHTML =
      '<div style="text-align:center;margin:8px 0 22px;">' +
      '<div style="font-size:2rem;">🏛️</div>' +
      '<p style="color:var(--text-muted);margin-top:4px;">' + (streakCount > 0 ? "🔥 " + streakCount + "-Tage-Streak — weiter so!" : "Was möchtest du heute lernen?") + "</p>" +
      "</div>" +
      '<div class="menu-grid">' + cards + "</div>";

    root.querySelectorAll("[data-goto]").forEach(function (btn) {
      btn.addEventListener("click", function () { showView(btn.dataset.goto); });
    });
  }

  // ---------------- Streak-Ansicht ----------------

  function renderStreakView() {
    var root = document.getElementById("view-streak");
    var s = Store.getStreak();
    var streakCount = Streak.currentStreak(s);
    var days = Streak.last7Days(s);
    var today = Streak.todayCount(s);
    var goalMet = Streak.goalMetToday(s);
    var isRestToday = (s.restDays || []).indexOf(new Date().getDay()) !== -1;
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
      (isRestToday
        ? "<p><strong>⏸ Heute ist ein Pausentag.</strong> Du musst heute nichts lernen, dein Streak bleibt erhalten." +
          (today > 0 ? '</p><p style="color:var(--text-muted);font-size:0.9rem;">Du hast heute freiwillig ' + today + (today === 1 ? " Karteikarte" : " Karteikarten") + " richtig beantwortet – das zählt nicht zum Tagesziel.</p>" : "</p>")
        : "<p>" + today + " / " + s.dailyGoal + " Karteikarten richtig beantwortet" + (goalMet ? " — Tagesziel erreicht! 🎉" : "") + "</p>" +
          '<div class="progress-bar-track"><div class="progress-bar-fill" style="width:' + Math.min(100, Math.round((today / s.dailyGoal) * 100)) + '%;"></div></div>') +
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
        cur.settingsUpdated = Date.now();
        Store.setStreak(cur);
        renderStreakView();
      });
    }
  }

  // ---------------- Einstellungen ----------------

  var settingsSignedIn = false;

  function renderSettingsView() {
    var root = document.getElementById("view-settings");
    var s = Store.getSettings();
    var signedIn = !!Sync.getState().user;
    settingsSignedIn = signedIn;
    root.innerHTML =
      '<div class="card-panel" id="account-panel"></div>' +
      '<div class="card-panel">' +
      '<div class="toggle-row"><span>Dark Mode</span><label class="switch"><input type="checkbox" id="set-dark" ' + (s.darkMode ? "checked" : "") + '><span class="slider"></span></label></div>' +
      "</div>" +
      '<div class="card-panel">' +
      '<div class="section-title">Schriftgröße</div>' +
      '<input type="range" id="set-font" min="0.85" max="1.3" step="0.05" value="' + (s.fontScale || 1) + '" style="width:100%;">' +
      "</div>" +
      '<div class="card-panel">' +
      '<div class="section-title">Daten</div>' +
      '<p style="color:var(--text-muted);font-size:0.85rem;">Setzt deinen gesamten Lernfortschritt, Streak und alle Einstellungen auf diesem Gerät zurück' + (signedIn ? " – und löscht auch den Online-Stand deines Kontos, also auf allen Geräten." : ".") + "</p>" +
      '<button class="btn btn-danger btn-block" id="set-reset">Fortschritt zurücksetzen</button>' +
      "</div>" +
      '<p style="color:var(--text-muted);font-size:0.78rem;text-align:center;padding:0 20px;">Latinolo ist ein unabhängiges Lernprojekt und steht in keiner Verbindung zum Verlag oder zu den Herausgebern von Campus A.</p>' +
      '<footer class="legal">' + (signedIn ? "Latinolo · mit deinem Google-Konto synchronisiert" : "Latinolo · lokal auf diesem Gerät gespeichert") + "</footer>";

    renderAccountPanel();

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
      var online = !!Sync.getState().user;
      var msg = online
        ? "Wirklich den gesamten Fortschritt löschen? Das gilt auch für den Online-Stand deines Kontos (alle Geräte) und kann nicht rückgängig gemacht werden."
        : "Wirklich den gesamten Fortschritt löschen? Das kann nicht rückgängig gemacht werden.";
      if (confirm(msg)) {
        var finish = function () { localStorage.clear(); location.reload(); };
        if (online) {
          Sync.resetEverywhere().then(finish, function () {
            alert("Der Online-Stand konnte nicht gelöscht werden. Bitte prüfe die Internetverbindung und versuche es noch einmal.");
          });
        } else {
          finish();
        }
      }
    });
  }


  // ---------------- Konto (Google-Anmeldung) ----------------

  function pad2(n) { return (n < 10 ? "0" : "") + n; }

  function renderAccountPanel() {
    var box = document.getElementById("account-panel");
    if (!box) return;
    var st = Sync.getState();
    var esc = function (x) { return String(x).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); };
    var html = '<div class="section-title">Konto &amp; Synchronisation</div>';

    if (st.user) {
      var statusText = {
        idle: "",
        syncing: "Synchronisiere …",
        ok: st.lastSync ? "✓ Synchronisiert um " + pad2(st.lastSync.getHours()) + ":" + pad2(st.lastSync.getMinutes()) + " Uhr" : "✓ Synchronisiert",
        offline: "Offline – wird synchronisiert, sobald du wieder online bist.",
        error: "",
      }[st.status] || "";
      html +=
        '<p style="margin:0 0 4px;">Angemeldet als <strong>' + esc(st.user.name || st.user.email) + "</strong></p>" +
        (st.user.name && st.user.email ? '<p style="margin:0 0 8px;color:var(--text-muted);font-size:0.85rem;">' + esc(st.user.email) + "</p>" : "") +
        '<p style="margin:0 0 8px;font-size:0.9rem;">' + statusText + "</p>" +
        (st.errorText ? '<p style="margin:0 0 8px;color:var(--danger, #c0392b);font-size:0.9rem;">' + esc(st.errorText) + "</p>" : "") +
        '<div class="btn-row"><button class="btn" id="acc-sync">Jetzt synchronisieren</button>' +
        '<button class="btn" id="acc-signout">Abmelden</button></div>' +
        '<p style="margin:10px 0 0;color:var(--text-muted);font-size:0.8rem;">Synchronisiert werden Fortschritt, Streak, Wortauswahl und deaktivierte Wörter. Dark Mode und Schriftgröße bleiben pro Gerät.</p>';
    } else if (st.sdk === "ready") {
      html +=
        '<p style="margin:0 0 10px;font-size:0.9rem;">Melde dich mit Google an, um auf mehreren Geräten mit demselben Lernstand zu lernen.</p>' +
        (st.errorText ? '<p style="margin:0 0 8px;color:var(--danger, #c0392b);font-size:0.9rem;">' + esc(st.errorText) + "</p>" : "") +
        '<button class="btn btn-primary btn-block" id="acc-signin">Mit Google anmelden</button>';
    } else if (st.sdk === "failed") {
      html += '<p style="margin:0;font-size:0.9rem;color:var(--text-muted);">Die Anmeldung ist gerade nicht verfügbar (keine Internetverbindung?). Die App funktioniert weiterhin lokal.</p>';
    } else {
      html += '<p style="margin:0;font-size:0.9rem;color:var(--text-muted);">Anmeldung wird vorbereitet …</p>';
    }
    box.innerHTML = html;

    var bIn = box.querySelector("#acc-signin");
    if (bIn) bIn.addEventListener("click", function () {
      Sync.signIn().catch(function (err) {
        accountError = Sync.describeError(err);
        var st2 = Sync.getState();
        st2.errorText = accountError;
        renderAccountPanel();
      });
    });
    var bOut = box.querySelector("#acc-signout");
    if (bOut) bOut.addEventListener("click", function () {
      if (confirm("Abmelden? Dein Lernstand bleibt auf diesem Gerät erhalten.")) Sync.signOut();
    });
    var bSync = box.querySelector("#acc-sync");
    if (bSync) bSync.addEventListener("click", function () { Sync.syncNow(); });
  }
  var accountError = "";

  function refreshActiveView() {
    var active = document.querySelector(".view.active");
    if (!active) return;
    var name = active.id.replace("view-", "");
    if (name === "home") renderHomeView();
    if (name === "streak") renderStreakView();
  }

  // ---------------- Start ----------------

  document.addEventListener("DOMContentLoaded", function () {
    applyTheme();
    Sync.onChange(function (st, reason) {
      if (reason === "applied") {
        Flashcards.reloadState();
        Forms.reloadState();
        refreshActiveView();
      }
      var active = document.querySelector(".view.active");
      if (active && active.id === "view-settings") {
        if (!!st.user !== settingsSignedIn) renderSettingsView();
        else renderAccountPanel();
      }
    });
    var s0 = Store.getSettings();
    if (s0.fontScale) document.documentElement.style.fontSize = (s0.fontScale * 100) + "%";

    Data.load("vocab.json").catch(function (err) {
      console.error("Konnte vocab.json nicht laden:", err);
      document.getElementById("view-flashcards").innerHTML =
        '<div class="empty-state">Die Vokabeldatei (vocab.json) konnte nicht geladen werden.<br>Falls du die Seite lokal per Doppelklick geöffnet hast, starte stattdessen einen kleinen lokalen Server (z. B. <code>python3 -m http.server</code>) oder nutze GitHub Pages.</div>';
    });

    // nach der Uebernahme alter IDs (data.js) den gespeicherten Zustand neu einlesen
    Data.ready.then(function () { Flashcards.reloadState(); Forms.reloadState(); });

    Flashcards.init(document.getElementById("view-flashcards"));
    Search.init(document.getElementById("view-search"));
    Forms.init(document.getElementById("view-forms"));
    renderHomeView();

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
