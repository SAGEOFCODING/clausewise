import { describe, expect, it } from "vitest";
import { validateSignature, validateUpload } from "./fileValidation";

function file(overrides: Partial<Express.Multer.File>): Express.Multer.File {
  return {
    fieldname: "document",
    originalname: "contract.txt",
    encoding: "7bit",
    mimetype: "text/plain",
    size: 120,
    buffer: Buffer.from("This Agreement includes payment, termination, and liability clauses."),
    destination: "",
    filename: "",
    path: "",
    stream: undefined as never,
    ...overrides
  };
}

describe("file validation", () => {
  it("accepts supported text uploads", () => {
    expect(validateUpload(file({})).safeName).toBe("contract.txt");
  });

  it("rejects path traversal filenames", () => {
    expect(() => validateUpload(file({ originalname: "../contract.txt" }))).toThrow(/paths|traversal/i);
  });

  it("rejects unsupported extensions", () => {
    expect(() => validateUpload(file({ originalname: "run.exe" }))).toThrow(/unsupported/i);
  });

  it("rejects fake PDFs by signature", () => {
    expect(() => validateSignature(Buffer.from("not a pdf"), ".pdf")).toThrow(/valid PDF/i);
  });
});
