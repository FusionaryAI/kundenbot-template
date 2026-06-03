import { z } from "zod";
import type { IntegrationAdapter } from "./types";

// Doctolib hat keine offene öffentliche Schreib-API. Die realistische
// Integration für DACH-Praxen ist daher ein Buchungs-Deeplink: Der Bot nimmt
// den Terminwunsch als Lead auf UND verweist auf die Doctolib-Buchungsseite.
// (Echte PVS-Anbindungen — CGM, medatixx, tomedo — laufen projektbezogen über
//  GDT/HL7/KIM und sind kein generischer Adapter.)
const configSchema = z.object({
  booking_url: z.string().url(),
});
type Config = z.infer<typeof configSchema>;

export const doctolibAdapter: IntegrationAdapter<Config> = {
  id: "doctolib",
  label: "Doctolib (Online-Terminbuchung)",
  verticals: ["praxis"],
  configSchema,

  bookingLink(config: Config): string | null {
    return config.booking_url || null;
  },
};
