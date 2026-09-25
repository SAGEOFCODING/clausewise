import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { StoredDocument } from "../../shared/types";
import { chunkDocument } from "../document/chunk";
import { sampleDocuments } from "../sampleDocuments";
import { fallbackAnalyze } from "../ai/fallbackAnalyzer";

export const SAMPLE_EMPLOYMENT_ID = "77777777-7777-4777-8777-777777777777";
export const SAMPLE_RENTAL_ID = "88888888-8888-4888-8888-888888888888";

const documents = new Map<string, StoredDocument>();
const tmpDir = path.join(os.tmpdir(), "clausewise-documents");

function ensureTmpDir() {
  try {
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
    }
  } catch {}
}

export function saveDocument(document: StoredDocument): StoredDocument {
  documents.set(document.id, document);
  try {
    ensureTmpDir();
    fs.writeFileSync(path.join(tmpDir, `${document.id}.json`), JSON.stringify(document), "utf8");
  } catch {}
  return document;
}

export function createSampleDocument(type: "employment" | "rental", customId?: string): StoredDocument {
  const sample = sampleDocuments[type];
  const id = customId || (type === "employment" ? SAMPLE_EMPLOYMENT_ID : SAMPLE_RENTAL_ID);
  const chunks = chunkDocument(id, sample.content);
  const analysis = fallbackAnalyze(id, sample.fileName, chunks);
  const doc: StoredDocument = {
    id,
    fileName: sample.fileName,
    mimeType: "text/plain",
    size: Buffer.byteLength(sample.content),
    text: sample.content,
    chunks,
    analysis,
    createdAt: analysis.createdAt
  };
  return saveDocument(doc);
}

export function getDocument(id: string): StoredDocument | null {
  if (documents.has(id)) {
    return documents.get(id)!;
  }
  // Check disk cache in /tmp
  try {
    const filePath = path.join(tmpDir, `${id}.json`);
    if (fs.existsSync(filePath)) {
      const data = JSON.parse(fs.readFileSync(filePath, "utf8")) as StoredDocument;
      documents.set(data.id, data);
      return data;
    }
  } catch {}

  // Check if it matches deterministic sample IDs
  if (id === SAMPLE_EMPLOYMENT_ID) {
    return createSampleDocument("employment", SAMPLE_EMPLOYMENT_ID);
  }
  if (id === SAMPLE_RENTAL_ID) {
    return createSampleDocument("rental", SAMPLE_RENTAL_ID);
  }

  return null;
}

export function listDocuments(): Array<{ id: string; fileName: string; createdAt: string; documentType: string }> {
  // Try loading from tmpDir
  try {
    ensureTmpDir();
    const files = fs.readdirSync(tmpDir);
    for (const file of files) {
      if (file.endsWith(".json")) {
        const id = file.replace(".json", "");
        if (!documents.has(id)) {
          try {
            const data = JSON.parse(fs.readFileSync(path.join(tmpDir, file), "utf8")) as StoredDocument;
            documents.set(data.id, data);
          } catch {}
        }
      }
    }
  } catch {}

  return Array.from(documents.values()).map((doc) => ({
    id: doc.id,
    fileName: doc.fileName,
    createdAt: doc.createdAt,
    documentType: doc.analysis.overview.documentType
  }));
}

export function clearDocumentsForTests() {
  documents.clear();
  try {
    if (fs.existsSync(tmpDir)) {
      const files = fs.readdirSync(tmpDir);
      for (const file of files) {
        fs.unlinkSync(path.join(tmpDir, file));
      }
    }
  } catch {}
}
