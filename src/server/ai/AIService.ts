import OpenAI from "openai";
import { z } from "zod";
import type { ComparisonResult, DocumentAnalysis, DocumentChunk, GroundedAnswer } from "../../shared/types";
import { config } from "../config";
import { fallbackAnalyze, fallbackAnswer, fallbackCompare } from "./fallbackAnalyzer";
import { analysisPrompt, answerPrompt, comparisonPrompt, legalSafetySystemPrompt } from "./prompts";
import { analysisSchema, answerSchema, comparisonSchema } from "./schemas";

export class AIService {
  private client: OpenAI | null;

  constructor() {
    this.client = config.OPENAI_API_KEY ? new OpenAI({ apiKey: config.OPENAI_API_KEY }) : null;
  }

  async analyzeDocument(documentId: string, fileName: string, chunks: DocumentChunk[]): Promise<DocumentAnalysis> {
    if (!this.client) return fallbackAnalyze(documentId, fileName, chunks);
    const parsed = await this.completeJson(analysisSchema, analysisPrompt(chunks));
    return {
      documentId,
      fileName,
      createdAt: new Date().toISOString(),
      ...parsed,
      privacyNote: "Documents are processed in memory for this demo and are not intentionally persisted to disk."
    };
  }

  async answerQuestion(question: string, chunks: DocumentChunk[]): Promise<GroundedAnswer> {
    if (!this.client) return fallbackAnswer(question, chunks);
    return this.completeJson(answerSchema, answerPrompt(question, chunks));
  }

  async compareDocuments(chunksA: DocumentChunk[], chunksB: DocumentChunk[]): Promise<ComparisonResult> {
    if (!this.client) return fallbackCompare(chunksA, chunksB);
    return this.completeJson(comparisonSchema, comparisonPrompt(chunksA, chunksB));
  }

  async simplifyClause(clause: string): Promise<Pick<DocumentAnalysis["clauses"][number], "plainEnglish" | "practicalMeaning" | "whatToCheck" | "professionalReview">> {
    const local = fallbackAnalyze("draft", "Selected clause", [{ id: "selected", documentId: "draft", text: clause, section: "Selected clause" }]);
    const first = local.clauses[0];
    return first ? {
      plainEnglish: first.plainEnglish,
      practicalMeaning: first.practicalMeaning,
      whatToCheck: first.whatToCheck,
      professionalReview: first.professionalReview
    } : {
      plainEnglish: clause,
      practicalMeaning: "This selected wording should be interpreted in the context of the full document.",
      whatToCheck: ["Check who must act, by when, and what happens if they do not."],
      professionalReview: "Consider professional review before relying on this wording."
    };
  }

  private async completeJson<T extends z.ZodTypeAny>(schema: T, prompt: string): Promise<z.infer<T>> {
    if (!this.client) throw new Error("AI client is not configured.");
    const response = await this.client.chat.completions.create({
      model: config.OPENAI_MODEL,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: legalSafetySystemPrompt },
        { role: "user", content: prompt }
      ]
    });
    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error("AI response was empty.");
    const json = JSON.parse(content);
    return schema.parse(json);
  }
}

export const aiService = new AIService();
