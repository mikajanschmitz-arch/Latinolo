/* ==========================================================================
   streak.js — Lern-Streak mit Tagesziel und Pausentagen
   ========================================================================== */

var Streak = (function () {
  "use strict";

  var WEEKDAY_NAMES = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];

  function todayKey(d) {
    d = d || new Date();
    var y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, "0"), day = String(d.getDate()).padStart(2, "0");
    return y + "-" + m + "-" + day;
  }

  function dateFromKey(key) {
    var parts = key.split("-").map(Number);
    return new Date(parts[0], parts[1] - 1, parts[2]);
  }

  function addDays(d, n) {
    var nd = new Date(d);
    nd.setDate(nd.getDate() + n);
    return nd;
  }

  // Zaehlt eine richtige Antwort fuer heute (wird von flashcards.js / forms.js aufgerufen)
  function recordCorrect(n) {
    n = n || 1;
    var s = Store.getStreak();
    var key = todayKey();
    if (!s.history[key]) s.history[key] = { count: 0 };
    s.history[key].count += n;
    s.setupDone = true;
    Store.setStreak(s);
    return s;
  }

  function isRestDay(s, date) {
    return s.restDays.indexOf(date.getDay()) !== -1;
  }

  function dayStatus(s, key) {
    var date = dateFromKey(key);
    var entry = s.history[key];
    var count = entry ? entry.count : 0;
    var rest = isRestDay(s, date);
    var isToday = key === todayKey();
    var isFuture = date > new Date();
    if (isFuture) return "future";
    if (rest) return "rest";
    if (count >= s.dailyGoal) return "done";
    if (isToday) return "today-pending";
    return "missed";
  }

  // Aktuellen Streak (in zusammenhaengenden Tagen) rueckwaerts ab heute berechnen.
  // Pausentage unterbrechen den Streak nicht, zaehlen ihn aber auch nicht hoch.
  function currentStreak(s) {
    s = s || Store.getStreak();
    var streak = 0;
    var cursor = new Date();
    // Wenn heute das Ziel noch nicht erreicht ist (und kein Pausentag), zaehlt
    // der heutige Tag noch nicht zum Streak, unterbricht ihn aber auch noch nicht.
    while (true) {
      var key = todayKey(cursor);
      var status = dayStatus(s, key);
      if (status === "done" || status === "rest") {
        if (status === "done") streak++;
        cursor = addDays(cursor, -1);
        continue;
      }
      if (status === "today-pending") {
        cursor = addDays(cursor, -1);
        continue;
      }
      break; // "missed"
    }
    return streak;
  }

  function last7Days(s) {
    s = s || Store.getStreak();
    var days = [];
    for (var i = 6; i >= 0; i--) {
      var d = addDays(new Date(), -i);
      var key = todayKey(d);
      days.push({ key: key, label: WEEKDAY_NAMES[d.getDay()], status: dayStatus(s, key), isToday: i === 0 });
    }
    return days;
  }

  function goalMetToday(s) {
    s = s || Store.getStreak();
    var key = todayKey();
    var count = (s.history[key] && s.history[key].count) || 0;
    return count >= s.dailyGoal || isRestDay(s, new Date());
  }

  function canEditSettings(s) {
    s = s || Store.getStreak();
    if (!s.setupDone) return true;
    return goalMetToday(s);
  }

  function todayCount(s) {
    s = s || Store.getStreak();
    var key = todayKey();
    return (s.history[key] && s.history[key].count) || 0;
  }

  return {
    WEEKDAY_NAMES: WEEKDAY_NAMES,
    todayKey: todayKey,
    recordCorrect: recordCorrect,
    dayStatus: dayStatus,
    currentStreak: currentStreak,
    last7Days: last7Days,
    goalMetToday: goalMetToday,
    canEditSettings: canEditSettings,
    todayCount: todayCount,
  };
})();
