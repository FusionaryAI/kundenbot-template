import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * Anwendungsseitige Verschlüsselung für Zugangsdaten der Integrationen
 * (Slack-Webhook, HubSpot-/Pipedrive-Token) in tenant_integrations.config.
 *
 * Warum auf Anwendungsebene: Der Schlüssel liegt ausschließlich als
 * Umgebungsvariable in Vercel (INTEGRATIONS_ENCRYPTION_KEY). Supabase speichert
 * nur Chiffrat und erhält den Schlüssel nie — ein DB-Dump, ein Backup oder ein
 * Zugriff beim Datenbank-Anbieter legt die Tokens nicht offen.
 *
 * Verfahren: AES-256-GCM (authentifiziert), zufälliger 96-Bit-IV je Wert.
 * Als Associated Data wird "tenant_id/integration/feld" gebunden: Ein Chiffrat
 * lässt sich dadurch nicht unbemerkt in einen anderen Tenant oder ein anderes
 * Feld kopieren — die Entschlüsselung schlägt dann fehl.
 *
 * Format: enc:v1:<iv>:<tag>:<ciphertext> (je base64url). Das v1 erlaubt später
 * eine Schlüsselrotation, ohne Altwerte unlesbar zu machen.
 */

const PREFIX = "enc:v1:";
const IV_BYTES = 12;

export function isEncrypted(value: string): boolean {
  return value.startsWith(PREFIX);
}

/** Liest und prüft den Schlüssel (32 Byte, base64). Fehlt er, wird nichts im Klartext gespeichert. */
export function keyFromEnv(raw = process.env.INTEGRATIONS_ENCRYPTION_KEY): Buffer {
  if (!raw) throw new Error("INTEGRATIONS_ENCRYPTION_KEY fehlt");
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error("INTEGRATIONS_ENCRYPTION_KEY muss 32 Byte (base64) lang sein");
  }
  return key;
}

export function encryptSecret(plaintext: string, key: Buffer, aad: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from(aad, "utf8"));
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return PREFIX + [iv, tag, ciphertext].map((b) => b.toString("base64url")).join(":");
}

export function decryptSecret(value: string, key: Buffer, aad: string): string {
  if (!isEncrypted(value)) throw new Error("Wert ist nicht verschlüsselt");
  const parts = value.slice(PREFIX.length).split(":");
  if (parts.length !== 3) throw new Error("Chiffrat hat ein ungültiges Format");
  const [iv, tag, ciphertext] = parts.map((p) => Buffer.from(p, "base64url"));
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAAD(Buffer.from(aad, "utf8"));
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

/** Associated Data: bindet ein Chiffrat an genau einen Tenant, eine Integration, ein Feld. */
export function secretAad(tenantId: string, integration: string, field: string): string {
  return `${tenantId}/${integration}/${field}`;
}

type Config = Record<string, unknown>;

/** Verschlüsselt die als geheim markierten Felder; übrige Felder bleiben unverändert. */
export function encryptConfig(
  config: Config,
  secretKeys: string[],
  key: Buffer,
  tenantId: string,
  integration: string,
): Config {
  const out: Config = { ...config };
  for (const field of secretKeys) {
    const v = out[field];
    if (typeof v === "string" && v && !isEncrypted(v)) {
      out[field] = encryptSecret(v, key, secretAad(tenantId, integration, field));
    }
  }
  return out;
}

/**
 * Entschlüsselt die geheimen Felder. Klartext-Altwerte (vor der Umstellung
 * gespeichert, bis scripts/encrypt-integration-secrets.ts gelaufen ist) werden
 * durchgereicht und in `legacyPlaintext` gemeldet, damit der Aufrufer warnen kann.
 */
export function decryptConfig(
  config: Config,
  secretKeys: string[],
  key: Buffer,
  tenantId: string,
  integration: string,
): { config: Config; legacyPlaintext: string[] } {
  const out: Config = { ...config };
  const legacyPlaintext: string[] = [];
  for (const field of secretKeys) {
    const v = out[field];
    if (typeof v !== "string" || !v) continue;
    if (isEncrypted(v)) {
      out[field] = decryptSecret(v, key, secretAad(tenantId, integration, field));
    } else {
      legacyPlaintext.push(field);
    }
  }
  return { config: out, legacyPlaintext };
}
