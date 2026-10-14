// Das Widget läuft im iframe auf Kundenwebsites und behält seine eigene
// Schrift — unabhängig vom Marken-Look des Dashboards.
export default function EmbedLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ height: "100%", fontFamily: "var(--font-dm-sans), 'DM Sans', sans-serif" }}>
      {children}
    </div>
  );
}
