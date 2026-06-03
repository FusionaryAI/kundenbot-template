// Vertical-Profile: kapselt das branchenspezifische Verhalten des Bots.
//
// Leitgedanke: EINE Engine (app/api/chat/route.ts), austauschbares Profil.
// Alles, was sich je Anwendungsgebiet (Praxis, Handwerk, Agentur, …) ändert
// — Prompts, Safety-Hinweise, Guardrails, Capability-Antwort — lebt hier als
// versioniertes Code-Modul, nicht als if/else im Chat-Handler.

/**
 * Branchenspezifischer Guardrail (z.B. „keine medizinische Beratung").
 * Ein Profil ohne Guardrail (z.B. base) lässt die normale RAG-Pipeline laufen.
 */
export type AdviceGuardrail = {
  /** Erkennt, ob die Nutzerfrage in den geschützten Bereich fällt. */
  matches: (text: string) => boolean;
  /** Antworttext, wenn der Guardrail greift. */
  safetyFallback: string;
  /** Zusatzfrage, die nach dem Safety-Hinweis ein Handoff anbietet. */
  handoffPrompt: string;
  /** Lead-Typ, mit dem das angebotene Handoff startet. */
  handoffLeadType: "appointment" | "callback" | "contact";
  /**
   * Formulierungen, die in einer LLM-Antwort auf einen Regelbruch hindeuten
   * (Post-Generation-Check). Treffer → Antwort wird durch safetyFallback ersetzt.
   */
  unsafeClaims: string[];
};

export interface VerticalProfile {
  /** Stabiler Schlüssel, entspricht tenants.vertical (z.B. "praxis"). */
  id: string;
  /** Anzeigename für Admin-UIs. */
  label: string;

  /** SICHERHEIT/KOMPLIANCE-Block im System-Prompt. */
  safetyHint: string;
  /** Sanfter Handoff-Hinweis, der an Kontakt-/Info-Antworten angehängt wird. */
  softHandoffHint: string;
  /** Antwort auf „Was kannst du?". */
  capabilityAnswer: (tenantName: string) => string;
  /** Rollen-/Scope-Beschreibung für den Off-Topic-Deflektor. */
  offTopicRole: (tenantName: string) => string;
  /** „WICHTIG"-Instruktion im KB-Antwort-Prompt. */
  kbAnswerInstruction: string;

  /** Optionaler branchenspezifischer Guardrail. */
  adviceGuardrail?: AdviceGuardrail;

  /** IDs der Integrationen, die diese Branche anbietet (Phase 2). */
  availableIntegrations: string[];

  /**
   * Legacy-Heuristik: erkennt anhand von Tenant-Name/-Label, ob dieses Profil
   * passt. Wird NUR genutzt, solange tenants.vertical noch nicht gesetzt ist,
   * damit Bestandskunden ohne Backfill verhaltensgleich bleiben.
   */
  detect?: (name: string, label?: string | null) => boolean;
}
