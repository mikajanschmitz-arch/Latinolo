/* ==========================================================================
   storage.js — kleiner localStorage-Wrapper
   ========================================================================== */

var Store = (function () {
  "use strict";

  var KEYS = {
    settings: "ll_settings_v1",
    progress: "ll_progress_v1",
    streak: "ll_streak_v1",
    lessonSelection: "ll_lesson_selection_v1",
    formsSelection: "ll_forms_selection_v1",
  };

  function read(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      if (raw === null) return fallback;
      return JSON.parse(raw);
    } catch (e) {
      console.warn("Store.read Fehler für", key, e);
      return fallback;
    }
  }

  function write(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      console.warn("Store.write Fehler für", key, e);
      return false;
    }
  }

  // ---------------- Settings ----------------
  var DEFAULT_SETTINGS = { darkMode: false, fontScale: 1 };
  function getSettings() { return Object.assign({}, DEFAULT_SETTINGS, read(KEYS.settings, {})); }
  function setSettings(s) { write(KEYS.settings, s); }

  // ---------------- Fortschritt pro Vokabel ----------------
  // progress[id] = { box: 0-5, seen: n, correct: n, wrong: n, lastSeen: ISOString }
  function getProgress() { return read(KEYS.progress, {}); }
  function setProgress(p) { write(KEYS.progress, p); }

  function recordAnswer(id, wasCorrect) {
    var p = getProgress();
    var e = p[id] || { box: 0, seen: 0, correct: 0, wrong: 0, lastSeen: null };
    e.seen++;
    if (wasCorrect) {
      e.correct++;
      e.box = Math.min(5, e.box + 1);
    } else {
      e.wrong++;
      e.box = 0;
    }
    e.lastSeen = new Date().toISOString();
    p[id] = e;
    setProgress(p);
    return e;
  }

  // ---------------- Streak ----------------
  var DEFAULT_STREAK = {
    dailyGoal: 15,
    restDays: [], // 0=So,1=Mo,...6=Sa
    history: {},  // "YYYY-MM-DD" -> { count, goalMetSnapshot }
    setupDone: false,
  };
  function getStreak() { return Object.assign({}, DEFAULT_STREAK, read(KEYS.streak, {})); }
  function setStreak(s) { write(KEYS.streak, s); }

  // ---------------- Lektionsauswahl merken ----------------
  function getLessonSelection() { return read(KEYS.lessonSelection, []); }
  function setLessonSelection(arr) { write(KEYS.lessonSelection, arr); }
  function getFormsSelection() { return read(KEYS.formsSelection, null); }
  function setFormsSelection(obj) { write(KEYS.formsSelection, obj); }

  return {
    getSettings: getSettings, setSettings: setSettings,
    getProgress: getProgress, setProgress: setProgress, recordAnswer: recordAnswer,
    getStreak: getStreak, setStreak: setStreak,
    getLessonSelection: getLessonSelection, setLessonSelection: setLessonSelection,
    getFormsSelection: getFormsSelection, setFormsSelection: setFormsSelection,
  };
})();
