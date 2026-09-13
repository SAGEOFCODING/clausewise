import express from "express";
import multer from "multer";
import { z } from "zod";
import { aiService } from "../ai/AIService";
import { maxUploadBytes } from "../config";
import { chunkDocument, createDocumentId } from "../document/chunk";
import { extractText } from "../document/extractText";
import { userError } from "../errors";
import { retrieveRelevantChunks } from "../retrieval/retrieve";
import { validateUpload } from "../security/fileValidation";
import { getDocument, saveDocument } from "../storage/documentStore";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: maxUploadBytes, files: 2 }
});

export const documentsRouter = express.Router();

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

documentsRouter.post("/:documentId/question", async (req, res, next) => {
  try {
    const params = z.object({ documentId: z.string().uuid() }).parse(req.params);
    const body = z.object({ question: z.string().trim().min(3).max(600) }).parse(req.body);
    const document = getDocument(params.documentId);
    if (!document) throw userError(404, "That document is no longer available. Please upload it again.", "DOCUMENT_NOT_FOUND");
    const relevant = retrieveRelevantChunks(document.chunks, body.question, 6);
    const answer = await aiService.answerQuestion(body.question, relevant.length ? relevant : document.chunks.slice(0, 4));
    res.json({ answer });
  } catch (error) {
    next(error);
  }
});

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
