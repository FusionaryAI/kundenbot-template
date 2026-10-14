import { redirect } from "next/navigation";

// dashboard.fusionaryai.de/ führt direkt ins Dashboard; ohne Anmeldung leitet
// das Dashboard selbst zur Login-Seite weiter.
export default function Home() {
  redirect("/dashboard");
}
