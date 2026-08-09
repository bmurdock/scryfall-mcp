export function getUnquotedParenthesisStats(query: string): {
  currentNesting: number;
  maxNesting: number;
} {
  let currentNesting = 0;
  let maxNesting = 0;
  let inQuotes = false;

  for (const char of query) {
    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (inQuotes) {
      continue;
    }

    if (char === '(') {
      currentNesting++;
      maxNesting = Math.max(maxNesting, currentNesting);
    } else if (char === ')') {
      currentNesting--;
    }
  }

  return { currentNesting, maxNesting };
}
