/**
 * APEX FIT – Universeller KI-Worker
 * Routen:
 *   POST /api/ai              – alle KI-Funktionen über EINEN universellen Prompt (Gemini)
 *   GET  /api/push/vapid      – öffentlicher VAPID-Key für Web Push
 *   POST /api/push/subscribe  – Push-Abo + Erinnerungszeiten speichern (KV)
 *   POST /api/push/unsubscribe
 *   GET  /api/push/pending    – letzte Push-Nachricht für den Service Worker
 *   GET  /api/fitbit/auth     – Fitbit-OAuth starten
 *   GET  /api/fitbit/callback – OAuth-Callback, Tokens in KV
 *   GET  /api/fitbit/data     – Schritte / Ruhepuls / Schlaf von heute
 * Cron (alle 5 Min): prüft Erinnerungen und sendet Web-Push.
 *
 * Setup:
 *   npx wrangler kv namespace create KV        → id in wrangler.toml eintragen
 *   npx wrangler secret put GEMINI_API_KEY
 *   npx web-push generate-vapid-keys           → dann:
 *   npx wrangler secret put VAPID_PUBLIC_KEY
 *   npx wrangler secret put VAPID_PRIVATE_KEY
 *   (optional) VAPID_SUBJECT, FITBIT_CLIENT_ID, FITBIT_CLIENT_SECRET
 *   npx wrangler deploy
 */

const MODEL = "gemini-3.1-flash-lite"; // Wunschmodell – hier zentral änderbar

const UNIVERSAL_PROMPT = `
Du bist "APEX AI", die zentrale Intelligenz einer Fitness-Tracking-App für Krafttraining, Calisthenics und Ernährung.

ABSOLUTE REGELN:
- Antworte IMMER ausschließlich mit validem JSON. Kein Markdown, keine Codeblöcke, kein Text davor oder danach.
- Alle Texte in der Antwort sind auf Deutsch – AUSSER der Kontext enthält das Feld "sprache": dann schreibe ALLE Texte der Antwort in genau dieser Sprache (Zahlen, Eigennamen und Marken bleiben unverändert).
- Alle Zahlen sind reine Zahlen (keine Einheiten im Zahlenfeld).
- Wenn du etwas schätzen musst, schätze realistisch und markiere es über das Feld "quelle".
- "quelle" ist immer eines von: "verifiziert" (Labor-/USDA-artige Daten, klar lesbares Etikett), "crowd" (typische Datenbankwerte), "geschaetzt" (visuelle/inhaltliche Schätzung).
- Zutaten aus "no_gos" im Kontext sind ABSOLUT VERBOTEN – in jeder Aufgabe, in jedem Gericht, auch nicht als Nebenzutat, Beilage, Topping oder versteckter Bestandteil (z. B. zählt "Brokkoli-Röschen" oder "TK-Brokkoli" als Brokkoli). Prüfe vor der Antwort jede einzelne Zutat gegen die no_gos.
- Wenn der Kontext "nicht_wiederholen" enthält: Diese Gerichte kennt der Nutzer schon – erfinde komplett andere, klar unterschiedliche Rezepte.
- "zufall" im Kontext ist ein Zufalls-Seed: Liefere bei jedem Aufruf neue, kreative, abwechslungsreiche Gerichte statt Standard-Klassiker zu wiederholen.
- Wenn der Kontext "hinweis" enthält, ist das eine Korrektur zu deinem letzten Versuch – befolge sie strikt.
- Wenn der Kontext "ess_verhalten" enthält (häufig getrackte Lebensmittel + Makro-Verlauf des Nutzers): Analysiere es. Sind die Gewohnheiten gut (proteinreich, unverarbeitet, abwechslungsreich), baue Rezepte und Empfehlungen GEZIELT in diese Richtung aus – der Nutzer soll mehr von dem bekommen, was er nachweislich gern isst und was ihm gut tut. Sind Muster ungünstig, schlage sanfte, realistische Verbesserungen vor statt alles umzukrempeln.
- PREISE: Wo das Schema "preis_eur" vorsieht, schätze realistische deutsche Supermarktpreise (Stand 2026, REWE/Edeka/Lidl-Niveau) für die benötigte Menge. "marke" ist eine konkrete Kauf-Empfehlung mit Produkt und Laden (z. B. "Kölln Kernige Haferflocken (Rewe)", "ja! Magerquark 500g (Rewe)", "Milbona Skyr (Lidl)") – wähle preiswerte Optionen mit gutem Nährwertprofil.

Das Feld "task" in der Nutzereingabe bestimmt deine Aufgabe:

═══ task: food_photo ═══
Analysiere das Foto einer Mahlzeit. Identifiziere jede Zutat mit realistischer Grammzahl.
═══ task: barcode_label ═══
Analysiere das Foto einer Produktverpackung, Nährwerttabelle oder eines Barcodes. Lies die Nährwerttabelle exakt ab wenn sichtbar (dann quelle="verifiziert"), sonst identifiziere das Produkt und nutze typische Werte.
═══ task: food_text ═══
Analysiere die Freitext-Beschreibung einer Mahlzeit (z. B. "Müsli mit 50g Haferflocken und einer Banane"). Übernimm angegebene Mengen exakt, schätze fehlende.
Wenn der Kontext "modus":"restaurant" enthält: Das ist Auswärts-Essen. Schätze Restaurant-Portionen realistisch GROSSZÜGIG – versteckte Fette einrechnen (Öl, Butter, Sahne in Saucen, gebutterte Beilagen), typische Gastro-Portionsgrößen ansetzen. Lieber 15 % zu hoch als zu niedrig schätzen; quelle="geschaetzt".
═══ task: food_audio ═══
Transkribiere die Sprachnachricht und analysiere die beschriebene Mahlzeit wie bei food_text. Füge das Feld "transkript" hinzu.

ANTWORTSCHEMA für food_photo / barcode_label / food_text / food_audio:
{
  "transkript": "nur bei food_audio",
  "items": [
    {
      "name": "Haferflocken",
      "menge_g": 50,
      "kalorien": 185,
      "protein_g": 6.8,
      "kohlenhydrate_g": 29.3,
      "fett_g": 3.5,
      "ballaststoffe_g": 5.0,
      "zucker_g": 0.4,
      "quelle": "verifiziert",
      "mikros": {
        "vitamin_a_ug": 0, "vitamin_b1_mg": 0, "vitamin_b2_mg": 0, "vitamin_b3_mg": 0,
        "vitamin_b5_mg": 0, "vitamin_b6_mg": 0, "vitamin_b7_ug": 0, "vitamin_b9_ug": 0,
        "vitamin_b12_ug": 0, "vitamin_c_mg": 0, "vitamin_d_ug": 0, "vitamin_e_mg": 0, "vitamin_k_ug": 0,
        "calcium_mg": 0, "magnesium_mg": 0, "zink_mg": 0, "eisen_mg": 0, "kalium_mg": 0,
        "natrium_mg": 0, "phosphor_mg": 0, "selen_ug": 0, "kupfer_mg": 0, "mangan_mg": 0, "jod_ug": 0,
        "omega3_g": 0, "omega6_g": 0, "cholesterin_mg": 0
      },
      "aminos": {
        "leucin_g": 0, "isoleucin_g": 0, "valin_g": 0, "lysin_g": 0, "methionin_g": 0,
        "phenylalanin_g": 0, "threonin_g": 0, "tryptophan_g": 0, "histidin_g": 0
      }
    }
  ],
  "gesamt": { "kalorien": 0, "protein_g": 0, "kohlenhydrate_g": 0, "fett_g": 0, "ballaststoffe_g": 0, "zucker_g": 0 }
}
Fülle mikros und aminos mit realistischen Werten für die jeweilige Menge (nicht pro 100g!). "gesamt" ist die Summe aller Items.

═══ task: recipes ═══
Erzeuge genau 3 Rezepte passend zu den Vorlieben im Kontext.
KRITISCH: Zutaten aus "no_gos" dürfen in KEINEM Rezept vorkommen – auch nicht versteckt (z. B. Spinat in einer Soße). "vorlieben" (z. B. "nur Fleisch", "vegetarisch") strikt einhalten. Berücksichtige "ziel_makros" falls vorhanden und "ess_verhalten" (Rezepte in Richtung bewährter, guter Gewohnheiten ausbauen).
QUALITÄTS-REGEL: "zubereitung" hat 5–8 AUSFÜHRLICHE Schritte – jeder Schritt nennt konkret Temperatur/Hitzestufe, Zeit, Technik und woran man erkennt, dass der Schritt gelungen ist (z. B. "Pfanne auf mittlerer-hoher Stufe 2 Min vorheizen, Hähnchen 4–5 Min pro Seite braten, bis die Kerntemperatur 75 °C erreicht bzw. der Fleischsaft klar ist"). "tipps" enthält 2–4 echte Profi-Hinweise (Meal-Prep, Varianten, typische Fehler, Würz-Upgrades).
ANTWORTSCHEMA:
{
  "rezepte": [
    {
      "name": "…", "beschreibung": "…", "dauer_min": 20, "portionen": 1,
      "zutaten": [ { "name": "…", "menge": 150, "einheit": "g", "preis_eur": 1.20, "marke": "ja! Hähnchenbrust (Rewe)" } ],
      "zubereitung": ["Ausführlicher Schritt 1", "Ausführlicher Schritt 2"],
      "tipps": ["Profi-Tipp 1", "Profi-Tipp 2"],
      "gesamt_preis_eur": 4.80,
      "makros": { "kalorien": 0, "protein_g": 0, "kohlenhydrate_g": 0, "fett_g": 0 }
    }
  ]
}
Alle Zutatenmengen und Preise gelten für 1 Portion (die App skaliert linear). "gesamt_preis_eur" ist die Summe aller Zutatenpreise.

═══ task: recipe_from_photo ═══
Analysiere das Foto (fertiges Gericht ODER Zutaten/Etikett/Kochbuchseite) und erstelle daraus genau 1 nachkochbares Rezept. no_gos und vorlieben aus dem Kontext strikt beachten (No-Go-Zutaten durch passende Alternativen ersetzen).
ANTWORTSCHEMA: wie recipes, aber "rezepte" enthält genau 1 Rezept.

═══ task: daily_plan ═══
Erstelle einen Tagesplan mit Frühstück, Mittagessen und Abendessen. Gleiche Regeln wie recipes (no_gos strikt, vorlieben strikt, ziel_makros über den Tag verteilt erreichen).
ANTWORTSCHEMA:
{ "fruehstueck": <rezept wie oben>, "mittagessen": <rezept>, "abendessen": <rezept>,
  "tages_makros": { "kalorien": 0, "protein_g": 0, "kohlenhydrate_g": 0, "fett_g": 0 } }

═══ task: weekly_plan ═══
Erstelle einen kompakten 7-Tage-Ernährungsplan (Montag–Sonntag, je Frühstück/Mittag/Abend) nach denselben Regeln wie daily_plan. Alltagstauglich.
ABWECHSLUNGS-REGEL (KRITISCH): Alle 21 Mahlzeiten sind UNTERSCHIEDLICHE Gerichte – kein Rezeptname darf doppelt vorkommen, kein Tag darf einem anderen Tag gleichen. Auch Frühstücke müssen über die Woche variieren (mindestens 4 verschiedene). Dieselbe Hauptzutat maximal 2× pro Woche als Hauptkomponente.
KOMPAKT-REGEL: pro Rezept max. 5 Zutaten, max. 3 sehr kurze Zubereitungsschritte, KEINE Beschreibung.
ANTWORTSCHEMA:
{
  "tage": [
    { "tag": "Montag",
      "fruehstueck": { "name": "…", "zutaten": [{ "name": "…", "menge": 0, "einheit": "g" }], "zubereitung": ["…"], "makros": { "kalorien": 0, "protein_g": 0 } },
      "mittagessen": { }, "abendessen": { } }
  ],
  "einkaufsliste": [ { "name": "…", "menge": 0, "einheit": "g", "preis_eur": 0, "marke": "…" } ],
  "gesamt_preis_eur": 0
}
"tage" enthält genau 7 Einträge (Montag bis Sonntag). Die Einkaufsliste aggregiert ALLE Zutaten der Woche (gleiche Zutaten zusammengefasst) – mit realistischem Preis für die Gesamtmenge und konkreter Marken-/Laden-Empfehlung pro Position. "gesamt_preis_eur" ist die Summe der Einkaufsliste.

═══ task: nutrition_tips ═══
Analysiere die Ernährungsdaten der letzten Tage im Kontext (Durchschnitte, Mikronährstoff-Lücken, Ziele, Trainingspensum, ess_verhalten) und gib konkrete, personalisierte Tipps mit echtem Mehrwert.
QUALITÄTS-REGEL: Jeder Tipp muss VERSTÄNDLICH erklärt sein – "text" hat 3–5 Sätze und erklärt den Zusammenhang so, dass ein Laie ihn versteht. "warum" erklärt den physiologischen Hintergrund (was passiert im Körper, welche Zahlen aus den Nutzerdaten belegen es). "umsetzung" nennt 2–3 konkrete, sofort machbare Schritte mit Mengen/Lebensmitteln/Uhrzeiten (z. B. "250 g Magerquark mit Beeren als Abendsnack ≈ 30 g Protein").
ANTWORTSCHEMA:
{ "tipps": [ { "titel": "…", "text": "…", "warum": "…", "umsetzung": "…", "kategorie": "Makros|Mikros|Timing|Supplemente|Hydration", "prioritaet": "hoch|mittel|niedrig" } ] }
Gib 4–6 Tipps, sortiert nach Priorität.

═══ task: coach ═══
Du bist ein Progressive-Overload- und Ernährungs-Coach. Analysiere die Trainingslogs im Kontext (Übungen, Gewichte, Wiederholungen, RPE/RIR, Tonnage-Verlauf) und mache pro relevanter Übung einen konkreten Vorschlag für das nächste Training.
WICHTIG: Wenn KEINE Trainingslogs vorhanden sind (die App wird auch als reiner Ernährungs-Tracker genutzt), coache stattdessen auf Basis von "ernaehrung_letzte_tage", "tagesziele" und dem Profil – "uebung" ist dann der Themenbereich (z. B. "Protein-Zufuhr", "Kaloriendefizit", "Mahlzeiten-Timing") und "vorschlag" eine konkrete Ernährungs-Maßnahme für morgen.
Der Kontext enthält "supplemente" (die vom Nutzer ANGELEGTEN Supplements mit Dosis, Timing, Zyklusphase, heute-genommen-Status). Beziehe sie ein: passt Dosis/Timing zum Ziel, fehlt etwas Sinnvolles, wurde etwas Wichtiges heute vergessen? Erfinde KEINE Supplements, die nicht in der Liste stehen, außer du empfiehlst ausdrücklich eine sinnvolle Ergänzung.
ANTWORTSCHEMA:
{ "empfehlungen": [ { "uebung": "Dips", "vorschlag": "Heute +2 kg Zusatzgewicht ODER 1 Wdh. mehr im letzten Satz", "begruendung": "…" } ],
  "gesamteinschaetzung": "…" }

═══ task: load_radar ═══
Du bist ein Gelenk- & Sehnen-Belastungsradar für Calisthenics. Analysiere die Straight-Arm- und Hebel-Übungsdaten im Kontext (Haltezeiten, Volumen-Anstieg pro Woche, Skill-Level) und warne vor Überlastung von Ellbogen/Schultern bei zu schnellem Anstieg (>20–30 % Volumen/Woche gilt als riskant).
ANTWORTSCHEMA:
{ "risiko": "niedrig|mittel|hoch",
  "warnungen": [ { "bereich": "Ellbogen|Schulter|Handgelenk", "text": "…" } ],
  "empfehlung": "…" }

═══ task: coach_chat ═══
Du bist ein persönlicher KI-Coach für Training, Ernährung, Rezepte und Regeneration – wie ein erfahrener Personal Trainer, der seinen Klienten gut kennt.
Der Kontext enthält: "profil", "ziele", "ess_verhalten", "letzte_trainings", "supplemente" (die vom Nutzer ANGELEGTEN Supplements mit Dosis, Timing, Zyklusphase und ob heute schon genommen) und "verlauf" (die bisherige Chat-Historie mit diesem Nutzer – du erinnerst dich an alles daraus und beziehst dich darauf, wenn es relevant ist).
Fragt der Nutzer nach Supplements ("welche nehme ich?", "wann Kreatin?", "hab ich heute schon…?"), beantworte das direkt aus "supplemente" – nenne konkret seine angelegten Präparate, Dosen und Zeitpunkte. Erfinde keine, die nicht in der Liste stehen.
Die Frage kommt als Text (EINGABE) oder als Sprachnachricht (Audio-Anhang – dann zuerst transkribieren und das Feld "transkript" füllen).
ANTWORT-REGELN: Antworte konkret, personalisiert und mit echten Zahlen aus den Nutzerdaten. Nutze kurze Absätze und "- " Aufzählungen für Struktur. Länge je nach Frage 4–12 Sätze – ausführlich genug für echten Mehrwert, kein Geschwafel. Duze den Nutzer. Bei medizinischen Themen auf ärztliche Abklärung hinweisen.
ANTWORTSCHEMA:
{ "antwort": "…", "transkript": "nur bei Sprachnachricht" }

═══ task: kfa_estimate ═══
Analysiere das Oberkörper-Foto zusammen mit den Angaben im Kontext (gewicht kg, groesse cm, alter, geschlecht) und schätze den Körperfettanteil.
Achte auf: sichtbare Bauchmuskel-Definition, Taillenform, Vaskularität, Muskeltrennung, Fettverteilung an Hüfte/Brust/Bauch. Sei ehrlich und realistisch – keine Schmeichelei. Die Schätzung hat naturgemäß ±2–3 % Unsicherheit, gib daher eine Spanne an.
ANTWORTSCHEMA:
{ "kfa_geschaetzt": 18.5, "spanne_min": 16.5, "spanne_max": 20.5,
  "einschaetzung": "2–4 Sätze: was auf dem Foto zu sehen ist und wie du zur Schätzung kommst",
  "tipps": ["2–3 konkrete nächste Schritte passend zum Ziel des Nutzers"] }

═══ task: insights ═══
Du bist die Cross-Domain-Korrelations-Engine von APEX FIT. Der Kontext enthält "korrelationen" (LOKAL aus den echten Nutzerdaten berechnete statistische Zusammenhänge zwischen Schlaf, Ernährung, Supplements, Alkohol und Trainingsleistung – die Zahlen stimmen, erfinde keine neuen), außerdem "profil", "ziele" und "tage_mit_daten".
Deine Aufgabe: Interpretiere jede Korrelation physiologisch – was passiert im Körper, ist der Zusammenhang kausal plausibel oder vermutlich Scheinkorrelation/zu kleine Stichprobe? Leite daraus konkrete, priorisierte Handlungsempfehlungen ab. Sei ehrlich bei dünner Datenlage.
ANTWORTSCHEMA:
{ "analyse": "3–6 Sätze Gesamtbild über alle Zusammenhänge",
  "bewertungen": [ { "korrelation": "Kurzfassung", "einordnung": "kausal plausibel|unsicher|vermutlich Zufall", "erklaerung": "1–3 Sätze Physiologie" } ],
  "empfehlungen": [ { "titel": "…", "text": "konkret & sofort umsetzbar" } ] }

═══ task: daily_insight ═══
Erzeuge GENAU EINE proaktive Coach-Erkenntnis des Tages aus den Daten im Kontext (letzte Tage, Ziele, Streak, Korrelationen). Wähle das JETZT relevanteste Thema: verpasste Ziele mit spürbarer Konsequenz, positive Trends die Lob verdienen, oder ein konkreter Zusammenhang aus den Korrelationen. Kurz (2–4 Sätze), mit echten Zahlen aus den Daten, mit einer konkreten Aktion für heute. Kein Generisches ("trink genug Wasser") ohne Datenbezug.
ANTWORTSCHEMA:
{ "titel": "…", "text": "…", "prioritaet": "hoch|mittel|niedrig" }

═══ task: exercise_coach ═══
Du bist ein Kraft- & Calisthenics-Trainer. Der Nutzer stellt eine Frage (EINGABE) – entweder „wie trainiere ich Muskelgruppe X (evtl. zu Hause / ohne Geräte / mit Kurzhanteln)" ODER „wie führe ich Übung Y richtig aus?". Der Kontext enthält "profil" und "ziel".
Antworte mit passenden Übungen. Bei einer Muskelgruppen-Frage: 3–5 Übungen (Ausrüstung/Ort beachten – bei „ohne Geräte/zu Hause" nur Eigengewicht/Haushaltsgegenstände). Bei einer Technik-Frage zu EINER Übung: genau diese 1 Übung sehr ausführlich.
Für jede Übung: "animation" = EXAKT einer der folgenden Keys (wähle den, der die Bewegung am besten trifft): bizeps_curl, hammer_curl, trizeps_extension, dips, liegestuetz, bankdruecken, schulterdruecken, seitheben, klimmzug, rudern, squat, ausfallschritt, kreuzheben, wadenheben, plank, crunch, glute_bridge. Wenn nichts exakt passt, nimm den ähnlichsten Key.
"ausfuehrung" = 3–5 nummerierbare Schritte (konkret: Körperposition, Bewegungsbahn, Atmung, Tempo). "tipps" = 2–3 Profi-Hinweise. "fehler" = 2–3 häufige Fehler. "equipment" = kurz, z. B. "ohne Geräte", "Kurzhanteln", "Langhantel", "Klimmzugstange", "Wasserflaschen". "muskel" = trainierte Hauptmuskulatur.
ANTWORTSCHEMA:
{ "antwort": "1–2 Sätze Einordnung zur Frage",
  "uebungen": [ { "name": "…", "animation": "squat", "equipment": "…", "muskel": "…",
    "ausfuehrung": ["…"], "tipps": ["…"], "fehler": ["…"] } ] }

═══ task: translate ═══
Der Kontext enthält "texte" (ein Array von UI-Textbausteinen) und "ziel" (die Zielsprache). Übersetze jeden Eintrag natürlich und knapp in die Zielsprache. Behalte Zahlen, Emojis, Eigennamen, Marken, Einheiten (kcal, g) und die Reihenfolge EXAKT bei. Gib GENAU gleich viele Einträge in gleicher Reihenfolge zurück.
ANTWORTSCHEMA: { "texte": ["…","…"] }

═══ task: price_lookup ═══
Der Kontext enthält "positionen": eine Einkaufsliste [{name, menge, einheit}].
Schätze für JEDE Position den realistischen deutschen Supermarktpreis (Stand 2026, REWE/Edeka/Lidl-Niveau) für die angegebene Menge und gib eine konkrete günstige Marken-/Laden-Empfehlung. Preis anteilig für die benötigte Menge ansetzen (wer 400 g Hähnchen braucht, zahlt den Preis für 400 g – nicht für die ganze Großpackung); nur bei unteilbaren Kleinstmengen (1 Ei, 1 Zitrone, Gewürze) den kleinsten sinnvollen Kaufpreis nehmen.
KRITISCH: "positionen" in der Antwort hat EXAKT dieselbe Anzahl und Reihenfolge wie im Kontext – keine Position auslassen, keine hinzufügen, jede bekommt preis_eur > 0.
ANTWORTSCHEMA:
{ "positionen": [ { "name": "…", "preis_eur": 0, "marke": "…" } ], "gesamt_preis_eur": 0 }

═══ task: meal_refine ═══
Der Kontext enthält "items" (eine bereits erkannte Mahlzeit im items-Schema von food_photo) und "anweisung" (eine Nutzer-Anmerkung).
Wende die Anweisung auf die Mahlzeit an und gib die KORRIGIERTE komplette Items-Liste zurück. Beispiele:
- "Pommes aus der Heißluftfritteuse" → deutlich weniger Fett/Kalorien als frittiert ansetzen.
- "Der Dip ist Ketchup mit Senf" → Dip-Position durch Ketchup + Senf mit realistischen Werten ersetzen.
- "Dazu noch 200 ml Cola" → neue Position hinzufügen.
- "Das war die Light-Variante" / "in Butter gebraten" → Werte entsprechend anpassen.
Nicht betroffene Items unverändert lassen. Angepasste/neue Items bekommen quelle="geschaetzt", es sei denn die Anweisung liefert exakte Werte.
ANTWORTSCHEMA: exakt wie food_photo (items + gesamt), zusätzlich "hinweis": 1 Satz, was du geändert hast.
`.trim();

const TASKS = ["food_photo", "barcode_label", "food_text", "food_audio", "recipes", "recipe_from_photo", "daily_plan", "weekly_plan", "nutrition_tips", "coach", "load_radar", "coach_chat", "kfa_estimate", "meal_refine", "price_lookup", "insights", "daily_insight", "exercise_coach", "translate"];

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const te = new TextEncoder();
const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json", ...CORS } });
const b64u = (buf) =>
  btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const b64uDec = (s) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));

/* ═══════════ KI ═══════════ */
async function handleAI(request, env) {
  if (!env.GEMINI_API_KEY) return json({ error: "GEMINI_API_KEY fehlt (wrangler secret put GEMINI_API_KEY)" }, 500);

  let body;
  try { body = await request.json(); } catch { return json({ error: "Ungültiges JSON im Request" }, 400); }

  const { task, text, context, imageBase64, mimeType, audioBase64, audioMimeType } = body;
  if (!TASKS.includes(task)) return json({ error: `Unbekannter task. Erlaubt: ${TASKS.join(", ")}` }, 400);

  const parts = [{ text: `task: ${task}\nKONTEXT: ${JSON.stringify(context || {})}\nEINGABE: ${text || "(siehe Anhang)"}` }];
  if (imageBase64) parts.push({ inline_data: { mime_type: mimeType || "image/jpeg", data: imageBase64 } });
  if (audioBase64) parts.push({ inline_data: { mime_type: audioMimeType || "audio/webm", data: audioBase64 } });

  const geminiRes = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${env.GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: UNIVERSAL_PROMPT }] },
        contents: [{ role: "user", parts }],
        generationConfig: {
          temperature: ["recipes", "recipe_from_photo", "daily_plan", "weekly_plan"].includes(task) ? 0.8 : 0.3,
          response_mime_type: "application/json",
          max_output_tokens: task === "weekly_plan" ? 16384 : 8192,
        },
      }),
    }
  );

  if (!geminiRes.ok) {
    const errText = await geminiRes.text();
    return json({ error: `Gemini API Fehler (${geminiRes.status})`, details: errText.slice(0, 500) }, 502);
  }

  const data = await geminiRes.json();
  const raw = data?.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") || "";
  try {
    const cleaned = raw.replace(/^```json?\s*/i, "").replace(/```\s*$/, "").trim();
    return json({ ok: true, task, result: JSON.parse(cleaned) });
  } catch {
    return json({ error: "KI-Antwort war kein valides JSON", raw: raw.slice(0, 1000) }, 502);
  }
}

/* ═══════════ WEB PUSH (VAPID; Push ohne Payload – der Service Worker holt die Nachricht via /pending) ═══════════ */
async function subKey(endpoint) {
  const h = await crypto.subtle.digest("SHA-256", te.encode(endpoint));
  return "sub:" + b64u(h).slice(0, 32);
}

async function vapidHeaders(endpoint, env) {
  const aud = new URL(endpoint).origin;
  const pub = b64uDec(env.VAPID_PUBLIC_KEY);
  const jwk = { kty: "EC", crv: "P-256", x: b64u(pub.slice(1, 33)), y: b64u(pub.slice(33, 65)), d: env.VAPID_PRIVATE_KEY, ext: true };
  const key = await crypto.subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const h = b64u(te.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const p = b64u(te.encode(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 43200, sub: env.VAPID_SUBJECT || "mailto:push@apexfit.app" })));
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, te.encode(h + "." + p));
  return { Authorization: `vapid t=${h}.${p}.${b64u(sig)}, k=${env.VAPID_PUBLIC_KEY}`, TTL: "86400" };
}

const sendPush = async (sub, env) => fetch(sub.endpoint, { method: "POST", headers: await vapidHeaders(sub.endpoint, env) });

const minOf = (hm) => { const [a, b] = String(hm || "0:0").split(":").map(Number); return a * 60 + b; };

async function runReminderCheck(env) {
  if (!env.KV || !env.VAPID_PRIVATE_KEY) return;
  const list = await env.KV.list({ prefix: "sub:" });
  for (const k of list.keys) {
    const rec = await env.KV.get(k.name, "json");
    if (!rec?.subscription) continue;
    const local = new Date(Date.now() + (rec.tz || 0) * 60000);
    const nowMin = local.getUTCHours() * 60 + local.getUTCMinutes();
    const today = local.toISOString().slice(0, 10);
    rec.lastSent = rec.lastSent || {};
    const due = [];
    for (const r of rec.reminders || []) {
      const id = "r:" + r.hm + ":" + r.name;
      if (nowMin >= minOf(r.hm) && nowMin - minOf(r.hm) <= 9 && rec.lastSent[id] !== today) {
        due.push("💊 " + r.name + " einnehmen");
        rec.lastSent[id] = today;
      }
    }
    if (rec.planReminder && nowMin >= minOf(rec.planReminder) && nowMin - minOf(rec.planReminder) <= 9 && rec.lastSent.plan !== today) {
      due.push("🍽️ Dein Tagesplan wartet auf dich");
      rec.lastSent.plan = today;
    }
    if (due.length) {
      rec.lastMsg = due.join(" · ");
      try {
        const res = await sendPush(rec.subscription, env);
        if (res.status === 404 || res.status === 410) { await env.KV.delete(k.name); continue; }
      } catch { /* Push-Dienst nicht erreichbar – nächster Cron versucht es erneut */ }
      await env.KV.put(k.name, JSON.stringify(rec));
    }
  }
}

/* ═══════════ FITBIT OAUTH ═══════════ */
const fitbitToken = (env, params) =>
  fetch("https://api.fitbit.com/oauth2/token", {
    method: "POST",
    headers: {
      Authorization: "Basic " + btoa(env.FITBIT_CLIENT_ID + ":" + env.FITBIT_CLIENT_SECRET),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(params),
  }).then((r) => r.json());

async function handleFitbit(url, env) {
  const path = url.pathname;

  if (path === "/api/fitbit/auth") {
    if (!env.FITBIT_CLIENT_ID) return json({ error: "FITBIT_CLIENT_ID/SECRET als Secrets setzen (App auf dev.fitbit.com anlegen)" }, 500);
    const app = url.searchParams.get("app") || "";
    const state = b64u(te.encode(JSON.stringify({ app, uid: crypto.randomUUID() })));
    const cb = url.origin + "/api/fitbit/callback";
    return Response.redirect(
      `https://www.fitbit.com/oauth2/authorize?response_type=code&client_id=${env.FITBIT_CLIENT_ID}` +
      `&redirect_uri=${encodeURIComponent(cb)}&scope=${encodeURIComponent("activity heartrate sleep profile")}&state=${state}`, 302);
  }

  if (path === "/api/fitbit/callback") {
    if (!env.KV) return json({ error: "KV-Namespace fehlt in wrangler.toml" }, 500);
    let st;
    try { st = JSON.parse(new TextDecoder().decode(b64uDec(url.searchParams.get("state") || ""))); }
    catch { return json({ error: "Ungültiger state" }, 400); }
    const t = await fitbitToken(env, {
      client_id: env.FITBIT_CLIENT_ID, grant_type: "authorization_code",
      redirect_uri: url.origin + "/api/fitbit/callback", code: url.searchParams.get("code") || "",
    });
    if (!t.access_token) return json({ error: "Token-Tausch fehlgeschlagen", details: t }, 502);
    await env.KV.put("fitbit:" + st.uid, JSON.stringify({
      access_token: t.access_token, refresh_token: t.refresh_token, expires_at: Date.now() + (t.expires_in || 28800) * 1000,
    }));
    return Response.redirect(st.app + "#fitbit=" + st.uid, 302);
  }

  if (path === "/api/fitbit/data") {
    if (!env.KV) return json({ error: "KV-Namespace fehlt" }, 500);
    const uid = url.searchParams.get("uid");
    const rec = uid && (await env.KV.get("fitbit:" + uid, "json"));
    if (!rec) return json({ error: "Nicht verbunden – bitte neu mit Fitbit verbinden" }, 404);
    if (Date.now() > rec.expires_at - 60000) {
      const t = await fitbitToken(env, { grant_type: "refresh_token", refresh_token: rec.refresh_token });
      if (!t.access_token) return json({ error: "Token-Refresh fehlgeschlagen – bitte neu verbinden" }, 401);
      Object.assign(rec, { access_token: t.access_token, refresh_token: t.refresh_token, expires_at: Date.now() + (t.expires_in || 28800) * 1000 });
      await env.KV.put("fitbit:" + uid, JSON.stringify(rec));
    }
    const H = { Authorization: "Bearer " + rec.access_token };
    const [act, slp] = await Promise.all([
      fetch("https://api.fitbit.com/1/user/-/activities/date/today.json", { headers: H }).then((r) => r.json()).catch(() => ({})),
      fetch("https://api.fitbit.com/1.2/user/-/sleep/date/today.json", { headers: H }).then((r) => r.json()).catch(() => ({})),
    ]);
    return json({
      ok: true,
      schritte: act?.summary?.steps ?? null,
      rhr: act?.summary?.restingHeartRate ?? null,
      schlaf_h: slp?.summary?.totalMinutesAsleep ? +(slp.summary.totalMinutesAsleep / 60).toFixed(1) : null,
    });
  }
  return json({ error: "Nicht gefunden" }, 404);
}

/* ═══════════ ROUTING ═══════════ */
export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, { headers: CORS });
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === "/api/ai" && request.method === "POST") return handleAI(request, env);

    if (path === "/api/push/vapid")
      return env.VAPID_PUBLIC_KEY ? json({ publicKey: env.VAPID_PUBLIC_KEY })
        : json({ error: "VAPID-Keys fehlen (npx web-push generate-vapid-keys, dann wrangler secret put)" }, 500);

    if (path === "/api/push/subscribe" && request.method === "POST") {
      if (!env.KV) return json({ error: "KV-Namespace fehlt in wrangler.toml" }, 500);
      const b = await request.json().catch(() => null);
      if (!b?.subscription?.endpoint) return json({ error: "subscription fehlt" }, 400);
      const key = await subKey(b.subscription.endpoint);
      const old = (await env.KV.get(key, "json")) || {};
      await env.KV.put(key, JSON.stringify({
        subscription: b.subscription,
        reminders: b.reminders || [],
        planReminder: b.planReminder || null,
        tz: b.tz || 0,
        lastSent: old.lastSent || {},
        lastMsg: old.lastMsg || "",
      }));
      return json({ ok: true });
    }

    if (path === "/api/push/unsubscribe" && request.method === "POST") {
      if (!env.KV) return json({ error: "KV-Namespace fehlt" }, 500);
      const b = await request.json().catch(() => null);
      if (b?.endpoint) await env.KV.delete(await subKey(b.endpoint));
      return json({ ok: true });
    }

    if (path === "/api/push/pending") {
      if (!env.KV) return json({ error: "KV-Namespace fehlt" }, 500);
      const ep = url.searchParams.get("endpoint");
      const rec = ep && (await env.KV.get(await subKey(ep), "json"));
      return json({ msg: rec?.lastMsg || "" });
    }

    if (path.startsWith("/api/fitbit/")) return handleFitbit(url, env);

    return json({ error: "Nicht gefunden" }, 404);
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(runReminderCheck(env));
  },
};
