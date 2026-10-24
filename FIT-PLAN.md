# Evidence Fit — Plan (24.10.2026)

Aus „APEX FIT“ wird **Evidence Fit**: eine eigenständige App mit eigenem Konto,
eigenem Abo und eigener Adresse — die sich auf Wunsch mit Evidence Trading
verbinden lässt.

## Entscheidungen (Jason, 24.10.2026)

| Frage | Entscheidung |
|---|---|
| Konten | **Getrennt.** Evidence Fit behält sein Firebase (`fitness-64dbc`). Verbunden wird per Einmal-Code. |
| Adresse | **fit.evidencetrading.com** (eigene Subdomain, eigene installierbare App) |
| Preis | **4,99 € und 5,59 $** pro Monat, zwei Stripe-Preise |
| Ohne Abo | **Tracking frei** (Mahlzeiten, Training, Schlaf, Wasser von Hand). **Abo** = alles mit KI (Foto-/Barcode-Erkennung, Rezepte, Coach, Insights) + Evidence-Verbindung |
| Pro-Vorteil | Wer **Evidence Pro** hat und verbunden ist, nutzt Evidence Fit **ohne eigenes Abo** |
| Geteilte Daten | Schlaf & Readiness · Ernährung · Training · Körper — nur nach ausdrücklicher Einwilligung (Art. 9 DSGVO) |

## Wie die zwei Apps zusammenhängen

```
Evidence Fit (fitness-64dbc)                         Evidence Trading (Evidence-Firebase)
 ───────────────────────────                         ────────────────────────────────────
 Nutzer tippt Code ein  ──►  Fit-Worker  ──liest──►  fitLinkCodes/{code}  (vom Nutzer in
                             (Service-Konten          Evidence erzeugt, 15 min, einmalig)
                              für BEIDE Projekte)
                             schreibt Verknüpfung:
 apexfit/{fitUid}.link   ◄──           ──►  apexUsers/{uid}/private/fitLink
 Abo-Prüfung:  eigenes Fit-Abo  ODER  verknüpftes Evidence Pro  (Worker liest apexUsers/{uid})
 Tagesdaten:   App ──► Fit-Worker /api/share ──► apexUsers/{uid}/body/{datum}
```

- **Kein Konto-Zugriff über Kreuz:** Die Apps sehen nie die Datenbank der anderen.
  Nur der Fit-Worker (zwei Service-Konten) überträgt, und nur die freigegebenen Tageswerte.
- **Widerruf jederzeit**, in beiden Apps: Trennen löscht die Verknüpfung und alle
  übertragenen `body/*`-Tage in Evidence.

## Was Evidence Trading mit den Daten macht
1. **Journal-Tag:** kleine Zeile „Schlaf 6,2 h · Readiness 58 · 2 Drinks gestern“.
2. **Edge & Leaks:** neue Bedingungen, z. B. „Unter 6 h geschlafen“, „Readiness unter 50“,
   „Alkohol am Vortag“, „Training am Morgen“ — getestet wie alle anderen.
3. **Start my day:** Readiness und Schlaf der letzten Nacht.

## Etappen
1. **Umbenennen & eigenständig:** Name, Titel, Manifest, Icons, Texte, SW-Cache, Worker-Name im Text.
2. **Abo:** Fit-Billing (Stripe Checkout + Webhook) für 4,99 € / 5,59 $, Paywall in der App,
   kostenlose Basis bleibt definiert.
3. **Verknüpfen & Pro-Freizugang:** Code in Evidence erzeugen, in Fit eingeben, Einwilligung,
   Entitlement-Prüfung.
4. **Datenfluss:** Tageszusammenfassung → Evidence; Anzeige und Edge-&-Leaks-Bedingungen in Evidence.
5. **Rechtstexte (Entwurf):** Datenschutz (Art. 9), AGB/Widerruf für Evidence Fit, Impressum.
   **Muss juristisch geprüft werden.**
6. **Tests & Prüfung.**

## Was nur Jason machen kann
- DNS: `fit.evidencetrading.com` bei Cloudflare auf das Hosting zeigen lassen.
- Stripe: Produkt „Evidence Fit“ mit zwei Preisen (4,99 EUR / 5,59 USD) anlegen, Webhook eintragen.
- Service-Konto-Schlüssel des Evidence-Firebase als Secret in den Fit-Worker (nie in den Chat).
- Firestore-Regeln in **beiden** Projekten veröffentlichen.
- Rechtstexte prüfen lassen.

## Admin-Seite (24.10.2026)
`admin.html` (fit.evidencetrading.com/admin.html, noindex): alle Nutzer mit Abo-/Evidence-Status,
Aktivität und Datenumfang; Suche, Filter, Sortierung, CSV. Pro Nutzer: Profil & Ziele bearbeiten,
Mahlzeiten-Tage/Trainings löschen (mit Tombstones, damit der Abgleich sie nicht zurückholt),
kompletter JSON-Stand, Abo schenken/entziehen, Evidence trennen, Login sperren, DSGVO-Export, Löschen.
Läuft komplett über `worker/admin.js` (`/api/admin/*`); Zugang nur für `ADMIN_EMAILS`
(Standard jasonziborius@gmail.com). Das Fit-Service-Konto braucht dafür zusätzlich die Rolle
**Firebase Authentication Admin** (Nutzerliste, Sperren, Löschen).
