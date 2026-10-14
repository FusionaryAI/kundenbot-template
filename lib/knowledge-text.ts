/**
 * Text, der als Vektor gespeichert und dem Modell als Wissen gezeigt wird.
 * Mit Titel (meist die Frage) wird ein Eintrag über genau diese Frage
 * gefunden — ohne Titel bleibt er wie bisher nur der Inhalt (kompatibel mit
 * Website-Importen und älteren Einträgen).
 */
export function embeddingText(title: string | null | undefined, content: string): string {
  const t = title?.trim();
  return t ? `${t}\n${content}` : content;
}
