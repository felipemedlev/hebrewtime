import { FlashcardRating } from "./types";

/**
 * SuperMemo SM-2 Spaced Repetition Algorithm
 * 
 * Rating meanings:
 * 0: "Again" - Total blackout, forgot the word completely.
 * 1: "Hard" - Incorrect response; the correct one felt familiar but was hard to remember.
 * 3: "Good" - Correct response; recalled after some hesitation.
 * 5: "Easy" - Perfect response; instant recall.
 * 
 * Returns the updated interval, repetitions, and ease factor.
 */
export function calculateSM2(
  rating: FlashcardRating,
  prevIntervalDays: number,
  prevRepetitions: number,
  prevEaseFactor: number
): {
  intervalDays: number;
  repetitions: number;
  easeFactor: number;
  isLearned: boolean;
} {
  let easeFactor = prevEaseFactor;
  let repetitions = prevRepetitions;
  let intervalDays = prevIntervalDays;

  if (rating >= 3) {
    // Correct response
    if (repetitions === 0) {
      intervalDays = 1;
    } else if (repetitions === 1) {
      intervalDays = 6;
    } else {
      intervalDays = Math.round(prevIntervalDays * easeFactor);
    }
    repetitions++;
  } else {
    // Incorrect response (Again or Hard)
    repetitions = 0;
    intervalDays = 1; // Try again tomorrow (or standard 1 day)
  }

  // Adjust Ease Factor based on quality rating
  // SM-2 formula: EF' = EF + (0.1 - (5 - rating) * (0.08 + (5 - rating) * 0.02))
  // Simplified for ratings [0, 1, 3, 5]:
  easeFactor = easeFactor + (0.1 - (5 - rating) * (0.08 + (5 - rating) * 0.02));

  // Cap Ease Factor to a minimum of 1.3
  if (easeFactor < 1.3) {
    easeFactor = 1.3;
  }

  // A card is considered fully learned if its review interval reaches 21 days or more
  const isLearned = intervalDays >= 21;

  return {
    intervalDays,
    repetitions,
    easeFactor,
    isLearned,
  };
}
