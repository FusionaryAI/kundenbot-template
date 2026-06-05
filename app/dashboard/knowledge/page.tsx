"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { authedFetch } from "@/lib/api-client";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import { useAuth } from "@/hooks/useAuth";
import { t, glass, ctaPrimary, inputDark, topbar, DashboardShell } from "@/lib/dashboardTheme";

type KnowledgeItem = {
  id: string;
  title: string | null;
  content: string;
  source: string | null;
  created_at: string;
};

export default function CustomerKnowledgePage() {
  const router = useRouter();
  const { tenant, role, loading: authLoading } = useAuth();

  const [items, setItems] = useState<KnowledgeItem[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [adding, setAdding] = useState(false);
  const [addMsg, setAddMsg] = useState("");
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    if (!tenant?.id) return;
    async function loadData() {
      const { data: itemsData } = await supabase
        .from("knowledge_items")
        .select("id, title, content, source, created_at")
        .eq("tenant_id", tenant!.id)
        .order("created_at", { ascending: false });
      setItems(itemsData ?? []);
      setDataLoading(false);
      requestAnimationFrame(() => requestAnimationFrame(() => setRevealed(true)));
    }
    loadData();
  }, [tenant?.id]);

  const loading = authLoading || dataLoading;

  async function handleAdd() {
    if (!tenant || !newContent.trim()) return;
    setAdding(true);
    setAddMsg("");

    const res = await authedFetch("/api/knowledge/add", {
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

    const res = await authedFetch("/api/knowledge/delete", {
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

  const inputStyle = inputDark;

  if (loading) {
    return (
      <div style={{ display: "flex", minHeight: "100vh", background: t.bg, alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: t.textMuted, fontSize: "14px" }}>Wird geladen...</p>
      </div>
    );
  }

  return (
    <DashboardShell sidebar={<Sidebar role={role} tenantName={tenant?.name} />}>

      {/* Topbar */}
      <div style={{
        ...topbar,
        padding: "22px 28px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        ...revealStyle(0),
      }}>
        <div>
          <p style={{
            fontFamily: "var(--font-instrument-serif), Georgia, serif",
            fontSize: "24px",
            fontWeight: 400,
            color: t.text,
            letterSpacing: "-0.3px",
          }}>
            Wissensbasis für{" "}
            <span style={{ fontStyle: "italic", color: t.greenAccent }}>
              {tenant?.name ?? ""}
            </span>
          </p>
          <p style={{ fontSize: "12px", color: t.textMuted, marginTop: "4px" }}>
            {items.length} Einträge · Was soll dein Bot wissen?
          </p>
        </div>
      </div>

      <div style={{ padding: "24px 28px", display: "flex", flexDirection: "column", gap: "16px" }}>

        {/* Neuen Eintrag */}
        <div style={{
          ...glass,
          borderRadius: "14px",
          padding: "20px 24px",
          ...revealStyle(0.1),
        }}>
          <p style={{ fontSize: "12.5px", fontWeight: 600, color: t.text, marginBottom: "4px" }}>
            Neuen Eintrag hinzufügen
          </p>
          <p style={{ fontSize: "11.5px", color: t.textMuted, marginBottom: "16px" }}>
            Füge Texte oder FAQs hinzu die dein Bot kennen soll.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div>
              <label style={{ fontSize: "11px", color: t.textSecondary, display: "block", marginBottom: "5px", fontWeight: 500 }}>
                Titel (optional)
              </label>
              <input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="z.B. Öffnungszeiten, Leistungen..."
                style={inputStyle}
                onFocus={(e) => e.currentTarget.style.borderColor = t.greenBorder}
                onBlur={(e) => e.currentTarget.style.borderColor = t.border}
              />
            </div>
            <div>
              <label style={{ fontSize: "11px", color: t.textSecondary, display: "block", marginBottom: "5px", fontWeight: 500 }}>
                Inhalt <span style={{ color: t.danger }}>*</span>
              </label>
              <textarea
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                placeholder="Schreibe hier den Text den der Bot lernen soll..."
                rows={4}
                style={{ ...inputStyle, resize: "none" }}
                onFocus={(e) => e.currentTarget.style.borderColor = t.greenBorder}
                onBlur={(e) => e.currentTarget.style.borderColor = t.border}
              />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <button
                onClick={handleAdd}
                disabled={adding || !newContent.trim()}
                style={{
                  ...ctaPrimary,
                  borderRadius: "9px",
                  padding: "9px 18px",
                  fontSize: "13px",
                  opacity: adding || !newContent.trim() ? 0.5 : 1,
                }}
              >
                {adding ? "Wird hinzugefügt..." : "Hinzufügen"}
              </button>
              {addMsg && (
                <span style={{ fontSize: "12px", color: addMsg.includes("Fehler") ? t.danger : t.greenAccent }}>
                  {addMsg}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Bestehende Einträge */}
        <div style={revealStyle(0.2)}>
          <p style={{ fontSize: "12.5px", fontWeight: 600, color: t.text, marginBottom: "10px" }}>
            Bestehende Einträge
            <span style={{ fontSize: "11px", fontWeight: 400, color: t.textMuted, marginLeft: "6px" }}>
              ({items.length})
            </span>
          </p>

          {items.length === 0 ? (
            <div style={{
              ...glass,
              borderRadius: "14px", padding: "32px", textAlign: "center",
            }}>
              <p style={{ fontSize: "13px", color: t.textMuted }}>Noch keine Einträge vorhanden.</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {items.map((item) => (
                <div
                  key={item.id}
                  style={{
                    ...glass,
                    borderRadius: "13px",
                    padding: "12px 16px",
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                    gap: "12px",
                    transition: "border-color 0.15s, background 0.15s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = t.greenBorder;
                    e.currentTarget.style.background = "rgba(255,255,255,0.8)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = "rgba(255,255,255,0.7)";
                    e.currentTarget.style.background = "rgba(255,255,255,0.55)";
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {item.title && (
                      <p style={{ fontSize: "12.5px", fontWeight: 600, color: t.text, marginBottom: "3px" }}>
                        {item.title}
                      </p>
                    )}
                    <p style={{
                      fontSize: "12px", color: t.textSecondary,
                      overflow: "hidden",
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical" as const,
                    }}>
                      {item.content}
                    </p>
                    <div style={{ display: "flex", gap: "10px", marginTop: "6px" }}>
                      <span style={{ fontSize: "10.5px", color: t.textFaint }}>{formatDate(item.created_at)}</span>
                      {item.source && (
                        <span style={{ fontSize: "10.5px", color: t.textFaint }}>{item.source}</span>
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
                      color: t.textMuted,
                      padding: "2px 4px",
                      flexShrink: 0,
                      transition: "color 0.15s",
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.color = t.danger}
                    onMouseLeave={(e) => e.currentTarget.style.color = t.textMuted}
                  >
                    {deleting === item.id ? "..." : "Löschen"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </DashboardShell>
  );
}