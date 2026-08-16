# Textbaustein Datenschutzerklärung — KI-Assistent

**Für die Kundenübergabe.** Der Kunde ist Verantwortlicher i. S. d. DSGVO und nimmt diesen
Abschnitt in **seine** Datenschutzerklärung auf. Fusionary AI ist Auftragsverarbeiter.

> **Kein Rechtsrat.** Dieser Entwurf ist eine Arbeitsgrundlage. Vor Veröffentlichung muss
> der Kunde ihn durch seine:n Datenschutzbeauftragte:n oder eine:n Anwält:in prüfen lassen.
> Alle `[prüfen]`-Marker sind vor der Übergabe projektspezifisch zu füllen.

## Abgrenzung: zwei Pflichten, die nicht verwechselt werden dürfen

| Pflicht | Wo erfüllt | Grundlage |
|---|---|---|
| Hinweis, dass eine KI antwortet | **Im Chat selbst** (Header + erste Nachricht) — bereits im Widget umgesetzt | KI-VO Art. 50 Abs. 1 |
| Information über die Datenverarbeitung | **Datenschutzerklärung** (dieser Baustein) | DSGVO Art. 13 |

Der Baustein ersetzt **nicht** die Kennzeichnung im Chat, und die Kennzeichnung im Chat
ersetzt nicht diesen Baustein. Ein Hinweis nur im Impressum genügt für keine der beiden
Pflichten. Ins **Impressum** gehört zur KI-Nutzung nichts.

---

## Baustein (zum Einfügen in die Datenschutzerklärung des Kunden)

### KI-Assistent (Chat-Funktion)

Auf unserer Website setzen wir einen KI-gestützten Assistenten ein, der Ihre Fragen
automatisiert beantwortet. Dass Sie mit einer künstlichen Intelligenz und nicht mit einem
Menschen kommunizieren, wird Ihnen im Chat-Fenster angezeigt.

**Zweck der Verarbeitung**
Beantwortung von Anfragen rund um unser Angebot, Entgegennahme von Kontakt- und
Terminwünschen sowie die statistische Auswertung der Nutzung zur Verbesserung des
Assistenten.

**Verarbeitete Daten**
- Ihre Eingaben im Chat (die von Ihnen eingegebenen Nachrichten)
- Sofern Sie diese aktiv angeben: Name, E-Mail-Adresse, Telefonnummer und Ihr Anliegen
  zur Bearbeitung Ihrer Kontaktanfrage
- Nutzungsstatistiken zur Konversation (Anzahl der Nachrichten, Zeitpunkt, ob eine
  Kontaktanfrage entstanden ist, sowie die erste Frage einer Konversation zur Erkennung
  unbeantworteter Themen)
- Eine zufällig erzeugte Sitzungskennung, die nur für die Dauer Ihres Besuchs im Browser
  gespeichert wird

Eine Erfassung Ihrer IP-Adresse durch den Assistenten erfolgt nicht.

**Rechtsgrundlage**
Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse an einer effizienten
Anfragebeantwortung und der Verbesserung unseres Angebots). Übermitteln Sie uns über den
Assistenten eine Kontaktanfrage, erfolgt die Verarbeitung dieser Angaben auf Grundlage von
Art. 6 Abs. 1 lit. b DSGVO (Durchführung vorvertraglicher Maßnahmen).

**Empfänger**
- **OpenAI Ireland Ltd. / OpenAI, L.L.C.** — Erzeugung der Antworten. Ihre Eingaben werden
  zur Beantwortung an die Schnittstelle von OpenAI übermittelt (eingesetzte Modelle:
  GPT-4o mini sowie ein Modell zur Textähnlichkeitssuche). Eine Nutzung Ihrer Eingaben zum
  Training der Modelle findet nach den Zusagen des Anbieters für API-Kunden nicht statt.
  `[prüfen: aktuelle Vertragsentität und Data-Processing-Addendum]`
- **Supabase** — Datenbank- und Hosting-Dienst für die gespeicherten Angaben
  `[prüfen: Speicherregion des Projekts, EU-Region empfohlen]`
- **Vercel Inc.** — Betrieb der technischen Infrastruktur des Assistenten
- **Fusionary AI, Inhaber Noah Neumeier, Donaupark 19, 93309 Kelheim** — technischer
  Betrieb und Wartung als Auftragsverarbeiter auf Grundlage eines Vertrags nach
  Art. 28 DSGVO

**Übermittlung in Drittländer**
Bei der Verarbeitung durch die genannten Dienstleister kann es zu einer Übermittlung
personenbezogener Daten in die USA kommen. Die Übermittlung erfolgt auf Grundlage von
Standardvertragsklauseln der EU-Kommission gemäß Art. 46 Abs. 2 lit. c DSGVO sowie,
soweit die Anbieter zertifiziert sind, auf Grundlage des EU-US Data Privacy Framework
(Angemessenheitsbeschluss nach Art. 45 DSGVO).
`[prüfen: DPF-Zertifizierung der Anbieter im offiziellen Register bestätigen]`

**Speicherdauer**
Kontaktanfragen speichern wir, bis Ihr Anliegen abschließend bearbeitet ist, längstens
jedoch **6 Monate**; gesetzliche Aufbewahrungsfristen bleiben unberührt.
Nutzungsstatistiken und gespeicherte Fragen werden nach **12 Monaten** gelöscht. Der
Verlauf Ihrer Konversation wird nicht dauerhaft gespeichert. Die Löschung erfolgt
automatisiert durch eine täglich laufende Routine.

> **Verifiziert am 16.08.2026** für das Referenzprojekt: Cron-Job `purge-expired-data`
> aktiv (täglich 03:15 UTC), Funktionslauf erfolgreich, Protokollierung in
> `retention_log` bestätigt.
>
> **Bei jedem neuen Kundenprojekt erneut prüfen:** Die Migration
> `supabase/migrations/20260812120000_add_data_retention.sql` muss in der jeweiligen
> Datenbank eingespielt und einmal getestet sein (siehe `docs/loeschroutine.md`).
> Ohne laufende Routine darf der Absatz **nicht** veröffentlicht werden — eine
> zugesagte, aber nicht stattfindende Löschung ist ein eigenständiger Verstoß.

**Ihre Rechte**
Sie haben das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung,
Datenübertragbarkeit sowie ein Widerspruchsrecht nach Art. 21 DSGVO. Wenden Sie sich dazu
an die im Impressum genannten Kontaktdaten.

**Keine automatisierte Entscheidungsfindung**
Der Assistent trifft keine Entscheidungen mit rechtlicher Wirkung oder ähnlich erheblicher
Beeinträchtigung im Sinne von Art. 22 DSGVO. Er beantwortet Fragen und leitet Anliegen an
uns weiter; alle Entscheidungen treffen Menschen.

**Hinweis zu Ihren Eingaben**
Bitte geben Sie im Chat keine besonderen Kategorien personenbezogener Daten (etwa
Gesundheitsdaten) und keine Zugangsdaten ein.

---

## Übergabe-Checkliste

- [ ] `[prüfen]`-Marker projektspezifisch gefüllt (Speicherregion, Fristen, DPF-Status)
- [ ] Auftragsverarbeitungsvertrag (Art. 28 DSGVO) mit dem Kunden geschlossen → @DATENSCHUTZ.md
- [ ] TIA für den Drittlandtransfer beigelegt → @DATENSCHUTZ.md
- [ ] Kunde auf seine Betreiberpflichten nach KI-VO hingewiesen → @KI-VO.md
- [ ] Kunde bestätigt, dass er den Baustein rechtlich prüfen lässt
