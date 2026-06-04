import { calculateSRS } from '../src/utils/srs.js';
import assert from 'assert';

console.log('Running Spaced Repetition System (SRS) tests...');

try {
  // Test 1: New card (empty state) answered with perfect recall (Quality 5)
  const state1 = calculateSRS(null, 5);
  console.log('Test 1: New Item, Quality 5');
  assert.strictEqual(state1.repetitions, 1);
  assert.strictEqual(state1.interval, 1);
  assert.ok(state1.easiness > 2.5, 'Easiness factor should increase for quality 5');
  console.log('  Passed!');

  // Test 2: Card with repetitions=1 answered with perfect recall (Quality 5)
  const state2 = calculateSRS(state1, 5);
  console.log('Test 2: Repetitions 1, Quality 5');
  assert.strictEqual(state2.repetitions, 2);
  assert.strictEqual(state2.interval, 6);
  console.log('  Passed!');

  // Test 3: Card with repetitions=2 answered with correct recall (Quality 4)
  const state3 = calculateSRS(state2, 4);
  console.log('Test 3: Repetitions 2, Quality 4');
  assert.strictEqual(state3.repetitions, 3);
  assert.strictEqual(state3.interval, Math.round(6 * state2.easiness));
  console.log('  Passed!');

  // Test 4: Blackout failure (Quality 0) resets repetitions and interval
  const state4 = calculateSRS(state3, 0);
  console.log('Test 4: Review Failure, Quality 0');
  assert.strictEqual(state4.repetitions, 0, 'Repetitions should reset to 0');
  assert.strictEqual(state4.interval, 1, 'Interval should reset to 1 day');
  assert.ok(state4.easiness < state3.easiness, 'Easiness factor should decrease');
  console.log('  Passed!');

  // Test 5: Easiness factor lower bound is 1.3
  let state = { repetitions: 5, interval: 30, easiness: 1.3 };
  const stateLower = calculateSRS(state, 0);
  console.log('Test 5: Easiness lower bound check');
  assert.strictEqual(stateLower.easiness, 1.3, 'Easiness should clamp to 1.3');
  console.log('  Passed!');

  console.log('\nAll SRS scheduler tests completed successfully! 🎉');
} catch (error) {
  console.error('\nTest verification failed:', error.message);
  process.exit(1);
}
