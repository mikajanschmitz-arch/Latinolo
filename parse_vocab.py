#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
parse_vocab.py
===============
Wandelt tools/vocab_raw.txt in ../vocab.json um.

Format der Rohdatei (zwei Abschnitte, "Vokabeln" und "Redewendungen"):
    LATEINISCH - DEUTSCH - LEKTION(EN)

Aufruf (im Ordner tools/):
    python3 parse_vocab.py
"""

import json
import re
from pathlib import Path

HERE = Path(__file__).parent
RAW_PATH = HERE / "vocab_raw.txt"
OLD_VOCAB_PATH = HERE / "vocab_PREVIOUS_backup.json"  # optional (nur zum Ergaenzen)
OUT_PATH = HERE.parent / "vocab.json"
REPORT_PATH = HERE / "parse_report.txt"

MACRON_MAP = {
    "ā": "a", "ē": "e", "ī": "i", "ō": "o", "ū": "u", "ȳ": "y",
    "Ā": "A", "Ē": "E", "Ī": "I", "Ō": "O", "Ū": "U",
}


def strip_macrons(s):
    return "".join(MACRON_MAP.get(c, c) for c in s)


def norm_lookup(s):
    return strip_macrons(s).lower()


def strip_accents_for_search(s):
    s = strip_macrons(s)
    s = s.replace("j", "i").replace("J", "I")
    s = s.replace("v", "u").replace("V", "U")
    return s.lower()


def parse_lessons(raw):
    parts = [p.strip() for p in raw.split(",") if p.strip()]
    out = []
    for p in parts:
        if "." in p:
            main, sub = p.split(".", 1)
            out.append(f"{int(main)}.{sub}")
        else:
            out.append(str(int(p)))
    return out


# ---------------------------------------------------------------------------
# Manuelle Einordnung (Mehrwort-Ausdruecke, Pronomen, Zahlwoerter, ...)
# ---------------------------------------------------------------------------

MANUAL_POS_OVERRIDE = {
    "alius ... alius": "Pronomen",
    "aut ... aut": "Konjunktion",
    "et ... et": "Konjunktion",
    "modo ... modo": "Adverb",
    "nihil ... nisi": "Adverb",
    "nē ... quidem": "Partikel",
    "nec ... nec": "Konjunktion",
    "neque ... neque": "Konjunktion",
    "tam ... quam": "Adverb",
    "tālis ... quālis": "Adverb",
    "tantum ... quantum": "Adverb",
    "tantus ... quantus": "Adverb",
    "utrum ... an": "Konjunktion",
    "-ne ... an": "Konjunktion",
    "eius modī / eiusmodī": "Adverb",
    "sponte meā (tuā, suā)": "Adverb",
    "necesse (est)": "Ausdruck",
    "odiō esse": "Ausdruck",
    "cōnstāre, cōnstat, cōnstitit": "Verb",
    "licet": "Ausdruck",
    "oportet": "Ausdruck",
    "pudet, puduit m. Akk.": "Ausdruck",
    "ventum est": "Ausdruck",
    "no(vī)sse": "Verb",
    "nōn dubitō, quīn": "Ausdruck",
    "aes aliēnum": "Ausdruck",
    "hic, haec, hoc": "Pronomen",
    "ille, illa, illud": "Pronomen",
    "iste, ista, istud": "Pronomen",
    "is, ea, id": "Pronomen",
    "īdem, eadem, idem": "Pronomen",
    "ipse, ipsa, ipsum": "Pronomen",
    "quī, quae, quod": "Pronomen",
    "quī, quae, quod adj.": "Pronomen",
    "quis?": "Pronomen",
    "quid?": "Pronomen",
    "aliquis, aliquid": "Pronomen",
    "aliquī, aliqua, aliquod": "Pronomen",
    "quīdam, quaedam, quiddam subst.": "Pronomen",
    "quīdam, quaedam, quoddam adj.": "Pronomen",
    "quisque, quidque subst.": "Pronomen",
    "alius, alia, aliud": "Pronomen",
    "quisnam": "Pronomen",
    "dī! / Vok.!": "Interjektion",
    "fac!": "Interjektion",
    "dūc!": "Interjektion",
    "salvē! salvēte!": "Interjektion",
    "āiō": "Verb",
    "inquam": "Verb",
    "meminisse": "Verb",
    "placet": "Ausdruck",
    "mēcum": "Pronomen", "tēcum": "Pronomen", "sēcum": "Pronomen", "vōbīscum": "Pronomen",
    "quemadmodum": "Adverb",
    "cēterī, ae, a": "Adjektiv",
    "cūnctī, ae, a": "Adjektiv",
    "multī, ae, a": "Adjektiv",
    "nōnnūllī, ae, a": "Adjektiv",
    "paucī, ae, a": "Adjektiv",
    "plūrimī, ae, a": "Adjektiv",
    "complūrēs, complūra": "Adjektiv",
    "plērīque, plēraeque, plēraque": "Adjektiv",
    "sunt": "Verb",
    "est": "Verb",
    "ego": "Pronomen", "tū": "Pronomen", "nōs": "Pronomen", "vōs": "Pronomen",
    "mē": "Pronomen", "tē": "Pronomen", "sē": "Pronomen",
    "mihi": "Pronomen", "tibi": "Pronomen", "sibi": "Pronomen",
    "nōbīs": "Pronomen", "vōbīs": "Pronomen",
    "duo, duae, duo": "Zahlwort",
    "trēs, trēs, tria": "Zahlwort",
    "ambō, ambae, ambō": "Zahlwort",
    "mīlia, mīlium Pl.": "Zahlwort",
    "causā (nachgestellt) m. Gen.": "Adverb",
    "sē recipere": "Ausdruck",
}

# Lemma/Notiz bereinigen fuer manuell eingeordnete Eintraege
LEMMA_REWRITE = {
    "dī! / Vok.!": ("dī!", "Vok."),
    "causā (nachgestellt) m. Gen.": ("causā", "(nachgestellt) m. Gen."),
}

PLURAL_ONLY_ADJ_KEYS = {"cēterī, ae, a", "cūnctī, ae, a", "multī, ae, a",
                         "nōnnūllī, ae, a", "paucī, ae, a", "plūrimī, ae, a"}

BARE_ADVERB_SET = {
    "hic", "ibi", "ubi", "unde", "quo", "quando", "tum", "tunc", "nunc", "iam",
    "etiam", "saepe", "mox", "tandem", "sic", "ita", "tam", "quam", "cur",
    "nihil", "non", "haud", "vix", "satis", "paene", "domi", "domum", "ruri",
    "nocte", "heri", "hodie", "cras", "semper", "numquam", "umquam", "quondam",
    "adeo", "adhuc", "antea", "statim", "diu", "ergo", "deinde", "demum",
    "denique", "libenter", "illic", "illuc", "istic",
    "intus", "circiter", "paulatim", "paulo", "profecto",
    "quidem", "equidem", "fere", "forte", "minime", "maxime",
    "omnino", "palam", "pariter", "potius", "proinde", "protinus",
    "scilicet", "simul", "subito", "tantum",
    "ultro", "undique", "usque", "velut", "vero", "raro",
    "bene", "multum", "parum", "magis",
    "crebro", "occulte", "primum", "primo", "postea", "postremo", "nondum",
    "imprimis", "praeterea", "quasi", "quoque", "aliter", "nimis", "nimium",
    "certe", "quotiens", "eo", "huc", "procul",
    "nonne", "num", "facile",
}
BARE_CONJ_SET = {
    "ac", "atque", "aut", "at", "vel", "et", "nam", "enim", "autem", "itaque",
    "ergo", "igitur", "quia", "quod", "quoniam", "nec", "neque", "sed", "an",
    "namque", "que", "quin", "sive", "seu",
}
BARE_PARTICLE_SET = {"-ne", "quin", "quidem", "quoque"}
BARE_PREP_SET = {"ad", "ante", "apud", "contra", "a", "ab", "e", "ex", "circum",
                 "inter", "intra", "extra", "per", "prae", "pro", "sine",
                 "sub", "super", "trans", "cum", "de", "in", "propter", "adversus"}
EXTRA_CONJ = {"etsi", "nisi", "postquam", "si", "tamquam", "ne", "ut", "dum", "cum",
              "quamquam", "quamvis", "antequam", "priusquam", "ubi", "tamen"}
EXTRA_ADV = {"quare", "immo", "inde", "interea", "item", "nuper", "prope", "qua", "recte",
             "plus", "tot", "utinam", "paulo post", "eo anno", "post", "brevi (tempore)",
             "brevi"}

NORM_CONJ_SET = {norm_lookup(x) for x in BARE_CONJ_SET}
NORM_ADVERB_SET = {norm_lookup(x) for x in BARE_ADVERB_SET}
NORM_PARTICLE_SET = {norm_lookup(x) for x in BARE_PARTICLE_SET}
NORM_PREP_SET = {norm_lookup(x) for x in BARE_PREP_SET}
NORM_CONJ_SET |= {norm_lookup(x) for x in EXTRA_CONJ}
NORM_ADVERB_SET |= {norm_lookup(x) for x in EXTRA_ADV}
NORM_ADVERB_SET -= NORM_PREP_SET

BARE_NOUN_ENDINGS = [("us", "m", 2), ("um", "n", 2), ("a", "f", 1)]

PRAEP_RE = re.compile(r"\bPr[āa]p\.\s+m\.\s+(Akk|Abl)\.")
SUBJ_RE = re.compile(r"\bSubj\.(\s+m\.\s+(Ind|Konj)\.)?")

NUMERAL_WORDS = {
    "duo", "trēs", "quattuor", "quīnque", "sex", "septem", "octō", "novem",
    "decem", "undecim", "duodecim", "trēdecim", "quattuordecim",
    "quīndecim", "sēdecim", "septendecim", "duodēvigintī", "ūndēvigintī",
    "vīgintī", "centum", "mīlle",
}
NORM_NUMERALS = {norm_lookup(x) for x in NUMERAL_WORDS}


def classify_latin(latin):
    extra = {}

    if latin in MANUAL_POS_OVERRIDE:
        pos = MANUAL_POS_OVERRIDE[latin]
        if latin in PLURAL_ONLY_ADJ_KEYS:
            extra["adj_type"] = "i_ae_a_pl"
        if latin in LEMMA_REWRITE:
            lem, note = LEMMA_REWRITE[latin]
            return pos, None, note, lem, extra
        return pos, None, "", latin, extra

    # Zusatz "m. Konj./Ind./Inf." am Ende (z.B. "utinam m. Konj.") als Notiz abtrennen
    m_tail = re.match(r"^(\S+)\s+(m\.\s*(?:Konj|Ind|Inf)\.)$", latin)
    if m_tail:
        lem = m_tail.group(1)
        pos = "Konjunktion" if norm_lookup(lem) in NORM_CONJ_SET else "Adverb"
        return pos, None, m_tail.group(2), lem, extra

    m = PRAEP_RE.search(latin)
    if m:
        return "Präposition", None, m.group(0), latin[: m.start()].strip(), extra

    m = SUBJ_RE.search(latin)
    if m:
        return "Konjunktion", None, m.group(0), latin[: m.start()].strip(), extra

    # Klammer-Zusaetze fuer die Klassifikation abtrennen und als Notiz anhaengen
    paren_notes = re.findall(r"\([^)]*\)", latin)
    if paren_notes and " " in latin:
        stripped = re.sub(r"\s*\([^)]*\)", "", latin).strip()
        stripped = re.sub(r"\s+", " ", stripped)
        if stripped and stripped != latin:
            pos, gender, note, lemma_clean, ex = classify_latin(stripped)
            extra_note = " ".join(paren_notes)
            note = (note + " " + extra_note).strip() if note else extra_note
            return pos, gender, note, lemma_clean, ex

    if latin.endswith("?") and " " not in latin[:-1]:
        lemma = latin[:-1]
        key = norm_lookup(lemma)
        if key in NORM_ADVERB_SET:
            pos = "Adverb"
        elif key in NORM_CONJ_SET:
            pos = "Konjunktion"
        else:
            pos = "Pronomen"
        return pos, None, "?", lemma, extra

    noun = try_noun(latin)
    if noun:
        return noun

    verb = try_verb(latin)
    if verb:
        return verb

    adj = try_adjective(latin)
    if adj:
        return adj

    if " / " in latin:
        first_alt = latin.split(" / ")[0].strip()
        k = norm_lookup(first_alt)
        if k in NORM_PREP_SET:
            return "Präposition", None, "", latin, extra
        if k in NORM_CONJ_SET:
            return "Konjunktion", None, "", latin, extra
        if k in NORM_ADVERB_SET:
            return "Adverb", None, "", latin, extra
        if re.fullmatch(r"[A-ZĀĒĪŌŪ][a-zA-ZāēīōūĀĒĪŌŪ]+", first_alt):
            e = dict(extra)
            e["proper_noun"] = True
            return "Substantiv", "m", "", latin, e

    key0 = norm_lookup(latin)
    if key0 in NORM_PREP_SET:
        return "Präposition", None, "", latin, extra
    if key0 in NORM_NUMERALS:
        return "Zahlwort", None, "", latin, extra
    if key0 in NORM_CONJ_SET:
        return "Konjunktion", None, "", latin, extra
    if key0 in NORM_ADVERB_SET:
        return "Adverb", None, "", latin, extra
    if key0 in NORM_PARTICLE_SET:
        return "Partikel", None, "", latin, extra

    if re.fullmatch(r"[A-Za-zĀĒĪŌŪāēīōū]+", latin):
        is_proper = latin[0].isupper()
        gender = None
        for suf, gnd, dc in BARE_NOUN_ENDINGS:
            if latin.endswith(suf):
                gender = gnd
                break
        if is_proper or gender:
            e = dict(extra)
            if is_proper:
                e["proper_noun"] = True
            if gender:
                e["inferred_gender"] = True
            return "Substantiv", gender, "", latin, e

    if re.fullmatch(r"[A-ZĀĒĪŌŪ][a-zA-ZāēīōūĀĒĪŌŪ]+ [A-ZĀĒĪŌŪ][a-zA-ZāēīōūĀĒĪŌŪ]+", latin):
        e = dict(extra)
        e["proper_noun"] = True
        e["inferred_gender"] = True
        return "Substantiv", "m", "", latin, e

    return "Partikel", None, "", latin, extra


NOUN_GENDER_RE = re.compile(r"(?<![A-Za-zÄÖÜäöüāēīōūĀĒĪŌŪ])(m/f|m|f|n)(\s+Pl\.)?$")


def try_noun(latin):
    m = NOUN_GENDER_RE.search(latin)
    if not m:
        return None
    before = latin[: m.start()].strip().rstrip(",").strip()
    if not before:
        return None
    gender = m.group(1)
    note = gender + (" Pl." if m.group(2) else "")
    return "Substantiv", gender, note, before, {}


def looks_like_verb_infinitive(word):
    if word.endswith("esse"):
        return True
    if word.endswith("ferre"):
        return True
    if word.endswith("dare"):
        return True
    if word.endswith(("ārī", "āri", "ērī", "ēri", "īrī", "īri")):
        return True
    if word.endswith(("āre", "ēre", "īre")):
        return True
    if word.endswith("ere") and not word.endswith("ēre"):
        return True
    if word.endswith("ī") and not word.endswith("aī"):
        return True
    return False


def try_verb(latin):
    if "," not in latin:
        return None
    parts = [p.strip() for p in latin.split(",")]
    first = parts[0]
    if not looks_like_verb_infinitive(first) and first not in ("posse", "velle", "nōlle", "fierī", "dare"):
        return None
    forms = []
    latin_word_re = re.compile(r"^[A-Za-zĀĒĪŌŪāēīōū]+$")
    note_bits = []
    i = 0
    while i < len(parts):
        p = parts[i]
        toks = p.split()
        if len(toks) == 1 and latin_word_re.match(toks[0]):
            forms.append(toks[0])
            i += 1
            continue
        if len(toks) == 2 and latin_word_re.match(toks[0]) and toks[1] == "sum":
            forms.append(toks[0] + " sum")
            i += 1
            continue
        m = re.match(r"^([A-Za-zĀĒĪŌŪāēīōū]+)(\s+sum)?\s*(.*)$", p)
        if m and m.group(1) and (len(forms) >= 1):
            forms.append(m.group(1) + (m.group(2) or ""))
            rest = m.group(3).strip()
            if rest:
                note_bits.append(rest)
            note_bits.extend(parts[i + 1:])
            break
        else:
            note_bits.extend(parts[i:])
            break
    if len(forms) < 2:
        return None
    note = ", ".join(forms)
    if note_bits:
        note += "  " + " ".join(b.strip() for b in note_bits if b.strip())
    return "Verb", None, note.strip(), forms[0], {"verb_forms": forms}


def try_adjective(latin):
    parts = [p.strip() for p in latin.split(",")]
    if len(parts) == 3 and parts[1] == "a" and parts[2] == "um":
        return "Adjektiv", None, "", latin, {"adj_type": "a_um"}
    if len(parts) == 2 and parts[1] == "e":
        return "Adjektiv", None, "", latin, {"adj_type": "is_e"}
    if len(parts) == 3 and parts[2].endswith("um") and not parts[1].endswith("um") and parts[0].endswith("er"):
        return "Adjektiv", None, "", latin, {"adj_type": "er_a_um"}
    if len(parts) == 3 and parts[0].endswith("er") and parts[1].endswith("ris") and parts[2].endswith("re"):
        return "Adjektiv", None, "", latin, {"adj_type": "er_ris_re"}
    m = re.match(r"^([A-Za-zĀĒĪŌŪāēīōū]+),\s*([A-Za-zĀĒĪŌŪāēīōū]+)\s*\(Gen\.\s*([A-Za-zĀĒĪŌŪāēīōū]+)\)$", latin)
    if m:
        lemma = f"{m.group(1)}, {m.group(2)}"
        return "Adjektiv", None, f"(Gen. {m.group(3)})", lemma, {"adj_type": "comparative", "adj_stem_gen": m.group(3)}
    if len(parts) == 2 and parts[0].endswith("ior") and parts[1].endswith("ius"):
        gen = parts[0][:-2] + "ōris"
        return "Adjektiv", None, f"(Gen. {gen})", latin, {"adj_type": "comparative", "adj_stem_gen": gen}
    if len(parts) == 2 and parts[0] == "minor" and parts[1] == "minus":
        return "Adjektiv", None, "(Gen. minōris)", latin, {"adj_type": "comparative", "adj_stem_gen": "minōris"}
    if len(parts) == 2 and re.match(r"^[A-Za-zĀĒĪŌŪāēīōū]+is$", parts[1]):
        return "Adjektiv", None, "", latin, {"adj_type": "one_ending", "adj_stem_gen": parts[1]}
    return None


# ---------------------------------------------------------------------------
# Ergaenzungen aus dem frueheren Datenstand (optional)
# ---------------------------------------------------------------------------

def load_old():
    verb_forms, irregular = {}, {}
    if not OLD_VOCAB_PATH.exists():
        return verb_forms, irregular
    try:
        old = json.loads(OLD_VOCAB_PATH.read_text(encoding="utf-8"))
    except Exception:
        return verb_forms, irregular
    for e in old:
        if e.get("pos") == "Verb" and e.get("verb_forms"):
            inf = e["verb_forms"][0]
            if inf not in verb_forms or len(e["verb_forms"]) > len(verb_forms[inf]):
                verb_forms[inf] = e["verb_forms"]
        if e.get("pos") == "Substantiv" and e.get("irregular_note"):
            irregular[e["lemma"].split(",")[0].strip()] = e["irregular_note"]
    return verb_forms, irregular


def merge_verb_forms(new_forms, old_by_inf):
    old = old_by_inf.get(new_forms[0])
    if not old or len(old) <= len(new_forms):
        return new_forms
    if old[:len(new_forms)] == new_forms:
        return old
    return new_forms


def split_irregular(note):
    """Trennt unregelmaessige Formangaben wie (Gen. Pl. -ium) von der Notiz."""
    irr = []

    def repl(m):
        inner = m.group(1).strip()
        if re.search(r"(Gen|Dat|Akk|Abl|Nom)\.", inner):
            irr.append(inner)
            return ""
        return m.group(0)

    new = re.sub(r"\s*\(([^)]*)\)", repl, note)
    return re.sub(r"\s+", " ", new).strip(), "; ".join(irr)


MERGE_PRONOUNS = {
    "nōs": ("wir / uns", "Nom./Akk."),
    "vōs": ("ihr / euch", "Nom./Akk."),
}


def merge_pronoun_forms(entries):
    """nōs (wir/uns) und vōs (ihr/euch) werden je zu einer Karteikarte."""
    out, seen = [], set()
    for e in entries:
        if e.get("category") == "vokabel" and e["lemma"] in MERGE_PRONOUNS:
            if e["lemma"] in seen:
                continue
            seen.add(e["lemma"])
            trans, note = MERGE_PRONOUNS[e["lemma"]]
            e = dict(e)
            e["translation"] = trans
            e["grammar_note"] = note
        out.append(e)
    return out


# ---------------------------------------------------------------------------
# Hauptprogramm
# ---------------------------------------------------------------------------

def main():
    old_verb_forms, old_irregular = load_old()
    merged_count = 0
    irr_count = 0

    lines = RAW_PATH.read_text(encoding="utf-8").split("\n")
    section = None
    entries, problems = [], []

    for lineno, line in enumerate(lines, start=1):
        s = line.strip()
        if not s:
            continue
        if s == "Vokabeln":
            section = "vokabel"
            continue
        if s == "Redewendungen":
            section = "redewendung"
            continue
        parts = line.split(" - ")
        if len(parts) != 3:
            problems.append(f"Zeile {lineno}: unerwartetes Format ({len(parts)} Teile): {line!r}")
            continue
        latin_raw, german_raw, lesson_raw = [p.strip() for p in parts]
        try:
            lessons = parse_lessons(lesson_raw)
        except ValueError:
            problems.append(f"Zeile {lineno}: Lektion nicht lesbar: {line!r}")
            continue

        translation = re.sub(r"\s+", " ", german_raw).strip().rstrip(".").strip()

        if section == "redewendung":
            entries.append({
                "id": f"r{lineno:04d}",
                "lemma": latin_raw,
                "search_key": strip_accents_for_search(latin_raw.split(" ")[0]),
                "pos": "Redewendung",
                "category": "redewendung",
                "gender": None,
                "grammar_note": "",
                "translation": translation,
                "lessons": lessons,
                "raw_line": line,
            })
            continue

        pos, gender, note, lemma_clean, extra = classify_latin(latin_raw)

        if "verb_forms" in extra:
            merged = merge_verb_forms(extra["verb_forms"], old_verb_forms)
            if merged != extra["verb_forms"]:
                merged_count += 1
                extra["verb_forms"] = merged
                note = ", ".join(merged)

        irregular_note = None
        if pos == "Substantiv":
            note, irregular_note = split_irregular(note)
            if not irregular_note:
                irregular_note = old_irregular.get(lemma_clean.split(",")[0].strip())
                if irregular_note:
                    irr_count += 1

        entry = {
            "id": f"v{lineno:04d}",
            "lemma": lemma_clean,
            "search_key": strip_accents_for_search(lemma_clean.split(",")[0].split("/")[0].strip()),
            "pos": pos,
            "category": "vokabel",
            "gender": gender,
            "grammar_note": re.sub(r"\s+", " ", note).strip(),
            "translation": translation,
            "lessons": lessons,
            "raw_line": line,
        }
        if irregular_note:
            entry["irregular_note"] = irregular_note
        entry.update(extra)
        entries.append(entry)

    entries = merge_pronoun_forms(entries)
    OUT_PATH.write_text(json.dumps(entries, ensure_ascii=False, indent=1), encoding="utf-8")

    from collections import Counter
    pos_counter = Counter(e["pos"] for e in entries if e["category"] == "vokabel")
    red_count = sum(1 for e in entries if e["category"] == "redewendung")
    report = [f"Eintraege gesamt: {len(entries)}", f"  davon Redewendungen: {red_count}",
              f"  Verben mit ergaenzten Stammformen: {merged_count}",
              f"  Substantive mit ergaenzten Sonderformen: {irr_count}", "",
              "Wortarten-Verteilung (Vokabeln):"]
    for p, cnt in pos_counter.most_common():
        report.append(f"  {p:15s} {cnt}")
    report += ["", f"Probleme ({len(problems)}):"] + problems
    REPORT_PATH.write_text("\n".join(report), encoding="utf-8")
    print(f"{len(entries)} Eintraege geschrieben nach {OUT_PATH}")
    print(f"Probleme: {len(problems)} | Verb-Ergaenzungen: {merged_count} | Sonderform-Ergaenzungen: {irr_count}")


if __name__ == "__main__":
    main()
