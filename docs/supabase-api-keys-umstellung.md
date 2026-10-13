# Runbook: Supabase-API-Keys umstellen (Legacy-JWT → Publishable/Secret)

Stand: 13.10.2026 · Projekt: kundenbot-template (Vercel + Supabase)

## Warum

- Supabase schaltet die Legacy-Keys `anon` und `service_role` (beide `eyJ…`, JWTs)
  **Ende 2026** ab; ein genaues Datum ist noch nicht angekündigt
  ([Doku API-Keys](https://supabase.com/docs/guides/api/api-keys),
  [Changelog](https://supabase.com/changelog/29260-upcoming-changes-to-supabase-api-keys)).
  Danach bricht jede App, die noch Legacy-Keys nutzt.
- Der Legacy-`service_role` lässt sich **nicht einzeln rotieren**: Nur ein Wechsel des
  JWT-Secrets würde ihn ungültig machen — und dabei auch `anon` entwerten und alle
  eingeloggten Dashboard-Nutzer abmelden. Die Umstellung ist daher zugleich die saubere
  Rotation des Server-Keys.
- Vercel markiert `SUPABASE_SERVICE_ROLE` als „Needs Attention", weil er als nicht
  sensible (im Dashboard lesbare) Variable gespeichert ist. Der neue Key kommt direkt als
  **Sensitive** Variable hinein.

**Zeitpunkt:** erst **nach** abgeschlossener IONOS-Umstellung
(`docs/ionos-umstellung.md`) — nie beides im selben Deployment, sonst ist bei einem
Fehler unklar, welche Änderung ihn verursacht.

## Was im Code passiert (bereits umgesetzt)

| Datei | Liest (Reihenfolge) | Verwendet von |
|---|---|---|
| `lib/db.ts` | `SUPABASE_SECRET_KEY` → Fallback `SUPABASE_SERVICE_ROLE` (+ ältere Aliasse) | alle API-Routen, `lib/auth-server.ts`, `scripts/ingest.ts`, `scripts/seed-demo-data.ts`, `scripts/reembed.ts` |
| `lib/supabase.ts` | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` → Fallback `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Login, Passwort-Reset, Dashboard, Admin (Browser) |

- **Neue Namen haben Vorrang, alte bleiben Fallback.** Dadurch läuft die App vor, während
  und nach der Umstellung ohne Ausfall, und der Rollback ist „neue Variablen löschen".
- **Schutzschranken:** `lib/db.ts` bricht ab, wenn im Secret-Slot ein Publishable Key
  steckt; `lib/supabase.ts` bricht ab (Build scheitert), wenn ein `sb_secret_…` in die
  öffentliche `NEXT_PUBLIC_`-Variable gerät — der Key würde sonst im JS-Bundle landen.
- **Nicht betroffen:**
  - Die Löschroutine (`pg_cron`, Migration `20260812120000_add_data_retention.sql`)
    läuft als SQL **in** der Datenbank und nutzt keinen API-Key.
  - Es gibt keine Edge Functions, keine Database Webhooks/`pg_net`-Aufrufe.
  - Kein Code dekodiert einen Key als JWT oder wertet dessen `role`-Claim aus.
  - Der Vercel-Cron (`/api/cron/monthly-report`) authentifiziert sich per `CRON_SECRET`
    und nutzt intern `lib/db.ts` — bekommt den neuen Key also automatisch.
- **Verträglichkeit geprüft:** supabase-js 2.80 sendet den Key als `apikey`-Header
  (plus `Authorization: Bearer <key>`, solange kein Nutzer eingeloggt ist — das
  akzeptiert Supabase zur Migrationskompatibilität). Laut Supabase funktioniert jede
  Version der Client-Libraries mit den neuen Werten ohne Code-Änderung.
- **RLS / `auth.uid()`:** unverändert. Der Publishable Key ersetzt nur den App-Schlüssel;
  eingeloggte Nutzer schicken weiterhin ihr eigenes Access-Token (JWT), daraus liest
  Postgres `auth.uid()`. Auch `supaAdmin.auth.getUser(token)` und
  `auth.admin.createUser` funktionieren mit dem Secret Key.
- **Server-only:** Ein Secret Key wird von Supabase im Browser abgelehnt (HTTP 401,
  Erkennung am User-Agent). Er gehört nur in Server-Variablen ohne `NEXT_PUBLIC_`.

### Variablen-Übersicht

| Variable (Vercel) | Inhalt | Sensitive? | Nach der Umstellung |
|---|---|---|---|
| `SUPABASE_SECRET_KEY` | `sb_secret_…` | **ja** | bleibt |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_…` | nein nötig (ist öffentlich) | bleibt |
| `SUPABASE_SERVICE_ROLE` | Legacy `eyJ…` | — | löschen (Schritt 8) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Legacy `eyJ…` | — | löschen (Schritt 8) |
| `SUPABASE_ANON_KEY` | Legacy `eyJ…` | — | löschen — **wird vom Code nicht gelesen** (per grep geprüft) |
| `SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL` | Projekt-URL | nein | bleiben unverändert |

## Ablauf

> Key-Werte nie in Chats, Tickets, Commits oder Logs kopieren — nur zwischen
> Supabase-Dashboard und Vercel-/`.env.local`-Feld.

### 0 · Vorbereitung (5 Min.)

- [ ] IONOS-Umstellung ist live und stabil.
- [ ] Der Code-Stand mit den neuen Variablennamen (`lib/db.ts`, `lib/supabase.ts`) ist
      auf `main` gemergt und deployed. Das Deployment ändert noch nichts am Verhalten
      (Fallback auf die alten Variablen).
- [ ] Prüfen, ob **andere** Systeme dasselbe Supabase-Projekt mit Legacy-Keys ansprechen
      (andere Vercel-Projekte, n8n/Make, lokale Skripte auf anderen Rechnern). Supabase
      zeigt dafür **keine** automatische Nutzungsanzeige — das ist eine manuelle Liste.

### 1 · Neue Keys in Supabase anlegen

Supabase-Dashboard → Projekt → **Settings → API Keys** → Reiter
**„Publishable and secret API keys"**.

1. Gibt es noch keine Keys: den Button zum Erzeugen neuer API-Keys klicken (Beschriftung kann je nach Dashboard-Stand leicht abweichen). Damit entsteht ein Publishable Key
   (`default`) und ein Secret Key. Die Legacy-Keys bleiben dabei aktiv.
2. Empfohlen: **je Umgebung einen eigenen Secret Key** anlegen („Add new secret key"),
   z. B. `vercel-production`, `vercel-preview`, `local-dev`. Dann lässt sich später jeder
   einzeln widerrufen, ohne die anderen anzufassen.

### 2 · Vercel: neue Variablen anlegen

Vercel → Projekt **kundenbot-template** → **Settings → Environment Variables** →
„Add New".

1. `SUPABASE_SECRET_KEY`
   - Wert: Secret Key `vercel-production`, Environment **Production**, **Sensitive an**.
   - Nochmals anlegen mit Secret Key `vercel-preview`, Environment **Preview**,
     **Sensitive an**.
2. `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - Wert: Publishable Key, Environments **Production + Preview**.
   - Sensitive ist hier nicht nötig (der Key steht ohnehin im Browser-Bundle); schadet
     aber nicht.

Hinweise zu Sensitive-Variablen: Sie sind nach dem Speichern nicht mehr lesbar (auch
nicht für dich), stehen **nicht** für die Environment „Development" zur Verfügung und
kommen nicht per `vercel env pull` herunter. Eine bestehende Variable lässt sich nicht
nachträglich auf Sensitive umstellen — dafür löschen und neu anlegen. Durch die neuen
Namen entfällt dieses Löschen hier; die alten Variablen werden erst in Schritt 8
entfernt.

### 3 · Lokale `.env.local` ergänzen

Im Haupt-Checkout `kundenbot-template/.env.local` zwei Zeilen **ergänzen** (alte Zeilen
vorerst stehen lassen):

```
SUPABASE_SECRET_KEY=<Secret Key local-dev>
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<Publishable Key>
```

Lokal gegenprüfen (gibt nur `true`/`false` aus, keinen Wert):

```bash
node -e "require('fs').readFileSync('.env.local','utf8').split('\n').forEach(l=>{const[k,v]=l.split('=');if(/SUPABASE_(SECRET|PUBLISHABLE)/.test(k))console.log(k,v?.startsWith('sb_'))})"
```

### 4 · Redeploy

Vercel → **Deployments** → letztes Production-Deployment → „…" → **Redeploy**
(ohne Build-Cache). Nötig, weil `NEXT_PUBLIC_`-Werte beim Build ins Bundle geschrieben
werden.

### 5 · Testen (Production)

Alles muss grün sein, bevor es weitergeht.

| # | Test | Erwartung | Prüft |
|---|---|---|---|
| 1 | `https://<prod-domain>/api/ping` aufrufen | `{"ok":true}` | Secret Key, Server |
| 2 | Browser-DevTools → Network beim Laden des Logins | Requests an `*.supabase.co` tragen `apikey: sb_publishable_…` | Publishable Key ist im Bundle |
| 3 | Dashboard-Login mit Kunden-Account | Login klappt, Übersicht/Leads/Wissen laden mit Daten | Auth + RLS (`auth.uid()`) |
| 4 | Login als super_admin → `/admin` | Tenant-Liste lädt | RLS + `is_super_admin()` |
| 5 | Widget auf einer Demo-/Kundenseite öffnen, Frage zum Wissen stellen | Antwort mit Wissen aus der DB | `match_embeddings`-RPC via Secret Key |
| 6 | Im Widget einen Test-Lead absenden | Lead erscheint im Dashboard, Benachrichtigungs-Mail kommt an | Lead-Flow, Schreiben |
| 7 | Im Dashboard einen Wissenseintrag anlegen und wieder löschen | beides klappt | API-Route mit `getUser(token)` |
| 8 | Vercel → **Logs**, Filter `ENV ERROR` und Status 401/500 | keine Treffer | — |
| 9 | Supabase SQL-Editor: `select * from public.retention_log order by run_at desc limit 3;` | Lauf von heute 03:15 UTC vorhanden | pg_cron (unabhängig vom Key, nur zur Sicherheit) |

Optional Cron-Route: Der Monatsbericht verschickt derzeit **keine** Mails (Resend-Block
auskommentiert — vor dem Test in `app/api/cron/monthly-report/route.ts` prüfen!). Dann
lässt er sich gefahrlos manuell auslösen; `CRON_SECRET` vorher in der eigenen Shell als
Variable setzen, nicht in den Befehl tippen:

```bash
curl -s -H "Authorization: Bearer $CRON_SECRET" https://<prod-domain>/api/cron/monthly-report
```

Lokal (nach Schritt 3) zusätzlich `npm run dev` und Test 1–3 gegen `localhost:3000`.

### 6 · Legacy-Keys deaktivieren

Erst wenn Schritt 5 komplett grün ist:

Supabase → **Settings → API Keys** → Reiter **„Legacy API Keys"** →
die Legacy-Keys **deaktivieren** (Supabase fragt zur Bestätigung nach).

Danach sofort Test 1, 3 und 5 wiederholen. Ab jetzt sind die alten `eyJ…`-Werte in
Vercel und `.env.local` wertlos — auch der von Vercel bemängelte `SUPABASE_SERVICE_ROLE`.

### 7 · Beobachten (ca. 1 Woche)

Vercel-Logs und Kundenrückmeldungen im Blick behalten. Taucht ein vergessener Client auf,
greift der Rollback.

### 8 · Aufräumen

- Vercel: `SUPABASE_SERVICE_ROLE`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` und `SUPABASE_ANON_KEY`
  löschen → Redeploy → Test 1 + 3.
- `.env.local`: die drei alten Zeilen löschen.
- Optional später (eigene Aufgabe): die Legacy-Fallbacks aus `lib/db.ts` und
  `lib/supabase.ts` entfernen, wenn keine Bestandsinstallation sie mehr braucht.

## Rollback

| Situation | Vorgehen |
|---|---|
| Fehler in Schritt 5 (Legacy noch aktiv) | In Vercel `SUPABASE_SECRET_KEY` und `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` löschen → Redeploy. Die App fällt auf die alten Variablen zurück. |
| Fehler nach Schritt 6 (Legacy deaktiviert) | Supabase → Legacy API Keys → **wieder aktivieren** (umkehrbar, Werte bleiben gleich). Liegt der Fehler an den neuen Keys, zusätzlich wie oben die neuen Variablen löschen → Redeploy. Setzt voraus, dass die alten Vercel-Variablen noch existieren — deshalb Schritt 8 erst nach der Beobachtungsphase. |
| Neuer Secret Key geleakt | Supabase → betroffenen Secret Key löschen, neuen anlegen, in Vercel ersetzen (Sensitive), Redeploy. Andere Umgebungen bleiben unberührt. |

## Bestandsinstallationen / weitere Kundenprojekte

Jede andere Instanz dieses Templates mit eigenem Supabase-Projekt braucht denselben
Ablauf vor Ende 2026. Der Code ist abwärtskompatibel: Ein Deploy des neuen Stands ändert
nichts, solange dort nur die alten Variablen gesetzt sind.
