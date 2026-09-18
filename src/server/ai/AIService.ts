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
    try {
      const parsed = await this.completeJson(analysisSchema, analysisPrompt(chunks));
      return {
        documentId,
        fileName,
        createdAt: new Date().toISOString(),
        ...parsed,
        privacyNote: "Documents are processed in memory for this demo and are not intentionally persisted to disk."
      };
    } catch (error) {
      console.error("AI analysis failed, using fallback:", error instanceof Error ? error.message : error);
      return fallbackAnalyze(documentId, fileName, chunks);
    }
  }

  async answerQuestion(question: string, chunks: DocumentChunk[]): Promise<GroundedAnswer> {
    if (!this.client) return fallbackAnswer(question, chunks);
    try {
      return await this.completeJson(answerSchema, answerPrompt(question, chunks));
    } catch (error) {
      console.error("AI Q&A failed, using fallback:", error instanceof Error ? error.message : error);
      return fallbackAnswer(question, chunks);
    }
  }

  async compareDocuments(chunksA: DocumentChunk[], chunksB: DocumentChunk[]): Promise<ComparisonResult> {
    if (!this.client) return fallbackCompare(chunksA, chunksB);
    try {
      return await this.completeJson(comparisonSchema, comparisonPrompt(chunksA, chunksB));
    } catch (error) {
      console.error("AI comparison failed, using fallback:", error instanceof Error ? error.message : error);
      return fallbackCompare(chunksA, chunksB);
    }
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
    const controller = new AbortController();
    const timeoutMs = process.env.VERCEL ? 15_000 : 45_000;
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await this.client.chat.completions.create(
        {
          model: config.OPENAI_MODEL,
          temperature: 0.2,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: legalSafetySystemPrompt },
            { role: "user", content: prompt }
          ]
        },
        { signal: controller.signal }
      );
      const content = response.choices[0]?.message?.content;
      if (!content) throw new Error("AI response was empty.");
      let json: unknown;
      try {
        json = JSON.parse(content);
      } catch {
        // Attempt to extract JSON from markdown fences
        const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (fenced) {
          json = JSON.parse(fenced[1]);
        } else {
          throw new Error("AI returned invalid JSON.");
        }
      }
      return schema.parse(json);
    } finally {
      clearTimeout(timeout);
    }
  }
}

export const aiService = new AIService();
