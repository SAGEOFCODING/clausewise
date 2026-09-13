import { z } from "zod";

const citationSchema = z.object({
  label: z.string(),
  chunkId: z.string().optional(),
  page: z.number().optional(),
  section: z.string().optional(),
  excerpt: z.string()
});

const attentionSchema = z.object({
  title: z.string(),
  severity: z.enum(["Informational", "Attention", "Important", "High Attention"]),
  explanation: z.string(),
  citation: citationSchema.optional()
});

const clauseSchema = z.object({
  title: z.string(),
  category: z.string(),
  original: z.string(),
  plainEnglish: z.string(),
  practicalMeaning: z.string(),
  whatToCheck: z.array(z.string()),
  professionalReview: z.string(),
  citation: citationSchema.optional()
});

export const analysisSchema = z.object({
  overview: z.object({
    documentType: z.string(),
    parties: z.array(z.string()),
    effectiveDate: z.string().nullable(),
    duration: z.string().nullable(),
    purpose: z.string(),
    importantDates: z.array(z.string())
  }),
  summary: z.string(),
  attentionItems: z.array(attentionSchema),
  clauses: z.array(clauseSchema),
  checklist: z.array(z.object({
    id: z.string(),
    text: z.string(),
    completed: z.boolean(),
    citation: citationSchema.optional()
  })),
  lawyerPrep: z.object({
    documentSummary: z.string(),
    importantClauses: z.array(z.string()),
    questionsToAsk: z.array(z.string()),
    informationToBring: z.array(z.string()),
    areasRequiringClarification: z.array(z.string())
  })
});

export const answerSchema = z.object({
  answer: z.string(),
  evidence: z.array(citationSchema),
  whatThisMeans: z.string(),
  whatToClarify: z.array(z.string()),
  professionalReviewRecommended: z.string(),
  confidence: z.enum(["low", "medium", "high"])
});

export const comparisonSchema = z.object({
  addedClauses: z.array(z.string()),
  removedClauses: z.array(z.string()),
  modifiedClauses: z.array(z.object({
    title: z.string(),
    before: z.string(),
    after: z.string(),
    practicalImpact: z.string()
  })),
  attentionAreas: z.array(attentionSchema),
  summary: z.string()
});
