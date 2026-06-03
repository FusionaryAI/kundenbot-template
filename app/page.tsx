import Link from "next/link";

// Start-/Übersichtsseite der Demo-Umgebung. Bewusst als Testumgebung
// gekennzeichnet und mit Direktlinks zu den wichtigsten Bereichen — die
// eigentlichen Kunden-Bots laufen pro Mandant über /embed/[slug].

type RouteEntry = {
  href: string;
  path: string;
  title: string;
  description: string;
};

const AREAS: RouteEntry[] = [
  {
    href: "/login",
    path: "/login",
    title: "Anmeldung",
    description: "Zugang für Kunden und Administratoren.",
  },
  {
    href: "/dashboard",
    path: "/dashboard",
    title: "Kunden-Dashboard",
    description: "Wissensbasis, Leads, Wirkung und Integrationen verwalten.",
  },
  {
    href: "/admin",
    path: "/admin",
    title: "Super-Admin",
    description: "Mandanten anlegen, Profile und Zugänge verwalten.",
  },
  {
    href: "/demo/hausarzt-painten",
    path: "/demo/[slug]",
    title: "Demo-Bot",
    description: "Beispiel-Chatbot einer Praxis im Vollbild ausprobieren.",
  },
];

export default function Home() {
  return (
    <main
      className="min-h-screen flex items-center justify-center px-6 py-16"
      style={{ background: "var(--bg)", color: "var(--text)" }}
    >
      <div className="w-full" style={{ maxWidth: "680px" }}>

        {/* Eyebrow / Demo-Hinweis */}
        <div className="flex items-center gap-2.5 mb-6">
          <span
            className="inline-flex items-center gap-2 rounded-full"
            style={{
              background: "var(--status-amber-bg)",
              color: "var(--status-amber)",
              fontSize: "11px",
              fontWeight: 600,
              letterSpacing: "0.04em",
              padding: "5px 11px",
              textTransform: "uppercase",
            }}
          >
            <span
              style={{
                width: "6px",
                height: "6px",
                borderRadius: "50%",
                background: "var(--status-amber)",
                display: "inline-block",
              }}
            />
            Demo · Nur zu Testzwecken
          </span>
        </div>

        {/* Wordmark */}
        <p
          style={{
            fontSize: "12px",
            fontWeight: 600,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "var(--text-muted)",
            marginBottom: "14px",
          }}
        >
          Fusionary AI
        </p>

        {/* Headline */}
        <h1
          style={{
            fontFamily: "var(--font-instrument-serif), Georgia, serif",
            fontSize: "clamp(40px, 7vw, 64px)",
            lineHeight: 1.05,
            letterSpacing: "-0.02em",
            color: "var(--text)",
            marginBottom: "18px",
          }}
        >
          Kundenbot-Plattform
        </h1>

        {/* Pitch + Hinweis */}
        <p
          style={{
            fontSize: "16px",
            lineHeight: 1.6,
            color: "var(--text-secondary)",
            maxWidth: "520px",
            marginBottom: "40px",
          }}
        >
          Dies ist die <strong style={{ color: "var(--text)" }}>Test- und Vorschau-Umgebung</strong> der
          Plattform — nicht für den produktiven Einsatz gedacht. Wählen Sie einen Bereich,
          um ihn anzusehen.
        </p>

        {/* Bereiche */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: "12px",
          }}
        >
          {AREAS.map((area) => (
            <Link
              key={area.href}
              href={area.href}
              className="group block rounded-xl border border-[#e8e6e0] bg-white transition-colors hover:border-[#d0cdc6] hover:bg-[#fcfbf9]"
              style={{
                padding: "18px 20px",
                textDecoration: "none",
              }}
            >
              <div className="flex items-center justify-between gap-3" style={{ marginBottom: "6px" }}>
                <span style={{ fontSize: "14px", fontWeight: 600, color: "var(--text)" }}>
                  {area.title}
                </span>
                <code
                  style={{
                    fontSize: "11px",
                    color: "var(--text-muted)",
                    background: "var(--bg-card)",
                    borderRadius: "5px",
                    padding: "2px 7px",
                  }}
                >
                  {area.path}
                </code>
              </div>
              <p style={{ fontSize: "12.5px", lineHeight: 1.5, color: "var(--text-muted)" }}>
                {area.description}
              </p>
            </Link>
          ))}
        </div>

        {/* Footer-Hinweis */}
        <p
          style={{
            marginTop: "32px",
            fontSize: "12px",
            lineHeight: 1.6,
            color: "var(--text-muted)",
            borderTop: "1px solid var(--border)",
            paddingTop: "20px",
          }}
        >
          Live-Bots werden pro Kunde über{" "}
          <code style={{ background: "var(--bg-card)", borderRadius: "5px", padding: "2px 6px", fontSize: "11px" }}>
            /embed/[slug]
          </code>{" "}
          in die jeweilige Kundenwebsite eingebettet.
        </p>

      </div>
    </main>
  );
}
