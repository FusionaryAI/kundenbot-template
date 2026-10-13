// Modell-Eval für den Kundenbot: spielt die LLM-Aufgaben aus app/api/chat/route.ts
// mit festen Testfällen durch und prüft JSON-Gültigkeit + erwartete Werte.
// Vor jedem Anbieter-/Modellwechsel laufen lassen (nutzt die LLM_*-Werte aus .env.local).
// Aufruf: node --experimental-strip-types scripts/llm-eval.ts [modell-id]
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

if (process.argv[2]) process.env.LLM_CHAT_MODEL = process.argv[2];

// Dynamischer Import erst nach dotenv; Node (strip-types) verlangt die .ts-Endung.
// @ts-expect-error TS5097 — Endung ist für die direkte Ausführung mit Node nötig
const { llm, chatModel, parseJsonReply } = await import("../lib/llm.ts");

type Reply = Record<string, string | boolean | null | undefined>;

type Case = {
  name: string;
  prompt: string;
  temperature: number;
  check: (o: Reply) => string | null; // null = ok, sonst Fehlerbeschreibung
};

const kb = `- Die Praxis Dr. Sommer ist Montag bis Freitag von 8:00 bis 12:00 Uhr geöffnet, Dienstag und Donnerstag zusätzlich 14:00 bis 18:00 Uhr.
- Telefon: 0941 123456, E-Mail: praxis@dr-sommer.de
- Wir bieten Vorsorgeuntersuchungen, Impfungen und Reisemedizin an.`;

const analyze = (q: string, hist = "") => `
Analysiere die aktuelle Nutzerfrage im Kontext des bisherigen Gesprächs und der verfügbaren KB-Snippets.

Gib ausschließlich JSON zurück:
{
  "can_answer": boolean,
  "answer": string | null,
  "offer_handoff": boolean,
  "lead_type": "appointment" | "callback" | "contact"
}

Regeln:
- Interpretiere die aktuelle Nachricht IM KONTEXT der letzten Bot-Nachricht. Kurze Antworten ("ja", "nein", "ok", "später", "passt") beziehen sich auf das, was der Bot zuletzt angeboten/gefragt hat.
- can_answer = true nur wenn die Antwort klar aus den KB-Snippets ableitbar ist ODER wenn die Nachricht eine kontextuelle Bestätigung/Verneinung ist, die der Bot natürlich beantworten kann (dann formuliere die Antwort konversational).
- answer = die Antwort wenn can_answer true ist, sonst null
- offer_handoff = true NUR wenn der Nutzer aktiv einen Termin, Rückruf oder Kontakt wünscht — NICHT wenn er ein Angebot ablehnt oder das Gespräch abschließt
- lead_type = passender Lead-Typ basierend auf der Frage
- Keine externen Annahmen
${hist}
Aktuelle Nutzerfrage:
"""${q}"""

KB-Snippets:
${kb}
`;

const extract = (instr: string, text: string) => `
Du bist ein Parser. ${instr}

Gib ausschließlich JSON im folgenden Schema zurück:
{
  "name": string | null,
  "email": string | null,
  "phone": string | null,
  "preferred_contact": "email" | "phone" | null,
  "message": string | null
}

Text:
"""${text}"""
`;

const offTopic = (msg: string) => `
Du pruefst, ob eine Nachricht zum Aufgabenbereich eines Bots gehoert.

Bot-Rolle: Digitaler Assistent der Praxis Dr. Sommer

IN SCOPE (off_topic = false): Oeffnungszeiten, Kontakt, Leistungen, Termine, organisatorische Anliegen.
OFF TOPIC (off_topic = true): persoenliche Fragen an den Bot, Weltwissen, Witze, Smalltalk, Wetter, Politik.

Wenn OFF TOPIC: formuliere eine sehr kurze (1-2 Saetze), freundliche Antwort in der Sie-Form, die sanft zurueck auf den Aufgabenbereich lenkt.
Im Zweifel: off_topic = false.

Gib ausschliesslich JSON zurueck:
{
  "off_topic": boolean,
  "answer": string | null
}

Nachricht: """${msg}"""
`;

const cases: Case[] = [
  {
    name: "KB-Antwort Öffnungszeiten",
    prompt: analyze("Habt ihr donnerstags nachmittags offen?"),
    temperature: 0,
    check: (o) =>
      o.can_answer !== true ? "can_answer sollte true sein"
      : !/14|18/.test(String(o.answer ?? "")) ? "Antwort nennt Nachmittagszeiten nicht"
      : null,
  },
  {
    name: "Nicht in KB → can_answer false",
    prompt: analyze("Was kostet eine Gelbfieberimpfung?"),
    temperature: 0,
    check: (o) => (o.can_answer === true ? "darf Preis nicht erfinden" : null),
  },
  {
    name: "Terminwunsch → handoff appointment",
    prompt: analyze("Ich hätte gern einen Termin für eine Reiseberatung nächste Woche."),
    temperature: 0,
    check: (o) =>
      o.offer_handoff !== true ? "offer_handoff sollte true sein"
      : o.lead_type !== "appointment" ? `lead_type ${o.lead_type} statt appointment`
      : null,
  },
  {
    name: "Ablehnung im Kontext → kein handoff",
    prompt: analyze("nein danke", "\nLetzte Gesprächsturns:\nBot: Möchten Sie, dass ich eine Rückrufbitte ans Team weiterleite?\n"),
    temperature: 0,
    check: (o) => (o.offer_handoff === true ? "Ablehnung als Handoff gewertet" : null),
  },
  {
    name: "Name extrahieren",
    prompt: extract("Extrahiere einen plausiblen vollständigen Namen (Vor- und Nachname), falls vorhanden.", "ja klar, ich bin die Anna-Lena Müller-Schmidt"),
    temperature: 0,
    check: (o) => (!/Anna-Lena Müller-Schmidt/.test(String(o.name ?? "")) ? `name falsch: ${o.name}` : null),
  },
  {
    name: "Kontakt extrahieren",
    prompt: extract('Extrahiere E-Mail und/oder Telefonnummer, falls vorhanden. Erkenne ggf. preferred_contact ("email" oder "phone") wenn Nutzer das sagt.', "am besten telefonisch unter null eins sieben zwei, 55 44 33 21"),
    temperature: 0,
    check: (o) => (o.preferred_contact !== "phone" ? `preferred_contact ${o.preferred_contact} statt phone` : null),
  },
  {
    name: "Off-Topic erkennen",
    prompt: offTopic("Erzähl mir einen Witz über Ärzte"),
    temperature: 0.4,
    check: (o) => (o.off_topic !== true ? "off_topic sollte true sein" : !o.answer ? "keine Antwort" : null),
  },
  {
    name: "In-Scope nicht abwimmeln",
    prompt: offTopic("Kann ich bei euch auch eine Gelbfieberimpfung bekommen?"),
    temperature: 0.4,
    check: (o) => (o.off_topic === true ? "In-Scope-Frage als Off-Topic gewertet" : null),
  },
];

console.log(`Modell: ${chatModel()} @ ${process.env.LLM_BASE_URL || "api.openai.com"}\n`);
let pass = 0;
const times: number[] = [];
for (const c of cases) {
  const t0 = Date.now();
  let raw = "";
  let verdict: string | null;
  try {
    const r = await llm().chat.completions.create({
      model: chatModel(),
      temperature: c.temperature,
      messages: [{ role: "user", content: c.prompt }],
    });
    raw = r.choices[0]?.message?.content?.trim() ?? "";
    // Gleiches Parsing wie in den Routen
    verdict = c.check(parseJsonReply(raw));
  } catch (e) {
    verdict = raw ? `kein gültiges JSON: ${raw.slice(0, 80)}` : `Fehler: ${(e as Error).message}`;
  }
  times.push(Date.now() - t0);
  if (!verdict) pass++;
  console.log(`${verdict ? "✗" : "✓"} ${c.name} (${times.at(-1)} ms)${verdict ? ` — ${verdict}` : ""}`);
}
times.sort((a, b) => a - b);
console.log(`\n${pass}/${cases.length} bestanden · Median ${times[Math.floor(times.length / 2)]} ms`);
