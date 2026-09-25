import express from "express";
import multer from "multer";
import { z } from "zod";
import { aiService } from "../ai/AIService";
import { maxUploadBytes } from "../config";
import { chunkDocument, createDocumentId } from "../document/chunk";
import { extractText } from "../document/extractText";
import { userError } from "../errors";
import { retrieveRelevantChunks } from "../retrieval/retrieve";
import { sampleDocuments } from "../sampleDocuments";
import { validateUpload } from "../security/fileValidation";
import { getDocument, listDocuments, saveDocument, SAMPLE_EMPLOYMENT_ID, SAMPLE_RENTAL_ID } from "../storage/documentStore";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: maxUploadBytes, files: 2 }
});

export const documentsRouter = express.Router();

/* List all stored documents */
documentsRouter.get("/", (_req, res) => {
  res.json({ documents: listDocuments() });
});

/* Analyze a single uploaded document */
documentsRouter.post("/analyze", upload.single("document"), async (req, res, next) => {
  try {
    const { safeName, ext } = validateUpload(req.file);
    const extracted = await extractText(req.file!.buffer, ext);
    if (extracted.text.trim().length < 20) {
      throw userError(400, "The document did not contain enough readable text to analyze.", "EMPTY_TEXT");
    }
    const id = createDocumentId();
    const chunks = chunkDocument(id, extracted.text);
    if (!chunks.length) throw userError(400, "The document could not be divided into usable text sections.", "NO_CHUNKS");
    const analysis = await aiService.analyzeDocument(id, safeName, chunks);
    const document = saveDocument({
      id,
      fileName: safeName,
      mimeType: req.file!.mimetype,
      size: req.file!.size,
      text: extracted.text,
      chunks,
      analysis,
      createdAt: analysis.createdAt
    });
    res.json({ documentId: document.id, analysis: document.analysis });
  } catch (error) {
    next(error);
  }
});

/* Upload and analyze a built-in sample document */
documentsRouter.post("/sample", express.json(), async (req, res, next) => {
  try {
    const body = z.object({ type: z.enum(["employment", "rental"]) }).parse(req.body);
    const id = body.type === "employment" ? SAMPLE_EMPLOYMENT_ID : SAMPLE_RENTAL_ID;
    const sample = sampleDocuments[body.type];
    const chunks = chunkDocument(id, sample.content);
    if (!chunks.length) throw userError(500, "Sample document could not be chunked.", "SAMPLE_ERROR");
    const analysis = await aiService.analyzeDocument(id, sample.fileName, chunks);
    const document = saveDocument({
      id,
      fileName: sample.fileName,
      mimeType: "text/plain",
      size: Buffer.byteLength(sample.content),
      text: sample.content,
      chunks,
      analysis,
      createdAt: analysis.createdAt
    });
    res.json({ documentId: document.id, analysis: document.analysis });
  } catch (error) {
    next(error);
  }
});


/* Ask a question about an uploaded document (supports both singular and plural) */
documentsRouter.post(["/:documentId/question", "/:documentId/questions"], express.json(), async (req, res, next) => {
  try {
    const params = z.object({ documentId: z.string().uuid() }).parse(req.params);
    const body = z.object({ question: z.string().trim().min(3).max(600) }).parse(req.body);
    const document = getDocument(params.documentId);
    if (!document) throw userError(404, "That document is no longer available. Please upload it again.", "DOCUMENT_NOT_FOUND");
    const relevant = retrieveRelevantChunks(document.chunks, body.question, 6);
    const answer = await aiService.answerQuestion(body.question, relevant.length ? relevant : document.chunks.slice(0, 4));
    res.json({ answer, citations: answer.evidence });
  } catch (error) {
    next(error);
  }
});

/* Simplify a legal clause */
documentsRouter.post(["/:documentId/simplify", "/simplify"], express.json(), async (req, res, next) => {
  try {
    const body = z.object({ clauseText: z.string().trim().min(5) }).parse(req.body);
    const result = await aiService.simplifyClause(body.clauseText);
    res.json({
      simplifiedText: result.plainEnglish,
      practicalMeaning: result.practicalMeaning,
      keyPoints: result.whatToCheck,
      professionalReview: result.professionalReview
    });
  } catch (error) {
    next(error);
  }
});

/* Get lawyer preparation sheet for a document */
documentsRouter.post("/:documentId/prep", express.json(), (req, res, next) => {
  try {
    const params = z.object({ documentId: z.string().uuid() }).parse(req.params);
    const document = getDocument(params.documentId);
    if (!document) throw userError(404, "That document is no longer available. Please upload it again.", "DOCUMENT_NOT_FOUND");
    res.json({
      documentSummary: document.analysis.lawyerPrep.documentSummary,
      importantClauses: document.analysis.lawyerPrep.importantClauses,
      questionsForLawyer: document.analysis.lawyerPrep.questionsToAsk,
      informationToBring: document.analysis.lawyerPrep.informationToBring,
      redFlagsToClarify: document.analysis.lawyerPrep.areasRequiringClarification
    });
  } catch (error) {
    next(error);
  }
});

/* Compare two uploaded files */
documentsRouter.post("/compare", upload.fields([{ name: "documentA", maxCount: 1 }, { name: "documentB", maxCount: 1 }]), async (req, res, next) => {
  try {
    const files = req.files as Record<string, Express.Multer.File[]>;
    const fileA = files?.documentA?.[0];
    const fileB = files?.documentB?.[0];
    const validatedA = validateUpload(fileA);
    const validatedB = validateUpload(fileB);
    const [textA, textB] = await Promise.all([
      extractText(fileA.buffer, validatedA.ext),
      extractText(fileB.buffer, validatedB.ext)
    ]);
    if (textA.text.trim().length < 20 || textB.text.trim().length < 20) {
      throw userError(400, "Both documents need enough readable text for comparison.", "EMPTY_TEXT");
    }
    const idA = createDocumentId();
    const idB = createDocumentId();
    const result = await aiService.compareDocuments(chunkDocument(idA, textA.text), chunkDocument(idB, textB.text));
    res.json({ fileA: validatedA.safeName, fileB: validatedB.safeName, comparison: result });
  } catch (error) {
    next(error);
  }
});

/* Compare two previously stored documents by ID */
documentsRouter.post("/compare-stored", express.json(), async (req, res, next) => {
  try {
    const rawA = req.body.documentIdA || req.body.docId1;
    const rawB = req.body.documentIdB || req.body.docId2;
    const body = z.object({ documentIdA: z.string().uuid(), documentIdB: z.string().uuid() }).parse({
      documentIdA: rawA,
      documentIdB: rawB
    });
    const docA = getDocument(body.documentIdA);
    const docB = getDocument(body.documentIdB);
    if (!docA) throw userError(404, "Document A is no longer available.", "DOCUMENT_NOT_FOUND");
    if (!docB) throw userError(404, "Document B is no longer available.", "DOCUMENT_NOT_FOUND");
    const result = await aiService.compareDocuments(docA.chunks, docB.chunks);
    res.json({
      fileA: docA.fileName,
      fileB: docB.fileName,
      comparison: result,
      summary: result.summary,
      addedClauses: result.addedClauses,
      removedClauses: result.removedClauses,
      modifiedClauses: result.modifiedClauses,
      attentionAreas: result.attentionAreas
    });

  } catch (error) {
    next(error);
  }
});

/* Get a single stored document */
documentsRouter.get("/:documentId", (req, res, next) => {
  try {
    const params = z.object({ documentId: z.string().uuid() }).parse(req.params);
    const document = getDocument(params.documentId);
    if (!document) throw userError(404, "That document is no longer available. Please upload it again.", "DOCUMENT_NOT_FOUND");
    res.json({
      id: document.id,
      fileName: document.fileName,
      size: document.size,
      createdAt: document.createdAt,
      analysis: document.analysis,
      chunks: document.chunks.map((chunk) => ({ id: chunk.id, section: chunk.section, page: chunk.page, preview: chunk.text.slice(0, 240) }))
    });
  } catch (error) {
    next(error);
  }
});
