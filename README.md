**🌐 Sprache / Language:** [English](README.md) · [Deutsch](README.de.md)

# Scientia

Scientia is a responsive, ad-free knowledge quiz with eight subject areas, tailored visualisations and local spaced-repetition progress.

> *Scientia potentia est* — knowledge is power.

[Open the live application](https://dm0.de/sci/)

## What it includes

- Eight independently loaded domains: Terra, Astra, Homo, Natura, Cultura, Lingua, Machina and
  Historia.
- Over 53,000 generated questions based on more than 13,000 sourced concepts.
- An interactive MapLibre atlas for geography, dedicated astronomy and anatomy views, and a
  concept visual for every remaining question.
- SM-2-inspired review scheduling stored locally in IndexedDB. No account is required.
- Static data and bundled application assets for fast, privacy-friendly operation.

## Local development

Scientia requires Node.js `^22.22.2`, `^24.15.0` or `>=26.0.0`. These ranges are
the common supported versions of Vite and the jsdom test environment; `.nvmrc`
selects Node 22.22.2 as the reproducible default.

```bash
npm ci
npm run dev
```

Vite serves the application at `http://localhost:3000` by default.

Build and verify the project with:

```bash
npm test
npm run build
npm run check:layout
python3 -m unittest tests/test_deploy.py
```

For an FTPS release, copy `.env.example` to the ignored local file `.env` and
replace its placeholders. `deploy.py` also accepts another credentials file via
`--env` or `SCIENTIA_DEPLOY_ENV`; never commit a file containing `FTP_PASS`.

The content pipeline keeps reviewed source data in `scripts/data_sources/*_raw.json` and writes
the generated application data to `public/data/`. See
[`docs/content_pipeline.md`](docs/content_pipeline.md) for the workflow and
[`AGENTS.md`](AGENTS.md) for contribution rules.

## Repository layout

```text
public/                 Static application data and bundled assets
scripts/data_sources/  Reviewed source data and harvest tooling
scripts/generate_*.js  Deterministic domain generators
src/components/        Quiz, visualisation and explorer components
src/domains/           Domain registry and loaders
src/utils/             Persistence, learning and UI helpers
```

## Licensing and sources

The original software code is available under the [MIT License](LICENSE). Original editorial
dataset material is separately licensed under [CC BY-SA 4.0](DATA_LICENSE.md), where the project
holds the necessary rights. Images, quotations, fonts, map data and other third-party material keep
their own licences and are not relicensed by this repository. See
[`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md) and the per-asset credit files.

Project facts are traced to named sources. A source citation documents provenance; it does not
imply that the source endorses Scientia.
