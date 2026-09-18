import mammoth from "mammoth";
import { userError } from "../errors";

export interface ExtractedText {
  text: string;
  pageCount?: number;
}

export async function extractText(buffer: Buffer, ext: string): Promise<ExtractedText> {
  try {
    if (ext === ".txt") {
      return { text: buffer.toString("utf8") };
    }
    if (ext === ".pdf") {
      const pdfModule = await import("pdf-parse");
      const pdfParse = (pdfModule as any).default ?? pdfModule;
      const parsed = await pdfParse(buffer);
      return { text: parsed.text, pageCount: parsed.numpages };
    }
    if (ext === ".docx") {
      const result = await mammoth.extractRawText({ buffer });
      return { text: result.value };
    }
  } catch (error) {
    console.error("Document extraction failed", error);
    throw userError(400, "We could not read text from this document. It may be corrupted or scanned as an image.", "EXTRACTION_FAILED");
  }
  throw userError(400, "Unsupported document format.", "UNSUPPORTED_FORMAT");
}
