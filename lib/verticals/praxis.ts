import type { VerticalProfile } from "./types";

// Praxis-/Medizin-Profil. Bündelt die bisher im Chat-Handler hart verdrahtete
// `medicalTenant`-Logik: Erkennung, medizinischer Guardrail, Safety-Texte.

const MEDICAL_SAFETY_FALLBACK =
  "Ich kann keine medizinische Beratung, Diagnose oder Behandlung durchführen. " +
  "Für eine medizinische Einschätzung wenden Sie sich bitte direkt an die Praxis oder den Notdienst. " +
  "Gern nenne ich Ihnen Praxisinfos (Öffnungszeiten, Kontakt, Leistungen laut Website).";

// Erkennt, ob eine Frage nach medizinischer Beratung klingt (Symptome,
// Behandlung, Medikation, Diagnose) — vs. organisatorischer Logistik, die aus
// der KB beantwortet werden darf.
function looksLikeMedicalAdviceQuestion(text: string): boolean {
  const t = (text || "").toLowerCase();

  // Capability questions ("was kannst du") are never medical advice.
  const isCapabilityQuestion =
    t.includes("was kannst du") ||
    t.includes("was kann der assistent") ||
    t.includes("wobei kannst du helfen") ||
    t.includes("wie kannst du helfen") ||
    t.includes("was machst du");
  if (isCapabilityQuestion) return false;

  // 1) Starke Beratungssignale — blocken auch bei organisatorischer Formulierung.
  //    Ich-Symptom-Beschreibungen, konkrete Symptome, Diagnose-/Hilfe-Suche.
  const strongAdviceSignals = [
    "ich habe", "ich hab", "mir ist", "mir geht", "ich fühle", "ich fuehle",
    "ich leide", "ich spüre", "ich spuere",
    "symptom", "schmerz", "fieber", "husten", "durchfall", "übelkeit", "uebelkeit",
    "schwindel", "ausschlag", "entzündung", "entzuendung", "krampf", "atemnot",
    "brustschmerz", "blut im", "blut beim", "blut erbrechen",
    "diagnose", "was hilft gegen", "was soll ich tun", "was kann ich tun gegen",
    "ist das schlimm", "ist das gefährlich", "ist das gefaehrlich",
    "wechselwirkung", "schwanger", "stillen", "notfall",
  ];
  if (strongAdviceSignals.some((k) => t.includes(k))) return true;

  // 2) Medikamenten-Einnahme / Dosierung — blocken auch bei "wann/wie viel".
  const mentionsMedication =
    /medikament|tablette|tropfen|salbe|zäpfchen|zaepfchen|ibuprofen|paracetamol|antibiotika|aspirin/.test(t);
  const intakeOrDose = /nehmen|einnehmen|dosis|dosier|wie oft|wie viel|auftragen/.test(t);
  if (mentionsMedication && intakeOrDose) return true;
  if (/dosierung|überdosis|ueberdosis/.test(t)) return true;

  // 3) Organisatorische / Service-Logistik-Absicht — KEINE Beratung, aus KB
  //    beantworten. Fängt "Wann kann ich zur Blutabnahme kommen?", Öffnungs-
  //    zeiten, Vorbereitung (nüchtern), Terminfragen usw. ab.
  const orgSignals = [
    "wann", "öffnung", "oeffnung", "sprechzeit", "zeiten", "uhrzeit",
    "termin", "kommen", "vorbei", "anmeld", "nüchtern", "nuechtern",
    "mitbringen", "brauche ich", "muss ich", "wie läuft", "wie laeuft",
    "ablauf", "dauer", "wie lange", "kann ich", "geöffnet", "geoeffnet",
    "offen", "abholen",
  ];
  if (orgSignals.some((k) => t.includes(k))) return false;

  // 4) Verbleibende Behandlungs-Begriffe ohne Org-Kontext → als Beratung werten.
  const treatmentSignals = ["behandeln", "behandlung", "therapie"];
  return treatmentSignals.some((k) => t.includes(k));
}

export const praxisProfile: VerticalProfile = {
  id: "praxis",
  label: "Arzt-/Heilberuf-Praxis",

  safetyHint: `- Du führst keine medizinische Beratung/Diagnose/Behandlung durch und gibst keine Dosierungs- oder Therapieempfehlungen.
- Du darfst Leistungen der Praxis nur als "die Praxis bietet laut Website ..." beschreiben.
- Wenn eine Frage nach Symptomen/Behandlung/Medikation/Diagnose klingt: antworte kurz mit Hinweis + biete Termin-/Kontaktweiterleitung an.`,

  softHandoffHint:
    "\n\nWenn Sie möchten, kann ich auch eine **Terminanfrage / Rückrufbitte** aufnehmen und an das Team weiterleiten.",

  capabilityAnswer: (tenantName) =>
    `Ich bin der digitale Assistent der Praxis „${tenantName}" und helfe Ihnen mit Praxis-Informationen.\n\n` +
    `**Das kann ich für Sie tun:**\n` +
    `- Öffnungszeiten, telefonische Erreichbarkeit, Adresse & Anfahrt\n` +
    `- Kontaktmöglichkeiten (Telefon/E-Mail) und organisatorische Fragen\n` +
    `- Leistungen/Angebote **laut Website** (ohne medizinische Bewertung)\n` +
    `- Terminanfrage oder Rückrufwunsch aufnehmen und ans Team weiterleiten\n\n` +
    `**Wichtig:** Ich gebe **keine medizinische Beratung/Diagnosen/Therapie- oder Dosierungsempfehlungen**.`,

  offTopicRole: (tenantName) =>
    `digitaler Assistent der Praxis "${tenantName}". Aufgabenbereich: Praxisinfos (Oeffnungszeiten, Kontakt, Adresse, Leistungen laut Website, Terminanfragen).`,

  kbAnswerInstruction: `- Antworte nur auf Basis dieses Wissens.
- Wenn es um medizinische Themen geht: formuliere ausschließlich als "Die Praxis bietet laut Website ..." und gib keine medizinische Beratung/Diagnose/Behandlungsempfehlungen.`,

  adviceGuardrail: {
    matches: looksLikeMedicalAdviceQuestion,
    safetyFallback: MEDICAL_SAFETY_FALLBACK,
    handoffPrompt:
      "Soll ich Ihre Anfrage an das Team weiterleiten und eine Terminanfrage aufnehmen?",
    handoffLeadType: "appointment",
    unsafeClaims: [
      "ich behandle", "ich diagnostiziere", "ich empfehle", "ich rate ihnen",
      "nehmen sie", "dosierung", "therapieplan",
      "ich kann sie behandeln", "ich kann ihnen eine therapie",
    ],
  },

  availableIntegrations: ["slack", "hubspot", "pipedrive", "doctolib"],

  // Bisherige isMedicalTenant-Heuristik (Name + Label).
  detect: (name, label) => {
    const s = `${name || ""} ${label || ""}`.toLowerCase();
    return (
      s.includes("arzt") ||
      s.includes("praxis") ||
      s.includes("medizin") ||
      s.includes("zahnarzt") ||
      s.includes("klinik") ||
      s.includes("therapie") ||
      s.includes("physio") ||
      s.includes("apotheke")
    );
  },
};
