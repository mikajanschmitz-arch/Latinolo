/* ==========================================================================
   sync.js — Anmeldung mit Google (Firebase) und Synchronisation des Lernstands

   - Ohne Anmeldung arbeitet die App wie bisher rein lokal.
   - Nach der Anmeldung wird der Lernstand (Fortschritt, Streak, Wortauswahl,
     deaktivierte Woerter, ...) in Firestore unter  users/<uid>  abgelegt und
     zwischen allen Geraeten abgeglichen.
   - Nicht synchronisiert werden geraetespezifische Einstellungen
     (Dark Mode, Schriftgroesse).
   - Die Firebase-SDK-Dateien werden erst zur Laufzeit nachgeladen; schlaegt das
     fehl (z. B. offline), laeuft die App ganz normal weiter.
   ========================================================================== */

var Sync = (function () {
  "use strict";

  // Oeffentliche Konfiguration des Firebase-Projekts (kein Geheimnis;
  // der Schutz der Daten erfolgt ueber die Firestore-Regeln).
  var FIREBASE_CONFIG = {
    apiKey: "AIzaSyAtVgCQpd7ogE2339eoCoT73MUPHXd0Nnc",
    authDomain: "latinolo.firebaseapp.com",
    projectId: "latinolo",
    storageBucket: "latinolo.firebasestorage.app",
    messagingSenderId: "216544401253",
    appId: "1:216544401253:web:0d38f7f91b6d5b045a738c",
  };

  var SDK_VERSION = "10.14.1";
  var SDK_URLS = [
    "https://www.gstatic.com/firebasejs/" + SDK_VERSION + "/firebase-app-compat.js",
    "https://www.gstatic.com/firebasejs/" + SDK_VERSION + "/firebase-auth-compat.js",
    "https://www.gstatic.com/firebasejs/" + SDK_VERSION + "/firebase-firestore-compat.js",
  ];

  var KEY_PROGRESS = "ll_progress_v1";
  var KEY_STREAK = "ll_streak_v1";
  var SYNC_KEYS = [
    KEY_PROGRESS,
    KEY_STREAK,
    "ll_lesson_selection_v1",
    "ll_forms_selection_v1",
    "ll_flash_idioms_v1",
    "ll_forms_words_v1",
    "ll_fc_disabled_ids_v1",
    "ll_fc_disabled_groups_v1",
  ];
  var META_KEY = "ll_sync_meta_v1"; // lokale Zeitstempel je Schluessel
  var PUSH_DELAY = 4000;
  var RETRY_DELAY = 30000;

  var state = {
    sdk: "idle",     // idle | loading | ready | failed
    user: null,      // { uid, name, email }
    status: "idle",  // idle | syncing | ok | offline | error
    lastSync: null,
    errorText: "",
  };
  var listeners = [];
  var auth = null, db = null, docRef = null, unsubscribe = null;
  var pushTimer = null, retryTimer = null;
  var applying = false;

  // ------------------------------------------------------------ Hilfsfunktionen

  var nativeSetItem = Storage.prototype.setItem;

  function notify(reason) {
    listeners.forEach(function (fn) {
      try { fn(state, reason || "state"); } catch (e) { console.warn("Sync-Listener Fehler", e); }
    });
  }
  function setStatus(status, errorText) {
    state.status = status;
    state.errorText = errorText || "";
    notify("state");
  }

  function getMeta() {
    try { return JSON.parse(localStorage.getItem(META_KEY) || "{}") || {}; } catch (e) { return {}; }
  }
  function saveMeta(meta) {
    try { nativeSetItem.call(localStorage, META_KEY, JSON.stringify(meta)); } catch (e) {}
  }

  function stable(v) {
    if (Array.isArray(v)) return "[" + v.map(stable).join(",") + "]";
    if (v && typeof v === "object") {
      return "{" + Object.keys(v).sort().map(function (k) { return JSON.stringify(k) + ":" + stable(v[k]); }).join(",") + "}";
    }
    return JSON.stringify(v);
  }
  function norm(str) {
    try { return stable(JSON.parse(str)); } catch (e) { return String(str); }
  }

  function describeError(err) {
    var code = (err && (err.code || err.message)) || "unbekannt";
    var map = {
      "auth/unauthorized-domain": "Diese Webadresse ist in Firebase noch nicht freigegeben (Authentication → Einstellungen → Autorisierte Domains).",
      "auth/operation-not-allowed": "Die Google-Anmeldung ist in Firebase noch nicht aktiviert.",
      "auth/popup-closed-by-user": "Anmeldung abgebrochen.",
      "auth/cancelled-popup-request": "Anmeldung abgebrochen.",
      "auth/popup-blocked": "Das Anmelde-Fenster wurde blockiert. Bitte Pop-ups für diese Seite erlauben.",
      "auth/network-request-failed": "Keine Internetverbindung.",
      "permission-denied": "Zugriff verweigert – bitte die Firestore-Regeln prüfen.",
      "not-found": "Die Firestore-Datenbank wurde noch nicht angelegt.",
      "unavailable": "Der Server ist gerade nicht erreichbar.",
      "sdk-not-ready": "Die Anmeldung wird noch vorbereitet. Bitte kurz warten und noch einmal tippen.",
    };
    return map[code] || "Fehler: " + code;
  }

  // ------------------------------------------------------------ Merge-Logik

  function mergeProgress(a, b) {
    var out = {};
    Object.keys(a).concat(Object.keys(b)).forEach(function (id) {
      if (id in out) return;
      var x = a[id], y = b[id];
      if (!x) { out[id] = y; return; }
      if (!y) { out[id] = x; return; }
      var tx = x.lastSeen || "", ty = y.lastSeen || "";
      if (tx > ty) out[id] = x;
      else if (ty > tx) out[id] = y;
      else out[id] = (x.seen || 0) >= (y.seen || 0) ? x : y;
    });
    return out;
  }

  function mergeStreak(a, b) {
    var base = (b.settingsUpdated || 0) > (a.settingsUpdated || 0) ? b : a;
    var out = Object.assign({}, base);
    var h1 = a.history || {}, h2 = b.history || {}, hist = {};
    Object.keys(h1).concat(Object.keys(h2)).forEach(function (d) {
      if (d in hist) return;
      var x = h1[d], y = h2[d];
      if (!x) { hist[d] = y; return; }
      if (!y) { hist[d] = x; return; }
      var cx = x.count || 0, cy = y.count || 0;
      hist[d] = cx >= cy ? x : y;
    });
    out.history = hist;
    out.setupDone = !!(a.setupDone || b.setupDone);
    return out;
  }

  // Ergebnis: null (nichts zu tun) oder { value, t, applyLocal, push }
  function mergeKey(key, localStr, localT, remote) {
    var hasRemote = remote && typeof remote.v === "string";
    if (!hasRemote) {
      if (localStr === null) return null;
      return { value: localStr, t: localT || Date.now(), applyLocal: false, push: true };
    }
    if (localStr === null) {
      return { value: remote.v, t: remote.t || 0, applyLocal: true, push: false };
    }
    var nl = norm(localStr), nr = norm(remote.v);
    if (key === KEY_PROGRESS || key === KEY_STREAK) {
      try {
        var a = JSON.parse(localStr), b = JSON.parse(remote.v);
        var merged = key === KEY_PROGRESS ? mergeProgress(a, b) : mergeStreak(a, b);
        var mStr = JSON.stringify(merged);
        var nm = norm(mStr);
        var applyLocal = nm !== nl;
        var push = nm !== nr;
        return {
          value: mStr,
          t: push ? Date.now() : Math.max(localT || 0, remote.t || 0),
          applyLocal: applyLocal,
          push: push,
        };
      } catch (e) { /* faellt auf "neuester gewinnt" zurueck */ }
    }
    if (nl === nr) return { value: localStr, t: Math.max(localT || 0, remote.t || 0), applyLocal: false, push: false };
    if ((remote.t || 0) > (localT || 0)) {
      return { value: remote.v, t: remote.t, applyLocal: true, push: false };
    }
    return { value: localStr, t: localT || Date.now(), applyLocal: false, push: true };
  }

  // Remote-Stand mit dem lokalen Stand abgleichen; schreibt lokal und/oder online.
  function reconcile(data) {
    var remoteKeys = (data && data.keys) || {};
    var resetAt = (data && data.resetAt) || 0;
    var meta = getMeta();
    if (meta._resetSeen === undefined) {
      // erste Synchronisation auf diesem Geraet: bestehende Markierung nur merken
      meta._resetSeen = resetAt;
    } else if (resetAt > meta._resetSeen) {
      // Der Lernstand wurde auf einem anderen Geraet zurueckgesetzt.
      applying = true;
      try {
        SYNC_KEYS.forEach(function (key) { localStorage.removeItem(key); delete meta[key]; });
      } finally {
        applying = false;
      }
      meta._resetSeen = resetAt;
      saveMeta(meta);
      return Promise.resolve(true);
    }
    var changedLocal = false;
    var toPush = {};
    applying = true;
    try {
      SYNC_KEYS.forEach(function (key) {
        var localStr = localStorage.getItem(key);
        var res = mergeKey(key, localStr, meta[key], remoteKeys[key]);
        if (!res) return;
        if (res.applyLocal) {
          nativeSetItem.call(localStorage, key, res.value);
          changedLocal = true;
        }
        meta[key] = res.t;
        if (res.push) toPush[key] = { v: res.value, t: res.t };
      });
    } finally {
      applying = false;
    }
    saveMeta(meta);
    if (Object.keys(toPush).length) return pushKeys(toPush).then(function () { return changedLocal; });
    return Promise.resolve(changedLocal);
  }

  function pushKeys(map) {
    if (!docRef) return Promise.resolve();
    var keys = {};
    Object.keys(map).forEach(function (k) { keys[k] = { v: map[k].v, t: map[k].t }; });
    return docRef.set({ keys: keys, updatedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
  }

  // ------------------------------------------------------------ Abgleich-Ablauf

  function afterReconcile(changedLocal) {
    state.lastSync = new Date();
    setStatus("ok");
    if (changedLocal) notify("applied");
  }

  function handleError(err) {
    console.warn("Sync-Fehler:", err);
    var offline = (typeof navigator !== "undefined" && navigator.onLine === false) ||
      (err && (err.code === "unavailable" || err.code === "auth/network-request-failed"));
    setStatus(offline ? "offline" : "error", offline ? "" : describeError(err));
    scheduleRetry();
  }

  function scheduleRetry() {
    clearTimeout(retryTimer);
    retryTimer = setTimeout(function () { if (state.user) syncNow(); }, RETRY_DELAY);
  }

  // Einmal vom Server lesen, abgleichen und ggf. zurueckschreiben.
  function syncNow() {
    if (!docRef) return Promise.resolve();
    if (typeof navigator !== "undefined" && navigator.onLine === false) { setStatus("offline"); return Promise.resolve(); }
    setStatus("syncing");
    return docRef.get({ source: "server" }).then(function (snap) {
      return reconcile(snap.exists ? (snap.data() || {}) : {});
    }).then(afterReconcile).catch(handleError);
  }

  function schedulePush() {
    clearTimeout(pushTimer);
    pushTimer = setTimeout(syncNow, PUSH_DELAY);
  }

  function startSync() {
    stopSync(false);
    docRef = db.collection("users").doc(state.user.uid);
    setStatus("syncing");
    unsubscribe = docRef.onSnapshot(function (snap) {
      if (snap.metadata.fromCache || snap.metadata.hasPendingWrites) return;
      reconcile(snap.exists ? (snap.data() || {}) : {}).then(afterReconcile).catch(handleError);
    }, handleError);
  }

  function stopSync(clearStatus) {
    if (unsubscribe) { try { unsubscribe(); } catch (e) {} unsubscribe = null; }
    clearTimeout(pushTimer);
    clearTimeout(retryTimer);
    docRef = null;
    if (clearStatus !== false) { state.lastSync = null; setStatus("idle"); }
  }

  // Lokale Aenderungen mitbekommen (auch die der Module, die localStorage direkt nutzen)
  Storage.prototype.setItem = function (k) {
    nativeSetItem.apply(this, arguments);
    try {
      if (this === window.localStorage && !applying && SYNC_KEYS.indexOf(k) !== -1) {
        var meta = getMeta();
        meta[k] = Date.now();
        saveMeta(meta);
        if (state.user) schedulePush();
      }
    } catch (e) {}
  };

  // ------------------------------------------------------------ SDK / Anmeldung

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      s.src = src;
      s.async = false;
      s.onload = resolve;
      s.onerror = function () { reject(new Error("load-failed")); };
      document.head.appendChild(s);
    });
  }

  function init() {
    if (state.sdk === "loading" || state.sdk === "ready") return;
    state.sdk = "loading";
    notify("state");
    SDK_URLS.reduce(function (p, url) { return p.then(function () { return loadScript(url); }); }, Promise.resolve())
      .then(function () {
        firebase.initializeApp(FIREBASE_CONFIG);
        auth = firebase.auth();
        db = firebase.firestore();
        try { db.settings({ experimentalAutoDetectLongPolling: true, merge: true }); } catch (e) {}
        state.sdk = "ready";
        auth.onAuthStateChanged(function (user) {
          if (user) {
            state.user = { uid: user.uid, name: user.displayName || "", email: user.email || "" };
            notify("state");
            startSync();
          } else {
            state.user = null;
            stopSync(true);
          }
        });
        notify("state");
      })
      .catch(function () {
        state.sdk = "failed";
        notify("state");
      });
  }

  function signIn() {
    if (state.sdk !== "ready") return Promise.reject({ code: "sdk-not-ready" });
    var provider = new firebase.auth.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    return auth.signInWithPopup(provider).catch(function (err) {
      if (err && (err.code === "auth/popup-blocked" || err.code === "auth/operation-not-supported-in-this-environment")) {
        return auth.signInWithRedirect(provider);
      }
      throw err;
    });
  }

  function signOut() {
    if (!auth) return Promise.resolve();
    return auth.signOut();
  }

  // "Fortschritt zuruecksetzen" fuer alle Geraete: Online-Stand leeren und eine
  // Markierung setzen, damit auch andere angemeldete Geraete ihren Stand verwerfen.
  function resetEverywhere() {
    if (!docRef) return Promise.resolve();
    var ref = docRef;
    stopSync(false);
    return ref.set({ keys: {}, resetAt: Date.now(), updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
  }

  window.addEventListener("online", function () {
    if (state.sdk === "failed") init();
    if (state.user) syncNow();
  });
  window.addEventListener("offline", function () { if (state.user) setStatus("offline"); });

  document.addEventListener("DOMContentLoaded", function () { setTimeout(init, 600); });

  return {
    getState: function () { return state; },
    onChange: function (fn) { listeners.push(fn); },
    signIn: signIn,
    signOut: signOut,
    syncNow: syncNow,
    resetEverywhere: resetEverywhere,
    describeError: describeError,
    init: init,
  };
})();
