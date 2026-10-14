# Umstellung OpenAI → IONOS AI Model Hub

Stand: 12.10.2026 · Ziel: KI-Verarbeitung (Chat + Wissenssuche) in deutschen
Rechenzentren (IONOS, Berlin). Vercel und Supabase bleiben unverändert im Stack —
der Kunden-Claim lautet daher „KI-Verarbeitung in Deutschland", nicht „alles in
Deutschland".

## Überblick

Der Anbieter ist per Umgebungsvariablen austauschbar (`lib/llm.ts`). Chat-Modell
und Embedding-Modell werden getrennt umgestellt:

- **Chat** ist zustandslos — Umstellung = Env-Wert ändern + Redeploy.
- **Embeddings** sind in der Datenbank gespeichert und müssen zum Modell der
  Suchanfrage passen. Deshalb Umstellung in zwei Phasen ohne Ausfallzeit.

| Variable | Wert IONOS |
|---|---|
| `LLM_BASE_URL` | `https://openai.inference.de-txl.ionos.com/v1` |
| `LLM_API_KEY` | IONOS-Token (DCD → Management → Token Manager; lange TTL, Ablaufdatum notieren!) |
| `LLM_CHAT_MODEL` | `mistralai/Mistral-Small-24B-Instruct` (Eval 13.10.2026: 3× 8/8, Median ~1,25 s) |
| `LLM_EMBEDDING_MODEL` | `BAAI/bge-m3` (1024 Dim.; Schwellen kalibriert in `lib/llm.ts`) |

Achtung: Mit gesetzter `LLM_BASE_URL` ist `LLM_API_KEY` Pflicht — fehlt er, bricht
der Client ab, statt `OPENAI_API_KEY` an den Fremdhost zu senden.

## Schritt 0 — Modelltest

```bash
node --experimental-strip-types scripts/llm-eval.ts <chat-modell-id>
```

Vergleichswert gpt-4o-mini: 8/8 bestanden, Median ~1,1 s. Ein IONOS-Modell
muss ebenfalls 8/8 schaffen; zusätzlich die Antworttexte stichprobenartig auf
Deutsch, Sie-Form und Tonalität lesen.

## Schritt 1 — Neue Spalte anlegen und befüllen (Live-Bot unberührt)

1. Migration `supabase/migrations/20261012120000_add_embedding_bge_m3.sql` im
   Supabase SQL Editor ausführen. Ergänzt nur die Spalte `embedding_bge` und
   versioniert `match_embeddings` (Definition unverändert).
2. Lokal in `.env.local` `LLM_EMBEDDING_MODEL` setzen, dann:
   ```bash
   node --experimental-strip-types scripts/reembed.ts
   ```
   Bestand am 12.10.2026: 16 Zeilen / 2 Tenants → Sekunden, < 1 Cent.

## Schritt 2 — Schwellenwerte kalibrieren (Pflicht vor dem Tausch)

Die RAG-Schwellen in `app/api/chat/route.ts` (`MIN_SIMILARITY` 0.30,
`KB_GOOD_ENOUGH` 0.32, `MID_CONF_SIM` 0.35, `HIGH_CONF_SIM` 0.45 und die feste
0.38) sind auf die Ähnlichkeitswerte von OpenAI `text-embedding-3-small`
abgestimmt. Andere Modelle liefern andere Wertebereiche (BGE M3 erfahrungsgemäß
höhere). Ohne Neukalibrierung hält der Bot schwache Treffer für sichere — und
antwortet, wo er an das Team weiterleiten sollte.

Vorgehen: typische Fragen je Tenant (passend, halb passend, unpassend) gegen beide
Spalten laufen lassen, die besten Ähnlichkeitswerte vergleichen und die
Schwellen so setzen, dass dieselben Fragen in dieselbe Stufe fallen.

## Schritt 3 — Umschalten

1. `scripts/reembed.ts` erneut laufen lassen (erfasst Einträge, die seit Schritt 1
   über das Dashboard dazukamen).
2. Im Supabase SQL Editor, in einer Transaktion:
   ```sql
   begin;
   alter table public.embeddings rename column embedding to embedding_openai;
   alter table public.embeddings alter column embedding_openai drop not null;
   alter table public.embeddings rename column embedding_bge to embedding;
   commit;
   ```
   Die alte Spalte bleibt als Rückweg erhalten. Ein Index ist bei der aktuellen
   Datenmenge nicht nötig (exakte Suche ist schneller und genauer).
3. **Unmittelbar danach** in Vercel alle vier `LLM_*`-Variablen setzen und neu
   deployen. Zwischen Schritt 2 und dem fertigen Deploy schlägt die Wissenssuche
   fehl; die Route fängt das ab und bietet die Weiterleitung ans Team an —
   kein Absturz, aber das Fenster kurz halten.
4. Nach dem Deploy: Testfrage je Tenant im Live-Widget, Vercel-Logs auf
   `match_embeddings error` / `[RAG] error` prüfen.

## Rückweg (falls nötig)

```sql
begin;
alter table public.embeddings rename column embedding to embedding_bge;
alter table public.embeddings rename column embedding_openai to embedding;
commit;
```
Danach die `LLM_*`-Variablen in Vercel entfernen und neu deployen. Achtung:
Einträge, die nach dem Umschalten angelegt wurden, haben keinen OpenAI-Vektor
und müssen dann neu eingelesen werden.

## Schritt 4 — Aufräumen (nach ca. 2 Wochen stabilem Betrieb)

```sql
alter table public.embeddings drop column embedding_openai;
```
Als Migration ins Repo übernehmen.

## Papierkram (vor dem Kunden-Claim)

- [ ] AVV mit IONOS abschließen, datierte PDF-Kopie ablegen
- [x] `docs/datenschutz-textbaustein.md`: OpenAI als Empfänger durch IONOS ersetzen,
      Drittlandtransfer für die KI-Verarbeitung streichen (Vercel/Supabase bleiben)
- [ ] OpenAI-Key nach erfolgreicher Umstellung widerrufen, sobald nichts mehr darauf zugreift
- [ ] Token-Ablaufdatum im Kalender eintragen (abgelaufenes Token = Bot antwortet nicht)
