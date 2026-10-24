# Evidence Fit — Rechtstexte (ENTWURF, 24.10.2026)

> **Entwurf, keine Rechtsberatung.** Vor dem Live-Gang von einer Anwältin / einem
> Anwalt prüfen lassen. Gesundheitsdaten (Art. 9 DSGVO) und Abos für
> Verbraucher (§§ 312 ff. BGB) sind haftungsrelevant.
> In **[eckigen Klammern]** steht, was ich nicht sicher weiß und du prüfen musst.

---

## 1. Impressum
Wie bei Evidence Trading (gleicher Anbieter):
Jason Ziborius · Holzstraße 16 · 77855 Achern · E-Mail: [wie im Evidence-Impressum]
Umsatzsteuer: Kleinunternehmer nach § 19 UStG — es wird keine Umsatzsteuer berechnet.
[Prüfen: Reicht § 19 UStG bei zwei Produkten und Umsatz im Ausland noch aus? Grenzwerte beobachten.]

---

## 2. Datenschutzerklärung Evidence Fit

**Verantwortlicher:** siehe Impressum.

**Welche Daten**
- Konto: E-Mail-Adresse, Passwort (nur als Hash bei Google Firebase Authentication).
- Was du einträgst: Mahlzeiten, Training, Supplements, Wasser, Alkohol, Körpermaße,
  Gewicht, Schlaf, Ruhepuls, HRV, Zyklus, Fortschrittsfotos.
- **Gesundheitsdaten im Sinne von Art. 9 DSGVO** sind darunter (z. B. Schlaf, Ruhepuls,
  HRV, Gewicht, Zyklus, Körperfoto-Schätzung). Rechtsgrundlage: **deine ausdrückliche
  Einwilligung, Art. 9 Abs. 2 lit. a DSGVO**, die du bei der Registrierung erteilst und
  jederzeit widerrufen kannst. [Prüfen: Einwilligungs-Häkchen bei der Registrierung
  einbauen — gibt es heute noch nicht.]
- Abo: Stripe verarbeitet die Zahlung; wir erhalten nur Kunden-, Abo-ID und Status.

**Wofür**
- Bereitstellen der App und Synchronisieren zwischen deinen Geräten (Art. 6 Abs. 1 lit. b).
- KI-Funktionen (Foto-/Etiketterkennung, Rezepte, Pläne, Coach, Insights): die jeweils
  nötigen Angaben werden im Moment der Nutzung an Google (Gemini API) gesendet.
  Nur, wenn du eine KI-Funktion auslöst. [Prüfen: Googles Bedingungen zur Nutzung der
  Eingaben für Training — bezahlte API-Stufe verwenden.]
- Abo-Abrechnung (Art. 6 Abs. 1 lit. b).

**Weitergabe an Evidence Trading (nur auf deinen Wunsch)**
Wenn du Evidence Fit mit deinem Evidence-Trading-Konto verbindest, werden **nur die
Kategorien, die du dabei anhakst** (Schlaf & Readiness · Ernährung · Training · Körper),
als Tageswerte an dein Evidence-Trading-Konto übertragen und dort ausgewertet (z. B.
„Unter 6 h geschlafen“ in Edge & Leaks). Notizen, Fotos und Rezepte werden nie
übertragen. Rechtsgrundlage: deine ausdrückliche Einwilligung (Art. 9 Abs. 2 lit. a).
**Widerruf:** „Verbindung trennen“ in Evidence Fit oder in Evidence Trading — dabei
werden alle übertragenen Tage in Evidence Trading gelöscht.

**Empfänger / Auftragsverarbeiter**
- Google (Firebase Authentication + Firestore; Gemini API; Website-Übersetzung)
  [Prüfen: Firestore-Standort des Projekts fitness-64dbc — EU oder USA?]
- Cloudflare (Worker: KI-Weiterleitung, Push-Erinnerungen, Abo, Verbindung)
- Stripe (Zahlung)
- Open Food Facts (Barcode-Abfrage; nur die Barcode-Nummer)
- Fitbit (nur wenn du Fitbit verbindest)
Übermittlungen außerhalb der EU auf Grundlage der Standardvertragsklauseln /
des EU-US Data Privacy Framework. [Prüfen je Anbieter.]

**Speicherdauer:** bis du dein Konto löschst; Abo-Unterlagen nach den gesetzlichen
Aufbewahrungsfristen (bis zu 10 Jahre, nur Rechnungsdaten).

**Deine Rechte:** Auskunft, Berichtigung, Löschung, Einschränkung, Datenübertragbarkeit,
Widerspruch, Widerruf von Einwilligungen mit Wirkung für die Zukunft, Beschwerde bei
der Aufsichtsbehörde (Landesbeauftragte für Datenschutz Baden-Württemberg).

**Kein Medizinprodukt:** Evidence Fit gibt keine medizinischen Diagnosen. Schätzungen
(Kalorien aus Fotos, Körperfett, Readiness) sind Näherungen.

---

## 3. Leistungsbeschreibung & AGB-Ergänzung „Evidence Fit Abo“

- **Kostenlos:** Konto, manuelles Tracken (Mahlzeiten, Training, Schlaf, Wasser,
  Supplements), Auswertungen ohne KI, Barcode-Abfrage.
- **Abo „Evidence Fit“:** alle KI-Funktionen und die Verbindung zu Evidence Trading.
  **Preis: 4,99 € pro Monat** (Euro-Kunden) bzw. **5,59 USD pro Monat**
  (alle anderen). Endpreis, keine Umsatzsteuer (§ 19 UStG).
- **Laufzeit:** monatlich, verlängert sich jeweils um einen Monat, **jederzeit zum Ende
  des laufenden Monats kündbar.**
- **Inklusive mit Evidence Pro:** Wer ein aktives Evidence-Pro-Abo (oder die
  Evidence-Testphase) hat und Evidence Fit mit Evidence verbindet, nutzt die
  Abo-Funktionen ohne zusätzliche Kosten. Endet Evidence Pro oder wird die
  Verbindung getrennt, endet auch dieser Zugang.
- [Prüfen: Abschnitt in die bestehende Evidence-AGB aufnehmen oder eigene AGB für Fit?]

---

## 4. Widerrufsbelehrung (digitale Dienstleistung)
Übernehmen aus der Evidence-AGB, angepasst auf „Evidence Fit Abo“. Wichtig: Der
Hinweis, dass das Widerrufsrecht erlischt, wenn der Nutzer **ausdrücklich zustimmt**,
dass vor Ablauf der Widerrufsfrist begonnen wird, und dies **bestätigt** — dafür
braucht der Checkout ein entsprechendes Häkchen. **Gebaut 24.10.:** Häkchen vor der Zahlung, der Worker lehnt ohne ab und speichert `waiverAt` an der Stripe-Session/dem Abo. [Wortlaut prüfen lassen.]

---

## 5. Kündigungsbutton (§ 312k BGB)
Evidence hat „Verträge hier kündigen“ ohne Anmeldung. Für Evidence Fit gibt es heute
nur „Abo verwalten / kündigen“ nach dem Login (Stripe-Portal).
**Gebaut 24.10.:** „Verträge hier kündigen“ im Login-Fenster und in den Einstellungen,
direkt über fit.evidencetrading.com/#kuendigen. Kündigt per E-Mail-Adresse zum Laufzeitende
(`POST /api/cancel`), Eingangsbestätigung per Resend (Secret `RESEND_API_KEY`, optional
`MAIL_FROM`/`MAIL_REPLY_TO`). [Prüfen: genügt E-Mail als Identifikation?]

---

## 6. Ergänzung Datenschutz Evidence Trading
> „Wenn du dein Evidence-Trading-Konto mit Evidence Fit verbindest, empfangen wir die
> von dir in Evidence Fit freigegebenen Tageswerte (Schlaf, Readiness, Ernährung,
> Training, Gewicht) und speichern sie in deinem Konto unter
> `apexUsers/<uid>/body`. Sie sind nur für dich sichtbar, werden für deine Auswertungen
> (z. B. Edge & Leaks) verwendet und beim Trennen vollständig gelöscht. Rechtsgrundlage:
> deine ausdrückliche Einwilligung in Evidence Fit (Art. 9 Abs. 2 lit. a DSGVO).“
[In ApexLegal (indexdatenschutz.html) aufnehmen, sobald die Verbindung live geht.]
