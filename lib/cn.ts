/** Klassen-Namen zusammenfügen (truthy-Filter). */
export function cn(...inputs: Array<string | false | null | undefined>): string {
  return inputs.filter(Boolean).join(" ");
}
