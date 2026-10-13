-- Phase 1 der Umstellung auf IONOS-Embeddings (BGE M3, 1024 Dimensionen).
-- Nicht-destruktiv: Die neue Spalte wird nur ergänzt und per scripts/reembed.ts
-- befüllt. Der Live-Bot sucht weiter über `embedding` (OpenAI, 1536 Dim.).
-- Der Spaltentausch (Phase 2) steht in docs/ionos-umstellung.md.

alter table public.embeddings
  add column if not exists embedding_bge vector(1024);

-- match_embeddings war bisher nur direkt in Supabase angelegt und nicht
-- versioniert. Definition 1:1 übernommen (Stand 12.10.2026) — der Parameter
-- `vector` ohne Dimension funktioniert mit 1536 wie mit 1024 Dimensionen,
-- solange Anfrage- und Spaltenvektor vom selben Modell stammen.
create or replace function public.match_embeddings(
  query_embedding vector,
  match_count integer,
  p_tenant_id uuid
)
returns table(id uuid, content text, similarity double precision)
language plpgsql
as $function$
begin
  return query
  select
    e.id,
    e.content,
    1 - (e.embedding <=> query_embedding) as similarity
  from embeddings e
  where e.tenant_id = p_tenant_id
  order by e.embedding <=> query_embedding
  limit match_count;
end;
$function$;
