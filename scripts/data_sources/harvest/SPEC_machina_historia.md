# Spec für Content-Finder: Machina (IT) + Historia (Geschichte)

Du produzierst **verifizierte Konzept-Kandidaten** als JSON-Array in eine Datei. Kein Prosa-Output.

## Eiserne Regeln (Projekt-Inhaltsregeln)

1. **Keine erfundenen Fakten.** Nur Wissen, das du als **lehrbuch-/Wikidata-sicher** kennst.
   Bei der kleinsten Unsicherheit über einen Wert: **Attribut weglassen** (nicht raten). Lieber ein
   Konzept mit 3 sicheren Attributen als mit 6 halb-geratenen.
2. **Nur bekannte, faire Objekte** — keine obskuren Nischen-Begriffe. Was ein interessierter Laie
   schon mal gehört haben könnte.
3. **Echte Umlaute** (ä ö ü ß), niemals ASCII-Ersatz (ae/oe/ue/ss). Deutsche Werte/funFacts.
4. **Quelle pro Konzept:** `sourceName` (+ `sourceUrl` wenn bekannt) + kurze `verifyNote` (woher der
   Kernfakt stammt). Autoritative Quellen genügen: Wikipedia DE/EN, Wikidata, RFC/IANA (Ports),
   offizielle Sprach-/Projektseiten, Standard-Lehrbücher.
5. **funFact**: 1 kurzer deutscher Satz, sachlich, belegt. Optional — lieber weglassen als schwach.
6. **HISTORIA — Politik-Ausschluss (hart):** KEINE Tagespolitik, Parteien, Wahlen, Regierungen, Kriege
   als Wertung, keine -ismen-Debatten, keine lebenden Personen. Schwerpunkt: **Wissenschaft, Technik,
   Erfindungen, Entdeckungen, Entdeckungsreisen, Kultur-/Bauepochen** als datierbare, wertungsfreie
   Fakten. Im Zweifel: weglassen.
7. **MACHINA — Achse Funktionsprinzip:** Frage NICHT nach Erfindungsdatum/-person (das ist Historia).
   Attribute beschreiben **Funktion/Eigenschaft** (Paradigma, Schicht, Kompression, Komplexität …).

## JSON-Schema je Konzept

```json
{
  "id": "kebab-case-eindeutig",
  "name": "Anzeigename",
  "category": "<siehe unten>",
  "attributes": { /* nur belegte, siehe Kategorie */ },
  "funFact": "kurzer deutscher Satz (optional)",
  "sourceName": "z.B. Wikipedia DE – Python (Programmiersprache)",
  "sourceUrl": "https://…",
  "verifyNote": "1 Satz: woher der Kernfakt"
}
```

`id` eindeutig **innerhalb deiner Datei** (ich dedupe global beim Mergen). Schreibe das Array als
gültiges JSON (doppelte Anführungszeichen, kein trailing comma).

---

## MACHINA — Kategorien + Attribute (kontrolliertes Vokabular!)

Distraktoren ziehen aus derselben Kategorie/demselben Attribut → **Werte MÜSSEN aus dem
vorgegebenen Vokabular kommen**, sonst zerfallen die Pools.

### `programming_language`
- `paradigm` ∈ {"Objektorientiert", "Funktional", "Imperativ/prozedural", "Logisch",
  "Multiparadigma", "Skriptsprache", "Stack-basiert"} — die **primär** prägende Einordnung.
- `typeSystem` ∈ {"Statisch typisiert", "Dynamisch typisiert"}
- `execution` ∈ {"Kompiliert", "Interpretiert", "Bytecode (VM)", "JIT-kompiliert"}
- `primaryDomain` ∈ {"Systemprogrammierung", "Webentwicklung (Frontend)", "Webentwicklung (Backend)",
  "Datenwissenschaft", "Mobile Apps", "Skripting/Automatisierung", "Wissenschaftliches Rechnen",
  "Spieleentwicklung", "Datenbankabfragen", "Nebenläufige Systeme"}
- `fileExtension` z.B. ".py", ".js", ".rs", ".java", ".cpp"

### `file_format`
- `mediaType` ∈ {"Bild", "Audio", "Video", "Dokument", "Archiv/Kompression", "Tabellen/Daten",
  "Schriftart", "3D-Modell"}
- `compression` ∈ {"verlustfrei komprimiert", "verlustbehaftet komprimiert", "unkomprimiert"}
- `fullName` — wofür das Kürzel steht, z.B. "Portable Network Graphics"

### `network_protocol`
- `layer` ∈ {"Anwendungsschicht", "Transportschicht", "Vermittlungsschicht (Internet)",
  "Sicherungsschicht", "Bitübertragungsschicht"} (TCP/IP- bzw. OSI-Einordnung, gängige Lehrmeinung)
- `defaultPort` — Zahl (nur wenn eindeutig, z.B. HTTP 80, HTTPS 443, SSH 22, DNS 53)
- `transport` ∈ {"TCP", "UDP", "TCP und UDP"}
- `purpose` — kurzer deutscher Zweck, z.B. "Übertragung von Webseiten"
- `fullName` — z.B. "Hypertext Transfer Protocol"

### `data_structure`
- `category` ∈ {"Lineare Struktur", "Baumstruktur", "Hash-basiert", "Graph", "Heap"}
- `purpose` — kurzer deutscher Zweck
- `accessComplexity` — Big-O als String: "O(1)", "O(log n)", "O(n)", "O(n log n)", "O(n²)"

### `algorithm`
- `category` ∈ {"Sortieralgorithmus", "Suchalgorithmus", "Graphalgorithmus", "Kryptografie",
  "Kompression", "String-Verarbeitung"}
- `avgComplexity` — Big-O als String (s.o.)
- `purpose` — kurzer deutscher Zweck

### `hardware`
- `category` ∈ {"Prozessor/Recheneinheit", "Arbeitsspeicher", "Massenspeicher", "Eingabegerät",
  "Ausgabegerät", "Hauptplatine/Bus", "Netzwerk", "Grafik"}
- `function` — kurze deutsche Funktionsbeschreibung

### `acronym`  (IT-Abkürzungen)
- `fullName` — Vollform, z.B. "Structured Query Language"
- `domain` ∈ {"Netzwerk", "Datenbanken", "Webtechnik", "Sicherheit", "Hardware", "Software/OS",
  "Programmierung", "Daten/Formate"}

### `concept`  (Informatik-Grundbegriffe)
- `category` ∈ {"Netzwerk", "Datenbanken", "Sicherheit/Kryptografie", "Betriebssysteme",
  "Programmierung", "Künstliche Intelligenz", "Theoretische Informatik", "Webtechnik"}
- `definition` — kurze deutsche Definition (wird erst NACH der Antwort gezeigt)

---

## HISTORIA — Kategorien + Attribute

Jahre als **Zahl** (positiv = n. Chr.). v.-Chr.-Daten als negative Zahl ODER String "550 v. Chr." —
der Generator filtert Nicht-n.-Chr.-Jahre automatisch aus Jahres-Fragen heraus, also ruhig eintragen.

### `invention`  (Technik-/Wissenschaftserfindungen)
- `inventor` — Person(en) oder "unbekannt"
- `year` — Zahl (Erfindungs-/Patentjahr, ca.)
- `country` — Land (heutiger Name oder "Deutschland"/"England" etc.)
- `field` ∈ {"Kommunikation", "Verkehr/Transport", "Energie", "Medizin", "Computertechnik",
  "Haushalt", "Optik", "Produktion/Industrie", "Luft-/Raumfahrt", "Werkstoffe"}

### `discovery`  (wissenschaftliche Entdeckungen)
- `discoverer` — Person(en)
- `year` — Zahl
- `field` ∈ {"Physik", "Chemie", "Biologie", "Medizin", "Astronomie", "Geografie", "Mathematik",
  "Geologie"}

### `epoch`  (Kultur-/Geschichtsepochen, wertungsfrei)
- `startYear` — Zahl (ca. Beginn, in Europa)
- `endYear` — Zahl (ca. Ende)
- `region` — z.B. "Europa", "Italien", "Antikes Griechenland"
- `precededBy` — Name der unmittelbar vorausgehenden Epoche (wenn klar)

### `figure`  (Forscher/Erfinder/Entdecker — KEINE Politiker, KEINE lebenden Personen)
- `field` ∈ {"Physik", "Chemie", "Biologie", "Medizin", "Astronomie", "Mathematik", "Technik/Erfindung",
  "Entdeckungsreisen", "Naturwissenschaft (allg.)"}
- `nationality` — z.B. "Deutschland", "Italien", "England" (Herkunft)
- `birthYear` — Zahl
- `knownFor` — kurze deutsche Beschreibung der Hauptleistung (eindeutig, z.B.
  "Formulierung der Relativitätstheorie")

### `milestone`  (datierbare Wissenschafts-/Technik-/Entdeckungs-Ereignisse, wertungsfrei)
- `year` — Zahl
- `protagonist` — Person/Gruppe im Zentrum
- `field` ∈ {"Raumfahrt", "Luftfahrt", "Medizin", "Computertechnik", "Kommunikation", "Energie",
  "Entdeckung", "Wissenschaft"}

### `expedition`  (Entdeckungsreisen)
- `explorer` — Leiter der Reise
- `year` — Zahl (Beginn)
- `region` — Zielregion, z.B. "Amerika", "Südpol", "Indischer Seeweg"
