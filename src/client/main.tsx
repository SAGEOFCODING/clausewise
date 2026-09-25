import React from "react";
import ReactDOM from "react-dom/client";
import {
  AlertTriangle, CheckCircle2, ChevronDown, ClipboardList, Copy, FileDiff,
  FileText, HelpCircle, Lock, MessageSquareText, Scale, Upload, X,
  type LucideIcon
} from "lucide-react";
import clsx from "clsx";
import Lenis from "lenis";
import "lenis/dist/lenis.css";
import type { ComparisonResult, DocumentAnalysis, GroundedAnswer } from "../shared/types";
import "./styles.css";

const API = "/api/documents";

type Tab = "overview" | "clauses" | "qa" | "compare" | "lawyer";

interface QAEntry {
  question: string;
  answer: GroundedAnswer;
}

async function safeFetchJson<T = any>(response: Response): Promise<T> {
  const text = await response.text();
  let payload: any = {};
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { error: { message: text.length < 200 ? text : `Server error (${response.status})` } };
    }
  } else {
    payload = { error: { message: `Server returned empty response (${response.status || 500})` } };
  }
  if (!response.ok) {
    throw new Error(payload.error?.message ?? `Request failed with status ${response.status}`);
  }
  return payload;
}

/* ================================================================
   App — Root component
   ================================================================ */
function App() {
  const [activeTab, setActiveTab] = React.useState<Tab>("overview");
  const [analysis, setAnalysis] = React.useState<DocumentAnalysis | null>(null);

  React.useEffect(() => {
    if (typeof window === "undefined" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }
    const lenis = new Lenis({
      duration: 1.0,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
    });

    let rafId: number;
    function raf(time: number) {
      lenis.raf(time);
      rafId = requestAnimationFrame(raf);
    }
    rafId = requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(rafId);
      lenis.destroy();
    };
  }, []);
  const [documentId, setDocumentId] = React.useState<string | null>(null);
  const [chunks, setChunks] = React.useState<any[]>([]);
  const [uploadState, setUploadState] = React.useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = React.useState("");
  const [question, setQuestion] = React.useState("");
  const [qaHistory, setQaHistory] = React.useState<QAEntry[]>([]);
  const [asking, setAsking] = React.useState(false);
  const [comparison, setComparison] = React.useState<ComparisonResult | null>(null);
  const [comparing, setComparing] = React.useState(false);
  const [checked, setChecked] = React.useState<Record<string, boolean>>({});

  const dismissError = React.useCallback(() => setError(""), []);

  async function uploadDocument(file?: File | null) {
    if (!file) return;
    setUploadState("loading");
    setError("");
    const form = new FormData();
    form.append("document", file);
    try {
      const response = await fetch(`${API}/analyze`, { method: "POST", body: form });
      const payload = await safeFetchJson(response);
      setAnalysis(payload.analysis);
      setDocumentId(payload.documentId);
      setChunks(payload.chunks || []);
      setChecked({});
      setQaHistory([]);
      setActiveTab("overview");
      setUploadState("idle");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Document analysis failed.");
      setUploadState("error");
    }
  }

  async function loadSample(type: "employment" | "rental") {
    setUploadState("loading");
    setError("");
    try {
      const response = await fetch(`${API}/sample`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type })
      });
      const payload = await safeFetchJson(response);
      setAnalysis(payload.analysis);
      setDocumentId(payload.documentId);
      setChunks(payload.chunks || []);
      setChecked({});
      setQaHistory([]);
      setActiveTab("overview");
      setUploadState("idle");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sample loading failed.");
      setUploadState("error");
    }
  }

  async function askQuestion(event: React.FormEvent) {
    event.preventDefault();
    if (!documentId || !question.trim()) return;
    setAsking(true);
    setError("");
    try {
      const response = await fetch(`${API}/${documentId}/question`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, chunks })
      });
      const payload = await safeFetchJson(response);
      setQaHistory((prev) => [{ question, answer: payload.answer }, ...prev]);
      setQuestion("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Question failed.");
    } finally {
      setAsking(false);
    }
  }

  async function compareDocuments(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    if (!data.get("documentA") || !data.get("documentB")) return;
    setComparing(true);
    setError("");
    try {
      const response = await fetch(`${API}/compare`, { method: "POST", body: data });
      const payload = await safeFetchJson(response);
      setComparison(payload.comparison);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Comparison failed.");
    } finally {
      setComparing(false);
    }
  }

  async function compareStoredDocuments(documentIdA: string, documentIdB: string) {
    if (!documentIdA || !documentIdB) return;
    setComparing(true);
    setError("");
    try {
      const response = await fetch(`${API}/compare-stored`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentIdA, documentIdB })
      });
      const payload = await safeFetchJson(response);
      setComparison(payload.comparison);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Comparison failed.");
    } finally {
      setComparing(false);
    }
  }

  const completed = analysis?.checklist.filter((item) => checked[item.id] ?? item.completed).length ?? 0;

  const tabs: Array<[Tab, LucideIcon, string]> = [
    ["overview", FileText, "Overview"],
    ["clauses", AlertTriangle, "Clauses"],
    ["qa", MessageSquareText, "Ask"],
    ["compare", FileDiff, "Compare"],
    ["lawyer", ClipboardList, "Lawyer Prep"]
  ];

  return (
    <div className="app">
      {/* --- Header --- */}
      <header className="topbar">
        <div className="brand">
          <div className="brand-icon"><Scale /></div>
          <div className="brand-text">
            <strong>ClauseWise</strong>
            <span>Legal document intelligence</span>
          </div>
        </div>
        <div className="header-actions">
          <div className="pill pill-info"><Lock size={14} /> In-memory demo</div>
        </div>
      </header>

      {/* --- Hero / Upload --- */}
      <section className="hero" aria-labelledby="hero-title">
        <div className="hero-copy">
          <span className="eyebrow">Legal information assistant</span>
          <h1 id="hero-title">Understand your legal documents.</h1>
          <p>Upload a PDF, DOCX, or TXT file. Get a grounded summary, attention areas, clause explanations, comparison, and preparation for a professional consultation.</p>
        </div>
        <div>
          <UploadPanel onUpload={uploadDocument} state={uploadState} onSample={loadSample} />
        </div>
      </section>

      {/* --- Disclaimer --- */}
      <section className="disclaimer" role="note">
        <Scale />
        <p><strong>Legal information only.</strong> ClauseWise helps you understand documents — it does not provide professional legal advice. Consult a qualified legal professional before acting on important decisions.</p>
      </section>

      {/* --- Error Banner --- */}
      {error && (
        <div className="error-banner" role="alert">
          <AlertTriangle />
          <span>{error}</span>
          <button className="btn-dismiss" onClick={dismissError} aria-label="Dismiss error"><X size={14} /></button>
        </div>
      )}

      {/* --- Tabs --- */}
      <nav className="tabs" aria-label="Document workspace">
        {tabs.map(([id, Icon, label]) => (
          <button
            key={id}
            className={activeTab === id ? "active" : ""}
            onClick={() => setActiveTab(id)}
            aria-current={activeTab === id ? "page" : undefined}
          >
            <Icon size={16} aria-hidden="true" /> {label}
          </button>
        ))}
      </nav>

      {/* --- Workspace --- */}
      <section className="workspace" aria-live="polite">
        {!analysis && activeTab !== "compare" && <EmptyState />}

        {analysis && activeTab === "overview" && (
          <Overview analysis={analysis} completed={completed} checked={checked} setChecked={setChecked} />
        )}

        {analysis && activeTab === "clauses" && <Clauses analysis={analysis} />}

        {analysis && activeTab === "qa" && (
          <QAPanel
            question={question}
            setQuestion={setQuestion}
            askQuestion={askQuestion}
            qaHistory={qaHistory}
            asking={asking}
          />
        )}

        {activeTab === "compare" && (
          <ComparePanel
            compareDocuments={compareDocuments}
            compareStoredDocuments={compareStoredDocuments}
            onSample={loadSample}
            comparing={comparing}
            comparison={comparison}
          />
        )}

        {analysis && activeTab === "lawyer" && <LawyerPrep analysis={analysis} />}
      </section>
    </div>
  );
}

/* ================================================================
   UploadPanel
   ================================================================ */
function UploadPanel({ onUpload, state, onSample }: {
  onUpload: (file?: File | null) => void;
  state: string;
  onSample: (type: "employment" | "rental") => void;
}) {
  const inputId = React.useId();
  const isLoading = state === "loading";

  return (
    <div className={clsx("upload-panel", isLoading && "is-loading")}>
      <label htmlFor={inputId}>
        <div className="upload-icon"><Upload /></div>
        <strong>{isLoading ? "Analyzing document…" : "Upload legal document"}</strong>
        <span className="upload-hint">PDF, DOCX, or TXT — up to 6 MB</span>
        {isLoading && <span className="spinner spinner-lg" aria-label="Processing" />}
      </label>
      <input
        id={inputId}
        type="file"
        accept=".pdf,.docx,.txt"
        onChange={(event) => onUpload(event.target.files?.[0])}
        disabled={isLoading}
      />
      <div className="sample-actions">
        <button className="btn-sample" onClick={() => onSample("employment")} disabled={isLoading}>
          Try employment agreement
        </button>
        <button className="btn-sample" onClick={() => onSample("rental")} disabled={isLoading}>
          Try rental agreement
        </button>
      </div>
    </div>
  );
}

/* ================================================================
   EmptyState
   ================================================================ */
function EmptyState() {
  return (
    <div className="empty-state">
      <HelpCircle />
      <h2>Start with a document</h2>
      <p>Upload a legal document or try a sample. ClauseWise will identify important clauses, cite supporting text, and help you prepare better questions.</p>
    </div>
  );
}

/* ================================================================
   Overview
   ================================================================ */
function Overview({ analysis, completed, checked, setChecked }: {
  analysis: DocumentAnalysis;
  completed: number;
  checked: Record<string, boolean>;
  setChecked: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
}) {
  return (
    <div className="grid grid-2">
      {/* Document Overview Card */}
      <article className="card">
        <div className="card-header">
          <h2 className="card-title">Document Overview</h2>
          <span className="card-badge">{analysis.overview.documentType}</span>
        </div>
        <div className="stats-row">
          <div className="stat">
            <span className="stat-value">{analysis.clauses.length}</span>
            <span className="stat-label">Clauses</span>
          </div>
          <div className="stat">
            <span className="stat-value">{analysis.attentionItems.length}</span>
            <span className="stat-label">Attention</span>
          </div>
          <div className="stat">
            <span className="stat-value">{completed}/{analysis.checklist.length}</span>
            <span className="stat-label">Checked</span>
          </div>
        </div>
        <dl className="dl-grid">
          <dt>Parties</dt>
          <dd>{analysis.overview.parties.length ? analysis.overview.parties.join(", ") : "Not clearly stated"}</dd>
          <dt>Effective date</dt>
          <dd>{analysis.overview.effectiveDate ?? "Not clearly stated"}</dd>
          <dt>Duration</dt>
          <dd>{analysis.overview.duration ?? "Not clearly stated"}</dd>
        </dl>
        <p className="summary-text">{analysis.summary}</p>
      </article>

      {/* Attention Items Card */}
      <article className="card">
        <div className="card-header">
          <h2 className="card-title">What You Should Care About</h2>
        </div>
        <div className="attention-list">
          {analysis.attentionItems.length
            ? analysis.attentionItems.map((item, i) => <AttentionCard key={`${item.title}-${i}`} item={item} />)
            : <p className="text-muted text-sm">No high-priority attention areas were detected. A professional review may still be useful.</p>
          }
        </div>
      </article>

      {/* Checklist Card */}
      <article className="card col-span-full">
        <div className="card-header">
          <h2 className="card-title">Action Checklist</h2>
          <span className="card-badge">{completed}/{analysis.checklist.length} complete</span>
        </div>
        <div className="checklist">
          {analysis.checklist.map((item) => (
            <label key={item.id} className="checklist-item">
              <input
                type="checkbox"
                checked={checked[item.id] ?? item.completed}
                onChange={(event) => setChecked((prev) => ({ ...prev, [item.id]: event.target.checked }))}
              />
              <span>{item.text}</span>
            </label>
          ))}
        </div>
      </article>
    </div>
  );
}

/* ================================================================
   Clauses — Expandable clause cards
   ================================================================ */
function Clauses({ analysis }: { analysis: DocumentAnalysis }) {
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set());

  const toggle = (key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  if (!analysis.clauses.length) return <EmptyState />;

  return (
    <div className="clauses-list">
      {analysis.clauses.map((clause, i) => {
        const key = `${clause.title}-${i}`;
        const isOpen = expanded.has(key);
        return (
          <article key={key} className={clsx("clause-card", isOpen && "is-expanded")}>
            <div className="clause-header" onClick={() => toggle(key)} role="button" tabIndex={0}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(key); } }}
              aria-expanded={isOpen}
            >
              <div className="clause-header-left">
                <span className="clause-title">{clause.title}</span>
                <span className="clause-category">{clause.category}</span>
              </div>
              <ChevronDown className="clause-chevron" />
            </div>
            <div className="clause-body">
              {/* Original text */}
              <div className="clause-section">
                <span className="clause-section-label original-label">Original Document Text</span>
                <p className="clause-original-text">{clause.original}</p>
              </div>
              {/* Plain English */}
              <div className="clause-section">
                <span className="clause-section-label plain-label">Plain-Language Explanation</span>
                <p className="clause-plain-text">{clause.plainEnglish}</p>
              </div>
              {/* Practical meaning */}
              <div className="clause-section">
                <span className="clause-section-label">Practical Meaning</span>
                <p className="clause-practical">{clause.practicalMeaning}</p>
              </div>
              {/* What to check */}
              <div className="clause-section">
                <span className="clause-section-label">What to Check</span>
                <ul className="check-list">
                  {clause.whatToCheck.map((item, j) => <li key={j}>{item}</li>)}
                </ul>
              </div>
              {/* Professional review */}
              <div className="clause-section">
                <span className="clause-section-label">Professional Review</span>
                <p className="clause-practical">{clause.professionalReview}</p>
              </div>
              {clause.citation && <Citation citation={clause.citation} />}
            </div>
          </article>
        );
      })}
    </div>
  );
}

/* ================================================================
   QAPanel — Q&A with history
   ================================================================ */
function QAPanel({ question, setQuestion, askQuestion, qaHistory, asking }: {
  question: string;
  setQuestion: (value: string) => void;
  askQuestion: (event: React.FormEvent) => void;
  qaHistory: QAEntry[];
  asking: boolean;
}) {
  return (
    <div className="grid grid-2">
      <form className="card qa-form" onSubmit={askQuestion}>
        <h2 className="card-title">Ask About This Document</h2>
        <label htmlFor="qa-question">Question</label>
        <textarea
          id="qa-question"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="Can I terminate this agreement? What happens if I miss a payment? What are the non-compete restrictions?"
        />
        <button className="btn btn-primary" disabled={asking || question.trim().length < 3}>
          {asking ? <><span className="spinner" /> Searching evidence…</> : "Ask with evidence"}
        </button>
      </form>

      <article className="card">
        <h2 className="card-title">Grounded Answers</h2>
        {qaHistory.length ? (
          <div className="qa-history">
            {qaHistory.map((entry, i) => (
              <div key={i} className="qa-pair">
                <div className="qa-question-text">{entry.question}</div>
                <div className="qa-answer-section">
                  <div>
                    <span className="qa-section-title">Answer</span>
                    <span className={clsx("qa-confidence", entry.answer.confidence)}>{entry.answer.confidence} confidence</span>
                    <p className="qa-text">{entry.answer.answer}</p>
                  </div>
                  <div>
                    <span className="qa-section-title">What this means</span>
                    <p className="qa-text">{entry.answer.whatThisMeans}</p>
                  </div>
                  {entry.answer.whatToClarify.length > 0 && (
                    <div>
                      <span className="qa-section-title">What to clarify</span>
                      <ul className="prep-list">
                        {entry.answer.whatToClarify.map((item, j) => <li key={j}>{item}</li>)}
                      </ul>
                    </div>
                  )}
                  <div>
                    <span className="qa-section-title">Professional review</span>
                    <p className="qa-text">{entry.answer.professionalReviewRecommended}</p>
                  </div>
                  {entry.answer.evidence.map((citation, j) => (
                    <Citation key={j} citation={citation} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-muted text-sm">Answers appear here with evidence from the uploaded document.</p>
        )}
      </article>
    </div>
  );
}

/* ================================================================
   ComparePanel — Two-document comparison
   ================================================================ */
interface StoredDocSummary {
  id: string;
  fileName: string;
  documentType: string;
  createdAt: string;
}

function ComparePanel({
  compareDocuments,
  compareStoredDocuments,
  onSample,
  comparing,
  comparison
}: {
  compareDocuments: (event: React.FormEvent<HTMLFormElement>) => void;
  compareStoredDocuments: (docA: string, docB: string) => Promise<void>;
  onSample: (type: "employment" | "rental") => Promise<void>;
  comparing: boolean;
  comparison: ComparisonResult | null;
}) {
  const [mode, setMode] = React.useState<"stored" | "upload">("stored");
  const [storedDocs, setStoredDocs] = React.useState<StoredDocSummary[]>([]);
  const [docA, setDocA] = React.useState("");
  const [docB, setDocB] = React.useState("");
  const [loadingStored, setLoadingStored] = React.useState(false);

  const fetchStoredDocs = React.useCallback(async () => {
    setLoadingStored(true);
    try {
      const res = await fetch("/api/documents");
      const data = await safeFetchJson(res);
      if (Array.isArray(data.documents)) {
        setStoredDocs(data.documents);
        if (data.documents.length >= 2) {
          setDocA((prev) => prev || data.documents[0].id);
          setDocB((prev) => prev || data.documents[1].id);
        } else if (data.documents.length === 1) {
          setDocA((prev) => prev || data.documents[0].id);
        }
      }
    } catch {
      // ignore
    } finally {
      setLoadingStored(false);
    }
  }, []);

  React.useEffect(() => {
    fetchStoredDocs();
  }, [fetchStoredDocs]);

  const handleQuickSample = async (type: "employment" | "rental") => {
    await onSample(type);
    await fetchStoredDocs();
  };

  const handleStoredSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (docA && docB) {
      compareStoredDocuments(docA, docB);
    }
  };

  return (
    <div className="grid grid-2">
      <div className="card compare-form">
        <h2 className="card-title">Compare Two Documents</h2>
        <div className="compare-mode-toggle">
          <button
            type="button"
            className={clsx("btn-mode", mode === "stored" && "active")}
            onClick={() => setMode("stored")}
          >
            Analyzed Documents ({storedDocs.length})
          </button>
          <button
            type="button"
            className={clsx("btn-mode", mode === "upload" && "active")}
            onClick={() => setMode("upload")}
          >
            Upload Files
          </button>
        </div>

        {mode === "stored" ? (
          <form onSubmit={handleStoredSubmit} style={{ display: "grid", gap: "var(--space-4)" }}>
            {storedDocs.length < 2 ? (
              <div style={{ display: "grid", gap: "var(--space-2)" }}>
                <p className="text-muted text-sm">
                  You need at least two analyzed documents to compare. Quickly load samples below:
                </p>
                <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
                  <button
                    type="button"
                    className="btn-sample"
                    onClick={() => handleQuickSample("employment")}
                    disabled={loadingStored || comparing}
                  >
                    Load employment sample
                  </button>
                  <button
                    type="button"
                    className="btn-sample"
                    onClick={() => handleQuickSample("rental")}
                    disabled={loadingStored || comparing}
                  >
                    Load rental sample
                  </button>
                </div>
              </div>
            ) : null}

            {storedDocs.length > 0 ? (
              <>
                <label>
                  First Document
                  <select value={docA} onChange={(e) => setDocA(e.target.value)} disabled={comparing}>
                    {storedDocs.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.fileName} ({d.documentType})
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Second Document
                  <select value={docB} onChange={(e) => setDocB(e.target.value)} disabled={comparing}>
                    {storedDocs.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.fileName} ({d.documentType})
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={comparing || !docA || !docB || docA === docB}
                >
                  {comparing ? <><span className="spinner" /> Comparing…</> : "Compare analyzed documents"}
                </button>
                {docA === docB && storedDocs.length >= 2 && (
                  <span className="text-xs text-muted">Please choose two different documents to compare.</span>
                )}
              </>
            ) : null}
          </form>
        ) : (
          <form onSubmit={compareDocuments} style={{ display: "grid", gap: "var(--space-4)" }}>
            <label>
              Original version
              <input name="documentA" type="file" accept=".pdf,.docx,.txt" />
            </label>
            <label>
              New version
              <input name="documentB" type="file" accept=".pdf,.docx,.txt" />
            </label>
            <button className="btn btn-primary" disabled={comparing}>
              {comparing ? <><span className="spinner" /> Comparing…</> : "Compare meaningfully"}
            </button>
          </form>
        )}
      </div>

      <article className="card">
        <h2 className="card-title">Comparison Results</h2>
        {comparison ? (
          <div className="comparison-result">
            <div>
              <span className="qa-section-title">Summary</span>
              <p className="summary-text">{comparison.summary}</p>
            </div>

            {comparison.addedClauses.length > 0 && (
              <div>
                <span className="qa-section-title">Added Clauses</span>
                {comparison.addedClauses.map((clause, i) => (
                  <div key={i} className="diff-added"><span className="diff-label">Added</span>{clause}</div>
                ))}
              </div>
            )}

            {comparison.removedClauses.length > 0 && (
              <div>
                <span className="qa-section-title">Removed Clauses</span>
                {comparison.removedClauses.map((clause, i) => (
                  <div key={i} className="diff-removed"><span className="diff-label">Removed</span>{clause}</div>
                ))}
              </div>
            )}

            {comparison.modifiedClauses.length > 0 && (
              <div>
                <span className="qa-section-title">Modified Clauses</span>
                {comparison.modifiedClauses.map((item, i) => (
                  <div key={i} className="diff-modified">
                    <span className="diff-label">{item.title}</span>
                    <p className="text-sm">{item.practicalImpact}</p>
                  </div>
                ))}
              </div>
            )}

            {comparison.attentionAreas.length > 0 && (
              <div>
                <span className="qa-section-title">Attention Areas</span>
                <div className="attention-list">
                  {comparison.attentionAreas.map((item, i) => <AttentionCard key={i} item={item} />)}
                </div>
              </div>
            )}
          </div>
        ) : (
          <p className="text-muted text-sm">Upload two versions to find meaningful changes, not just raw text differences.</p>
        )}
      </article>
    </div>
  );
}

/* ================================================================
   LawyerPrep — Consultation preparation
   ================================================================ */
function LawyerPrep({ analysis }: { analysis: DocumentAnalysis }) {
  return (
    <div className="grid grid-2">
      <article className="card">
        <div className="card-header">
          <h2 className="card-title">Consultation Summary</h2>
          <CopyButton text={formatPrepForCopy(analysis)} />
        </div>
        <p className="summary-text">{analysis.lawyerPrep.documentSummary}</p>
        <PrepSection title="Important Clauses" items={analysis.lawyerPrep.importantClauses} />
      </article>

      <article className="card">
        <PrepSection title="Questions to Ask Your Lawyer" items={analysis.lawyerPrep.questionsToAsk} icon={<HelpCircle />} />
        <PrepSection title="Information to Bring" items={analysis.lawyerPrep.informationToBring} icon={<ClipboardList />} />
        <PrepSection title="Areas Requiring Clarification" items={analysis.lawyerPrep.areasRequiringClarification} icon={<AlertTriangle />} />
      </article>
    </div>
  );
}

/* ================================================================
   Shared Components
   ================================================================ */

function AttentionCard({ item }: { item: DocumentAnalysis["attentionItems"][number] }) {
  const severityClass = item.severity.toLowerCase().replace(/ /g, "-");
  return (
    <div className={clsx("attention-card", `severity-${severityClass}`)}>
      <span className={clsx("severity-badge", severityClass)}>{item.severity}</span>
      <span className="attention-title">{item.title}</span>
      <p className="attention-explanation">{item.explanation}</p>
      {item.citation && <Citation citation={item.citation} />}
    </div>
  );
}

function Citation({ citation }: { citation: NonNullable<DocumentAnalysis["attentionItems"][number]["citation"]> }) {
  return (
    <div className="citation">
      <CheckCircle2 aria-hidden="true" />
      <span><span className="citation-label">{citation.label}:</span> {citation.excerpt}</span>
    </div>
  );
}

function PrepSection({ title, items, icon }: { title: string; items: string[]; icon?: React.ReactNode }) {
  return (
    <div className="prep-section">
      <h3 className="prep-section-title">{icon}{title}</h3>
      <ul className="prep-list">
        {items.length
          ? items.map((item, i) => <li key={i}>{item}</li>)
          : <li>Not clearly stated in the document.</li>
        }
      </ul>
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API not available
    }
  };

  return (
    <button className={clsx("btn-copy", copied && "copied")} onClick={handleCopy}>
      <Copy size={12} /> {copied ? "Copied!" : "Copy"}
    </button>
  );
}

function formatPrepForCopy(analysis: DocumentAnalysis): string {
  const sections = [
    `CONSULTATION PREPARATION — ${analysis.fileName}`,
    `Document Type: ${analysis.overview.documentType}`,
    "",
    "SUMMARY",
    analysis.lawyerPrep.documentSummary,
    "",
    "IMPORTANT CLAUSES",
    ...analysis.lawyerPrep.importantClauses.map((c) => `• ${c}`),
    "",
    "QUESTIONS TO ASK",
    ...analysis.lawyerPrep.questionsToAsk.map((q) => `• ${q}`),
    "",
    "INFORMATION TO BRING",
    ...analysis.lawyerPrep.informationToBring.map((i) => `• ${i}`),
    "",
    "AREAS REQUIRING CLARIFICATION",
    ...analysis.lawyerPrep.areasRequiringClarification.map((a) => `• ${a}`),
    "",
    "Note: This was generated by ClauseWise, a legal information tool. It is not legal advice."
  ];
  return sections.join("\n");
}

/* ================================================================
   Mount
   ================================================================ */
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
