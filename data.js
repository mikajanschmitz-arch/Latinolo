/* ==========================================================================
   data.js — laedt data/vocab.json und stellt Hilfsfunktionen bereit
   ========================================================================== */

var Data = (function () {
  "use strict";

  var vocab = [];
  var byId = {};
  var readyResolve;
  var ready = new Promise(function (res) { readyResolve = res; });

  function normalize(s) {
    return (s || "")
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Makra entfernen
      .replace(/j/g, "i").replace(/J/g, "I")
      .replace(/v/g, "u").replace(/V/g, "U")
      .toLowerCase();
  }

  function load(path) {
    return fetch(path || "vocab.json")
      .then(function (r) { return r.json(); })
      .then(function (json) {
        vocab = json;
        vocab.forEach(function (e) { byId[e.id] = e; });
        try { migrateLegacyIds(); } catch (err) { console.warn("ID-Uebernahme fehlgeschlagen:", err); }
        readyResolve();
        return vocab;
      });
  }

  // Nach einer neuen Vokabelliste haben die Eintraege neue IDs. Der Lernfortschritt, deaktivierte
  // Woerter und die Wortauswahl wurden unter den alten IDs gespeichert; sie werden hier auf die
  // neuen IDs umgeschrieben (Zuordnung: legacy_ids in vocab.json).
  function migrateLegacyIds() {
    var map = {};
    vocab.forEach(function (e) { (e.legacy_ids || []).forEach(function (old) { map[old] = e.id; }); });
    if (!Object.keys(map).length) return;

    function readJson(key, fallback) {
      try { var v = JSON.parse(localStorage.getItem(key)); return v == null ? fallback : v; } catch (e) { return fallback; }
    }
    function write(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {} }

    var progress = readJson("ll_progress_v1", null);
    if (progress && typeof progress === "object") {
      var changed = false;
      Object.keys(progress).forEach(function (oldId) {
        if (byId[oldId] || !map[oldId]) return;      // schon neu oder unbekannt
        var newId = map[oldId];
        var cur = progress[newId], old = progress[oldId];
        if (!cur || String(old.lastSeen || "") > String(cur.lastSeen || "")) progress[newId] = old;
        delete progress[oldId];
        changed = true;
      });
      if (changed) write("ll_progress_v1", progress);
    }
    ["ll_fc_disabled_ids_v1", "ll_forms_words_v1"].forEach(function (key) {
      var arr = readJson(key, null);
      if (!Array.isArray(arr)) return;
      var out = [], changed = false;
      arr.forEach(function (id) {
        if (!byId[id] && map[id]) { id = map[id]; changed = true; }
        if (byId[id] && out.indexOf(id) === -1) out.push(id); else if (!byId[id]) changed = true;
      });
      if (changed) write(key, out);
    });
  }

  function lessonMain(lessonStr) {
    return parseInt(String(lessonStr).split(".")[0], 10);
  }

  // Liefert eine sortierte Liste aller in den Daten vorkommenden Lektionen,
  // gruppiert nach Hauptlektion: [{ main: 1, subs: ["1"] }, { main:2, subs:["2.1","2.2"]}, ...]
  function allLessons() {
    var set = {};
    vocab.forEach(function (e) {
      (e.lessons || []).forEach(function (l) {
        var m = lessonMain(l);
        if (!set[m]) set[m] = new Set();
        set[m].add(String(l));
      });
    });
    var mains = Object.keys(set).map(Number).sort(function (a, b) { return a - b; });
    return mains.map(function (m) {
      var subs = Array.from(set[m]).sort();
      return { main: m, subs: subs, hasSubs: subs.length > 1 || subs[0] !== String(m) };
    });
  }

  function entriesForLessons(lessonLabels) {
    var wanted = new Set(lessonLabels.map(String));
    return vocab.filter(function (e) {
      return (e.lessons || []).some(function (l) { return wanted.has(String(l)); });
    });
  }

  function entriesForMainLessons(mainNumbers) {
    var wanted = new Set(mainNumbers.map(Number));
    return vocab.filter(function (e) {
      return (e.lessons || []).some(function (l) { return wanted.has(lessonMain(l)); });
    });
  }

  function byPos(entries, posSet) {
    if (!posSet || !posSet.size) return entries;
    return entries.filter(function (e) { return posSet.has(e.pos); });
  }

  function allPosValues() {
    var s = new Set();
    vocab.forEach(function (e) { s.add(e.pos); });
    return Array.from(s);
  }

  function search(query) {
    var qNorm = normalize(query.trim());
    if (!qNorm) return [];
    var results = [];
    vocab.forEach(function (e) {
      var lemmaNorm = normalize(e.lemma);
      var firstFormNorm = normalize((e.lemma.split(",")[0] || "").trim());
      if (lemmaNorm.indexOf(qNorm) !== -1 || firstFormNorm === qNorm) {
        results.push({ entry: e, matchType: "lemma", score: firstFormNorm === qNorm ? 2 : 1 });
      }
    });
    return results;
  }

  return {
    ready: ready,
    load: load,
    get vocab() { return vocab; },
    byId: function (id) { return byId[id]; },
    lessonMain: lessonMain,
    allLessons: allLessons,
    entriesForLessons: entriesForLessons,
    entriesForMainLessons: entriesForMainLessons,
    byPos: byPos,
    allPosValues: allPosValues,
    search: search,
    normalize: normalize,
  };
})();
