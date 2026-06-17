# Externe Wissensquellen — YouTube & E-Book-Korpus

> **Stand: 2026-06-17.** Kuratierte, seriöse Quellen je Bereich für den Content-Ausbau.
> Ergänzt `docs/wissensquellen.md` (freie Text-/Datenquellen) und `docs/content_pipeline.md`.

## Nutzungsprinzip (verbindlich)

Kuratierte Kanäle/Bücher sind die **Entdeckungs-/Notabilitätsschicht** — sie entscheiden, *welche*
Objekte/Themen interessant und bekannt genug fürs Quiz sind. Sie sind **niemals die Faktenschicht**:
jeder Zahlen-/Wertfakt kommt weiter aus autoritativen Quellen (Wikidata, NASA, IUCN, Gray's Anatomy,
Ethnologue …) bzw. — beim E-Book-Korpus — aus dem **Sachbuch-Volltext mit verbatim-Verifikation**.
Begründung live belegt: YouTube-Auto-Transkripte verstümmeln Eigennamen UND Zahlen (z.B. „R136a1 =
35 Sonnenmassen" statt ~200); selbst Wikidata hatte eine falsche Distanz (Beta Centauri 50 statt
~390 Lj). Das Gate (Opus) bleibt Pflicht.

**Politik-Ausschluss** gilt auch hier (s. `AGENTS.md` → Inhaltsregeln): Gegenwarts-/Tagespolitik,
Parteien/Wahlen, Wirtschaftssystem-Debatten raus; historische Politik nur als nüchterne Fakten.

## Werkzeuge

- **YouTube → Text:** Skill `yt-transcribe` (lokal, Whisper/Auto-Untertitel, kein Cloud-Call;
  Fakten sind nicht copyright-schützbar). Themen-Screening eines Kanals: `yt-dlp --flat-playlist
  --print "%(id)s\t%(title)s" <kanal-url>` → nach Titel filtern (Astronomie rein, Politik raus).
- **Frames:** `~/git/claude-video/scripts/frames.py` (lokales Vision-LLM). **Kein Stil-Nachbau**
  fremder Kanäle (Trade Dress); Astra rendert prozedural + freie NASA/ESO-Bilder reichen.

## Kuratierte Kanäle je Bereich

Von Daniel ausgewählt (✓) bzw. vorgeschlagen. Bewusst seriös/hochschulnah; sensationalistische und
politiklastige Kanäle ausgelassen.

| Bereich | Kanäle | Hinweis |
| :--- | :--- | :--- |
| **übergreifend** | Vsauce, Vsauce2 ✓; Kurzgesagt + Ableger Nightshift ✓ | Themen je Video dem passenden Bereich zuordnen |
| **Astra** | SciShowSpace ✓; EntropyWSE ✓; PBS Space Time, Dr. Becky, Cool Worlds, Astrum, Scott Manley, NASA/ESA; **de:** Urknall Weltall und das Leben (Gaßner) | EntropyWSE: **nur nicht-spekulative** Themen |
| **Natura** | Buschfunkistan ✓, mndiaye_97 ✓; PBS Eons, Deep Look, Journey to the Microcosmos, Clint's Reptiles, Real Science, Bizarre Beasts; **de:** Terra X Natur | |
| **Cultura** | CapturedInWords ✓, QuinnsIdeas ✓ (Sci-Fi-Bücher → `literature`); Great Art Explained, Smarthistory, David Bruce Composer, Inside the Score, The B1M | Sci-Fi-Werke als Konzepte ok; **Zitate** nur †≤1955 (Copyright) |
| **Homo** | (offen) Institute of Human Anatomy, AnatomyZone | **nur Anatomie/Physiologie**, keine Krankheiten; SciShowPsych verworfen (Psychologie ≠ Anatomie) |
| **Terra** | (Vorschlag) Nick Zentner, GEO GIRL, Atlas Pro, Practical Engineering; **de:** Terra X / Harald Lesch | |
| **Lingua** | (Vorschlag) NativLang, Langfocus, Simon Roper, K Klein | |
| **Machina** *(geplant)* | ExplainingTheFuture ✓, c't 3003 ✓, heise c't ✓ | für künftigen Digital/IT-Bereich |
| **Historia** *(geplant)* | Geschichtsfenster ✓ | Schwerpunkt Kultur/Wissenschaft/Technik; Politikregel |

> Daniels Abo-Listen (Accounts nfetzen@ / omgdanielm@) sind noch nicht eingelesen — geplant via
> Google Takeout, Dev-Tools-Snippet auf `youtube.com/feed/channels` oder `yt-dlp --cookies-from-browser`.
> Schnittmenge mit obiger Liste = vertrauenswürdiges Startset.

## E-Book-Korpus (Projekt ebook_vectordb, M5)

Große private EPUB/PDF-Bibliothek mit Volltext- + Bedeutungssuche und RAG. **Daten liegen auf M5**
(`ssh m5`); Live-Stand 2026-06-17: ~40.449 Bücher indexiert. Zugang/Bedienung/Genre-Caveat:
theplan-knowledge `p_scientiapotentia.md` + `ebook_vectordb.md`.

**Geplanter Einsatz (s. AGENTS-Todo):**
1. **Verifikations-Schicht:** geernteten Fakt per `ask "<Fakt>" --check strict` gegen den
   **Sachbuch**-Volltext bestätigen → Vermerk „bestätigt in <Buch>" in `verifyNote`. Spart Web-Zugriffe.
2. **Gezielte Extraktion:** `search`/`semantic` (nur Sachbuch) → MiniMax/gemma entwirft eine Frage,
   `strict`-Check sichert die Verankerung → **eigene Formulierung** speichern, Quelle = Buchtitel+Autor.
   **Keine langen Wörtlich-Zitate** speichern (Copyright; Fakten/Titel sind frei).

**Caveat:** Korpus ist fiction-lastig; bare Stichwortsuche liefert Romane. Zuverlässig non-fiction nur
über Ordner `eBooks/Sachbücher/`; das große, unaufgeräumte „ePub Archiv" enthält viele Sachbücher,
deren Pfad-Genre-Erkennung aber versagt → bessere Genre-Erkennung als späterer Schritt.
