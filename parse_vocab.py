#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
parse_vocab.py
==============
Wandelt die Rohtext-Wortschatzliste (tools/vocab_raw.txt) in eine strukturierte
JSON-Datei (data/vocab.json) fuer die Lernwebsite um.

Aufruf:
    python3 parse_vocab.py

Eingabe:  tools/vocab_raw.txt   (eine Vokabel pro Zeile, Format wie im Schulbuch-Anhang)
Ausgabe:  data/vocab.json

Wenn du spaeter Unterlektionen (z.B. "1.1" statt "1") ergaenzen willst, aendere die
Lektionsangaben direkt in vocab_raw.txt (Format bleibt: "... - 1.1" bzw. "... - 1.1, 3.2")
und fuehre dieses Skript erneut aus.
"""

import json
import re
import sys
import unicodedata
from pathlib import Path

HERE = Path(__file__).parent
RAW_PATH = HERE / "vocab_raw.txt"
OUT_PATH = HERE.parent / "vocab.json"
REPORT_PATH = HERE / "parse_report.txt"

# ----------------------------------------------------------------------------
# Hilfsfunktionen
# ----------------------------------------------------------------------------

VOWELS_LONG = "āēīōūȳĀĒĪŌŪ"
MACRON_MAP = {
    "ā": "a", "ē": "e", "ī": "i", "ō": "o", "ū": "u", "ȳ": "y",
    "Ā": "A", "Ē": "E", "Ī": "I", "Ō": "O", "Ū": "U",
}


def strip_macrons(s: str) -> str:
    return "".join(MACRON_MAP.get(c, c) for c in s)


def strip_accents_for_search(s: str) -> str:
    """Normalisierte Form ohne Makra/Sonderzeichen fuer die Suche (v/u und i/j
    werden vereinheitlicht, wie in klassischen Lateinwoerterbuechern ueblich)."""
    s = strip_macrons(s)
    s = s.replace("j", "i").replace("J", "I")
    s = s.replace("v", "u").replace("V", "U")
    return s.lower()


def norm_lookup(s: str) -> str:
    """Nur Makra entfernen + kleinschreiben, OHNE v/u- bzw. i/j-Angleichung.
    Wird fuer den Abgleich mit den festen Wortlisten (Adverbien, Konjunktionen
    etc.) verwendet, deren Eintraege in normaler Schreibung vorliegen."""
    return strip_macrons(s).lower()


# Bekannte, geschlossene Wortklassen (Funktionswoerter), die nicht generisch
# erkennbar sind. Wird nur als Fallback verwendet, wenn keine andere Regel greift.
KNOWN_CONJUNCTIONS = {
    "ac", "atque", "aut", "at", "sed", "vel", "et", "nam", "enim", "autem",
    "itaque", "ergo", "igitur", "quia", "quod", "quoniam", "nec", "neque",
    "-que", "que", "modo", "haud",
}

KNOWN_ADVERBS_NOMARK = {
    "hic", "ibi", "ubi", "unde", "quo", "quando", "tum", "tunc", "nunc",
    "iam", "etiam", "saepe", "mox", "tandem", "sic", "ita", "tam", "quam",
    "cur", "nihil", "non", "haud", "vix", "satis", "paene",
}

# Woerter, die eindeutig Praepositionen / Adverbien / Konjunktionen / Interjektionen
# sind, deren Zeile aber nicht das ueblich Muster "Wort Adv./Praep./Subj." zeigt.
MANUAL_POS_OVERRIDE = {
    # lemma (wie im Rohtext) -> pos
    "alius ... alius": "Pronomen",
    "aut ... aut": "Konjunktion",
    "et ... et": "Konjunktion",
    "modo ... modo": "Adverb",
    "nihil ... nisi": "Adverb",
    "nē ... quidem": "Partikel",
    "nec ... nec": "Konjunktion",
    "neque ... neque": "Konjunktion",
    "tam ... quam": "Adverb",
    "ūtrum ... an": "Konjunktion",
    "eius modī / eiusmodī": "Adverb",
    "sponte meā (tuā, suā)": "Adverb",
    "deō grātiās": "Interjektion",
    "necesse est": "Ausdruck",
    "odiō esse": "Ausdruck",
    "cōnstat": "Ausdruck",
    "licet": "Ausdruck",
    "oportet": "Ausdruck",
    "placet": "Ausdruck",
    "pudet, puduit": "Ausdruck",
    # Demonstrativ-, Relativ-, Interrogativ- und Indefinitpronomen
    "hic, haec, hoc": "Pronomen",
    "ille, illa, illud": "Pronomen",
    "iste, ista, istud": "Pronomen",
    "is, ea, id": "Pronomen",
    "īdem, eadem, idem": "Pronomen",
    "ipse, ipsa, ipsum": "Pronomen",
    "quī, quae, quod": "Pronomen",
    "quis, quid": "Pronomen",
    "quis?": "Pronomen",
    "quid?": "Pronomen",
    "aliquis, aliquid": "Pronomen",
    "aliquī, aliqua, aliquod": "Pronomen",
    "quīdam, quaedam, quiddam": "Pronomen",
    "quidam, quaedam, quiddam": "Pronomen",
    "quidam, quaedam, quoddam": "Pronomen",
    "quisque, quidque": "Pronomen",
    "alius, alia, aliud": "Pronomen",
    "quisnam": "Pronomen",
    # Ausrufe / feste Imperativformen (mehrere Formen mit "!")
    "dī!": "Interjektion",
    "dīc!": "Interjektion",
    "dūc!": "Interjektion",
    "salvē! salvēte!": "Interjektion",
    # Pronomen-"cum"-Verschmelzungen (sehen wegen "-um" wie Neutra aus)
    "mēcum": "Pronomen",
    "tēcum": "Pronomen",
    "vōbīscum": "Pronomen",
    "quemadmodum": "Adverb",
    # Defektives Verb
    "āiō": "Verb",
    "inquam": "Verb",
    "meminisse": "Verb",
    "sunt": "Verb",
    # Zahlwoerter (deklinierbar)
    "ambō, ambae, ambō": "Zahlwort",
    "duo, duae, duo": "Zahlwort",
    "trēs, trēs, tria": "Zahlwort",
    "mīlia, mīlium": "Zahlwort",
    # Pronominal-/Quantitaetsadjektive
    "complūrēs, complūra": "Adjektiv",
    "plērique, plēraeque, plēraque": "Adjektiv",
    "cēterī, ae, a": "Adjektiv",
    "cūnctī, ae, a": "Adjektiv",
    "multī, ae, a": "Adjektiv",
    "nōnnullī, ae, a": "Adjektiv",
    "paucī, ae, a": "Adjektiv",
    "plūrimī, ae, a": "Adjektiv",
    # feste adverbiale Ausdruecke (mehrere Woerter)
    "eō annō": "Ausdruck",
    "causā": "Ausdruck",
    "domī": "Adverb",
    "domum": "Adverb",
    "nōn iam": "Adverb",
    "nē quidem": "Partikel",
}

PLURAL_ONLY_ADJ_KEYS = {"cēterī, ae, a", "cūnctī, ae, a", "multī, ae, a",
                         "nōnnullī, ae, a", "paucī, ae, a", "plūrimī, ae, a"}

# einzelne, haeufig auftretende bare Adverbien/Konjunktionen, die per Endungs-
# heuristik faelschlich als Nomen erkannt werden koennten oder generisch
# in "Partikel" landen wuerden
BARE_ADVERB_EXTRA = {
    "nōn", "tamen", "magis", "ut", "velut", "equidem", "etsī", "quandō",
    "quārē", "quoque", "quotiēns", "paulō", "utinam", "procul",
}
BARE_CONJ_EXTRA = {"vel"}

# Woerter mit "!" deren komplette Zeile manuell aufgeteilt wird
# (lemma_override -> (lemma, translation))
MANUAL_BANG_SPLIT = {
    "dī! Vok. (oh) Götter!": ("dī", "(oh) Götter!"),
    "dīc! sag! sprich!": ("dīc", "sag! sprich!"),
    "dūc! führe!": ("dūc", "führe!"),
    "salvē! salvēte! sei gegrüßt! seid gegrüßt!": ("salvē! salvēte!", "sei gegrüßt! seid gegrüßt!"),
}

# Nomen-Endungen -> (Geschlecht, Deklination) fuer Woerter OHNE angegebenen Genitiv/Genus
BARE_NOUN_ENDINGS = [
    ("us", "m", 2), ("um", "n", 2), ("er", "m", 2), ("a", "f", 1),
]

# Bekannte Adverbien/Konjunktionen/Praepositionen ohne Marker im Text (closed class)
BARE_ADVERB_SET = {
    "hīc", "ibi", "ubi", "unde", "quō", "quandō", "tum", "tunc", "nunc", "iam",
    "etiam", "saepe", "mox", "tandem", "sīc", "ita", "tam", "quam", "cūr",
    "nihil", "nōn", "haud", "vīx", "satis", "paene", "domī", "domum", "rūrī",
    "nocte", "herī", "hodiē", "crās", "semper", "numquam", "umquam", "quondam",
}
BARE_CONJ_SET = {
    "ac", "atque", "aut", "at", "vel", "et", "nam", "enim", "autem", "itaque",
    "ergō", "igitur", "quia", "quod", "quoniam", "nec", "neque", "sed", "an",
    "vērō", "namque", "que",
}
BARE_PARTICLE_SET = {
    "nōnne", "num", "utrum", "-ne", "quīn", "equidem", "quidem", "quoque",
}

NORM_CONJ_SET = {norm_lookup(x) for x in (BARE_CONJ_SET | BARE_CONJ_EXTRA)}
NORM_ADVERB_SET = {norm_lookup(x) for x in (BARE_ADVERB_SET | BARE_ADVERB_EXTRA)}
NORM_PARTICLE_SET = {norm_lookup(x) for x in BARE_PARTICLE_SET}


ROMAN_OK = re.compile(r"^[IVXLCDM]+$")


def parse_lessons(raw: str):
    """'6' / '15, 30' / '08' -> [6] / [15, 30] / [8]
    Unterstuetzt auch bereits vergebene Unterlektionen wie '1.1' oder '1.1, 3.2'."""
    parts = [p.strip() for p in raw.split(",") if p.strip()]
    lessons = []
    for p in parts:
        # Unterlektion wie "1.1" bleibt String, reine Zahl wird zu int-aehnlichem String ohne fuehrende Nullen
        if "." in p:
            main, sub = p.split(".", 1)
            main = str(int(main))
            lessons.append(f"{main}.{sub}")
        else:
            lessons.append(str(int(p)))
    return lessons


LESSON_RE = re.compile(r"^(.*)\s-\s([0-9](?:[0-9.,\s]*[0-9])?)\s*$")


def split_off_lessons(line: str):
    m = LESSON_RE.match(line)
    if not m:
        return line, []
    body, lessons_raw = m.group(1).strip(), m.group(2).strip()
    return body, parse_lessons(lessons_raw)


# ----------------------------------------------------------------------------
# Klassifikation & Aufspaltung in (headword_info, translation)
# ----------------------------------------------------------------------------

GENDER_TOKENS = ("m/f", "m", "f", "n")

# Regex-Bausteine
PRAEP_RE = re.compile(r"\bPräp\.\s+m\.\s+(Akk|Abl)\.")
ADV_RE = re.compile(r"\bAdv\.")
SUBJ_RE = re.compile(r"\bSubj\.(\s+m\.\s+(Ind|Konj)\.)?")
NOUN_GENDER_RE = re.compile(r"(?<![A-Za-zÄÖÜäöüāēīōūĀĒĪŌŪ])(m/f|m|f|n)(\s+Pl\.)?(?=\s)")


def find_first(regex, text):
    m = regex.search(text)
    return m


def classify_and_split(body: str):
    """
    Gibt zurueck: dict mit
        lemma_raw:   kompletter lateinischer Kopf inkl. Formen, wie im Buch (String)
        grammar_note: zusaetzliche grammatische Angabe (z.B. 'Präp. m. Akk.', 'Adv.', ...) oder ''
        translation: deutsche Uebersetzung
        pos: grobe Wortart
        gender: 'm' | 'f' | 'n' | 'm/f' | None
    """
    # 0) exakte manuelle Aufteilung fuer Ausruf-Zeilen mit mehreren "!"
    if body in MANUAL_BANG_SPLIT:
        lemma, translation = MANUAL_BANG_SPLIT[body]
        return {"lemma_raw": lemma, "grammar_note": "", "translation": translation,
                "pos": "Interjektion", "gender": None}

    # 1) manuelle Overrides (Mehrwort-Ausdruecke)
    for key, pos in MANUAL_POS_OVERRIDE.items():
        if body.startswith(key):
            rest = body[len(key):].strip()
            entry = {
                "lemma_raw": key,
                "grammar_note": "",
                "translation": rest,
                "pos": pos,
                "gender": None,
            }
            if key in PLURAL_ONLY_ADJ_KEYS:
                entry["adj_type"] = "i_ae_a_pl"
            return entry

    # 2) Praeposition
    m = PRAEP_RE.search(body)
    if m:
        lemma = body[: m.start()].strip().rstrip(",")
        note = m.group(0)
        translation = body[m.end():].strip()
        return {"lemma_raw": lemma, "grammar_note": note, "translation": translation,
                "pos": "Präposition", "gender": None}

    # 3) Adverb (Adv.)
    m = ADV_RE.search(body)
    if m:
        lemma = body[: m.start()].strip().rstrip(",")
        translation = body[m.end():].strip()
        return {"lemma_raw": lemma, "grammar_note": "Adv.", "translation": translation,
                "pos": "Adverb", "gender": None}

    # 4) Subjunktion / unterordnende Konjunktion (Subj.)
    m = SUBJ_RE.search(body)
    if m:
        lemma = body[: m.start()].strip().rstrip(",")
        note = m.group(0)
        translation = body[m.end():].strip()
        return {"lemma_raw": lemma, "grammar_note": note, "translation": translation,
                "pos": "Konjunktion", "gender": None}

    # 5) Einzel-Kasusform von Personalpronomen o.ae.:  "ego Nom. ich (betont)"
    m = re.match(r"^(\S+)\s+((?:Nom|Gen|Dat|Akk|Abl|Vok)\.(?:\s*/\s*(?:Nom|Gen|Dat|Akk|Abl|Vok)\.)*)\s+(.*)$", body)
    if m:
        lemma, note, translation = m.group(1), m.group(2), m.group(3)
        return {"lemma_raw": lemma, "grammar_note": note, "translation": translation,
                "pos": "Pronomen", "gender": None}

    # 6) Ausruf-/Imperativ-Einzelformen mit "!"
    if re.match(r"^\S+!", body):
        toks = body.split()
        head_toks = []
        i = 0
        while i < len(toks) and toks[i].endswith("!"):
            head_toks.append(toks[i])
            i += 1
        lemma = " ".join(head_toks)
        translation = " ".join(toks[i:])
        return {"lemma_raw": lemma, "grammar_note": "", "translation": translation,
                "pos": "Interjektion", "gender": None}

    # 7) Fragewoerter/Sonderfaelle mit "?" direkt nach dem Lemma, z.B. "cuī? wem?"
    m = re.match(r"^(\S+\?)\s+(.*)$", body)
    if m and not re.search(r",", m.group(1)):
        lemma = m.group(1)[:-1]
        translation = m.group(2)
        pos = "Adverb" if lemma.lower() in ("cūr", "ubi", "unde", "quō", "quandō", "quot",
                                             "quārē", "quotiēns") else "Pronomen"
        return {"lemma_raw": lemma, "grammar_note": "?", "translation": translation,
                "pos": pos, "gender": None}

    # 8) Nomen: Suche Genus-Token (m, f, n, m/f) ausserhalb von Klammern
    #    Wir suchen im Bereich VOR dem ersten Grossbuchstaben-losen deutschen Wortblock.
    #    Strategie: alles bis zum ersten Komma-Block einsammeln, dann nach Genus-Token schauen.
    noun_info = try_parse_noun(body)
    if noun_info:
        return noun_info

    # 9) Verb: Prinzipalformen (2-4 kommagetrennte lateinische Formen am Zeilenanfang)
    verb_info = try_parse_verb(body)
    if verb_info:
        return verb_info

    # 10) Adjektiv: Muster "wort, a, um" / "wort, e" / "wort, wortis" / "wort, wort (Gen. ...)"
    adj_info = try_parse_adjective(body)
    if adj_info:
        return adj_info

    # 11) Zahlwoerter "indekl."
    if "indekl." in body:
        idx = body.index("indekl.")
        lemma = body[:idx].strip().rstrip(",")
        translation = body[idx + len("indekl."):].strip()
        return {"lemma_raw": lemma, "grammar_note": "indekl.", "translation": translation,
                "pos": "Zahlwort", "gender": None}

    # 11b) Eigenname mit Genitiv, aber ohne Genus-Buchstaben:
    #      "Orpheus, Orpheī Orpheus (berühmter ... Sänger)"
    m = re.match(r"^([A-ZĀĒĪŌŪ][a-zA-ZāēīōūĀĒĪŌŪ]+),\s+([A-Za-zāēīōūĀĒĪŌŪ]+)\s+(.*)$", body)
    if m and "(" not in m.group(1) and not looks_like_verb_infinitive(m.group(1)):
        lemma = f"{m.group(1)}, {m.group(2)}"
        translation = m.group(3).strip()
        gender = "m"
        for suf, gnd, dc in BARE_NOUN_ENDINGS:
            if m.group(1).endswith(suf):
                gender = gnd
                break
        return {"lemma_raw": lemma, "grammar_note": "", "translation": translation,
                "pos": "Substantiv", "gender": gender, "proper_noun": True,
                "inferred_gender": True}

    # 11c) Alternativform mit "/" ohne weiteren Marker, z.B. "ac / atque und, ..."
    m = re.match(r"^(\S+)\s*/\s*(\S+)\s+(.*)$", body)
    if m and not re.search(r"[,.]", m.group(1) + m.group(2)):
        lemma2 = f"{m.group(1)} / {m.group(2)}"
        lemma_key2 = norm_lookup(m.group(1))
        translation2 = m.group(3)
        if lemma_key2 in NORM_CONJ_SET:
            pos2 = "Konjunktion"
        elif lemma_key2 in NORM_ADVERB_SET:
            pos2 = "Adverb"
        else:
            pos2 = "Partikel"
        return {"lemma_raw": lemma2, "grammar_note": "", "translation": translation2,
                "pos": pos2, "gender": None}

    # 11d) Zweiwoertiger Eigenname, dessen deutsche "Übersetzung" ihn nur
    #      wiederholt, z.B. "Spurius Tarpēius Spurius Tarpeius (röm. ...)"
    m = re.match(r"^([A-ZĀĒĪŌŪ][a-zA-ZāēīōūĀĒĪŌŪ]+)\s+([A-ZĀĒĪŌŪ][a-zA-ZāēīōūĀĒĪŌŪ]+)\s+(.*)$", body)
    if m:
        w1, w2, rest = m.group(1), m.group(2), m.group(3)
        restNorm = norm_lookup(rest)
        repeatNorm = norm_lookup(w1) + " " + norm_lookup(w2)
        if restNorm.startswith(repeatNorm):
            # Die deutsche Seite wiederholt den Namen (ohne Makra) und haengt
            # oft noch eine Rollenbeschreibung an, z.B. "Spurius Tarpeius
            # (röm. Befehlshaber)". Genau wie bei einwoertigen Eigennamen
            # (z.B. "Coriolānus Coriolan (röm. Patrizier)") bleibt das die
            # komplette Übersetzung - nur unnoetige Leerzeichen entfernen.
            translation = rest.strip()
            return {"lemma_raw": f"{w1} {w2}", "grammar_note": "", "translation": translation,
                    "pos": "Substantiv", "gender": "m", "proper_noun": True, "inferred_gender": True}

    # 12) Einzelnes lateinisches Wort ohne Komma/Marker, gefolgt von der
    #     deutschen Uebersetzung: haeufigster Fall bei einfachen Nomen aus
    #     fruehen Lektionen ("avus Großvater"), Eigennamen ("Rōma Rom") und
    #     geschlossenen Partikeln/Adverbien/Konjunktionen ohne Extra-Marker.
    toks = body.split(" ", 1)
    lemma = toks[0]
    translation = toks[1] if len(toks) > 1 else ""
    lemma_key = norm_lookup(lemma.rstrip("?"))

    if lemma_key in NORM_CONJ_SET:
        pos = "Konjunktion"
    elif lemma_key in NORM_ADVERB_SET:
        pos = "Adverb"
    elif lemma_key in NORM_PARTICLE_SET:
        pos = "Partikel"
    elif re.match(r"^[A-Za-zĀĒĪŌŪāēīōū]+$", lemma) and translation:
        # Nomen-Heuristik ueber die Endung
        is_proper = lemma[0].isupper()
        gender, decl = None, None
        for suf, gnd, dc in BARE_NOUN_ENDINGS:
            if lemma.endswith(suf):
                gender, decl = gnd, dc
                break
        if gender or is_proper:
            note = f"({gender} vermutet)" if gender and not is_proper else ""
            entry = {"lemma_raw": lemma, "grammar_note": "", "translation": translation,
                     "pos": "Substantiv", "gender": gender, "inferred_gender": True}
            if is_proper:
                entry["proper_noun"] = True
            return entry
        pos = "Partikel"
    else:
        pos = "Partikel"

    return {"lemma_raw": lemma, "grammar_note": "", "translation": translation,
            "pos": pos, "gender": None}


def try_parse_noun(body: str):
    """Erkennt Substantive: Suche isoliertes Genus-Token (m/f/n) VOR dem
    deutschen Uebersetzungstext, das nicht Teil eines laengeren Wortes ist."""
    # Kandidatenbereich: von Anfang bis max. 3. Komma bzw. bis 60 Zeichen
    head_search_limit = min(len(body), 80)
    search_region = body[:head_search_limit]

    for m in NOUN_GENDER_RE.finditer(search_region):
        gender_tok = m.group(1)
        # Pluralmarker mit einschliessen
        end = m.end()
        # Es darf davor kein "Adv."/"Präp." etc. stehen (schon oben behandelt) - reicht als Heuristik
        before = body[: m.start()].rstrip()
        after = body[end:].strip()
        if not before:
            continue
        # 'before' muss wie ein lateinisches Formen-Feld aussehen (Buchstaben, Kommas, Punkte, Klammern, /)
        if not re.match(r"^[A-Za-zÄÖÜäöüāēīōūĀĒĪŌŪ0-9,.()/ \-]+$", before):
            continue
        # Grossgeschriebene deutsche Woerter mitten im "before" deuten auf Uebersetzungstext hin
        # (z.B. bei Verben mit "m. Akk." o.ae. wurde das schon vorher abgefangen)
        lemma_part = before.rstrip(",").strip()
        if len(lemma_part) == 0:
            continue
        # Heuristik: das Wort direkt vor dem Genus-Token darf keine deutsche Praeposition/Verbangabe sein
        last_word = re.split(r"[ ,]", lemma_part)[-1]
        if last_word in ("m.", "in", "ad", "ā", "ab", "ē", "ex", "dē", "cum"):
            continue
        gender = gender_tok
        note = gender_tok + (" Pl." if m.group(2) else "")
        return {"lemma_raw": lemma_part, "grammar_note": note, "translation": after,
                "pos": "Substantiv", "gender": gender}
    return None


VERB_ENDINGS_ACTIVE = ("āre", "ēre", "īre")
VERB_ENDINGS_DEP = ("ārī", "ērī", "īrī")


IRREGULAR_INFINITIVES_EXACT = {"posse", "velle", "nōlle", "fierī", "dare"}


def looks_like_verb_infinitive(word: str) -> bool:
    w = word
    if w in IRREGULAR_INFINITIVES_EXACT:
        return True
    if w.endswith("esse"):  # esse + Komposita (abesse, adesse, deesse, inesse, interesse, praeesse, prodesse, superesse)
        return True
    if w.endswith("ferre"):  # ferre + Komposita (afferre, auferre, conferre, differre, efferre, inferre, offerre, perferre, praeferre, referre)
        return True
    # deponente Infinitive auf -ārī/-ērī/-īrī (das Makron auf dem Schluss-i wird
    # in der Quelle nicht immer konsequent gesetzt, daher tolerant pruefen)
    if w.endswith(("ārī", "āri", "ērī", "ēri", "īrī", "īri")):
        return True
    if w.endswith(VERB_ENDINGS_ACTIVE):
        return True
    if w.endswith("ere") and not w.endswith(("ēre",)):
        return True
    if w.endswith("ī") and not w.endswith(("aī",)):
        # kurze Deponens-Infinitive wie loquī, sequī, patī, morī, nāscī ...
        return True
    return False


def try_parse_verb(body: str):
    # Erstes "Wort" (bis zum ersten Komma) muss wie ein Infinitiv aussehen
    first_comma = body.find(",")
    if first_comma == -1:
        first_token = body.split(" ", 1)[0]
        candidate = first_token
    else:
        candidate = body[:first_comma].strip()
    # Nur ein einzelnes lateinisches Wort erlaubt (keine Leerzeichen) fuer den Infinitiv-Test
    if " " in candidate:
        return None
    if not looks_like_verb_infinitive(candidate):
        return None
    if first_comma == -1:
        return None  # Verben haben hier immer mind. 2 Prinzipalformen

    # Sammle die kommagetrennten lateinischen Formen (Prinzipalteile), bis ein
    # Element nicht mehr wie ein lateinisches Formenwort aussieht (dann beginnt
    # entweder eine Klammer-Angabe oder die deutsche Uebersetzung).
    remainder = body
    forms = []
    pos_cursor = 0
    parts = split_top_level_commas(body)
    latin_word_re = re.compile(r"^[A-Za-zĀĒĪŌŪāēīōū]+$")
    i = 0
    consumed_chars = 0
    for i, raw_part in enumerate(parts):
        part = raw_part.strip()
        # "sum" als deponens-Marker ("... sum") gehoert noch zu den Formen
        if i == 0:
            forms.append(part)
            continue
        tokens = part.split()
        if len(tokens) == 1 and latin_word_re.match(tokens[0]):
            forms.append(tokens[0])
            continue
        if len(tokens) == 2 and latin_word_re.match(tokens[0]) and tokens[1] == "sum":
            forms.append(tokens[0] + " sum")
            continue
        # sonst: dieser Teil enthaelt schon Zusatzinfo/Übersetzung -> stoppen,
        # aber evtl. beginnt er mit einem letzten Formen-Wort gefolgt von Zusatz
        m = re.match(r"^([A-Za-zĀĒĪŌŪāēīōū]+)(\s+sum)?\s+(.*)$", part)
        if m and len(forms) >= 1:
            form = m.group(1) + (m.group(2) or "")
            forms.append(form.strip())
            rest_after = m.group(3)
            # Rekonstruiere den Rest der Zeile ab hier
            tail_parts = parts[i + 1:]
            tail = ", ".join([rest_after] + tail_parts) if tail_parts else rest_after
            return build_verb_result(forms, tail)
        break

    if len(forms) < 2:
        return None
    # Falls alle Teile konsumiert wurden (unwahrscheinlich) -> kein Body mehr fuer Übersetzung
    return None


def build_verb_result(forms, tail):
    tail = tail.strip()
    # Zusatzangaben wie "(m. Abl.)", "m. Dat.", "(ad m. Akk.)" vor der eigentlichen
    # deutschen Uebersetzung abtrennen und als grammar_note anhaengen
    note_bits = []
    while True:
        m = re.match(r"^(\([^)]*\)|m\.\s*(Akk|Dat|Abl|Gen)\.)(?=\s|$)\s*", tail)
        if not m:
            break
        note_bits.append(m.group(1).strip())
        tail = tail[m.end():].strip()
    grammar_note = ", ".join(forms)
    if note_bits:
        grammar_note += "  " + " ".join(note_bits)
    return {
        "lemma_raw": forms[0],
        "grammar_note": grammar_note,
        "translation": tail,
        "pos": "Verb",
        "gender": None,
        "verb_forms": forms,
    }


def split_top_level_commas(s: str):
    """Teilt an Kommas aber nicht innerhalb von Klammern."""
    parts = []
    depth = 0
    cur = []
    for ch in s:
        if ch == "(":
            depth += 1
        elif ch == ")":
            depth = max(0, depth - 1)
        if ch == "," and depth == 0:
            parts.append("".join(cur))
            cur = []
        else:
            cur.append(ch)
    parts.append("".join(cur))
    return parts


ADJ_THREE_END_RE = re.compile(r"^([A-Za-zĀĒĪŌŪāēīōū]+),\s*a,\s*um\b")
ADJ_TWO_END_E_RE = re.compile(r"^([A-Za-zĀĒĪŌŪāēīōū]+),\s*e\b")
ADJ_ER_A_UM_RE = re.compile(r"^([A-Za-zĀĒĪŌŪāēīōū()]+),\s*([A-Za-zĀĒĪŌŪāēīōū()]+),\s*([A-Za-zĀĒĪŌŪāēīōū()]+um)\b")
ADJ_COMPARATIVE_RE = re.compile(r"^([A-Za-zĀĒĪŌŪāēīōū]+),\s*([A-Za-zĀĒĪŌŪāēīōū]+)\s*\(Gen\.\s*([A-Za-zĀĒĪŌŪāēīōū]+)\)")
ADJ_ONE_END_GEN_RE = re.compile(r"^([A-Za-zĀĒĪŌŪāēīōū]+),\s*([A-Za-zĀĒĪŌŪāēīōū]+is)\b")


def try_parse_adjective(body: str):
    # a) Komparativ mit explizitem Genitiv: "melior, melius (Gen. meliōris) besser"
    m = ADJ_COMPARATIVE_RE.match(body)
    if m:
        lemma = f"{m.group(1)}, {m.group(2)}"
        note = f"(Gen. {m.group(3)})"
        translation = body[m.end():].strip()
        return {"lemma_raw": lemma, "grammar_note": note, "translation": translation,
                "pos": "Adjektiv", "gender": None, "adj_type": "comparative",
                "adj_stem_gen": m.group(3)}

    # b) Drei-Endungen 1./2. Deklination: "bonus, a, um gut"
    m = ADJ_THREE_END_RE.match(body)
    if m:
        end = m.end()
        translation = body[end:].strip()
        return {"lemma_raw": m.group(0), "grammar_note": "", "translation": translation,
                "pos": "Adjektiv", "gender": None, "adj_type": "a_um"}

    # c) er, a/era, um Muster (z.B. "niger, nigra, nigrum" / "liber, libera, liberum" / "pulcher, pulchra, pulchrum")
    m = ADJ_ER_A_UM_RE.match(body)
    if m and m.group(3).endswith("um") and not m.group(2).endswith("um"):
        lemma = f"{m.group(1)}, {m.group(2)}, {m.group(3)}"
        translation = body[m.end():].strip()
        return {"lemma_raw": lemma, "grammar_note": "", "translation": translation,
                "pos": "Adjektiv", "gender": None, "adj_type": "er_a_um"}

    # d) drei Formen er/eris/ere (z.B. "ācer, ācris, ācre") -> 3. Deklination, 3 Endungen
    m = re.match(r"^([A-Za-zĀĒĪŌŪāēīōū]+er),\s*([A-Za-zĀĒĪŌŪāēīōū]+ris),\s*([A-Za-zĀĒĪŌŪāēīōū]+re)\b", body)
    if m:
        lemma = f"{m.group(1)}, {m.group(2)}, {m.group(3)}"
        translation = body[m.end():].strip()
        return {"lemma_raw": lemma, "grammar_note": "", "translation": translation,
                "pos": "Adjektiv", "gender": None, "adj_type": "er_ris_re"}

    # e) zwei Endungen 3. Dekl.: "brevis, e kurz"
    m = ADJ_TWO_END_E_RE.match(body)
    if m:
        translation = body[m.end():].strip()
        return {"lemma_raw": m.group(0), "grammar_note": "", "translation": translation,
                "pos": "Adjektiv", "gender": None, "adj_type": "is_e"}

    # f) eine Endung 3. Dekl. mit Genitiv: "ingēns, ingentis gewaltig"
    m = ADJ_ONE_END_GEN_RE.match(body)
    if m:
        translation = body[m.end():].strip()
        # Ausschluss: falls es sich eigentlich um ein Nomen handelt, wurde es
        # bereits vorher (try_parse_noun) abgefangen.
        return {"lemma_raw": m.group(0), "grammar_note": "", "translation": translation,
                "pos": "Adjektiv", "gender": None, "adj_type": "one_ending",
                "adj_stem_gen": m.group(2)}

    return None


# ----------------------------------------------------------------------------
# Hauptverarbeitung
# ----------------------------------------------------------------------------

def make_id(counter, lemma):
    base = re.sub(r"[^a-z0-9]+", "-", strip_accents_for_search(lemma)).strip("-")
    return f"{base}-{counter}"


def main():
    raw_lines = RAW_PATH.read_text(encoding="utf-8").splitlines()
    entries = []
    problems = []
    seen_ids = {}

    for lineno, line in enumerate(raw_lines, start=1):
        line = line.strip()
        if not line:
            continue
        body, lessons = split_off_lessons(line)
        if not lessons:
            problems.append(f"Zeile {lineno}: keine Lektion erkannt -> {line!r}")
            continue
        info = classify_and_split(body)
        translation = info["translation"].strip().rstrip(".").strip()

        # Fuehrende Klammer-Zusatzangaben (z.B. "(Gen. Pl. -ium)", "(Abl. Sg. -ō, ...)")
        # aus der Uebersetzung herausloesen und der Grammatiknotiz zuschlagen.
        irregular_notes = []
        GRAMMAR_NOTE_RE = re.compile(
            r"(Gen\.|Dat\.|Akk\.|Abl\.|Nom\.|Vok\.|Sg\.|Pl\.|m\.\s*Abl|m\.\s*Akk|m\.\s*Dat|m\.\s*Gen|milit\.)"
        )
        while True:
            m = re.match(r"^\(([^)]*)\)\s*", translation)
            if not m:
                break
            # Nur echte grammatische Zusatzangaben herausloesen (z.B. "(Gen.
            # Pl. -ium)"); rein inhaltliche Praezisierungen wie "(wildes)"
            # vor "Tier" gehoeren zur Übersetzung und bleiben stehen.
            if not GRAMMAR_NOTE_RE.search(m.group(1)):
                break
            irregular_notes.append(m.group(1).strip())
            translation = translation[m.end():].strip()

        translation = re.sub(r"\s+", " ", translation)
        translation = re.sub(r"\s+,", ",", translation)
        if not translation:
            problems.append(f"Zeile {lineno}: keine Übersetzung erkannt -> {line!r}")

        lemma_raw = info["lemma_raw"].strip()
        counter = seen_ids.get(lemma_raw, 0) + 1
        seen_ids[lemma_raw] = counter
        entry_id = make_id(counter, lemma_raw) if counter == 1 else make_id(counter, lemma_raw)

        entry = {
            "id": f"v{lineno:04d}",
            "lemma": lemma_raw,
            "search_key": strip_accents_for_search(lemma_raw.split(",")[0].split("/")[0].strip()),
            "pos": info["pos"],
            "gender": info.get("gender"),
            "grammar_note": re.sub(r"\s+", " ", info.get("grammar_note", "")).strip(),
            "translation": translation,
            "lessons": lessons,
            "raw_line": line,
        }
        if "adj_type" in info:
            entry["adj_type"] = info["adj_type"]
        if "adj_stem_gen" in info:
            entry["adj_stem_gen"] = info["adj_stem_gen"]
        if "verb_forms" in info:
            entry["verb_forms"] = info["verb_forms"]
        if info.get("proper_noun"):
            entry["proper_noun"] = True
        if info.get("inferred_gender"):
            entry["inferred_gender"] = True
        if irregular_notes:
            entry["irregular_note"] = "; ".join(irregular_notes)

        entries.append(entry)

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(json.dumps(entries, ensure_ascii=False, indent=1), encoding="utf-8")

    # Statistikbericht
    from collections import Counter
    pos_counter = Counter(e["pos"] for e in entries)
    lines_out = [f"Eintraege gesamt: {len(entries)}", ""]
    lines_out.append("Wortarten-Verteilung:")
    for pos, cnt in pos_counter.most_common():
        lines_out.append(f"  {pos:15s} {cnt}")
    lines_out.append("")
    lines_out.append(f"Probleme ({len(problems)}):")
    lines_out.extend(problems)
    REPORT_PATH.write_text("\n".join(lines_out), encoding="utf-8")

    print(f"{len(entries)} Eintraege geschrieben nach {OUT_PATH}")
    print(f"Bericht: {REPORT_PATH}")
    print(f"Probleme: {len(problems)}")


if __name__ == "__main__":
    main()
