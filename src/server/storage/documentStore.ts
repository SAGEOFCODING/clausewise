import type { StoredDocument } from "../../shared/types";

const documents = new Map<string, StoredDocument>();

export function saveDocument(document: StoredDocument) {
  documents.set(document.id, document);
  return document;
}

export function getDocument(id: string) {
  return documents.get(id) ?? null;
}

export function listDocuments(): Array<{ id: string; fileName: string; createdAt: string; documentType: string }> {
  return Array.from(documents.values()).map((doc) => ({
    id: doc.id,
    fileName: doc.fileName,
    createdAt: doc.createdAt,
    documentType: doc.analysis.overview.documentType
  }));
}

export function clearDocumentsForTests() {
  documents.clear();
}
