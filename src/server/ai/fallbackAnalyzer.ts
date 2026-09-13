import { diffWords } from "diff";
import type { ComparisonResult, DocumentAnalysis, DocumentChunk, GroundedAnswer } from "../../shared/types";
import { retrieveRelevantChunks } from "../retrieval/retrieve";

const clausePatterns = [
  { category: "Termination", regex: /\b(termination|terminate|notice)\b/i, severity: "Important" as const },
  { category: "Payment", regex: /\b(payment|fee|invoice|late|penalt|interest)\b/i, severity: "Important" as const },
  { category: "Renewal", regex: /\b(renew|renewal|auto(?:matic)? renewal)\b/i, severity: "Attention" as const },
  { category: "Liability", regex: /\b(liability|liable|limitation of liability|damages)\b/i, severity: "High Attention" as const },
  { category: "Confidentiality", regex: /\b(confidential|non-disclosure|proprietary)\b/i, severity: "Attention" as const },
  { category: "Intellectual Property", regex: /\b(intellectual property|copyright|license|ownership|work product)\b/i, severity: "Important" as const },
  { category: "Dispute Resolution", regex: /\b(arbitration|dispute|governing law|jurisdiction|venue)\b/i, severity: "Important" as const },
  { category: "Restriction", regex: /\b(non-compete|non-solicit|restriction|exclusive)\b/i, severity: "High Attention" as const }
];

export function fallbackAnalyze(documentId: string, fileName: string, chunks: DocumentChunk[]): DocumentAnalysis {
  const text = chunks.map((chunk) => chunk.text).join("\n");
  const clauses = clausePatterns.flatMap((pattern) => {
    const chunk = chunks.find((candidate) => pattern.regex.test(candidate.text));
    if (!chunk) return [];
    const excerpt = excerptAround(chunk.text, pattern.regex);
    return [{
      title: `${pattern.category} clause`,
      category: pattern.category,
      original: excerpt,
      plainEnglish: simplifySentence(excerpt),
      practicalMeaning: `This section appears to address ${pattern.category.toLowerCase()}. Review the exact wording before relying on it.`,
      whatToCheck: [
        "Confirm who must act and by when.",
        "Check whether there are exceptions, fees, penalties, or notice requirements.",
        "Ask whether the wording matches what you were told outside the document."
      ],
      professionalReview: "Consider professional review if this clause affects money, deadlines, ownership, disputes, or important rights.",
      citation: citationFromChunk(chunk, excerpt)
    }];
  });

  const attentionItems = clauses.map((clause) => ({
    title: clause.title,
    severity: clause.category === "Liability" || clause.category === "Restriction" ? "High Attention" as const : "Important" as const,
    explanation: clause.practicalMeaning,
    citation: clause.citation
  }));

  const parties = Array.from(new Set((text.match(/\b[A-Z][A-Za-z0-9&.,' -]+(?:LLC|Inc\.?|Ltd\.?|Corporation|Company|Party)\b/g) ?? []).slice(0, 6)));
  const importantDates = Array.from(new Set(text.match(/\b(?:\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4})\b/g) ?? [])).slice(0, 6);

  return {
    documentId,
    fileName,
    createdAt: new Date().toISOString(),
    overview: {
      documentType: guessDocumentType(text),
      parties,
      effectiveDate: importantDates[0] ?? null,
      duration: firstMatch(text, /\b(?:term|duration).*?(?:\d+\s+(?:day|month|year)s?|until [^.]+)/i),
      purpose: "The document appears to set out legal rights, obligations, and conditions between the parties. Review the cited sections for specifics.",
      importantDates
    },
    summary: makeSummary(text),
    attentionItems,
    clauses,
    checklist: clauses.slice(0, 7).map((clause, index) => ({
      id: `check-${index + 1}`,
      text: `Review the ${clause.category.toLowerCase()} wording and confirm you understand its practical effect.`,
      completed: false,
      citation: clause.citation
    })),
    lawyerPrep: {
      documentSummary: makeSummary(text),
      importantClauses: clauses.map((clause) => clause.title),
      questionsToAsk: [
        "Which terms create the biggest practical risk for me?",
        "Are any deadlines, fees, penalties, or renewal rules easy to miss?",
        "Do any clauses need negotiation or clarification before signing?",
        "Does this document match the facts and communications around the deal?"
      ],
      informationToBring: ["The full document", "Any prior drafts", "Related emails or messages", "Key dates and payment details"],
      areasRequiringClarification: attentionItems.length ? attentionItems.map((item) => item.title) : ["No major clauses were automatically identified; ask a professional to review the full document."]
    },
    privacyNote: "Documents are processed in memory for this demo and are not intentionally persisted to disk."
  };
}

export function fallbackAnswer(question: string, chunks: DocumentChunk[]): GroundedAnswer {
  const relevant = retrieveRelevantChunks(chunks, question, 3);
  if (!relevant.length) {
    return {
      answer: "I could not determine the answer from the provided document excerpts.",
      evidence: [],
      whatThisMeans: "The document may not cover this issue, or it may use wording that was not retrieved by the question.",
      whatToClarify: ["Ask a legal professional to review the full document.", "Check whether related emails, schedules, or exhibits contain the missing term."],
      professionalReviewRecommended: "Yes, especially if the issue affects deadlines, money, ownership, liability, or important rights.",
      confidence: "low"
    };
  }
  const evidence = relevant.map((chunk) => citationFromChunk(chunk, chunk.text.slice(0, 260)));
  return {
    answer: "Based on the retrieved document text, the answer appears to depend on the cited wording below. Review the exact excerpts before acting.",
    evidence,
    whatThisMeans: relevant[0].text.slice(0, 360),
    whatToClarify: ["Confirm whether other sections modify or override this wording.", "Ask whether jurisdiction-specific rules affect this provision."],
    professionalReviewRecommended: "Recommended if this affects a material decision, deadline, payment, dispute, or legal right.",
    confidence: "medium"
  };
}

export function fallbackCompare(chunksA: DocumentChunk[], chunksB: DocumentChunk[]): ComparisonResult {
  const textA = chunksA.map((chunk) => chunk.text).join(" ");
  const textB = chunksB.map((chunk) => chunk.text).join(" ");
  const parts = diffWords(textA.slice(0, 12000), textB.slice(0, 12000));
  const added = parts.filter((part) => part.added).map((part) => clean(part.value)).filter(Boolean).slice(0, 6);
  const removed = parts.filter((part) => part.removed).map((part) => clean(part.value)).filter(Boolean).slice(0, 6);
  return {
    addedClauses: added.length ? added : ["No clear added clause was detected by the local comparison."],
    removedClauses: removed.length ? removed : ["No clear removed clause was detected by the local comparison."],
    modifiedClauses: added.slice(0, 3).map((addition, index) => ({
      title: `Meaningful wording change ${index + 1}`,
      before: removed[index] ?? "No matching removed wording detected.",
      after: addition,
      practicalImpact: "This wording change may alter obligations, rights, timing, or risk. Review it against the prior version."
    })),
    attentionAreas: [],
    summary: "The local comparison highlights meaningful wording changes. For legal significance, review the cited clauses with a qualified professional."
  };
}

function citationFromChunk(chunk: DocumentChunk, excerpt: string) {
  return {
    label: chunk.section ? `${chunk.section}` : chunk.id,
    chunkId: chunk.id,
    page: chunk.page,
    section: chunk.section,
    excerpt: clean(excerpt).slice(0, 420)
  };
}

function excerptAround(text: string, regex: RegExp) {
  const match = regex.exec(text);
  const index = match?.index ?? 0;
  return clean(text.slice(Math.max(0, index - 120), index + 420));
}

function simplifySentence(value: string) {
  return clean(value)
    .replace(/\bherein\b/gi, "in this document")
    .replace(/\bthereof\b/gi, "of that")
    .replace(/\bshall\b/gi, "must");
}

function guessDocumentType(text: string) {
  if (/lease/i.test(text)) return "Lease or rental agreement";
  if (/employment/i.test(text)) return "Employment-related agreement";
  if (/non-disclosure|confidential/i.test(text)) return "Confidentiality or non-disclosure agreement";
  if (/privacy policy/i.test(text)) return "Privacy policy";
  if (/terms of service|terms and conditions/i.test(text)) return "Terms of service";
  return "Legal document";
}

function firstMatch(text: string, regex: RegExp) {
  const match = text.match(regex);
  return match ? clean(match[0]).slice(0, 160) : null;
}

function makeSummary(text: string) {
  const firstSentences = clean(text).split(/(?<=[.!?])\s+/).slice(0, 3).join(" ");
  return firstSentences || "The document text was extracted, but a concise summary could not be generated locally.";
}

function clean(value: string) {
  return value.replace(/\s+/g, " ").trim();
}
