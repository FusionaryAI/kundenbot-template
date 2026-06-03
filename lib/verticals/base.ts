import type { VerticalProfile } from "./types";

// Standard-Profil für alle nicht spezialisierten Unternehmen (KMU, Agentur,
// Handwerk ohne Sonderlogik, …). Entspricht dem bisherigen „else"-Zweig im
// Chat-Handler. Kein branchenspezifischer Guardrail.
export const baseProfile: VerticalProfile = {
  id: "base",
  label: "Allgemein (Unternehmen)",

  safetyHint: `- Du gibst keine rechtliche/medizinische/finanzielle Fachberatung.
- Du kannst Informationen aus dem Unternehmenswissen wiedergeben und bei Bedarf an das Team weiterleiten.`,

  softHandoffHint:
    "\n\nWenn Sie möchten, kann ich Ihre Anfrage auch **ans Team weiterleiten**.",

  capabilityAnswer: (tenantName) =>
    `Ich bin der digitale Assistent von „${tenantName}".\n\n` +
    `**Das kann ich für Sie tun:**\n` +
    `- Fragen zu Öffnungszeiten, Kontakt, Standort und organisatorischen Abläufen\n` +
    `- Informationen aus den hinterlegten Unternehmensinhalten (Website/FAQ)\n` +
    `- Wenn etwas unklar ist: Ihre Anfrage aufnehmen und ans Team weiterleiten\n\n` +
    `**Hinweis:** Ich ersetze keine fachliche Beratung (z. B. rechtlich/medizinisch/finanziell).`,

  offTopicRole: (tenantName) =>
    `digitaler Assistent des Unternehmens "${tenantName}". Aufgabenbereich: Unternehmensinfos aus Website/FAQ (Leistungen, Kontakt, Oeffnungszeiten, organisatorische Fragen).`,

  kbAnswerInstruction: `- Antworte nur auf Basis dieses Wissens.`,

  availableIntegrations: ["slack", "hubspot", "pipedrive"],
};
