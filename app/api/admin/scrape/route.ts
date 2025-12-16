import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { supaAdmin } from "@/lib/db";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

function normalizeUrl(input: string): string {
  try {
    const url = new URL(input);
    return url.toString();
  } catch {
    // Wenn kein Protokoll, https dazunehmen
    return new URL(`https://${input}`).toString();
  }
}

// Sehr einfache Text-Extraktion aus HTML
function extractText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Links der gleichen Domain sammeln (eine Ebene tief)
function extractLinks(html: string, baseUrl: URL): string[] {
  const hrefs: string[] = [];
  const linkRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>/gi;
  let match: RegExpExecArray | null;

  while ((match = linkRegex.exec(html)) !== null) {
    const href = match[1];
    if (!href) continue;
    // Ignoriere Anker & Mailto etc.
    if (href.startsWith("#")) continue;
    if (href.startsWith("mailto:") || href.startsWith("tel:")) continue;

    try {
      const url = new URL(href, baseUrl);
      // Nur gleiche Origin
      if (url.origin !== baseUrl.origin) continue;
      hrefs.push(url.toString());
    } catch {
      // ignore
    }
  }

  // Duplikate entfernen
  return Array.from(new Set(hrefs));
}

async function getTenantBySlug(slug: string) {
  const { data, error } = await supaAdmin
    .from("tenants")
    .select("*")
    .eq("slug", slug)
    .single();

  if (error || !data) {
    console.error("getTenantBySlug error:", error);
    throw new Error("Tenant not found");
  }

  return data as { id: string; name: string; slug: string };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const password = body.password as string | undefined;
    const slug = body.slug as string | undefined;
    const targetUrl = body.url as string | undefined;

    if (!password || password !== process.env.ADMIN_PASSWORD) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    if (!slug || !targetUrl) {
      return NextResponse.json(
        { ok: false, error: "slug and url are required" },
        { status: 400 }
      );
    }

    const tenant = await getTenantBySlug(slug);
    const normalized = normalizeUrl(targetUrl);
    const base = new URL(normalized);

    // 1) vorhandene Knowledge + Embeddings für diesen Tenant löschen
    await supaAdmin.from("embeddings").delete().eq("tenant_id", tenant.id);
    await supaAdmin.from("knowledge_items").delete().eq("tenant_id", tenant.id);

    const visited = new Set<string>();
    const queue: string[] = [base.toString()];
    const maxPages = 8; // Light-Scan Limit

    const createdItems: { url: string; title: string }[] = [];

    while (queue.length > 0 && visited.size < maxPages) {
      const current = queue.shift()!;
      if (visited.has(current)) continue;
      visited.add(current);

      let res: Response;
      try {
        res = await fetch(current);
      } catch (e) {
        console.warn("Fetch error for", current, e);
        continue;
      }

      if (!res.ok) {
        console.warn("Non-200 for", current, res.status);
        continue;
      }

      const html = await res.text();
      const text = extractText(html);

      if (!text || text.length < 200) {
        // zu wenig Inhalt, überspringen
        continue;
      }

      // Titel aus URL ableiten
      let title = "Website";
      if (current !== base.toString()) {
        const path = new URL(current).pathname.replace(/\/+$/, "");
        title = path || "/";
      }

      // Knowledge Item speichern
      const { data: kiData, error: kiError } = await supaAdmin
        .from("knowledge_items")
        .insert({
          tenant_id: tenant.id,
          title,
          content: text.slice(0, 12000), // Safety-Limit
          url: current,
        })
        .select("id")
        .single();

      if (kiError) {
        console.error("Error inserting knowledge_item:", kiError);
        continue;
      }

      // Embedding erzeugen
      try {
        const emb = await openai.embeddings.create({
          model: "text-embedding-3-small",
          input: text.slice(0, 8000),
        });

        const embedding = emb.data[0].embedding;

        const { error: embError } = await supaAdmin
          .from("embeddings")
          .insert({
            tenant_id: tenant.id,
            content: text.slice(0, 8000),
            embedding,
          });

        if (embError) {
          console.error("Error inserting embedding:", embError);
        }
      } catch (e) {
        console.error("Error creating embedding:", e);
      }

      createdItems.push({ url: current, title });

      // Links der ersten Seite(n) nur aus der Startseite sammeln
      if (current === base.toString()) {
        const links = extractLinks(html, base);
        // Wir hängen maximal 10 weitere Seiten an
        for (const l of links.slice(0, 10)) {
          if (!visited.has(l)) queue.push(l);
        }
      }
    }

    return NextResponse.json({
      ok: true,
      tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug },
      pages_processed: createdItems.length,
      items: createdItems,
    });
  } catch (e: any) {
    console.error("Admin scrape error:", e);
    return NextResponse.json(
      { ok: false, error: e?.message ?? "server error" },
      { status: 500 }
    );
  }
}
