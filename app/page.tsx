import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-black text-white p-8">
      <h1 className="text-4xl font-semibold mb-4">Praxis-Assistent</h1>

      <p className="mb-6 text-lg text-gray-300 text-center max-w-xl">
        Willkommen beim KI-Praxis-Assistenten. Klicke unten, um den Chatbot zu öffnen.
      </p>

      <Link
        href="/demo/hausarzt-painten"
        className="border border-white/40 rounded-lg px-4 py-2 text-base hover:bg-white hover:text-black transition"
      >
        Chatbot öffnen
      </Link>
    </main>
  );
}
