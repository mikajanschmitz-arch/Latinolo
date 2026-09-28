#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Einmaliges Korrektur-Skript: ergänzt fehlende Stammformen (Perfekt/Supin)
bei Verben in vocab_raw.txt und behebt ein paar Datenfehler.
Wird nur einmal ausgeführt, danach kann es gelöscht werden."""

import re
from pathlib import Path

PATH = Path(__file__).parent / "vocab_raw.txt"
text = PATH.read_text(encoding="utf-8")
lines = text.split("\n")

# ---------------------------------------------------------------------------
# 1) Regelmäßige 1. Konjugation (nur Infinitiv+Präsens vorhanden) -> Perfekt
#    auf -āvī und Supin auf -ātum ergänzen (bei diesen 77 Verben unproblematisch
#    regelmässig).
# ---------------------------------------------------------------------------
FIRST_CONJ = [
    "accūsāre", "aedificāre", "aestimāre", "agitāre", "amāre", "appellāre",
    "cantāre", "cēnāre", "cessāre", "clāmāre", "cōgitāre", "collocāre",
    "comparāre", "cōnfirmāre", "cōnservāre", "convocāre", "creāre", "cūrāre",
    "damnāre", "dēlēctāre", "dēmōnstrāre", "dēsīderāre", "dēspērāre", "dōnāre",
    "dubitāre", "errāre", "excitāre", "existimāre", "exspectāre", "habitāre",
    "iactāre", "imperāre", "indicāre", "interrogāre", "intrāre", "iūdicāre",
    "iūrāre", "laborāre", "laudāre", "līberāre", "locāre", "memorāre",
    "mūtāre", "narrāre", "necāre", "negāre", "nōmināre", "nūntiāre",
    "obsecrāre", "occupāre", "optāre", "ōrāre", "ōrnāre", "parāre", "peccāre",
    "perturbāre", "portāre", "pōstulāre", "probāre", "properāre", "pugnāre",
    "putāre", "recitāre", "rogāre", "salūtāre", "servāre", "sollicitāre",
    "spectāre", "spērāre", "superāre", "temptāre", "turbāre", "vindicāre",
    "violāre", "vitāre", "vocāre", "volāre",
]

count_applied = 0
for i, line in enumerate(lines):
    for inf in FIRST_CONJ:
        pres = inf[:-3] + "ō"
        prefix = f"{inf}, {pres} "
        if line.startswith(prefix):
            stem = inf[:-3]
            new_prefix = f"{inf}, {pres}, {stem}āvī, {stem}ātum "
            lines[i] = new_prefix + line[len(prefix):]
            count_applied += 1
            break

print(f"1. Konjugation ergänzt: {count_applied} Zeilen")

# ---------------------------------------------------------------------------
# 2) Alle übrigen Einzelfälle: exakte Textersetzung (Praefix -> neuer Praefix)
# ---------------------------------------------------------------------------
REPLACEMENTS = [
    # --- Semideponentien (aktives Präsenssystem, Perfekt "PPP + sum") ---
    ("audēre, audeō wagen", "audēre, audeō, ausus sum wagen"),
    ("gaudēre, gaudeō sich freuen", "gaudēre, gaudeō, gāvīsus sum sich freuen"),
    ("solēre, soleō gewohnt sein", "solēre, soleō, solitus sum gewohnt sein"),

    # --- 2. Konjugation: Perfekt (+ Supin wo gebräuchlich) ergänzen ---
    ("carēre, careō m. Abl. frei sein von", "carēre, careō, caruī m. Abl. frei sein von"),
    ("dolēre, doleō schmerzen", "dolēre, doleō, doluī schmerzen"),
    ("exercēre, exerceō üben", "exercēre, exerceō, exercuī, exercitum üben"),
    ("habēre, habeō haben", "habēre, habeō, habuī, habitum haben"),
    ("iacēre, iaceō liegen", "iacēre, iaceō, iacuī liegen"),
    ("latēre, lateō verborgen sein", "latēre, lateō, latuī verborgen sein"),
    ("obtinēre, obtineō (in Besitz)", "obtinēre, obtineō, obtinuī, obtentum (in Besitz)"),
    ("pārēre, pāreō gehorchen", "pārēre, pāreō, pāruī gehorchen"),
    ("patēre, pateō offenstehen", "patēre, pateō, patuī offenstehen"),
    ("pertinēre, pertineō ad m. Akk.", "pertinēre, pertineō, pertinuī ad m. Akk."),
    ("placēre, placeō gefallen", "placēre, placeō, placuī, placitum gefallen"),
    ("praebēre, praebeō geben", "praebēre, praebeō, praebuī, praebitum geben"),
    ("prohibēre, prohibeō (ā m. Abl.)", "prohibēre, prohibeō, prohibuī, prohibitum (ā m. Abl.)"),
    ("studēre, studeō sich bemühen", "studēre, studeō, studuī sich bemühen"),
    ("tacēre, taceō schweigen", "tacēre, taceō, tacuī, tacitum schweigen"),
    ("timēre, timeō fürchten", "timēre, timeō, timuī fürchten"),
    ("valēre, valeō gesund sein", "valēre, valeō, valuī gesund sein"),
    ("dēlēre, dēleō, dēlēvī zerstören", "dēlēre, dēleō, dēlēvī, dēlētum zerstören"),
    ("persuādēre, persuādeō, persuāsī überreden",
     "persuādēre, persuādeō, persuāsī, persuāsum überreden"),
    ("sustinēre, sustineō, sustinuī ertragen",
     "sustinēre, sustineō, sustinuī, sustentum ertragen"),

    # --- 3. Konjugation: einzelne Verben ---
    ("cernere, cernō sehen", "cernere, cernō, crēvī, crētum sehen"),
    ("ēdūcere, ēdūcō herausführen", "ēdūcere, ēdūcō, ēdūxī, ēductum herausführen"),
    ("cōnficere, cōnficiō, cōnfectum fertig machen",
     "cōnficere, cōnficiō, cōnfēcī, cōnfectum fertig machen"),  # fehlendes Perfekt ergänzt

    # --- 4. Konjugation: Perfekt+Supin ergänzen ---
    ("audīre, audiō hören", "audīre, audiō, audīvī, audītum hören"),
    ("impedīre, impediō hindern", "impedīre, impediō, impedīvī, impedītum hindern"),
    ("mūnīre, mūniō bauen", "mūnīre, mūniō, mūnīvī, mūnītum bauen"),
    ("nescīre, nesciō nicht wissen", "nescīre, nesciō, nescīvī, nescītum nicht wissen"),
    ("scīre, sciō wissen", "scīre, sciō, scīvī, scītum wissen"),
    ("servīre, serviō dienen", "servīre, serviō, servīvī, servītum dienen"),

    # --- esse-Komposita: fehlendes Perfekt ---
    ("adesse, adsum da sein", "adesse, adsum, adfuī da sein"),
    ("dēesse, dēsum abwesend sein", "dēesse, dēsum, dēfuī abwesend sein"),

    # --- ire-Komposita: Supin ergänzen ---
    ("abīre, abeō, abiī weggehen", "abīre, abeō, abiī, abitum weggehen"),
    ("adīre, adeō, adiī herantreten", "adīre, adeō, adiī, aditum herantreten"),
    ("praeterīre, praetereō, praeteriī übergehen",
     "praeterīre, praetereō, praeteriī, praeteritum übergehen"),
    ("subīre, subeō, subiī auf sich nehmen", "subīre, subeō, subiī, subitum auf sich nehmen"),
    ("trānsīre, trānseō, trānsiī durchqueren",
     "trānsīre, trānseō, trānsiī, trānsitum durchqueren"),

    # --- Deponens: fehlerhaftes/unvollstaendiges Perfekt, Tippfehler ---
    ("tuēri, tueor betrachten, schützen, (milit.) sichern - 30\ntuēri, tueor betrachten, schützen, (milit.) sichern - 30",
     "tuērī, tueor, tuitus sum betrachten, schützen, (milit.) sichern - 30"),  # Duplikat zusammengeführt

    # --- 3. Konjugation "Rest"-Liste: Supin ergänzen ---
    ("āmittere, āmittō, āmīsī aufgeben", "āmittere, āmittō, āmīsī, āmissum aufgeben"),
    ("aperīre, aperiō, aperuī aufdecken", "aperīre, aperiō, aperuī, apertum aufdecken"),
    ("appetere, appetō, appetīvī erstreben", "appetere, appetō, appetīvī, appetītum erstreben"),
    ("cadere, cadō, cecidī fallen", "cadere, cadō, cecidī, cāsum fallen"),
    ("caedere, caedō, cecīdi fällen", "caedere, caedō, cecīdī, caesum fällen"),
    ("cēdere, cēdō, cessī gehen", "cēdere, cēdō, cessī, cessum gehen"),
    ("concēdere, concēdō, concessī erlauben", "concēdere, concēdō, concessī, concessum erlauben"),
    ("contendere, contendō, contendī sich anstrengen",
     "contendere, contendō, contendī, contentum sich anstrengen"),
    ("convenīre, conveniō, convēnī zusammenkommen",
     "convenīre, conveniō, convēnī, conventum zusammenkommen"),
    ("crēdere, crēdō, crēdidī glauben", "crēdere, crēdō, crēdidī, creditum glauben"),
    ("crēscere, crēscō, crēvī wachsen", "crēscere, crēscō, crēvī, crētum wachsen"),
    ("currere, currō, cucurrī laufen", "currere, currō, cucurrī, cursum laufen"),
    ("dēscendere, dēscendō, dēscendī herabsteigen",
     "dēscendere, dēscendō, dēscendī, dēscēnsum herabsteigen"),
    ("dēserere, dēserō, dēseruī im Stich lassen",
     "dēserere, dēserō, dēseruī, dēsertum im Stich lassen"),
    ("effugere, effugiō, effūgī entfliehen", "effugere, effugiō, effūgī, effugitum entfliehen"),
    ("fallere, fallō, fefellī täuschen", "fallere, fallō, fefellī, falsum täuschen"),
    ("flēre, fleō, flēvī weinen", "flēre, fleō, flēvī, flētum weinen"),
    ("fugere, fugiō, fūgī (m. Akk.) fliehen", "fugere, fugiō, fūgī, fugitum (m. Akk.) fliehen"),
    ("fundere, fundō, fūdī (aus)gießen", "fundere, fundō, fūdī, fūsum (aus)gießen"),
    ("haerēre, haereō, haesī hängen", "haerēre, haereō, haesī, haesum hängen"),
    ("incipere, incipiō, coepī (incēpī), inceptum anfangen",
     "incipere, incipiō, coepī, inceptum anfangen"),
    ("iuvāre, iuvō, iūvī unterstützen", "iuvāre, iuvō, iūvī, iūtum unterstützen"),
    ("laedere, laedō, laesī beschädigen", "laedere, laedō, laesī, laesum beschädigen"),
    ("manēre, maneō, mānsī bleiben", "manēre, maneō, mānsī, mānsum bleiben"),
    ("occidere, occidō, occidī (zu Boden) fallen",
     "occidere, occidō, occidī, occāsum (zu Boden) fallen"),
    ("ōmittere, ōmittō, ōmīsī aufgeben", "ōmittere, ōmittō, ōmīsī, ōmissum aufgeben"),
    ("ostendere, ostendō, ostendī zeigen", "ostendere, ostendō, ostendī, ostentum zeigen"),
    ("pergere, pergō, perrēxī aufbrechen", "pergere, pergō, perrēxī, perrēctum aufbrechen"),
    ("praestāre, praestō, praestitī m. Akk.", "praestāre, praestō, praestitī, praestitum m. Akk."),
    ("remanēre, remaneō, remānsī (zurück)bleiben",
     "remanēre, remaneō, remānsī, remānsum (zurück)bleiben"),
    ("repellere, repellō, reppulī zurückstoßen",
     "repellere, repellō, reppulī, repulsum zurückstoßen"),
    ("retinēre, retineō, retinui behalten", "retinēre, retineō, retinuī, retentum behalten"),
    ("ruere, ruō, ruī stürzen", "ruere, ruō, ruī, rutum stürzen"),
    ("sinere, sinō, sīvī (zu)lassen", "sinere, sinō, sīvī, situm (zu)lassen"),
    ("stāre, stō, stetī stehen", "stāre, stō, stetī, statum stehen"),
    ("surgere, surgō, surrēxī aufrichten", "surgere, surgō, surrēxī, surrēctum aufrichten"),
    ("tribuere, tribuō, tribuī schenken", "tribuere, tribuō, tribuī, tribūtum schenken"),
    ("vivere, vīvō, vīxī leben", "vivere, vīvō, vīxī, victum leben"),

    # --- kleinere Tippfehler (Makronfehler bei bereits vollständigen Verben) ---
    ("solvere, solvō, solvi, solūtum", "solvere, solvō, solvī, solūtum"),
]

text2 = "\n".join(lines)
applied2 = 0
for old, new in REPLACEMENTS:
    if old not in text2:
        print(f"WARNUNG: nicht gefunden -> {old!r}")
        continue
    n = text2.count(old)
    if n > 1:
        print(f"WARNUNG: {n}x gefunden (erwartet 1) -> {old!r}")
    text2 = text2.replace(old, new, 1)
    applied2 += 1

print(f"Einzelersetzungen angewendet: {applied2} / {len(REPLACEMENTS)}")

PATH.write_text(text2, encoding="utf-8")
print("vocab_raw.txt aktualisiert.")
