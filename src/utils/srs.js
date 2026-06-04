/**
 * Spaced Repetition System (SRS) using the SuperMemo-2 (SM-2) algorithm.
 * Calculates next review intervals based on user feedback quality.
 */

export const QUALITY = {
  BLACKOUT: 0, // Complete failure to recall
  INCORRECT_EASY: 1, // Incorrect, but remembered the answer when shown
  INCORRECT_HARD: 2, // Incorrect, felt very unfamiliar
  CORRECT_HARD: 3, // Correct, required serious effort to recall
  CORRECT_MEDIUM: 4, // Correct, recalled after a brief hesitation
  CORRECT_EASY: 5, // Perfect response, immediate recall
};

/**
 * Calculates the next SRS state for a card/item.
 * 
 * @param {Object} itemState - Current SRS parameters of the item
 * @param {number} itemState.repetitions - Number of successful consecutive reviews
 * @param {number} itemState.interval - Current interval in days
 * @param {number} itemState.easiness - Current easiness factor (EF) (typically starts at 2.5)
 * @param {number} quality - User answer quality (integer from 0 to 5)
 * @returns {Object} Updated SRS parameters: { repetitions, interval, easiness, nextDueDate }
 */
export function calculateSRS(itemState, quality) {
  // Safe defaults if item is new
  let { repetitions = 0, interval = 0, easiness = 2.5 } = itemState || {};
  
  // Ensure quality is between 0 and 5
  quality = Math.max(0, Math.min(5, Math.floor(quality)));

  // If answer was incorrect (quality < 3), reset repetitions and set interval to 1 day
  if (quality < 3) {
    repetitions = 0;
    interval = 1;
  } else {
    // If answer was correct (quality >= 3)
    if (repetitions === 0) {
      interval = 1;
    } else if (repetitions === 1) {
      interval = 6;
    } else {
      interval = Math.round(interval * easiness);
    }
    repetitions++;
  }

  // Adjust Easiness Factor (EF)
  // formula: EF' = EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
  easiness = easiness + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  
  // Easiness factor cannot fall below 1.3
  if (easiness < 1.3) {
    easiness = 1.3;
  }

  // Calculate next due date (relative to current time)
  const nextDueDate = new Date();
  nextDueDate.setDate(nextDueDate.getDate() + interval);
  // Set to midnight of the due day to keep reviews daily
  nextDueDate.setHours(0, 0, 0, 0);

  return {
    repetitions,
    interval,
    easiness,
    nextDueDate: nextDueDate.getTime(), // Store as epoch timestamp
  };
}

/**
 * Maps a binary correctness value (true/false) to a SM-2 quality.
 * This is useful for simple click-based questions where there isn't a granular 0-5 rating.
 * 
 * @param {boolean} isCorrect - Whether the user answered correctly
 * @param {number} attempts - How many attempts they took (1 = perfect, etc.)
 * @returns {number} Quality score from 0 to 5
 */
export function mapBinaryToQuality(isCorrect, attempts = 1) {
  if (!isCorrect) {
    return attempts >= 3 ? QUALITY.BLACKOUT : QUALITY.INCORRECT_HARD;
  }
  
  if (attempts === 1) {
    return QUALITY.CORRECT_EASY; // First try
  } else if (attempts === 2) {
    return QUALITY.CORRECT_MEDIUM; // Second try
  } else {
    return QUALITY.CORRECT_HARD; // Third try or more
  }
}
