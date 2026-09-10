**🌐 Sprache / Language:** [English](README.md) · [Deutsch](README.de.md)

# Scientia

Scientia ist ein responsives, werbefreies Wissensquiz mit acht Bereichen, passenden Visualisierungen und lokalem Spaced-Repetition-Fortschritt.

> *Scientia potentia est* — Wissen ist Macht.

[Live-Anwendung öffnen](https://dm0.de/sci/)

## Inhalt

- Acht unabhängig geladene Bereiche: Terra, Astra, Homo, Natura, Cultura, Lingua, Machina und
  Historia.
- Über 53.000 generierte Fragen auf Grundlage von über 13.000 belegten Konzepten.
- Interaktiver MapLibre-Atlas für Geografie, eigene Astronomie- und Anatomieansichten sowie eine
  Konzeptvisualisierung für jede weitere Frage.
- An SM-2 angelehnte Wiederholungsplanung in IndexedDB. Ein Konto ist nicht nötig.
- Statische Daten und gebündelte Anwendungsassets für einen schnellen, datensparsamen Betrieb.

## Lokale Entwicklung

Scientia benötigt Node.js `^22.22.2`, `^24.15.0` oder `>=26.0.0`. Das ist die
gemeinsame unterstützte Versionsmenge von Vite und der jsdom-Testumgebung;
`.nvmrc` wählt Node 22.22.2 als reproduzierbaren Standard.

```bash
npm ci
npm run dev
```

Vite stellt die Anwendung standardmäßig unter `http://localhost:3000` bereit.

Die Konzeptbilder liegen nicht im Repository: Rund 4.900 Dateien von Wikimedia Commons
würden es dauerhaft um mehrere hundert Megabyte vergrößern. Ein frischer Klon holt sie einmalig
selbst — der Lauf dauert etwa anderthalb Stunden und legt rund 590 MB unter
`public/images/concepts/` ab:

```bash
npm run mirror:images
```

Ohne diesen Lauf startet der Entwicklungsserver normal, zeigt aber keine Konzeptbilder, und
`npm run build` bricht mit einem Befund ab. Wer bewusst ohne Bilder bauen will, setzt
`SCIENTIA_ALLOW_MISSING_IMAGES=1`; das Ergebnis ist dann ausdrücklich kein Release.

Build und Prüfungen:

```bash
npm test
npm run build
npm run check:layout
python3 -m unittest tests/test_deploy.py
```

Für eine FTPS-Veröffentlichung `.env.example` nach `.env` kopieren und dort die
Platzhalter ersetzen. Git ignoriert `.env`; `deploy.py` akzeptiert über `--env`
oder `SCIENTIA_DEPLOY_ENV` auch eine andere lokale Zugangsdaten-Datei. Eine Datei
mit `FTP_PASS` darf nie versioniert werden.

Die Content-Pipeline hält geprüfte Quelldaten in `scripts/data_sources/*_raw.json` und schreibt die
generierten Anwendungsdaten nach `public/data/`. Der Ablauf steht in
[`docs/content_pipeline.md`](docs/content_pipeline.md), die Beitragsregeln in
[`AGENTS.md`](AGENTS.md).

## Verzeichnisstruktur

```text
public/                 Statische Anwendungsdaten und gebündelte Assets
scripts/data_sources/  Geprüfte Quelldaten und Erntewerkzeuge
scripts/generate_*.js  Deterministische Generatoren je Bereich
src/components/        Quiz-, Visualisierungs- und Explorer-Komponenten
src/domains/           Domain-Registry und Loader
src/utils/             Speicherung, Lernlogik und UI-Helfer
```

## Lizenzen und Quellen

Der ursprüngliche Programmcode steht unter der [MIT-Lizenz](LICENSE). Eigene redaktionelle
Datensatzinhalte stehen, soweit das Projekt die nötigen Rechte hält, getrennt unter
[CC BY-SA 4.0](DATA_LICENSE.md). Bilder, Zitate, Schriftarten, Kartendaten und anderes Material
Dritter behalten ihre jeweiligen Lizenzen und werden durch dieses Repository nicht neu lizenziert.
Einzelheiten stehen in [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md) und den Credit-Dateien
der Assets.

Die genannten Quellen belegen die Herkunft der Fakten. Ihre Nennung bedeutet keine Unterstützung
von Scientia durch die jeweilige Quelle.
