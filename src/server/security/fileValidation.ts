import path from "node:path";
import { maxUploadBytes } from "../config";
import { userError } from "../errors";

const allowedExtensions = new Set([".pdf", ".docx", ".txt"]);
const allowedMimeTypes = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain"
]);

export function sanitizeFileName(name: string) {
  const base = path.basename(name).replace(/[^\w.\- ]/g, "_").trim();
  if (!base || base === "." || base === "..") {
    throw userError(400, "The file name is not usable.", "INVALID_FILENAME");
  }
  if (base !== name || name.includes("..") || /[\\/]/.test(name)) {
    throw userError(400, "File names cannot contain paths or traversal characters.", "PATH_TRAVERSAL");
  }
  return base.slice(0, 120);
}

export function validateUpload(file?: Express.Multer.File) {
  if (!file) throw userError(400, "Upload a PDF, DOCX, or TXT legal document.", "MISSING_FILE");
  if (file.size <= 0) throw userError(400, "The uploaded document is empty.", "EMPTY_FILE");
  if (file.size > maxUploadBytes) {
    throw userError(413, `The document is too large. The limit is ${Math.round(maxUploadBytes / 1024 / 1024)} MB.`, "FILE_TOO_LARGE");
  }

  const safeName = sanitizeFileName(file.originalname);
  const ext = path.extname(safeName).toLowerCase();
  if (!allowedExtensions.has(ext)) {
    throw userError(400, "Unsupported file type. Use PDF, DOCX, or TXT.", "UNSUPPORTED_EXTENSION");
  }
  if (file.mimetype && !allowedMimeTypes.has(file.mimetype)) {
    throw userError(400, "The file type does not match a supported legal document format.", "UNSUPPORTED_MIME");
  }
  validateSignature(file.buffer, ext);
  return { safeName, ext };
}

export function validateSignature(buffer: Buffer, ext: string) {
  if (ext === ".pdf" && !buffer.subarray(0, 5).equals(Buffer.from("%PDF-"))) {
    throw userError(400, "This does not look like a valid PDF file.", "BAD_SIGNATURE");
  }
  if (ext === ".docx") {
    const zipHeader = buffer.subarray(0, 4);
    if (!(zipHeader[0] === 0x50 && zipHeader[1] === 0x4b)) {
      throw userError(400, "This does not look like a valid DOCX file.", "BAD_SIGNATURE");
    }
  }
}
