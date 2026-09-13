export type Severity = "Informational" | "Attention" | "Important" | "High Attention";

export interface Citation {
  label: string;
  chunkId?: string;
  page?: number;
  section?: string;
  excerpt: string;
}

export interface AttentionItem {
  title: string;
  severity: Severity;
  explanation: string;
  citation?: Citation;
}

export interface ClauseInsight {
  title: string;
  category: string;
  original: string;
  plainEnglish: string;
  practicalMeaning: string;
  whatToCheck: string[];
  professionalReview: string;
  citation?: Citation;
}

export interface ChecklistItem {
  id: string;
  text: string;
  completed: boolean;
  citation?: Citation;
}

export interface DocumentOverview {
  documentType: string;
  parties: string[];
  effectiveDate: string | null;
  duration: string | null;
  purpose: string;
  importantDates: string[];
}

export interface DocumentAnalysis {
  documentId: string;
  fileName: string;
  createdAt: string;
  overview: DocumentOverview;
  summary: string;
  attentionItems: AttentionItem[];
  clauses: ClauseInsight[];
  checklist: ChecklistItem[];
  lawyerPrep: LawyerPrep;
  privacyNote: string;
}

export interface LawyerPrep {
  documentSummary: string;
  importantClauses: string[];
  questionsToAsk: string[];
  informationToBring: string[];
  areasRequiringClarification: string[];
}

export interface GroundedAnswer {
  answer: string;
  evidence: Citation[];
  whatThisMeans: string;
  whatToClarify: string[];
  professionalReviewRecommended: string;
  confidence: "low" | "medium" | "high";
}

export interface ComparisonResult {
  addedClauses: string[];
  removedClauses: string[];
  modifiedClauses: Array<{
    title: string;
    before: string;
    after: string;
    practicalImpact: string;
  }>;
  attentionAreas: AttentionItem[];
  summary: string;
}

export interface DocumentChunk {
  id: string;
  documentId: string;
  text: string;
  page?: number;
  section?: string;
}

export interface StoredDocument {
  id: string;
  fileName: string;
  mimeType: string;
  size: number;
  text: string;
  chunks: DocumentChunk[];
  analysis: DocumentAnalysis;
  createdAt: string;
}
