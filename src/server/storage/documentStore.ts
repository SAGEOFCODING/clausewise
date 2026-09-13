import type { StoredDocument } from "../../shared/types";

const documents = new Map<string, StoredDocument>();

export function saveDocument(document: StoredDocument) {
  documents.set(document.id, document);
  return document;
}

export function getDocument(id: string) {
  return documents.get(id) ?? null;
}

export function clearDocumentsForTests() {
  documents.clear();
}
