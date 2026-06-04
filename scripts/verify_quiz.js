import fs from 'fs';
import path from 'path';

const DATA_DIR = path.resolve('src/data');
const PUBLIC_DIR = path.resolve('public/data');
const QUESTIONS_PATH = path.join(DATA_DIR, 'quiz_questions.json');
const COUNTRIES_GEOJSON_PATH = path.join(PUBLIC_DIR, 'countries.json');
const SUBDIVISIONS_GEOJSON_PATH = path.join(PUBLIC_DIR, 'subdivisions.json');

const ENGLISH_CAPITALS = new Set([
  'Vienna', 'Rome', 'Warsaw', 'Prague', 'Copenhagen', 'Lisbon', 'Athens',
  'Brussels', 'Bucharest', 'Moscow', 'Beijing', 'New Delhi', 'Cairo',
  'Kyiv', 'Reykjavik', 'Mexico City', 'Panama City', 'Guatemala City',
  'Vatican City', 'Luxembourg', 'Tehran', 'Baghdad', 'Riyadh', 'Kuwait City',
  'Damascus', 'Yerevan', 'Tbilisi', 'Ulan Bator', 'Tripoli', 'Algiers',
  'Addis Ababa', 'Khartoum', 'Prishtina', 'Havana', 'Cape Town', 'Singapore'
]);

const getExpectedFlag = (cca2) => {
  if (!cca2 || cca2.length !== 2) return null;
  return cca2.toUpperCase().replace(/./g, char => 
    String.fromCodePoint(char.charCodeAt(0) + 127397)
  );
};

function run() {
  console.log('--- STARTING QUIZ VERIFICATION SCRIPT ---');

  if (!fs.existsSync(QUESTIONS_PATH)) {
    console.error(`FAIL: quiz_questions.json not found at ${QUESTIONS_PATH}`);
    process.exit(1);
  }

  const questions = JSON.parse(fs.readFileSync(QUESTIONS_PATH, 'utf8'));
  console.log(`Loaded ${questions.length} questions for validation.`);

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

  let passed = 0;
  let failed = 0;
  const errors = [];

  const assert = (condition, questionId, message) => {
    if (condition) {
      passed++;
    } else {
      failed++;
      errors.push(`[${questionId}] ${message}`);
    }
  };

  questions.forEach(q => {
    // 1. Check basic structure
    assert(q.id && typeof q.id === 'string', q.id || 'unknown', 'ID is missing or not a string');
    assert(q.entityId && typeof q.entityId === 'string', q.id, 'entityId is missing');
    assert(q.type && typeof q.type === 'string', q.id, 'type is missing');
    assert(typeof q.difficulty === 'number' && q.difficulty >= 1 && q.difficulty <= 4, q.id, `Invalid difficulty: ${q.difficulty}`);
    assert(q.prompt && typeof q.prompt === 'string', q.id, 'prompt is missing');
    assert(q.correctAnswer && typeof q.correctAnswer === 'string', q.id, 'correctAnswer is missing');
    assert(q.mapTargetId && typeof q.mapTargetId === 'string', q.id, 'mapTargetId is missing');

    // 2. MCQ options checks (only for non-click-map)
    if (q.type !== 'click-map') {
      assert(Array.isArray(q.options), q.id, 'options is not an array');
      if (Array.isArray(q.options)) {
        assert(q.options.length === 4, q.id, `options length is ${q.options.length}, expected 4`);
        assert(new Set(q.options).size === q.options.length, q.id, 'options contain duplicate values');
        assert(q.options.includes(q.correctAnswer), q.id, `options do not include correctAnswer: ${q.correctAnswer}`);
      }
    } else {
      assert(Array.isArray(q.options) && q.options.length === 0, q.id, 'click-map options should be an empty array');
    }

    // 3. Capital translation verification
    if (q.type === 'capital') {
      assert(!ENGLISH_CAPITALS.has(q.correctAnswer), q.id, `Capital is in English: "${q.correctAnswer}". Expected German translation.`);
    }

    // 4. Flag Format Verification
    if (q.type === 'flag' && q.entityType === 'country') {
      const expectedFlag = getExpectedFlag(q.entityId);
      assert(q.correctAnswer === expectedFlag, q.id, `Incorrect flag for ${q.entityId}. Expected: ${expectedFlag}, got: ${q.correctAnswer}`);
    }

    // 5. Silhouette Bounding Box & Geometry Test
    if (q.type === 'silhouette') {
      assert(typeof q.silhouetteSvgPath === 'string' && q.silhouetteSvgPath.length > 0, q.id, 'silhouetteSvgPath is missing or empty');
      if (typeof q.silhouetteSvgPath === 'string' && q.silhouetteSvgPath.length > 0) {
        // Extract coordinate numbers from the SVG path
        const coords = (q.silhouetteSvgPath.match(/[-+]?[0-9]*\.?[0-9]+/g) || []).map(Number);
        assert(coords.length > 0, q.id, 'Failed to parse coordinates from silhouetteSvgPath');
        
        if (coords.length > 0) {
          // Bounding box in 160x160 SVG space
          let minX = Infinity, maxX = -Infinity;
          let minY = Infinity, maxY = -Infinity;
          
          for (let i = 0; i < coords.length; i += 2) {
            const x = coords[i];
            const y = coords[i+1];
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }

          const spanX = maxX - minX;
          const spanY = maxY - minY;
          assert(spanX > 0 && spanY > 0, q.id, `Invalid dimensions: ${spanX}x${spanY}`);
          
          const aspectRatio = spanX / spanY;
          assert(aspectRatio >= 0.1 && aspectRatio <= 5.0, q.id, `Aspect ratio out of realistic bounds: ${aspectRatio.toFixed(2)}`);
          
          // Verify that coordinates fit within the SVG canvas [0, 160] with small allowance for rounding
          assert(minX >= -1 && maxX <= 161 && minY >= -1 && maxY <= 161, q.id, `Coordinates out of canvas: [${minX}, ${maxX}] x [${minY}, ${maxY}]`);
        }
      }
    }

    // 6. Click-map target validation
    if (q.type === 'click-map') {
      const feature = featuresMap[q.mapTargetId];
      assert(feature && feature.geometry, q.id, `click-map target ${q.mapTargetId} does not have valid geometry in GeoJSON`);
    }
  });

  console.log('\n--- VERIFICATION REPORT ---');
  console.log(`Passed checks: ${passed}`);
  console.log(`Failed checks: ${failed}`);

  if (failed > 0) {
    console.error(`\nFAILED! Found ${failed} validation errors:`);
    errors.forEach(err => console.error(err));
    process.exit(1);
  } else {
    console.log('\nSUCCESS! All quiz questions passed verification.');
    process.exit(0);
  }
}

run();
