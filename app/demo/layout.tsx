// Die Demo zeigt das Widget so, wie es auf Kundenwebsites erscheint —
// mit dessen eigener Schrift, nicht der des Dashboards.
export default function DemoLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100%", fontFamily: "var(--font-dm-sans), 'DM Sans', sans-serif" }}>
      {children}
    </div>
  );
}
