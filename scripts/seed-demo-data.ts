// @ts-nocheck
/**
 * Seed demo analytics data for sales presentations.
 *
 * Generates ~90 days of realistic conversation_analytics rows for a tenant
 * (typical for a Hausarzt-Praxis). Use it to show the Wirkung dashboard
 * to prospects before they have real data.
 *
 * Usage:
 *   npx ts-node scripts/seed-demo-data.ts --slug=demo
 *   npx ts-node scripts/seed-demo-data.ts --slug=demo --days=90 --wipe
 *
 * Flags:
 *   --slug <slug>     Tenant slug (required)
 *   --days <n>        How many days back to seed (default 90)
 *   --wipe            Delete existing analytics for this tenant in the range first
 */

import * as dotenv from "dotenv";
import * as path from "node:path";
import { randomUUID } from "node:crypto";

// Load env BEFORE anything that reads process.env. With "module": "esnext",
// imports are hoisted, so we explicitly load env here and dynamic-import
// lib/db.ts later inside main().
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

function getArg(flag: string): string | null {
  const eq = process.argv.find((a) => a.startsWith(`${flag}=`));
  if (eq) return eq.split("=").slice(1).join("=");
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return null;
  return process.argv[idx + 1] ?? null;
}
function hasFlag(flag: string) {
  return process.argv.includes(flag);
}

// Realistic question pool for a Hausarztpraxis. The first ones are intentionally
// repeated to produce a meaningful "top questions" distribution.
const QUESTIONS = [
  "Wie sind die Öffnungszeiten?",
  "Wie sind die Öffnungszeiten?",
  "Wie sind die Öffnungszeiten?",
  "Wie sind die Öffnungszeiten?",
  "Wie kann ich einen Termin vereinbaren?",
  "Wie kann ich einen Termin vereinbaren?",
  "Wie kann ich einen Termin vereinbaren?",
  "Behandeln Sie auch privat versicherte Patienten?",
  "Behandeln Sie auch privat versicherte Patienten?",
  "Bieten Sie Hausbesuche an?",
  "Bieten Sie Hausbesuche an?",
  "Wo befindet sich die Praxis?",
  "Wo befindet sich die Praxis?",
  "Gibt es einen Notdienst am Wochenende?",
  "Welche Impfungen bieten Sie an?",
  "Ich brauche ein Rezept für meine Medikamente",
  "Wie bekomme ich eine Krankschreibung?",
  "Bieten Sie Vorsorgeuntersuchungen an?",
  "Nehmen Sie noch neue Patienten auf?",
  "Wie lange muss ich auf einen Termin warten?",
  "Gibt es Parkplätze vor der Praxis?",
  "Was kostet ein Gesundheits-Check-up?",
  "Wann ist die Praxis im Urlaub?",
  "Wer ist mein Hausarzt-Vertreter?",
];

function pickQuestion(): string {
  return QUESTIONS[Math.floor(Math.random() * QUESTIONS.length)];
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function randFloat(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

// Hour distribution for a typical day. Weight inside opening hours (8-18) higher,
// but allow ~30% to fall outside those hours.
function pickHour(): number {
  // 0..23
  if (Math.random() < 0.7) {
    // Inside business hours, weighted toward midday
    const inside = [8, 9, 10, 10, 11, 11, 12, 14, 14, 15, 16, 17];
    return inside[Math.floor(Math.random() * inside.length)];
  }
  // Outside business hours, weighted toward evening and very early
  const outside = [6, 7, 18, 19, 20, 20, 21, 21, 22, 23];
  return outside[Math.floor(Math.random() * outside.length)];
}

// Berlin business hours, matches the default tenant config.
function isOutsideBusinessHoursBerlin(date: Date): boolean {
  // Quick check: assume Mon–Thu 08–18, Fri 08–16, weekend closed.
  // Use date.getDay() in local time; we don't bother with TZ exactness for seed data.
  const day = date.getDay(); // 0 = Sun
  const hour = date.getHours();
  if (day === 0 || day === 6) return true; // weekend
  if (day === 5) return hour < 8 || hour >= 16; // Fri
  return hour < 8 || hour >= 18; // Mon–Thu
}

async function main() {
  const slug = getArg("--slug");
  const days = Number(getArg("--days") ?? "90");
  const wipe = hasFlag("--wipe");

  if (!slug) {
    console.error("Usage: npx ts-node scripts/seed-demo-data.ts --slug=<tenant-slug> [--days=90] [--wipe]");
    process.exit(1);
  }
  if (!Number.isFinite(days) || days < 1 || days > 365) {
    console.error("--days must be 1..365");
    process.exit(1);
  }

  // Dynamic import so lib/db.ts only runs after dotenv has populated env.
  const { supaAdmin } = await import("../lib/db.ts");

  // Resolve tenant
  const { data: tenant, error: tErr } = await supaAdmin
    .from("tenants")
    .select("id, name, slug")
    .eq("slug", slug)
    .single();

  if (tErr || !tenant) {
    console.error(`Tenant with slug "${slug}" not found.`);
    process.exit(1);
  }

  const now = new Date();
  const from = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

  console.log(`Seeding ${days} days of demo data for tenant "${tenant.name}" (${tenant.id})`);

  if (wipe) {
    const { error: delErr } = await supaAdmin
      .from("conversation_analytics")
      .delete()
      .eq("tenant_id", tenant.id)
      .gte("started_at", from.toISOString())
      .lte("started_at", now.toISOString());
    if (delErr) {
      console.error("Wipe failed:", delErr);
      process.exit(1);
    }
    console.log(`  Wiped existing rows in range.`);
  }

  const rows: any[] = [];

  for (let d = 0; d < days; d++) {
    const dayStart = new Date(now);
    dayStart.setDate(dayStart.getDate() - (days - 1 - d));
    const weekday = dayStart.getDay();
    const isWeekend = weekday === 0 || weekday === 6;

    // Conversation count for this day
    const count = isWeekend ? randInt(2, 5) : randInt(8, 18);

    for (let i = 0; i < count; i++) {
      const started = new Date(dayStart);
      started.setHours(pickHour(), randInt(0, 59), randInt(0, 59), 0);

      // Skip rows that would land in the future
      if (started.getTime() > now.getTime()) continue;

      const messageCount = randInt(2, 9);
      const samples = Math.max(1, messageCount - 1); // user messages excl. first
      const avgSim = Math.min(0.95, Math.max(0.18, randFloat(0.55, 0.92)));
      const fallback = Math.random() < 0.08 ? 1 : 0;
      const resultedInLead = Math.random() < 0.15;
      const outside = isOutsideBusinessHoursBerlin(started);
      const question = pickQuestion();

      rows.push({
        id: randomUUID(),
        tenant_id: tenant.id,
        conversation_id: randomUUID(),
        started_at: started.toISOString(),
        ended_at: new Date(started.getTime() + randInt(30, 600) * 1000).toISOString(),
        message_count: messageCount,
        first_user_message: question,
        outside_business_hours: outside,
        resulted_in_lead: resultedInLead,
        avg_similarity: avgSim,
        similarity_sum: avgSim * samples,
        similarity_samples: samples,
        fallback_count: fallback,
        updated_at: new Date(started.getTime() + 60_000).toISOString(),
      });
    }
  }

  // Insert in batches of 500
  console.log(`  Inserting ${rows.length} analytics rows…`);
  const batchSize = 500;
  for (let i = 0; i < rows.length; i += batchSize) {
    const chunk = rows.slice(i, i + batchSize);
    const { error } = await supaAdmin.from("conversation_analytics").insert(chunk);
    if (error) {
      console.error(`Batch ${i}-${i + chunk.length} failed:`, error);
      process.exit(1);
    }
  }

  const outsideCount = rows.filter((r) => r.outside_business_hours).length;
  const leadCount = rows.filter((r) => r.resulted_in_lead).length;
  console.log("Done.");
  console.log(`  Total: ${rows.length} conversations`);
  console.log(`  Outside hours: ${outsideCount} (${((outsideCount / rows.length) * 100).toFixed(0)}%)`);
  console.log(`  Leads: ${leadCount} (${((leadCount / rows.length) * 100).toFixed(0)}%)`);
  console.log(`  Range: ${from.toISOString().slice(0, 10)} → ${now.toISOString().slice(0, 10)}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
