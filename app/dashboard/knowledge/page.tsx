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
  const [revealed, setRevealed] = useState(false);

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
      setTimeout(() => setRevealed(true), 50);
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

  const revealStyle = (delay: number) => ({
    opacity: revealed ? 1 : 0,
    transform: revealed ? "translateY(0)" : "translateY(10px)",
    transition: `opacity 0.5s ease ${delay}s, transform 0.5s ease ${delay}s`,
  });

  const inputStyle = {
    width: "100%",
    background: "#fafafa",
    color: "#111",
    borderRadius: "8px",
    padding: "9px 12px",
    fontSize: "13px",
    border: "1px solid #efefed",
    outline: "none",
    boxSizing: "border-box" as const,
    transition: "border-color 0.15s",
    fontFamily: "inherit",
  };

  if (loading) {
    return (
      <div style={{ display: "flex", minHeight: "100vh", background: "#fafafa", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: "#bbb", fontSize: "14px" }}>Wird geladen...</p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#fafafa" }}>
      <Sidebar role={role} tenantName={tenant?.name} />

      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>

        {/* Topbar */}
        <div style={{
          background: "#fff",
          borderBottom: "1px solid #efefed",
          padding: "22px 28px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          ...revealStyle(0),
        }}>
          <div>
            <p style={{
              fontFamily: "var(--font-playfair), Georgia, serif",
              fontSize: "22px",
              fontWeight: 400,
              color: "#0a0a0a",
              letterSpacing: "-0.3px",
            }}>
              Wissensbasis,{" "}
              <span style={{ fontWeight: 600, fontStyle: "italic", color: "#2d5a1b" }}>
                {tenant?.name ?? ""}
              </span>
            </p>
            <p style={{ fontSize: "12px", color: "#bbb", marginTop: "4px" }}>
              {items.length} Einträge · Was soll dein Bot wissen?
            </p>
          </div>
        </div>

        <div style={{ padding: "24px 28px", display: "flex", flexDirection: "column", gap: "16px" }}>

          {/* Neuen Eintrag */}
          <div style={{
            background: "#fff",
            border: "1px solid #efefed",
            borderRadius: "10px",
            padding: "20px 24px",
            ...revealStyle(0.1),
          }}>
            <p style={{ fontSize: "12px", fontWeight: 600, color: "#333", marginBottom: "4px" }}>
              Neuen Eintrag hinzufügen
            </p>
            <p style={{ fontSize: "11.5px", color: "#bbb", marginBottom: "16px" }}>
              Füge Texte oder FAQs hinzu die dein Bot kennen soll.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div>
                <label style={{ fontSize: "11px", color: "#999", display: "block", marginBottom: "5px", fontWeight: 500 }}>
                  Titel (optional)
                </label>
                <input
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="z.B. Öffnungszeiten, Leistungen..."
                  style={inputStyle}
                  onFocus={(e) => e.currentTarget.style.borderColor = "#c8c4f8"}
                  onBlur={(e) => e.currentTarget.style.borderColor = "#efefed"}
                />
              </div>
              <div>
                <label style={{ fontSize: "11px", color: "#999", display: "block", marginBottom: "5px", fontWeight: 500 }}>
                  Inhalt <span style={{ color: "#e05" }}>*</span>
                </label>
                <textarea
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  placeholder="Schreibe hier den Text den der Bot lernen soll..."
                  rows={4}
                  style={{ ...inputStyle, resize: "none" }}
                  onFocus={(e) => e.currentTarget.style.borderColor = "#c8c4f8"}
                  onBlur={(e) => e.currentTarget.style.borderColor = "#efefed"}
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
                    padding: "9px 18px",
                    fontSize: "13px",
                    fontWeight: 500,
                    cursor: "pointer",
                    opacity: adding || !newContent.trim() ? 0.5 : 1,
                    transition: "all 0.15s",
                  }}
                >
                  {adding ? "Wird hinzugefügt..." : "Hinzufügen"}
                </button>
                {addMsg && (
                  <span style={{ fontSize: "12px", color: addMsg.includes("Fehler") ? "#e05" : "#3a6b10" }}>
                    {addMsg}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Bestehende Einträge */}
          <div style={revealStyle(0.2)}>
            <p style={{ fontSize: "12px", fontWeight: 600, color: "#333", marginBottom: "10px" }}>
              Bestehende Einträge
              <span style={{ fontSize: "11px", fontWeight: 400, color: "#bbb", marginLeft: "6px" }}>
                ({items.length})
              </span>
            </p>

            {items.length === 0 ? (
              <div style={{
                background: "#fff", border: "1px solid #efefed",
                borderRadius: "10px", padding: "32px", textAlign: "center",
              }}>
                <p style={{ fontSize: "13px", color: "#bbb" }}>Noch keine Einträge vorhanden.</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "7px" }}>
                {items.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      background: "#fff",
                      border: "1px solid #efefed",
                      borderRadius: "9px",
                      padding: "12px 16px",
                      display: "flex",
                      alignItems: "flex-start",
                      justifyContent: "space-between",
                      gap: "12px",
                      transition: "all 0.15s",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = "#c8c4f8";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = "#efefed";
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {item.title && (
                        <p style={{ fontSize: "12.5px", fontWeight: 600, color: "#0a0a0a", marginBottom: "3px" }}>
                          {item.title}
                        </p>
                      )}
                      <p style={{
                        fontSize: "12px", color: "#888",
                        overflow: "hidden",
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical" as const,
                      }}>
                        {item.content}
                      </p>
                      <div style={{ display: "flex", gap: "10px", marginTop: "6px" }}>
                        <span style={{ fontSize: "10.5px", color: "#bbb" }}>{formatDate(item.created_at)}</span>
                        {item.source && (
                          <span style={{ fontSize: "10.5px", color: "#bbb" }}>{item.source}</span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => handleDelete(item.id)}
                      disabled={deleting === item.id}
                      style={{
                        background: "transparent",
                        border: "none",
                        cursor: "pointer",
                        fontSize: "11.5px",
                        color: "#ccc",
                        padding: "2px 4px",
                        flexShrink: 0,
                        transition: "color 0.15s",
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.color = "#e05"}
                      onMouseLeave={(e) => e.currentTarget.style.color = "#ccc"}
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