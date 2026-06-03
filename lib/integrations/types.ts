import { z } from "zod";

// Integration-Adapter: kapselt eine externe Anbindung (CRM, Messaging,
// Buchungssystem) hinter einer einheitlichen Schnittstelle.
//
// Leitgedanke wie bei den Verticals: EIN generischer Lead-/Chat-Flow,
// austauschbare Adapter. Neue Integration = neues Modul + ein Registry-Eintrag,
// kein Eingriff in notify/route.ts oder den Chat-Handler.

/** Lead-Datensatz, wie ihn /api/leads an die Integrationen übergibt. */
export type LeadPayload = {
  tenant_id: string;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  message: string;
  type: string;
  appointment_topic?: string | null;
  appointment_window?: string | null;
};

export type IntegrationResult = { ok: boolean; [key: string]: unknown };

/** Beschreibt ein Config-Feld für das Admin-Formular (treibt das UI generisch). */
export type ConfigField = {
  /** Schlüssel in config (muss zum configSchema passen). */
  key: string;
  label: string;
  placeholder?: string;
  help?: string;
  /** Als Passwort-Feld rendern (API-Keys, Tokens). */
  secret?: boolean;
};

/** Kontext für Buchungslinks (z.B. um den Terminanlass vorzubefüllen). */
export type BookingContext = {
  appointment_topic?: string | null;
  appointment_window?: string | null;
};

export interface IntegrationAdapter<Config = Record<string, unknown>> {
  /** Stabiler Schlüssel, entspricht tenant_integrations.integration. */
  id: string;
  /** Anzeigename für Admin-UIs. */
  label: string;
  /** Kurzbeschreibung für die Admin-Karte (was bewirkt die Integration?). */
  description: string;
  /** Emoji/Icon für die Admin-Karte. */
  icon: string;
  /** Hinweis, wo der Kunde die Zugangsdaten findet. */
  setupHint?: string;
  /** Config-Felder, die das Admin-Formular rendert. */
  fields: ConfigField[];
  /** Welche Verticals diese Integration anbieten dürfen ("all" = alle). */
  verticals: string[] | "all";
  /** Validiert die pro-Tenant gespeicherte Config (tenant_integrations.config). */
  configSchema: z.ZodType<Config>;

  /** Outbound: neuer Lead → CRM/Messaging. Fehler werden pro Adapter isoliert. */
  onLead?(lead: LeadPayload, config: Config): Promise<IntegrationResult>;

  /** Liefert einen Buchungs-Deeplink (z.B. Doctolib) für den Chat, falls vorhanden. */
  bookingLink?(config: Config, ctx?: BookingContext): string | null;
}
