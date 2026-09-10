import fs from 'fs';
import path from 'path';
// Dieselben Regeln, die auch der Audit anwendet (scripts/audit_questions.cjs):
// Der Generator soll gar nicht erst erzeugen, was der Audit anschlagen würde.
import { answerInStem } from './lib/audit_rules.cjs';
import { pickBalanced, seededShuffle } from './lib/quizrandom.js';

const PUBLIC_DIR = path.resolve('public/data');
const DATA_DIR = path.resolve('src/data');
const DATA_SOURCES_DIR = path.resolve('scripts/data_sources');
const COUNTRIES_GEOJSON_PATH = path.join(PUBLIC_DIR, 'countries.json');
const SUBDIVISIONS_GEOJSON_PATH = path.join(PUBLIC_DIR, 'subdivisions.json');
const GEODB_PATH = path.join(DATA_DIR, 'geodb.json');
const CURRENCY_DATA_PATH = path.join(DATA_SOURCES_DIR, 'terra_currency_raw.json');
// Ausgabe nach public/data/questions_terra.json — genau die Datei, die die App und
// verify_quiz.js einlesen (analog zu generate_astra/homo/…, die ebenfalls nach
// public/data schreiben). Frueher wurde nach src/data/quiz_questions.json geschrieben,
// was niemand las → der Regenerationslauf erzeugte eine tote Datei.
const QUESTIONS_OUTPUT = path.join(PUBLIC_DIR, 'questions_terra.json');

const LEVEL_1_COUNTRIES = new Set(['DE', 'AT', 'CH', 'FR', 'IT', 'GB', 'US']);
const LEVEL_3_PARENT_COUNTRIES = new Set(['DE', 'AT', 'CH', 'US', 'GB', 'FR', 'IT', 'ES', 'CA', 'AU']);

// Stadt -> Fluss, handgepflegt. Die Schluessel sind Kennungen aus geodb.json:
// Faellt eine Stadt aus dem Bestand oder aendert sich ihre Kennung, entsteht die
// zugehoerige Flussfrage still nicht mehr. src/__tests__/generatorTables.test.js
// prueft die Zuordnung deshalb gegen den Bestand.
//
// Bewusst nicht enthalten, weil die Stadt im Bestand fehlt (Pruefung 2026-09-10):
// Dresden (Elbe) und Basel (Rhein). Sobald sie aufgenommen sind, gehoeren sie
// hierher zurueck.
const CITY_TO_RIVER = {
  'city_DE_berlin': 'Spree',
  'city_GB_london': 'Themse',
  'city_FR_paris': 'Seine',
  'city_IT_rom': 'Tiber',
  'city_US_new_york_city': 'Hudson',
  'city_RU_sankt_petersburg': 'Newa',
  'city_DE_frankfurt_am_main': 'Main',
  'city_DE_muenchen': 'Isar',
  'city_DE_hamburg': 'Elbe',
  'city_AT_wien': 'Donau',
  'city_HU_budapest': 'Donau',
  'city_RS_belgrad': 'Donau',
  'city_SK_bratislava': 'Donau',
  'city_DE_koeln': 'Rhein',
  'city_DE_duesseldorf': 'Rhein',
  'city_NL_rotterdam': 'Rhein',
  'city_PT_lissabon': 'Tajo',
  'city_PL_warschau': 'Weichsel',
  'city_EG_kairo': 'Nil',
  'city_IQ_bagdad': 'Tigris',
  'city_CN_shanghai': 'Jangtsekiang',
  'city_CN_wuhan': 'Jangtsekiang'
};

const CONTINENT_NAMES_DE = {
  'Europe': 'Europa',
  'Africa': 'Afrika',
  'Asia': 'Asien',
  'North America': 'Nordamerika',
  'South America': 'Südamerika',
  'Oceania': 'Ozeanien',
  'Antarctica': 'Antarktika'
};

const generateSilhouettePath = (geom) => {
  if (!geom) return null;
  
  // Shoelace area calculator
  const getRingArea = (ring) => {
    let sum = 0;
    for (let i = 0; i < ring.length; i++) {
      const [x1, y1] = ring[i];
      const [x2, y2] = ring[(i + 1) % ring.length];
      sum += x1 * y2 - x2 * y1;
    }
    return Math.abs(sum) * 0.5;
  };

  // Convert geom coordinates to a uniform list of polygons
  let allPolys = [];
  if (geom.type === 'Polygon') {
    allPolys = [geom.coordinates];
  } else if (geom.type === 'MultiPolygon') {
    allPolys = geom.coordinates;
  }

  if (allPolys.length === 0) return null;

  // For each polygon, calculate area, bounding box and center
  const polysWithMeta = allPolys.map(poly => {
    if (poly.length === 0) return { poly, area: 0, center: [0, 0], minLng: 0, maxLng: 0, minLat: 0, maxLat: 0 };
    const area = getRingArea(poly[0]);
    
    let minLng = Infinity, maxLng = -Infinity;
    let minLat = Infinity, maxLat = -Infinity;
    poly[0].forEach(([lng, lat]) => {
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    });
    return {
      poly,
      area,
      center: [(minLng + maxLng) / 2, (minLat + maxLat) / 2],
      minLng,
      maxLng,
      minLat,
      maxLat
    };
  });

  // Find the largest area polygon (master)
  let master = polysWithMeta[0];
  polysWithMeta.forEach(p => {
    if (p.area > master.area) {
      master = p;
    }
  });

  const masterMinLng = master.minLng;
  const masterMaxLng = master.maxLng;
  const masterMinLat = master.minLat;
  const masterMaxLat = master.maxLat;
  const masterCenter = master.center;
  const aspectCorrection = Math.cos(masterCenter[1] * Math.PI / 180);
  const maxDistance = 15.0; // degrees threshold to keep nearby islands

  // Filter polygons that are within maxDistance of the master polygon's bounding box
  const selectedPolys = [];
  polysWithMeta.forEach(p => {
    if (p.area === 0) return;
    
    let dx = 0;
    if (p.center[0] < masterMinLng) {
      dx = (masterMinLng - p.center[0]) * aspectCorrection;
    } else if (p.center[0] > masterMaxLng) {
      dx = (p.center[0] - masterMaxLng) * aspectCorrection;
    }
    
    let dy = 0;
    if (p.center[1] < masterMinLat) {
      dy = masterMinLat - p.center[1];
    } else if (p.center[1] > masterMaxLat) {
      dy = p.center[1] - masterMaxLat;
    }
    
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist <= maxDistance) {
      selectedPolys.push(p.poly);
    }
  });

  if (selectedPolys.length === 0) return null;

  // Calculate local bounding box of all selected polygons combined
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;

  selectedPolys.forEach(poly => {
    poly.forEach(ring => {
      ring.forEach(([lng, lat]) => {
        const xLocal = (lng - masterCenter[0]) * aspectCorrection;
        const yLocal = lat - masterCenter[1];
        if (xLocal < minX) minX = xLocal;
        if (xLocal > maxX) maxX = xLocal;
        if (yLocal < minY) minY = yLocal;
        if (yLocal > maxY) maxY = yLocal;
      });
    });
  });

  const width = 160;
  const height = 160;
  const padding = 10;

  const spanX = maxX - minX || 0.1;
  const spanY = maxY - minY || 0.1;

  const scaleX = (width - 2 * padding) / spanX;
  const scaleY = (height - 2 * padding) / spanY;
  const scale = Math.min(scaleX, scaleY);

  const centerXLocal = (minX + maxX) / 2;
  const centerYLocal = (minY + maxY) / 2;

  const project = ([lng, lat]) => {
    const xLocal = (lng - masterCenter[0]) * aspectCorrection;
    const yLocal = lat - masterCenter[1];
    const x = width / 2 + (xLocal - centerXLocal) * scale;
    const y = height / 2 - (yLocal - centerYLocal) * scale; // Invert Y for screen
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  };

  let paths = [];
  selectedPolys.forEach(poly => {
    poly.forEach(ring => {
      if (ring.length === 0) return;
      const d = 'M' + ring.map(pt => project(pt)).join(' L') + ' Z';
      paths.push(d);
    });
  });

  return paths.join(' ');
};

const getDistractors = (entity, entities) => {
  let siblings = [];
  if (entity.type === 'state') {
    siblings = Object.values(entities).filter(e => 
      e.type === 'state' && 
      e.metadata?.countryId === entity.metadata?.countryId && 
      e.id !== entity.id
    );
    if (siblings.length < 3) {
      const others = Object.values(entities).filter(e => 
        e.type === 'state' && 
        e.id !== entity.id
      );
      siblings = [...siblings, ...others];
    }
  } else if (entity.type === 'city') {
    siblings = Object.values(entities).filter(e => 
      e.type === 'city' && 
      e.metadata?.countryId === entity.metadata?.countryId && 
      e.id !== entity.id
    );
    if (siblings.length < 3) {
      const others = Object.values(entities).filter(e => 
        e.type === 'city' && 
        e.id !== entity.id
      );
      siblings = [...siblings, ...others];
    }
  } else {
    siblings = Object.values(entities).filter(e => e.type === 'country' && e.id !== entity.id);
  }
  const names = siblings.map(s => s.name);
  const uniqueNames = [...new Set(names)].filter(name => name !== entity.name);

  return seededShuffle(uniqueNames, `terra:${entity.id}:name`).slice(0, 3);
};

const getDifficulty = (entity, entities) => {
  if (entity.type === 'country') {
    if (LEVEL_1_COUNTRIES.has(entity.id)) {
      return 1;
    } else if (entity.metadata?.area >= 25000) {
      return 2;
    } else {
      return 4;
    }
  } else if (entity.type === 'state') {
    if (LEVEL_3_PARENT_COUNTRIES.has(entity.metadata?.countryId)) {
      return 3;
    } else {
      return 4;
    }
  } else if (entity.type === 'city') {
    const parentCountryId = entity.metadata?.countryId;
    const parentCountry = entities[parentCountryId];
    const isMediumCountry = parentCountryId && (LEVEL_1_COUNTRIES.has(parentCountryId) || (parentCountry?.metadata?.area >= 25000));
    const isMediumCity = isMediumCountry && (entity.metadata?.isCapital || entity.population > 500000);
    if (isMediumCity) {
      return 2;
    } else {
      return 4;
    }
  } else if (entity.type === 'river') {
    return 2;
  }
  return 4;
};

const currencyAnswer = (entry) => `${entry.germanName} (${entry.isoCode})`;

/**
 * Wählt Währungsdistraktoren zuerst aus derselben Weltregion und derselben
 * Schwierigkeit. Erst wenn dieser fachlich nähere Pool zu klein ist, wird er
 * deterministisch mit weiteren belegten Währungen aufgefüllt.
 */
const getCurrencyDistractors = (entry, entity, currencyEntries, entities) => {
  const correct = currencyAnswer(entry);
  const seen = new Set([correct]);
  const chosen = [];
  const questionSeed = `q_${entity.id}_currency`;

  const takeFrom = (pool, stage) => {
    const answers = [];
    for (const candidate of pool) {
      const answer = currencyAnswer(candidate);
      if (seen.has(answer)) continue;
      seen.add(answer);
      answers.push(answer);
    }

    const picked = pickBalanced(
      correct,
      answers,
      3 - chosen.length,
      `${questionSeed}:${stage}`,
    );
    chosen.push(...picked);
  };

  const otherEntries = currencyEntries.filter((candidate) => candidate.entityId !== entity.id);
  const sameContinent = otherEntries.filter(
    (candidate) =>
      entities[candidate.entityId]?.metadata?.continent === entity.metadata?.continent,
  );
  const sameDifficulty = otherEntries.filter(
    (candidate) =>
      getDifficulty(entities[candidate.entityId], entities) === getDifficulty(entity, entities),
  );

  takeFrom(sameContinent, 'continent');
  if (chosen.length < 3) takeFrom(sameDifficulty, 'difficulty');
  if (chosen.length < 3) takeFrom(otherEntries, 'global');

  return chosen;
};

function run() {
  console.log('--- STARTING QUIZ QUESTION COMPILING ---');

  if (!fs.existsSync(GEODB_PATH)) {
    console.error(`Error: geodb.json not found at ${GEODB_PATH}`);
    process.exit(1);
  }
  if (!fs.existsSync(CURRENCY_DATA_PATH)) {
    console.error(`Error: terra_currency_raw.json not found at ${CURRENCY_DATA_PATH}`);
    process.exit(1);
  }

  const { entities } = JSON.parse(fs.readFileSync(GEODB_PATH, 'utf8'));
  const currencyData = JSON.parse(fs.readFileSync(CURRENCY_DATA_PATH, 'utf8'));
  if (
    currencyData.metadata?.candidateOnly !== false ||
    currencyData.metadata?.rawMergeApproved !== true ||
    currencyData.metadata?.questionReactivationApproved !== true
  ) {
    console.error('Error: Terra-Currency-Daten besitzen keine vollständige Merge-/Reaktivierungsfreigabe');
    process.exit(1);
  }
  const currencyEntries = currencyData.entries;
  const currencyByEntityId = new Map(
    currencyEntries.map((entry) => [entry.entityId, entry]),
  );
  
  let countriesGeo = { features: [] };
  if (fs.existsSync(COUNTRIES_GEOJSON_PATH)) {
    countriesGeo = JSON.parse(fs.readFileSync(COUNTRIES_GEOJSON_PATH, 'utf8'));
  }
  
  let subdivisionsGeo = { features: [] };
  if (fs.existsSync(SUBDIVISIONS_GEOJSON_PATH)) {
    subdivisionsGeo = JSON.parse(fs.readFileSync(SUBDIVISIONS_GEOJSON_PATH, 'utf8'));
  }

  const featuresMap = {};
  countriesGeo.features.forEach(f => {
    featuresMap[f.id] = f;
  });
  subdivisionsGeo.features.forEach(f => {
    featuresMap[f.id] = f;
  });

  const questions = [];

  const getCountryName = (cid) => entities[cid]?.name || cid;

  Object.values(entities).forEach(entity => {
    const difficulty = getDifficulty(entity, entities);
    
    if (entity.type === 'country') {
      // 1. Capital Question
      if (entity.metadata?.capital && entity.metadata.capital !== 'N/A') {
        const correctAnswer = entity.metadata.capital;
        const otherCapitals = Object.values(entities)
          .filter(e => e.type === 'country' && e.id !== entity.id && e.metadata?.capital && e.metadata.capital !== 'N/A')
          .map(e => e.metadata.capital);
        
        const dists = seededShuffle(
          [...new Set(otherCapitals)],
          `q_${entity.id}_capital`,
        ).slice(0, 3);
        const options = [correctAnswer, ...dists];

        questions.push({
          id: `q_${entity.id}_capital`,
          entityId: entity.id,
          entityType: entity.type,
          type: 'capital',
          difficulty: difficulty,
          prompt: `Was ist die Hauptstadt von ${entity.name}?`,
          correctAnswer: correctAnswer,
          options: options,
          silhouetteSvgPath: null,
          mapTargetId: entity.id
        });
      }

      // 2. Flag Question
      if (entity.metadata?.flag && entity.metadata.flag !== '🏳️') {
        const correctAnswer = entity.metadata.flag;
        const otherFlags = Object.values(entities)
          .filter(e => e.type === 'country' && e.id !== entity.id && e.metadata?.flag && e.metadata.flag !== '🏳️')
          .map(e => e.metadata.flag);

        const dists = seededShuffle(
          [...new Set(otherFlags)],
          `q_${entity.id}_flag`,
        ).slice(0, 3);
        const options = [correctAnswer, ...dists];

        questions.push({
          id: `q_${entity.id}_flag`,
          entityId: entity.id,
          entityType: entity.type,
          type: 'flag',
          difficulty: difficulty,
          prompt: `Welche Flagge gehört zu ${entity.name}?`,
          correctAnswer: correctAnswer,
          options: options,
          silhouetteSvgPath: null,
          mapTargetId: entity.id
        });
      }

      // 3. Continent Match (For all countries in the database)
      if (entity.metadata?.continent && entity.metadata.continent !== 'N/A') {
        const rawCont = entity.metadata.continent;
        const correctAnswer = CONTINENT_NAMES_DE[rawCont] || rawCont;
        const allContinents = ['Europa', 'Afrika', 'Asien', 'Nordamerika', 'Südamerika', 'Ozeanien'];
        const filteredConts = allContinents.filter(c => c !== correctAnswer);
        const dists = seededShuffle(
          filteredConts,
          `q_${entity.id}_continent`,
        ).slice(0, 3);
        const options = [correctAnswer, ...dists];
        const continentDiff = LEVEL_1_COUNTRIES.has(entity.id) ? 1 : (difficulty === 2 ? 2 : 3);

        questions.push({
          id: `q_${entity.id}_continent`,
          entityId: entity.id,
          entityType: entity.type,
          type: 'continent-match',
          difficulty: continentDiff,
          prompt: `Auf welchem Kontinent liegt ${entity.name}?`,
          correctAnswer: correctAnswer,
          options: options,
          silhouetteSvgPath: null,
          mapTargetId: entity.id
        });
      }

      // 3b. Highest Peak / Point Question
      if (entity.metadata?.highestPoint && entity.metadata.highestPoint !== 'N/A') {
        const correctAnswer = entity.metadata.highestPoint;
        const otherPeaks = Object.values(entities)
          .filter(e => e.type === 'country' && e.id !== entity.id && e.metadata?.highestPoint && e.metadata.highestPoint !== 'N/A')
          .map(e => e.metadata.highestPoint);
        
        const dists = seededShuffle(
          [...new Set(otherPeaks)].filter(p => p !== correctAnswer),
          `q_${entity.id}_highest_point`,
        ).slice(0, 3);
        const options = [correctAnswer, ...dists];

        if (options.length === 4) {
          questions.push({
            id: `q_${entity.id}_highest_point`,
            entityId: entity.id,
            entityType: entity.type,
            type: 'highest-point',
            difficulty: Math.min(4, difficulty + 1),
            prompt: `Was ist der höchste Berg bzw. Punkt in ${entity.name}?`,
            correctAnswer: correctAnswer,
            options: options,
            silhouetteSvgPath: null,
            mapTargetId: entity.id
          });
        }
      }

      // 3c. Währungsfrage
      // Die deutsche Bezeichnung und der ISO-Code stammen vollständig aus dem
      // verifizierten Currency-Rawkatalog. Fehlt ein Eintrag oder ist er wegen
      // Länderadjektiv-/Gebiets-Leak gesperrt, entsteht bewusst keine Frage:
      // Es gibt keinen englischen Durchreich-Fallback mehr.
      const currencyEntry = currencyByEntityId.get(entity.id);
      if (currencyEntry?.questionStatus === 'eligible') {
        const correctAnswer = currencyAnswer(currencyEntry);
        const dists = getCurrencyDistractors(
          currencyEntry,
          entity,
          currencyEntries,
          entities,
        );
        const options = [correctAnswer, ...dists];

        if (options.length === 4) {
          questions.push({
            id: `q_${entity.id}_currency`,
            entityId: entity.id,
            entityType: entity.type,
            type: 'currency',
            difficulty: Math.min(4, difficulty),
            prompt: `Welche dieser Währungen wird in ${entity.name} verwendet?`,
            correctAnswer: correctAnswer,
            options: options,
            silhouetteSvgPath: null,
            mapTargetId: entity.id
          });
        }
      }

      // 4. Silhouette Question
      const feature = featuresMap[entity.id];
      if (feature && feature.geometry) {
        const pathData = generateSilhouettePath(feature.geometry);
        if (pathData) {
          const correctAnswer = entity.name;
          const options = [correctAnswer, ...getDistractors(entity, entities)];

          questions.push({
            id: `q_${entity.id}_silhouette`,
            entityId: entity.id,
            entityType: entity.type,
            type: 'silhouette',
            difficulty: difficulty,
            prompt: `Welcher Ort besitzt diesen Umriss?`,
            correctAnswer: correctAnswer,
            options: options,
            silhouetteSvgPath: pathData,
            mapTargetId: entity.id
          });
        }
      }

      // 5. Click Map Question
      if (feature && feature.geometry) {
        questions.push({
          id: `q_${entity.id}_clickmap`,
          entityId: entity.id,
          entityType: entity.type,
          type: 'click-map',
          difficulty: difficulty,
          prompt: `Finde und klicke auf das Land: ${entity.name}`,
          correctAnswer: entity.id,
          options: [],
          silhouetteSvgPath: null,
          mapTargetId: entity.id
        });
      }
    } else if (entity.type === 'state') {
      const parentCountryId = entity.metadata?.countryId;
      const countryName = getCountryName(parentCountryId);

      // 1. State Match (MCQ Name Match)
      const correctAnswer = entity.name;
      const options = [correctAnswer, ...getDistractors(entity, entities)];

      questions.push({
        id: `q_${entity.id}_statematch`,
        entityId: entity.id,
        entityType: entity.type,
        type: 'state-match',
        difficulty: difficulty,
        prompt: `Welches Bundesland/Bundesstaat in ${countryName} besitzt diesen Namen?`,
        correctAnswer: correctAnswer,
        options: options,
        silhouetteSvgPath: null,
        mapTargetId: entity.id
      });

      // 2. Silhouette Question
      const feature = featuresMap[entity.id];
      if (feature && feature.geometry) {
        const pathData = generateSilhouettePath(feature.geometry);
        if (pathData) {
          questions.push({
            id: `q_${entity.id}_silhouette`,
            entityId: entity.id,
            entityType: entity.type,
            type: 'silhouette',
            difficulty: difficulty,
            prompt: `Welcher Ort besitzt diesen Umriss?`,
            correctAnswer: correctAnswer,
            options: options,
            silhouetteSvgPath: pathData,
            mapTargetId: entity.id
          });
        }
      }

      // 3. Click Map Question
      if (feature && feature.geometry) {
        questions.push({
          id: `q_${entity.id}_clickmap`,
          entityId: entity.id,
          entityType: entity.type,
          type: 'click-map',
          difficulty: difficulty,
          prompt: `Finde und klicke auf: ${entity.name} (${countryName})`,
          correctAnswer: entity.id,
          options: [],
          silhouetteSvgPath: null,
          mapTargetId: entity.id
        });
      }

      // 4. State Parent Match
      if (parentCountryId) {
        const correctAnswer = countryName;
        const otherCountries = Object.values(entities)
          .filter(e => e.type === 'country' && e.id !== parentCountryId)
          .map(e => e.name);
        
        const dists = seededShuffle(
          [...new Set(otherCountries)],
          `q_${entity.id}_stateparent`,
        ).slice(0, 3);
        const options = [correctAnswer, ...dists];

        questions.push({
          id: `q_${entity.id}_stateparent`,
          entityId: entity.id,
          entityType: entity.type,
          type: 'state-parent',
          difficulty: difficulty,
          prompt: `In welchem Land liegt das Bundesland / der Bundesstaat bzw. die Region ${entity.name}?`,
          correctAnswer: correctAnswer,
          options: options,
          silhouetteSvgPath: null,
          mapTargetId: parentCountryId
        });
      }
    } else if (entity.type === 'city') {
      // 1. City Match (Where does this city lie?)
      const countryId = entity.metadata?.countryId;
      const correctAnswer = getCountryName(countryId);
      
      const otherCountries = Object.values(entities)
        .filter(e => e.type === 'country' && e.id !== countryId)
        .map(e => e.name);
      
      const dists = seededShuffle(
        [...new Set(otherCountries)],
        `q_${entity.id}_citymatch`,
      ).slice(0, 3);
      const options = [correctAnswer, ...dists];

      questions.push({
        id: `q_${entity.id}_citymatch`,
        entityId: entity.id,
        entityType: entity.type,
        type: 'city-match',
        difficulty: difficulty,
        prompt: `In welchem Land liegt die Stadt ${entity.name}?`,
        correctAnswer: correctAnswer,
        options: options,
        silhouetteSvgPath: null,
        mapTargetId: countryId
      });

      // 2. Reverse City Match (Which of these cities lies in country?)
      if (countryId) {
        const cCorrectAnswer = entity.name;
        const otherCities = Object.values(entities)
          .filter(e => e.type === 'city' && e.metadata?.countryId !== countryId)
          .map(e => e.name);

        const cDists = seededShuffle(
          [...new Set(otherCities)].filter(c => c !== cCorrectAnswer),
          `q_${entity.id}_reverse_city`,
        ).slice(0, 3);
        const cOptions = [cCorrectAnswer, ...cDists];

        if (cOptions.length === 4) {
          questions.push({
            id: `q_${entity.id}_reverse_city`,
            entityId: entity.id,
            entityType: entity.type,
            type: 'reverse-city-match',
            difficulty: difficulty,
            prompt: `Welche dieser Städte liegt in ${correctAnswer}?`,
            correctAnswer: cCorrectAnswer,
            options: cOptions,
            silhouetteSvgPath: null,
            mapTargetId: countryId
          });
        }
      }

      // 3. City River Question (which river flows through this city?)
      if (CITY_TO_RIVER[entity.id]) {
        const rCorrectAnswer = CITY_TO_RIVER[entity.id];
        const otherRivers = Object.values(entities)
          .filter(e => e.type === 'river' && e.name !== rCorrectAnswer)
          .map(e => e.name);
          
        const rDists = seededShuffle(
          [...new Set(otherRivers)],
          `q_${entity.id}_river`,
        ).slice(0, 3);
        const rOptions = [rCorrectAnswer, ...rDists];
        
        let riverDiff = ['city_DE_berlin', 'city_GB_london', 'city_FR_paris'].includes(entity.id) ? 1 : 2;

        questions.push({
          id: `q_${entity.id}_river`,
          entityId: entity.id,
          entityType: entity.type,
          type: 'city-river',
          difficulty: riverDiff,
          prompt: `Welcher Fluss fließt direkt durch die Stadt ${entity.name}?`,
          correctAnswer: rCorrectAnswer,
          options: rOptions,
          silhouetteSvgPath: null,
          mapTargetId: countryId || 'DE'
        });
      }
    } else if (entity.type === 'river') {
      // 1. River country flow check (for each country the river flows through)
      const riverCountries = entity.metadata?.countries || [];
      riverCountries.forEach(cId => {
        const countryName = getCountryName(cId);
        const correctAnswer = countryName;
        
        const otherCountries = Object.values(entities)
          .filter(e => e.type === 'country' && !riverCountries.includes(e.id))
          .map(e => e.name);
          
        const dists = seededShuffle(
          [...new Set(otherCountries)],
          `q_${entity.id}_country_${cId}`,
        ).slice(0, 3);
        const options = [correctAnswer, ...dists];
        
        let riverDiff = 3;
        if (cId === 'DE') {
          const majorGerman = ['river_rhein', 'river_donau', 'river_elbe', 'river_weser', 'river_main', 'river_oder', 'river_mosel', 'river_spree'];
          riverDiff = majorGerman.includes(entity.id) ? 1 : 2;
        } else if (['EG', 'BR', 'US', 'GB', 'FR'].includes(cId)) {
          const majorWorld = ['river_nil', 'river_amazonas', 'river_mississippi', 'river_themse', 'river_seine'];
          if (majorWorld.includes(entity.id)) riverDiff = 1;
        }
        
        if (options.length === 4) {
          questions.push({
            id: `q_${entity.id}_country_${cId}`,
            entityId: entity.id,
            entityType: entity.type,
            type: 'river-country',
            difficulty: riverDiff,
            prompt: `Durch welches dieser Länder fließt der Fluss ${entity.name} unter anderem?`,
            correctAnswer: correctAnswer,
            options: options,
            silhouetteSvgPath: null,
            mapTargetId: cId
          });
        }
      });

      // 2. Reverse River Country Match
      const primaryCId = riverCountries[0];
      if (primaryCId) {
        const primaryCountryName = getCountryName(primaryCId);
        const correctAnswer = entity.name;
        
        const otherRivers = Object.values(entities)
          .filter(e => e.type === 'river' && e.id !== entity.id && !(e.metadata?.countries || []).includes(primaryCId))
          .map(e => e.name);
          
        const dists = seededShuffle(
          [...new Set(otherRivers)],
          `q_${entity.id}_reverse_country`,
        ).slice(0, 3);
        const options = [correctAnswer, ...dists];
        
        let riverDiff = 2;
        if (primaryCId === 'DE') {
          const majorGerman = ['river_rhein', 'river_donau', 'river_elbe'];
          riverDiff = majorGerman.includes(entity.id) ? 1 : 2;
        } else if (['river_nil', 'river_amazonas', 'river_mississippi'].includes(entity.id)) {
          riverDiff = 1;
        }
        
        if (options.length === 4) {
          questions.push({
            id: `q_${entity.id}_reverse_country`,
            entityId: entity.id,
            entityType: entity.type,
            type: 'reverse-river-country',
            difficulty: riverDiff,
            prompt: `Welcher dieser bekannten Flüsse fließt unter anderem durch ${primaryCountryName}?`,
            correctAnswer: correctAnswer,
            options: options,
            silhouetteSvgPath: null,
            mapTargetId: primaryCId
          });
        }
      }

      // 3. Mouth/Outflow Question
      if (entity.metadata?.mouth) {
        const correctAnswer = entity.metadata.mouth;
        const otherMouths = Object.values(entities)
          .filter(e => e.type === 'river' && e.id !== entity.id && e.metadata?.mouth)
          .map(e => e.metadata.mouth);
          
        const dists = seededShuffle(
          [...new Set(otherMouths)].filter(m => m !== correctAnswer),
          `q_${entity.id}_mouth`,
        ).slice(0, 3);
        const options = [correctAnswer, ...dists];
        
        let riverDiff = ['river_nil', 'river_amazonas', 'river_mississippi', 'river_rhein', 'river_donau', 'river_elbe', 'river_themse', 'river_seine'].includes(entity.id) ? 2 : 3;
        
        if (options.length === 4) {
          questions.push({
            id: `q_${entity.id}_mouth`,
            entityId: entity.id,
            entityType: entity.type,
            type: 'river-mouth',
            difficulty: riverDiff,
            prompt: `In welches Gewässer mündet der Fluss ${entity.name}?`,
            correctAnswer: correctAnswer,
            options: options,
            silhouetteSvgPath: null,
            mapTargetId: primaryCId || 'DE'
          });
        }
      }



      // 5. Eselsbrücken / Merksprüche
      entity.facts.forEach((fact, idx) => {
        if (fact.includes('Eselsbrücke') || fact.includes('Merkspruch')) {
          if (entity.id === 'river_donau' && fact.includes('Brigach und Breg')) {
            questions.push({
              id: `q_${entity.id}_esel_quell`,
              entityId: entity.id,
              entityType: entity.type,
              type: 'river-mnemonic',
              difficulty: 2,
              prompt: `Vervollständige die bekannte Eselsbrücke für die Donau-Quellflüsse: „Brigach und ... bringen die Donau zuweg.“`,
              correctAnswer: 'Breg',
              options: seededShuffle(
                ['Breg', 'Inn', 'Lech', 'Fulda'],
                `q_${entity.id}_esel_quell`,
              ),
              silhouetteSvgPath: null,
              mapTargetId: 'DE'
            });
          }
          
          if (entity.id === 'river_donau' && fact.includes('Iller, Lech, Isar, Inn')) {
            questions.push({
              id: `q_${entity.id}_esel_rechts`,
              entityId: entity.id,
              entityType: entity.type,
              type: 'river-mnemonic',
              difficulty: 1,
              prompt: `Welcher Fluss gehört zu den rechten Donau-Nebenflüssen laut Reim: „Iller, Lech, ..., Inn fließen rechts zur Donau hin.“?`,
              correctAnswer: 'Isar',
              options: seededShuffle(
                ['Isar', 'Naab', 'Main', 'Mosel'],
                `q_${entity.id}_esel_rechts`,
              ),
              silhouetteSvgPath: null,
              mapTargetId: 'DE'
            });
            
            questions.push({
              id: `q_${entity.id}_esel_rechts_all`,
              entityId: entity.id,
              entityType: entity.type,
              type: 'river-mnemonic',
              difficulty: 1,
              prompt: `Welcher dieser Flüsse fließt laut bekanntem Merkspruch „rechts zur Donau hin“?`,
              correctAnswer: 'Lech',
              options: seededShuffle(
                ['Lech', 'Altmühl', 'Naab', 'Regen'],
                `q_${entity.id}_esel_rechts_all`,
              ),
              silhouetteSvgPath: null,
              mapTargetId: 'DE'
            });
          }
          
          if (entity.id === 'river_donau' && fact.includes('Altmühl, Naab und Regen')) {
            questions.push({
              id: `q_${entity.id}_esel_links`,
              entityId: entity.id,
              entityType: entity.type,
              type: 'river-mnemonic',
              difficulty: 2,
              prompt: `Welcher Fluss fließt der Donau laut Eselsbrücke von links entgegen? „..., Naab und Regen fließen ihr entgegen.“`,
              correctAnswer: 'Altmühl',
              options: seededShuffle(
                ['Altmühl', 'Iller', 'Lech', 'Isar'],
                `q_${entity.id}_esel_links`,
              ),
              silhouetteSvgPath: null,
              mapTargetId: 'DE'
            });
          }
          
          if (entity.id === 'river_weser' && fact.includes('Werra und Fulda')) {
            questions.push({
              id: `q_${entity.id}_esel_weser`,
              entityId: entity.id,
              entityType: entity.type,
              type: 'river-mnemonic',
              difficulty: 1,
              prompt: `Welcher Fluss vereinigt sich mit der Werra zur Weser, wie im bekannten Merkspruch „Wo Werra und ... sich küssen...“ beschrieben?`,
              correctAnswer: 'Fulda',
              options: seededShuffle(
                ['Fulda', 'Aller', 'Lahn', 'Ems'],
                `q_${entity.id}_esel_weser`,
              ),
              silhouetteSvgPath: null,
              mapTargetId: 'DE'
            });
          }
          
          if (entity.id === 'river_rhein' && fact.includes('Hunsrück')) {
            questions.push({
              id: `q_${entity.id}_esel_hunsrueck`,
              entityId: entity.id,
              entityType: entity.type,
              type: 'river-mnemonic',
              difficulty: 2,
              prompt: `Welcher Fluss schließt den Hunsrück ein laut Merkspruch: „Mosel, ..., Nahe, Rhein schließen rings den Hunsrück ein.“?`,
              correctAnswer: 'Saar',
              options: seededShuffle(
                ['Saar', 'Lahn', 'Ruhr', 'Main'],
                `q_${entity.id}_esel_hunsrueck`,
              ),
              silhouetteSvgPath: null,
              mapTargetId: 'DE'
            });
          }
          
          if (entity.id === 'river_main' && fact.includes('Spessart')) {
            questions.push({
              id: `q_${entity.id}_esel_spessart`,
              entityId: entity.id,
              entityType: entity.type,
              type: 'river-mnemonic',
              difficulty: 2,
              prompt: `Welcher Fluss umschließt den Spessart laut Eselsbrücke? „Kinzig, ... und Main schließen den Spessart ein.“`,
              correctAnswer: 'Sinn',
              options: seededShuffle(
                ['Sinn', 'Saar', 'Nahe', 'Lahn'],
                `q_${entity.id}_esel_spessart`,
              ),
              silhouetteSvgPath: null,
              mapTargetId: 'DE'
            });
          }
        }
      });
    }
  });

  // --- Fairness-Gates vor dem Schreiben -----------------------------------
  // Ein zentraler Punkt statt Guards an 20+ push-Stellen: leichter zu pruefen
  // und niemand vergisst ihn beim Ergaenzen eines Fragetyps.

  // Stillgelegte Fragetypen (Grund jeweils am Erzeugungsort dokumentiert).
  const DISABLED_TYPES = new Set();

  const before = questions.length;
  const disabled = questions.filter(q => DISABLED_TYPES.has(q.type));
  let kept = questions.filter(q => !DISABLED_TYPES.has(q.type));

  // Selbstverraeter: Steht die Antwort als eigenstaendiges Wort im Fragetext,
  // ist die Frage per String-Abgleich loesbar — ohne jedes Geografiewissen
  // ("Was ist die Hauptstadt von Luxemburg?" -> "Luxemburg"). Wortgrenzen statt
  // Substring, damit bekannte Trivialnamen, die echtes Kategorienwissen tragen
  // ("Suedafrika" -> "Afrika"), erhalten bleiben.
  const leaking = kept.filter(q => answerInStem(q.prompt, q.correctAnswer));
  kept = kept.filter(q => !answerInStem(q.prompt, q.correctAnswer));

  // Abzuege sichtbar machen: eine stille Kuerzung liest sich spaeter wie
  // "war schon immer so".
  console.log(
    DISABLED_TYPES.size > 0
      ? `Stillgelegte Typen (${[...DISABLED_TYPES].join(', ')}): ${disabled.length} Fragen entfernt`
      : 'Stillgelegte Typen: keine',
  );
  console.log(`Selbstverraeter (Antwort als Wort im Fragetext): ${leaking.length} Fragen entfernt`);
  for (const q of leaking) console.log(`   - [${q.type}] ${q.prompt} => ${q.correctAnswer}`);

  fs.writeFileSync(QUESTIONS_OUTPUT, JSON.stringify(kept, null, 2));
  console.log(`Saved pre-compiled quiz questions to: ${QUESTIONS_OUTPUT}`);
  console.log(`Total questions compiled: ${kept.length} (aus ${before} erzeugten)`);
  console.log('--- QUIZ QUESTION COMPILING COMPLETE ---');
}

run();
