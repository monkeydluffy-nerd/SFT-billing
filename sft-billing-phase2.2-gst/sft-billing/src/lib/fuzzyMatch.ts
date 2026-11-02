export interface FuzzyMatch {
  matches: boolean;
  /** Lower is a better match — used to rank results, not shown to the user. */
  score: number;
}

/**
 * Subsequence match: every character of `query` must appear in `target`
 * in order, but not necessarily adjacent — so "ovinv" still finds
 * "Show overdue invoices". Tighter, earlier, and more contiguous matches
 * score better.
 */
export function fuzzyMatch(query: string, target: string): FuzzyMatch {
  const q = query.trim().toLowerCase();
  const t = target.toLowerCase();
  if (q.length === 0) return { matches: true, score: 0 };

  let qi = 0;
  let score = 0;
  let lastMatchIndex = -1;

  for (let ti = 0; ti < t.length && qi < q.length; ti += 1) {
    if (t[ti] === q[qi]) {
      const gap = lastMatchIndex === -1 ? ti : ti - lastMatchIndex - 1;
      score += gap; // adjacent matches (gap 0) are cheapest
      lastMatchIndex = ti;
      qi += 1;
    }
  }

  if (qi < q.length) return { matches: false, score: Infinity };

  // Reward matches that start earlier in the string.
  score += t.indexOf(q[0]) * 0.5;
  return { matches: true, score };
}
