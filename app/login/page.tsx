"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetMsg, setResetMsg] = useState("");
  const [resetLoading, setResetLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError("Login fehlgeschlagen. Bitte E-Mail und Passwort prüfen.");
      setLoading(false);
      return;
    }

    router.push("/dashboard");
  }

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    setResetLoading(true);
    setResetMsg("");

    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
      redirectTo: `https://dashboard.fusionaryai.de/reset-password`,
    });

    setResetLoading(false);
    if (error) {
      setResetMsg("Fehler beim Senden. Bitte E-Mail prüfen.");
    } else {
      setResetMsg("E-Mail gesendet! Prüfe deinen Posteingang.");
    }
  }

  const inputStyle = {
    width: "100%",
    background: "#fafafa",
    color: "#111",
    borderRadius: "8px",
    padding: "10px 14px",
    fontSize: "13.5px",
    border: "1px solid #efefed",
    outline: "none",
    boxSizing: "border-box" as const,
    transition: "border-color 0.15s",
    fontFamily: "inherit",
  };

  return (
    <main style={{
      minHeight: "100vh",
      background: "#f7f7f5",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "20px",
    }}>
      <div style={{ width: "100%", maxWidth: "400px" }}>

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <p style={{
            fontFamily: "var(--font-playfair), Georgia, serif",
            fontSize: "32px",
            fontWeight: 400,
            color: "#0a0a0a",
            letterSpacing: "-0.5px",
            lineHeight: 1.2,
            marginBottom: "8px",
          }}>
            Fusionary{" "}
            <span style={{ fontStyle: "italic", color: "#2d5a1b" }}>AI</span>
          </p>
          <p style={{ fontSize: "13px", color: "#bbb" }}>
            {showReset ? "Passwort zurücksetzen" : "Kundenportal · Anmelden"}
          </p>
        </div>

        {/* Card */}
        <div style={{
          background: "#fff",
          border: "1px solid #efefed",
          borderRadius: "14px",
          padding: "28px",
        }}>
          {!showReset ? (
            <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div>
                <label style={{ fontSize: "11px", color: "#999", display: "block", marginBottom: "5px", fontWeight: 500 }}>
                  E-Mail
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="deine@email.de"
                  style={inputStyle}
                  onFocus={(e) => e.currentTarget.style.borderColor = "#c8c4f8"}
                  onBlur={(e) => e.currentTarget.style.borderColor = "#efefed"}
                />
              </div>
              <div>
                <label style={{ fontSize: "11px", color: "#999", display: "block", marginBottom: "5px", fontWeight: 500 }}>
                  Passwort
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  style={inputStyle}
                  onFocus={(e) => e.currentTarget.style.borderColor = "#c8c4f8"}
                  onBlur={(e) => e.currentTarget.style.borderColor = "#efefed"}
                />
              </div>

              {error && (
                <p style={{ fontSize: "12px", color: "#e05", background: "#fff5f5", padding: "8px 12px", borderRadius: "6px", border: "1px solid #ffd0d0" }}>
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                style={{
                  width: "100%",
                  background: "#111",
                  color: "#fff",
                  border: "none",
                  borderRadius: "8px",
                  padding: "11px",
                  fontSize: "13.5px",
                  fontWeight: 500,
                  cursor: "pointer",
                  opacity: loading ? 0.6 : 1,
                  transition: "all 0.15s",
                  marginTop: "4px",
                }}
                onMouseEnter={(e) => { if (!loading) e.currentTarget.style.background = "#333"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "#111"; }}
              >
                {loading ? "Wird angemeldet..." : "Anmelden"}
              </button>

              <button
                type="button"
                onClick={() => setShowReset(true)}
                style={{
                  background: "none",
                  border: "none",
                  fontSize: "12px",
                  color: "#bbb",
                  cursor: "pointer",
                  textAlign: "center",
                  padding: "4px",
                  transition: "color 0.15s",
                }}
                onMouseEnter={(e) => e.currentTarget.style.color = "#666"}
                onMouseLeave={(e) => e.currentTarget.style.color = "#bbb"}
              >
                Passwort vergessen?
              </button>
            </form>
          ) : (
            <form onSubmit={handleReset} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <p style={{ fontSize: "12.5px", color: "#888", lineHeight: 1.6 }}>
                Gib deine E-Mail ein – wir senden dir einen Link zum Zurücksetzen.
              </p>
              <div>
                <label style={{ fontSize: "11px", color: "#999", display: "block", marginBottom: "5px", fontWeight: 500 }}>
                  E-Mail
                </label>
                <input
                  type="email"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  required
                  placeholder="deine@email.de"
                  style={inputStyle}
                  onFocus={(e) => e.currentTarget.style.borderColor = "#c8c4f8"}
                  onBlur={(e) => e.currentTarget.style.borderColor = "#efefed"}
                />
              </div>

              {resetMsg && (
                <p style={{
                  fontSize: "12px",
                  color: resetMsg.includes("Fehler") ? "#e05" : "#3a6b10",
                  background: resetMsg.includes("Fehler") ? "#fff5f5" : "#f0f7e8",
                  padding: "8px 12px",
                  borderRadius: "6px",
                  border: `1px solid ${resetMsg.includes("Fehler") ? "#ffd0d0" : "#c8e0a0"}`,
                }}>
                  {resetMsg}
                </p>
              )}

              <button
                type="submit"
                disabled={resetLoading}
                style={{
                  width: "100%",
                  background: "#111",
                  color: "#fff",
                  border: "none",
                  borderRadius: "8px",
                  padding: "11px",
                  fontSize: "13.5px",
                  fontWeight: 500,
                  cursor: "pointer",
                  opacity: resetLoading ? 0.6 : 1,
                  transition: "all 0.15s",
                }}
              >
                {resetLoading ? "Wird gesendet..." : "Reset-Link senden"}
              </button>

              <button
                type="button"
                onClick={() => { setShowReset(false); setResetMsg(""); }}
                style={{
                  background: "none",
                  border: "none",
                  fontSize: "12px",
                  color: "#bbb",
                  cursor: "pointer",
                  textAlign: "center",
                  padding: "4px",
                  transition: "color 0.15s",
                }}
                onMouseEnter={(e) => e.currentTarget.style.color = "#666"}
                onMouseLeave={(e) => e.currentTarget.style.color = "#bbb"}
              >
                ← Zurück zum Login
              </button>
            </form>
          )}
        </div>

        {/* Footer */}
        <p style={{ textAlign: "center", fontSize: "11px", color: "#ccc", marginTop: "20px" }}>
          Powered by Fusionary AI
        </p>

      </div>
    </main>
  );
}