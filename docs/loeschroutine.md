# Automatische Löschroutine — Einrichtung & Kontrolle

Setzt DSGVO Art. 5 Abs. 1 lit. e (Speicherbegrenzung) technisch um und protokolliert
jeden Lauf für die Rechenschaftspflicht (Art. 5 Abs. 2).

**Migration:** `supabase/migrations/20260812120000_add_data_retention.sql`

## Was gelöscht wird

| Tabelle | Frist | Warum personenbezogen |
|---|---|---|
| `leads` | 6 Monate | Name, E-Mail, Telefon, Anliegen |
| `conversation_analytics` | 12 Monate | enthält `first_user_message` |
| `unanswered_questions` | 12 Monate | enthält Nutzerfragen im Klartext |

Der Job läuft täglich um **03:15 UTC** über `pg_cron` — in der Datenbank selbst, also
unabhängig davon, ob gerade ein Deployment läuft. Jeder Lauf schreibt eine Zeile mit
Zählwerten (keine personenbezogenen Daten) nach `retention_log`.

## Einspielen (einmalig, ca. 1 Minute)

1. Supabase-Dashboard → Projekt → **SQL Editor** → **New query**
2. Inhalt der Migrationsdatei einfügen und **Run** — der Editor meldet Fehler sofort
3. Falls `create extension pg_cron` abgelehnt wird: **Database → Extensions → pg_cron**
   aktivieren, dann Schritt 2 wiederholen

Die Migration ist **idempotent** — mehrfaches Ausführen ist gefahrlos, der Cron-Job wird
vorher entfernt und neu angelegt.

## Kontrolle

```sql
-- Ist der Job registriert?
select jobname, schedule, active from cron.job where jobname = 'purge-expired-data';

-- Liefen die letzten Läufe?
select * from public.retention_log order by run_at desc limit 10;

-- Einmalig manuell auslösen (z. B. zum Test)
select public.purge_expired_data();
```

Beim ersten Lauf werden voraussichtlich **0 Zeilen** gelöscht: Das System ist seit
Mai 2026 produktiv, es existieren noch keine Daten jenseits der Fristen. Ein Eintrag in
`retention_log` mit lauter Nullen ist also der erwartete Beleg dafür, dass die Routine
arbeitet.

## Fristen ändern

Die drei `interval`-Werte in `purge_expired_data()` anpassen, Migration erneut einspielen
— **und den Textbaustein mitziehen** (`docs/datenschutz-textbaustein.md`). Datenschutz-
erklärung und tatsächliches Verhalten müssen übereinstimmen; eine zugesagte, aber nicht
stattfindende Löschung ist ein eigenständiger Verstoß.
