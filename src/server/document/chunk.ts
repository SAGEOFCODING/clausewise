import crypto from "node:crypto";
import type { DocumentChunk } from "../../shared/types";

const CHUNK_WORDS = 260;
const OVERLAP_WORDS = 40;

export function createDocumentId() {
  return crypto.randomUUID();
}

export function chunkDocument(documentId: string, text: string): DocumentChunk[] {
  const normalized = text.replace(/\r/g, "").replace(/[ \t]+/g, " ").trim();
  if (!normalized) return [];
  const paragraphs = normalized.split(/\n{2,}/).map((part) => part.trim()).filter(Boolean);
  const chunks: DocumentChunk[] = [];
  let wordBuffer: string[] = [];
  let section = "Document text";

  for (const paragraph of paragraphs.length ? paragraphs : [normalized]) {
    const heading = detectHeading(paragraph);
    if (heading) section = heading;
    const words = paragraph.split(/\s+/);
    wordBuffer.push(...words);
    while (wordBuffer.length >= CHUNK_WORDS) {
      const slice = wordBuffer.slice(0, CHUNK_WORDS);
      chunks.push(makeChunk(documentId, chunks.length, slice.join(" "), section));
      wordBuffer = wordBuffer.slice(CHUNK_WORDS - OVERLAP_WORDS);
    }
  }
  if (wordBuffer.length) chunks.push(makeChunk(documentId, chunks.length, wordBuffer.join(" "), section));
  return chunks;
}

function makeChunk(documentId: string, index: number, text: string, section: string): DocumentChunk {
  return {
    id: `${documentId}-c${index + 1}`,
    documentId,
    text,
    section
  };
}

function detectHeading(paragraph: string) {
  const compact = paragraph.trim();
  if (compact.length > 90) return null;
  if (/^(?:\d+\.|article\b|section\b|clause\b|schedule\b|exhibit\b)/i.test(compact)) return compact;
  if (compact === compact.toUpperCase() && /[A-Z]/.test(compact)) return compact;
  return null;
}
