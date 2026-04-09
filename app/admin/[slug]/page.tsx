"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter, useParams } from "next/navigation";

type Lead = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  message: string;
  type: string;
  created_at: string;
};

type TenantSettings = {
  welcome_message: string | null;
  fallback_message: string | null;
  lead_enabled: boolean | null;
  lead_email: string | null;
  lead_auto_reply: string | null;
};

type Tenant = {
  id: string;
  name: string;
  slug: string;
};

export default function TenantDetailPage() {
  const router = useRouter();
  const params = useParams();
  const slug = params?.slug as string;

  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [settings, setSettings] = useState<TenantSettings | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [creatingUser, setCreatingUser] = useState(false);
  const [createUserMsg, setCreateUserMsg] = useState("");

  // Editierbare Felder
  const [welcomeMsg, setWelcomeMsg] = useState("");
  const [fallbackMsg, setFallbackMsg] = useState("");
  const [leadEmail, setLeadEmail] = useState("");
  const [leadEnabled, setLeadEnabled] = useState(true);
  const [leadAutoReply, setLeadAutoReply] = useState("");

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }

      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .single();

      if (!roleData || roleData.role !== "super_admin") {
        router.push("/dashboard");
        return;
      }

      const { data: tenantData } = await supabase
        .from("tenants")
        .select("id, name, slug")
        .eq("slug", slug)
        .single();

      if (!tenantData) { router.push("/admin"); return; }
      setTenant(tenantData);

      const { data: settingsData } = await supabase
        .from("tenant_settings")
        .select("welcome_message, fallback_message, lead_enabled, lead_email, lead_auto_reply")
        .eq("tenant_id", tenantData.id)
        .single();

      if (settingsData) {
        setSettings(settingsData);
        setWelcomeMsg(settingsData.welcome_message ?? "");
        setFallbackMsg(settingsData.fallback_message ?? "");
        setLeadEmail(settingsData.lead_email ?? "");
        setLeadEnabled(settingsData.lead_enabled ?? true);
        setLeadAutoReply(settingsData.lead_auto_reply ?? "");
      }

      const { data: leadsData } = await supabase
        .from("leads")
        .select("id, name, email, phone, message, type, created_at")
        .eq("tenant_id", tenantData.id)
        .order("created_at", { ascending: false })
        .limit(50);

      setLeads(leadsData ?? []);
      setLoading(false);
    }
    load();
  }, [slug, router]);

  async function handleSave() {
    if (!tenant) return;
    setSaving(true);
    setSaveMsg("");

    const { error } = await supabase
      .from("tenant_settings")
      .update({
        welcome_message: welcomeMsg,
        fallback_message: fallbackMsg,
        lead_email: leadEmail,
        lead_enabled: leadEnabled,
        lead_auto_reply: leadAutoReply,
      })
      .eq("tenant_id", tenant.id);

    setSaving(false);
    setSaveMsg(error ? "Fehler beim Speichern." : "Gespeichert!");
    setTimeout(() => setSaveMsg(""), 3000);
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString("de-DE", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  }

  function leadTypLabel(t: string) {
    if (t === "appointment") return "Termin";
    if (t === "callback") return "Rückruf";
    return "Kontakt";
  }

  function leadTypColor(t: string) {
    if (t === "appointment") return "bg-blue-500/20 text-blue-300";
    if (t === "callback") return "bg-amber-500/20 text-amber-300";
    return "bg-zinc-500/20 text-zinc-300";
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
      {/* Header */}
      <div className="border-b border-white/10 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/admin")}
            className="text-zinc-400 text-sm hover:text-white transition"
          >
            ← Alle Kunden
          </button>
          <span className="text-zinc-600">|</span>
          <span className="text-white font-medium">{tenant?.name}</span>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push("/dashboard")}
            className="text-zinc-400 text-sm hover:text-white transition"
          >
            Dashboard
          </button>
          <button
            onClick={async () => { await supabase.auth.signOut(); router.push("/login"); }}
            className="text-zinc-400 text-sm hover:text-white transition"
          >
            Abmelden
          </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8 flex flex-col gap-10">

        {/* Einstellungen */}
        <section>
          <h2 className="text-base font-medium mb-4">Bot-Einstellungen</h2>
          <div className="bg-zinc-900 border border-white/10 rounded-xl p-6 flex flex-col gap-4">

            <div>
              <label className="text-zinc-400 text-xs mb-1 block">Willkommensnachricht</label>
              <input
                value={welcomeMsg}
                onChange={(e) => setWelcomeMsg(e.target.value)}
                className="w-full bg-zinc-800 text-white rounded-lg px-4 py-2 text-sm border border-white/10 focus:outline-none focus:border-white/30"
              />
            </div>

            <div>
              <label className="text-zinc-400 text-xs mb-1 block">Fallback-Nachricht</label>
              <input
                value={fallbackMsg}
                onChange={(e) => setFallbackMsg(e.target.value)}
                className="w-full bg-zinc-800 text-white rounded-lg px-4 py-2 text-sm border border-white/10 focus:outline-none focus:border-white/30"
              />
            </div>

            <div>
              <label className="text-zinc-400 text-xs mb-1 block">Lead-E-Mail (wohin werden Leads gesendet)</label>
              <input
                value={leadEmail}
                onChange={(e) => setLeadEmail(e.target.value)}
                className="w-full bg-zinc-800 text-white rounded-lg px-4 py-2 text-sm border border-white/10 focus:outline-none focus:border-white/30"
              />
            </div>

            <div>
              <label className="text-zinc-400 text-xs mb-1 block">Auto-Reply an den Nutzer nach Lead</label>
              <input
                value={leadAutoReply}
                onChange={(e) => setLeadAutoReply(e.target.value)}
                className="w-full bg-zinc-800 text-white rounded-lg px-4 py-2 text-sm border border-white/10 focus:outline-none focus:border-white/30"
              />
            </div>

            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="lead-enabled"
                checked={leadEnabled}
                onChange={(e) => setLeadEnabled(e.target.checked)}
                className="w-4 h-4 accent-white"
              />
              <label htmlFor="lead-enabled" className="text-zinc-300 text-sm">
                Lead-Erfassung aktiv
              </label>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleSave}
                disabled={saving}
                className="bg-white text-black font-medium rounded-lg px-5 py-2 text-sm hover:bg-zinc-200 transition disabled:opacity-50"
              >
                {saving ? "Wird gespeichert..." : "Speichern"}
              </button>
              {saveMsg && (
                <span className={`text-sm ${saveMsg.includes("Fehler") ? "text-red-400" : "text-green-400"}`}>
                  {saveMsg}
                </span>
              )}
            </div>
          </div>
        </section>

        {/* Leads */}
        <section>
          <h2 className="text-base font-medium mb-4">
            Leads
            <span className="ml-2 text-zinc-500 text-sm font-normal">({leads.length})</span>
          </h2>

          {leads.length === 0 ? (
            <p className="text-zinc-500 text-sm">Noch keine Leads vorhanden.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {leads.map((lead) => (
                <div key={lead.id} className="bg-zinc-900 border border-white/10 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-white font-medium text-sm">
                        {lead.name ?? "Kein Name"}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${leadTypColor(lead.type)}`}>
                        {leadTypLabel(lead.type)}
                      </span>
                    </div>
                    <span className="text-zinc-500 text-xs">{formatDate(lead.created_at)}</span>
                  </div>
                  <p className="text-zinc-300 text-sm mb-2">{lead.message}</p>
                  <div className="flex gap-4 text-xs text-zinc-500">
                    {lead.email && <span>✉ {lead.email}</span>}
                    {lead.phone && <span>✆ {lead.phone}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Kunden-Zugang anlegen */}
        <section>
          <h2 className="text-base font-medium mb-4">Kunden-Zugang anlegen</h2>
          <div className="bg-zinc-900 border border-white/10 rounded-xl p-6 flex flex-col gap-4">
            <p className="text-zinc-400 text-sm">
              Erstelle einen Login für deinen Kunden. Er kann sich damit einloggen
              und seine Leads & Einstellungen einsehen.
            </p>

            <div>
              <label className="text-zinc-400 text-xs mb-1 block">E-Mail des Kunden</label>
              <input
                value={newUserEmail}
                onChange={(e) => setNewUserEmail(e.target.value)}
                placeholder="kunde@beispiel.de"
                className="w-full bg-zinc-800 text-white rounded-lg px-4 py-2 text-sm border border-white/10 focus:outline-none focus:border-white/30"
              />
            </div>

            <div>
              <label className="text-zinc-400 text-xs mb-1 block">Passwort</label>
              <input
                type="password"
                value={newUserPassword}
                onChange={(e) => setNewUserPassword(e.target.value)}
                placeholder="Mindestens 8 Zeichen"
                className="w-full bg-zinc-800 text-white rounded-lg px-4 py-2 text-sm border border-white/10 focus:outline-none focus:border-white/30"
              />
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={async () => {
                  if (!tenant || !newUserEmail || !newUserPassword) return;
                  setCreatingUser(true);
                  setCreateUserMsg("");

                  const res = await fetch("/api/create-client-user", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      email: newUserEmail,
                      password: newUserPassword,
                      tenant_id: tenant.id,
                    }),
                  });

                  const data = await res.json();
                  setCreatingUser(false);

                  if (data.ok) {
                    setCreateUserMsg(`Zugang für ${data.email} erfolgreich angelegt!`);
                    setNewUserEmail("");
                    setNewUserPassword("");
                  } else {
                    setCreateUserMsg(`Fehler: ${data.error}`);
                  }

                  setTimeout(() => setCreateUserMsg(""), 5000);
                }}
                disabled={creatingUser || !newUserEmail || !newUserPassword}
                className="bg-white text-black font-medium rounded-lg px-5 py-2 text-sm hover:bg-zinc-200 transition disabled:opacity-50"
              >
                {creatingUser ? "Wird angelegt..." : "Zugang anlegen"}
              </button>

              {createUserMsg && (
                <span className={`text-sm ${createUserMsg.includes("Fehler") ? "text-red-400" : "text-green-400"}`}>
                  {createUserMsg}
                </span>
              )}
            </div>
          </div>
        </section>

      </div>
    </main>
  );
}