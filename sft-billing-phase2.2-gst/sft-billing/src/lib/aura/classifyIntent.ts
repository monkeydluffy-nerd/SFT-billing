import type { Client } from "@/types";
import { INTENT_LEXICON, type AuraIntentType, type LexiconEntry } from "./intentLexicon";

export interface ClassifiedIntent {
  type: AuraIntentType;
  /** The client mentioned in the sentence, if any (e.g. "create an invoice for Acme"). Only ever populated for CREATE_INVOICE today. */
  clientMention?: Client;
  /** Diagnostic only - the winning score, exposed for tests, never shown to the user. */
  score: number;
}

const MIN_SCORE_TO_MATCH = 3;

/** Lowercases and strips punctuation so "What is outstanding?" and "what is outstanding" score identically. */
function normalize(rawInput: string): string {
  return rawInput.toLowerCase().replace(/[?!.,]/g, "").trim();
}

/**
 * Scores one intent's lexicon against the normalized input: every phrase
 * that appears anywhere in the input contributes its weight, so a
 * sentence can rack up points from multiple matching phrases (e.g. both
 * "outstanding" and "outstanding balance" hitting in the same input).
 * This is deliberately simple substring scoring, not embeddings or any
 * external model - see the module doc comment in intentLexicon.ts for why
 * that's sufficient here.
 */
function scoreIntent(normalizedInput: string, entries: LexiconEntry[]): number {
  let score = 0;
  for (const entry of entries) {
    if (normalizedInput.includes(entry.phrase)) {
      score += entry.weight;
    }
  }
  return score;
}

/**
 * The ONLY function in this module with any logic. Pure classification:
 * given raw text, return the single best-matching intent (or UNKNOWN if
 * nothing clears the minimum score). This function never touches
 * invoices/clients/payments data or performs any calculation - it only
 * decides WHICH existing handler in auraAssistant.ts should run.
 *
 * `clients` is accepted only so CREATE_INVOICE can extract a mentioned
 * client name - this is intent *parsing* (identifying who was mentioned
 * in the sentence), not a financial calculation, so it stays here rather
 * than in auraAssistant.ts's calculation-calling code.
 */
export function classifyIntent(rawInput: string, clients: Client[] = []): ClassifiedIntent {
  const normalized = normalize(rawInput);

  if (normalized.length === 0) {
    return { type: "UNKNOWN", score: 0 };
  }

  let bestType: AuraIntentType = "UNKNOWN";
  let bestScore = 0;

  for (const [type, entries] of Object.entries(INTENT_LEXICON) as [Exclude<AuraIntentType, "UNKNOWN">, LexiconEntry[]][]) {
    const score = scoreIntent(normalized, entries);
    if (score > bestScore) {
      bestScore = score;
      bestType = type;
    }
  }

  if (bestScore < MIN_SCORE_TO_MATCH) {
    return { type: "UNKNOWN", score: bestScore };
  }

  if (bestType === "CREATE_INVOICE") {
    const clientMention = findClientMention(rawInput, clients);
    return { type: bestType, clientMention, score: bestScore };
  }

  return { type: bestType, score: bestScore };
}

/**
 * Looks for a client name mentioned in the raw sentence - substring match
 * first ("create an invoice for Acme Corporation" -> exact hit), falling
 * back to matching just the client's first word ("...for Acme" ->
 * matches "Acme Corporation") since that's how people actually talk.
 * Moved here unchanged from the previous auraAssistant.ts implementation.
 */
function findClientMention(rawInput: string, clients: Client[]): Client | undefined {
  const inputLower = rawInput.toLowerCase();

  const exact = clients
    .filter((c) => inputLower.includes(c.name.toLowerCase()))
    .sort((a, b) => b.name.length - a.name.length)[0];
  if (exact) return exact;

  return clients.find((c) => {
    const firstWord = c.name.split(" ")[0].toLowerCase();
    return firstWord.length > 2 && inputLower.includes(firstWord);
  });
}