# Sicherheitsmaßnahmen — technische Umsetzung der AVV-Zusagen

Stand: 14.10.2026 · Gilt für jede Installation des Kundenbots. Die TOM-Anlage des AVV
darf diese Punkte erst **ohne Vorbehalt** zusagen, wenn die Einrichtung unten für das
jeweilige Projekt erledigt und geprüft ist.

## Was technisch umgesetzt ist

| Maßnahme | Umsetzung | Wo im Code |
|---|---|---|
| Rate Limiting öffentlicher Endpunkte | Chat 20/min, Lead-Erfassung 5/10 min (auch über den Chat), Begrüßung 30/min — je IP. Zähler in Supabase, gespeichert nur als HMAC der IP, Löschung nach ≤ 1 h per pg_cron | `lib/security/rate-limit.ts`, Migration `20261014120000_security_hardening.sql` |
| Verschlüsselung der Integrations-Zugangsdaten | AES-256-GCM auf Anwendungsebene, gebunden an Tenant/Integration/Feld. Schlüssel **nur** als Vercel-Env `INTEGRATIONS_ENCRYPTION_KEY` — Supabase erhält ihn nie | `lib/security/secrets.ts`, `lib/integrations/store.ts` |
| Keine Tokens im Browser | Editor lädt über `GET /api/settings/integrations` (nur „ist gesetzt"); Client-Leserecht auf `tenant_integrations` entfernt | `app/api/settings/integrations/route.ts` |
| Keine Klartext-Altspalten | `slack_webhook_url`, `hubspot_api_key`, `pipedrive_api_key` aus `tenant_settings` entfernt (vorher nach `tenant_integrations` übernommen) | Migration |
| Kein unauthentifizierter Integrations-Endpunkt | `/api/integrations/notify` entfernt; Benachrichtigung läuft im Server-Prozess nach der Antwort (`after()`) | `lib/integrations/notify.ts`, `lib/leads.ts` |
| Keine internen Daten nach außen | `?debug=1` entfernt; Fehlerantworten ohne interne Meldungen; Test-Route `/api/ask` entfernt | `app/api/chat/route.ts` |
| SSRF-Schutz | Slack-Webhook nur `https://hooks.slack.com/…` | `lib/integrations/slack.ts` |
| Tokens nicht in URLs | Pipedrive-Token im Header statt `?api_token=` | `lib/integrations/pipedrive.ts` |
| Eingabevalidierung | Zod-Schema mit Längengrenzen für `/api/leads`; Chat-Nachricht ≤ 2000 Zeichen | `app/api/leads/route.ts` |
| Laden erst nach Klick | `widget.js` legt das iframe erst beim Klick auf die Bubble an | `public/widget.js` |
| KI-Hinweis (KI-VO Art. 50) | Begrüßung beginnt immer mit „Hier antwortet ein KI-Assistent." — kundenseitig nicht entfernbar; Bubble-`aria-label` „Chat mit KI-Assistent öffnen" | `lib/ai-notice.ts`, `public/widget.js` |
| Verarbeitungsort | Vercel-Funktionen in **fra1 (Frankfurt)**; Supabase-Datenbank in **eu-west-1 (Irland)**; KI bei IONOS in Deutschland | `vercel.json` |
| Löschroutine | unverändert, siehe `docs/loeschroutine.md` | — |

## Einrichtung je Projekt (Reihenfolge einhalten)

1. **Env-Variablen in Vercel** (Production + Preview), danach neu deployen:
   ```bash
   openssl rand -base64 32
   ```
   - `INTEGRATIONS_ENCRYPTION_KEY` = Ausgabe des Befehls (32 Byte, base64). **Im
     Passwortmanager sichern** — ohne ihn sind gespeicherte Integrations-Tokens verloren.
   - `RATE_LIMIT_SECRET` = zweiter, unabhängiger Wert aus demselben Befehl.
   - `CRON_SECRET` = dritter, unabhängiger Wert. Ohne ihn lehnt der Monatsreport-Cron
     jeden Aufruf ab (auch den von Vercel).
   - `NEXT_PUBLIC_BASE_URL` braucht die Lead-Erfassung nicht mehr (der Chat ruft sie
     direkt auf); der Monatsreport nutzt die Variable weiterhin.
2. **Migrationen** im Supabase SQL Editor ausführen (alle idempotent):
   - `supabase/migrations/20261014120000_security_hardening.sql`. Falls `pg_cron`
     fehlt: Database → Extensions → pg_cron aktivieren.
   - `supabase/migrations/20261028120000_core_tenant_rls.sql` — RLS und Policies für
     Leads, Wissensbasis, Einstellungen und Rollen. **Ohne diese Migration liest jeder
     mit dem öffentlichen Key alle Leads aller Kunden.** (Bis 28.10.2026 hieß die Datei
     `supabase/rls-policies.sql`; wo sie schon lief, schadet die erneute Ausführung nicht.)
   - `supabase/migrations/20261028130000_tenant_settings_admin_write.sql` — Kunden lesen
     ihre Einstellungen nur noch; `lead_email`, `lead_enabled` und Bot-Texte ändert nur
     der super_admin.
   - `supabase/migrations/20261028140000_session_max_age.sql` — Datenbank lässt Browser-
     Sitzungen höchstens 12 Stunden nach der Anmeldung zu (gilt auch im Free-Plan).
3. **Bestand verschlüsseln** — lokal mit denselben Werten in `.env.local`
   (`vercel env pull .env.local` oder Schlüssel aus dem Passwortmanager eintragen):
   ```bash
   node scripts/encrypt-integration-secrets.ts
   ```
   ```bash
   node scripts/encrypt-integration-secrets.ts --write
   ```
   Der erste Aufruf zeigt nur an, was offen ist; der zweite schreibt. Danach erneut ohne
   `--write` ausführen — erwartet: „Keine Klartext-Tokens gefunden".
4. **Sitzungsdauer serverseitig:** Jede Sitzung endet spätestens 12 Stunden nach der
   Anmeldung — durchgesetzt von API (`lib/auth-server.ts`), Datenbank (Migration
   `20261028140000`) und Dashboard (`lib/session-policy.ts`). Die 60-Minuten-Regel bei
   Inaktivität wirkt weiterhin nur im Browser. Im Supabase-Pro-Plan zusätzlich
   Authentication → Sessions → „Inactivity timeout“ auf 1 Stunde setzen; im Free-Plan
   gibt es die Einstellung nicht (Restrisiko: ein kopierter Token bleibt bis zu 12 h nutzbar).
5. **Region prüfen:** Vercel → Project → Settings → Functions → Region muss `fra1`
   zeigen (kommt aus `vercel.json`). Supabase → Project Settings → General → Region
   notieren (am 14.10.2026 technisch ermittelt: eu-west-1, Irland).
6. **Kontrolle nach dem Deploy:**
   - Kundenseite öffnen, DevTools → Netzwerk: vor dem Klick auf die Bubble **kein**
     Request auf `/embed/…`.
   - Erste Chat-Nachricht beginnt mit „Hier antwortet ein KI-Assistent."
   - `curl -i "https://<bot-domain>/api/chat?debug=1" -X POST -H 'content-type: application/json' -d '{"slug":"<slug>","message":"Hallo"}'`
     → normale Antwort, **keine** Felder `tenant`/`settings`/`matches`.
   - `curl -i -X POST https://<bot-domain>/api/integrations/notify` → 404.
   - `curl -s "https://<projekt>.supabase.co/rest/v1/leads?select=id&limit=1" -H "apikey: <publishable-key>"`
     → `[]` (ohne Login keine Leads).
   - Supabase: `select jobname, schedule from cron.job where jobname = 'purge-rate-limits';`

## widget.js von der Kundendomain ausliefern (empfohlen)

Das Skript für die Bubble lädt standardmäßig vom Bot-Server — damit erreicht die IP des
Besuchers Vercel schon beim Seitenaufruf, wenn auch ohne Chat-Inhalt. Für „vor dem Klick
keine Verbindung" die Datei `public/widget.js` beim Kunden selbst hosten und
`data-origin` auf die Bot-Domain setzen:

```html
<script src="/widget.js" data-slug="<slug>" data-origin="https://<bot-domain>"></script>
```

Bei Updates von `widget.js` die Kundenkopie mitziehen.

## Was bewusst nicht verschlüsselt ist

Alles, worauf die Datenbank arbeiten muss: Leads (Name, E-Mail, Telefon, Anliegen),
Statistiken und Wissensbasis liegen im Klartext in Supabase (Schutz durch RLS,
EU-Region, Löschfristen). Das ist die Zweiteilung aus dem TIA: verschlüsselte
Sonderfelder (Zugangsdaten) vs. Klartext-Felder mit Risikoabwägung.
