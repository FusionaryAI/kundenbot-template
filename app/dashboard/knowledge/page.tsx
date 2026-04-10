"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

type KnowledgeItem = {
  id: string;
  title: string | null;
  content: string;
  source: string | null;
  created_at: string;
};

type Tenant = {
  id: string;
  name: string;
  slug: string;
};

export default function CustomerKnowledgePage() {
  const router = useRouter();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [items, setItems] = useState<KnowledgeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [adding, setAdding] = useState(false);
  const [addMsg, setAddMsg] = useState("");

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }

      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role, tenant_id")
        .eq("user_id", user.id)
        .single();

      if (!roleData) { router.push("/login"); return; }

      let tenantId = roleData.tenant_id;

      if (roleData.role === "super_admin") {
        const { data: firstTenant } = await supabase
          .from("tenants")
          .select("*")
          .limit(1)
          .single();
        if (firstTenant) {
          setTenant(firstTenant);
          tenantId = firstTenant.id;
        }
      } else {
        const { data: tenantData } = await supabase
          .from("tenants")
          .select("*")
          .eq("id", tenantId)
          .single();
        if (tenantData) setTenant(tenantData);
      }

      if (tenantId) {
        const { data: itemsData } = await supabase
          .from("knowledge_items")
          .select("id, title, content, source, created_at")
          .eq("tenant_id", tenantId)
          .order("created_at", { ascending: false });
        setItems(itemsData ?? []);
      }

      setLoading(false);
    }
    load();
  }, [router]);

  async function handleAdd() {
    if (!tenant || !newContent.trim()) return;
    setAdding(true);
    setAddMsg("");

    const res = await fetch("/api/knowledge/add", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tenant_id: tenant.id,
        title: newTitle.trim() || null,
        content: newContent.trim(),
      }),
    });

    const data = await res.json();
    setAdding(false);

    if (data.ok) {
      setAddMsg("Eintrag erfolgreich hinzugefügt!");
      setNewTitle("");
      setNewContent("");
      const { data: itemsData } = await supabase
        .from("knowledge_items")
        .select("id, title, content, source, created_at")
        .eq("tenant_id", tenant.id)
        .order("created_at", { ascending: false });
      setItems(itemsData ?? []);
    } else {
      setAddMsg(`Fehler: ${data.error}`);
    }

    setTimeout(() => setAddMsg(""), 4000);
  }

  async function handleDelete(id: string) {
    if (!confirm("Diesen Eintrag wirklich löschen?")) return;
    setDeleting(id);

    const res = await fetch("/api/knowledge/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });

    const data = await res.json();
    setDeleting(null);

    if (data.ok) {
      setItems((prev) => prev.filter((i) => i.id !== id));
    } else {
      alert(`Fehler: ${data.error}`);
    }
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString("de-DE", {
      day: "2-digit", month: "2-digit", year: "numeric",
    });
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-black flex items-center justify-center">
        <p className="text-zinc-400 text-sm">Wird geladen...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="border-b border-white/10 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/dashboard")}
            className="text-zinc-400 text-sm hover:text-white transition"
          >
            ← Dashboard
          </button>
          <span className="text-zinc-600">|</span>
          <span className="text-white font-medium">Wissensbasis</span>
        </div>
        <button
          onClick={async () => { await supabase.auth.signOut(); router.push("/login"); }}
          className="text-zinc-400 text-sm hover:text-white transition"
        >
          Abmelden
        </button>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8 flex flex-col gap-10">

        <section>
          <h2 className="text-base font-medium mb-4">Neuen Eintrag hinzufügen</h2>
          <div className="bg-zinc-900 border border-white/10 rounded-xl p-6 flex flex-col gap-4">
            <p className="text-zinc-400 text-sm">
              Füge Texte, FAQs oder Informationen hinzu die dein Bot kennen soll.
            </p>
            <div>
              <label className="text-zinc-400 text-xs mb-1 block">Titel (optional)</label>
              <input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="z.B. Öffnungszeiten, Leistungen..."
                className="w-full bg-zinc-800 text-white rounded-lg px-4 py-2 text-sm border border-white/10 focus:outline-none focus:border-white/30"
              />
            </div>
            <div>
              <label className="text-zinc-400 text-xs mb-1 block">
                Inhalt <span className="text-red-400">*</span>
              </label>
              <textarea
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                placeholder="Schreibe hier den Text den der Bot lernen soll..."
                rows={5}
                className="w-full bg-zinc-800 text-white rounded-lg px-4 py-2 text-sm border border-white/10 focus:outline-none focus:border-white/30 resize-none"
              />
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleAdd}
                disabled={adding || !newContent.trim()}
                className="bg-white text-black font-medium rounded-lg px-5 py-2 text-sm hover:bg-zinc-200 transition disabled:opacity-50"
              >
                {adding ? "Wird hinzugefügt..." : "Hinzufügen"}
              </button>
              {addMsg && (
                <span className={`text-sm ${addMsg.includes("Fehler") ? "text-red-400" : "text-green-400"}`}>
                  {addMsg}
                </span>
              )}
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-base font-medium mb-4">
            Bestehende Einträge
            <span className="ml-2 text-zinc-500 text-sm font-normal">({items.length})</span>
          </h2>
          {items.length === 0 ? (
            <p className="text-zinc-500 text-sm">Noch keine Einträge vorhanden.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {items.map((item) => (
                <div key={item.id} className="bg-zinc-900 border border-white/10 rounded-xl p-4">
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <div>
                      {item.title && (
                        <p className="text-white font-medium text-sm mb-1">{item.title}</p>
                      )}
                      <p className="text-zinc-300 text-sm line-clamp-3">{item.content}</p>
                    </div>
                    <button
                      onClick={() => handleDelete(item.id)}
                      disabled={deleting === item.id}
                      className="text-zinc-600 hover:text-red-400 transition text-xs shrink-0 disabled:opacity-50"
                    >
                      {deleting === item.id ? "..." : "Löschen"}
                    </button>
                  </div>
                  <div className="flex gap-4 text-xs text-zinc-600 mt-2">
                    <span>{formatDate(item.created_at)}</span>
                    {item.source && <span>{item.source}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

      </div>
    </main>
  );
}