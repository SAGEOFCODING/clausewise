import type { DocumentChunk } from "../../shared/types";

const stopWords = new Set(["the", "and", "or", "a", "an", "to", "of", "in", "for", "on", "is", "are", "this", "that", "what", "who", "how", "can", "i"]);

export function retrieveRelevantChunks(chunks: DocumentChunk[], query: string, limit = 5) {
  const terms = tokenize(query);
  return chunks
    .map((chunk) => ({ chunk, score: scoreChunk(chunk.text, terms) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((item) => item.chunk);
}

export function tokenize(input: string) {
  return input
    .toLowerCase()
    .replace(/[^\w\s-]/g, " ")
    .split(/\s+/)
    .filter((term) => term.length > 2 && !stopWords.has(term));
}

function scoreChunk(text: string, terms: string[]) {
  const lower = text.toLowerCase();
  return terms.reduce((score, term) => {
    const matches = lower.match(new RegExp(`\\b${escapeRegExp(term)}\\b`, "g"));
    return score + (matches?.length ?? 0);
  }, 0);
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
