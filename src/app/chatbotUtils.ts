export function keywordDistanceIsOne(left: string, right: string): boolean {
  if (Math.abs(left.length - right.length) > 1) return false;
  let leftIndex = 0;
  let rightIndex = 0;
  let differences = 0;

  while (leftIndex < left.length && rightIndex < right.length) {
    if (left[leftIndex] === right[rightIndex]) {
      leftIndex++;
      rightIndex++;
      continue;
    }
    differences++;
    if (differences > 1) return false;
    if (left.length > right.length) leftIndex++;
    else if (right.length > left.length) rightIndex++;
    else {
      leftIndex++;
      rightIndex++;
    }
  }

  if (leftIndex < left.length || rightIndex < right.length) differences++;
  return differences === 1;
}

export const CHATBOT_STOP_WORDS = new Set([
  "a", "an", "the", "how", "do", "does", "did", "i", "me", "my", "you", "your",
  "what", "whats", "when", "where", "why", "can", "could", "would", "should",
  "is", "are", "am", "to", "for", "of", "on", "in", "with", "please", "tell",
]);