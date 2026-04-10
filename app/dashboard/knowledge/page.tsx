"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";

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
  const [role, setRole] = useState<string | null>(null);
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
      setRole(roleData.role);

      let tenantId = roleData.tenant_id;

      if (roleData.role === "super_admin") {
        const { data: firstTenant } = await supabase
          .from("tenants").select("*").limit(1).single();
        if (firstTenant) { setTenant(firstTenant); tenantId = firstTenant.id; }
      } else {
        const { data: tenantData } = await supabase
          .from("tenants").select("*").eq("id", tenantId).single();
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
      <div style={{ display: "flex", minHeight: "100vh", background: "#0a0a0a", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "14px" }}>Wird geladen...</p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#f5f5f3" }}>
      <Sidebar role={role} tenantName={tenant?.name} />

      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        {/* Topbar */}
        <div style={{
          background: "#fff",
          borderBottom: "0.5px solid rgba(0,0,0,0.08)",
          padding: "14px 28px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}>
          <div>
            <p style={{ fontSize: "15px", fontWeight: 500, color: "#111" }}>Wissensbasis</p>
            {tenant && <p style={{ fontSize: "12px", color: "#888", marginTop: "1px" }}>{tenant.name}</p>}
          </div>
          <span style={{ fontSize: "12px", color: "#888" }}>{items.length} Einträge</span>
        </div>

        <div style={{ padding: "24px 28px", display: "flex", flexDirection: "column", gap: "24px" }}>

          {/* Neuen Eintrag */}
          <div style={{
            background: "#fff",
            border: "0.5px solid rgba(0,0,0,0.08)",
            borderRadius: "12px",
            padding: "20px 24px",
          }}>
            <p style={{ fontSize: "13px", fontWeight: 500, color: "#111", marginBottom: "4px" }}>
              Neuen Eintrag hinzufügen
            </p>
            <p style={{ fontSize: "12px", color: "#888", marginBottom: "16px" }}>
              Füge Texte oder FAQs hinzu die dein Bot kennen soll.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div>
                <label style={{ fontSize: "11px", color: "#888", display: "block", marginBottom: "4px" }}>
                  Titel (optional)
                </label>
                <input
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="z.B. Öffnungszeiten, Leistungen..."
                  style={{
                    width: "100%",
                    background: "#f5f5f3",
                    color: "#111",
                    borderRadius: "8px",
                    padding: "8px 12px",
                    fontSize: "13px",
                    border: "0.5px solid rgba(0,0,0,0.12)",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: "11px", color: "#888", display: "block", marginBottom: "4px" }}>
                  Inhalt <span style={{ color: "#E24B4A" }}>*</span>
                </label>
                <textarea
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  placeholder="Schreibe hier den Text den der Bot lernen soll..."
                  rows={4}
                  style={{
                    width: "100%",
                    background: "#f5f5f3",
                    color: "#111",
                    borderRadius: "8px",
                    padding: "8px 12px",
                    fontSize: "13px",
                    border: "0.5px solid rgba(0,0,0,0.12)",
                    outline: "none",
                    resize: "none",
                    boxSizing: "border-box",
                    fontFamily: "inherit",
                  }}
                />
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <button
                  onClick={handleAdd}
                  disabled={adding || !newContent.trim()}
                  style={{
                    background: "#111",
                    color: "#fff",
                    border: "none",
                    borderRadius: "8px",
                    padding: "8px 18px",
                    fontSize: "13px",
                    fontWeight: 500,
                    cursor: "pointer",
                    opacity: adding || !newContent.trim() ? 0.5 : 1,
                  }}
                >
                  {adding ? "Wird hinzugefügt..." : "Hinzufügen"}
                </button>
                {addMsg && (
                  <span style={{
                    fontSize: "12px",
                    color: addMsg.includes("Fehler") ? "#E24B4A" : "#3B6D11",
                  }}>
                    {addMsg}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Bestehende Einträge */}
          <div>
            <p style={{ fontSize: "13px", fontWeight: 500, color: "#111", marginBottom: "12px" }}>
              Bestehende Einträge
              <span style={{ fontSize: "12px", fontWeight: 400, color: "#888", marginLeft: "8px" }}>
                ({items.length})
              </span>
            </p>

            {items.length === 0 ? (
              <div style={{
                background: "#fff",
                border: "0.5px solid rgba(0,0,0,0.08)",
                borderRadius: "12px",
                padding: "32px",
                textAlign: "center",
              }}>
                <p style={{ fontSize: "13px", color: "#aaa" }}>Noch keine Einträge vorhanden.</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {items.map((item) => (
                  <div key={item.id} style={{
                    background: "#fff",
                    border: "0.5px solid rgba(0,0,0,0.08)",
                    borderRadius: "12px",
                    padding: "14px 18px",
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                    gap: "12px",
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {item.title && (
                        <p style={{ fontSize: "13px", fontWeight: 500, color: "#111", marginBottom: "3px" }}>
                          {item.title}
                        </p>
                      )}
                      <p style={{
                        fontSize: "12px",
                        color: "#666",
                        overflow: "hidden",
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                      }}>
                        {item.content}
                      </p>
                      <div style={{ display: "flex", gap: "12px", marginTop: "6px" }}>
                        <span style={{ fontSize: "11px", color: "#aaa" }}>{formatDate(item.created_at)}</span>
                        {item.source && <span style={{ fontSize: "11px", color: "#aaa" }}>{item.source}</span>}
                      </div>
                    </div>
                    <button
                      onClick={() => handleDelete(item.id)}
                      disabled={deleting === item.id}
                      style={{
                        background: "transparent",
                        border: "none",
                        cursor: "pointer",
                        fontSize: "12px",
                        color: "#bbb",
                        padding: "2px 4px",
                        flexShrink: 0,
                      }}
                    >
                      {deleting === item.id ? "..." : "Löschen"}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}