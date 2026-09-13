import React from "react";
import ReactDOM from "react-dom/client";
import { AlertTriangle, CheckCircle2, ClipboardList, FileDiff, FileText, HelpCircle, Lock, MessageSquareText, Scale, Upload, type LucideIcon } from "lucide-react";
import clsx from "clsx";
import type { ComparisonResult, DocumentAnalysis, GroundedAnswer } from "../shared/types";
import "./styles.css";

type Tab = "overview" | "clauses" | "qa" | "compare" | "lawyer";

function App() {
  const [activeTab, setActiveTab] = React.useState<Tab>("overview");
  const [analysis, setAnalysis] = React.useState<DocumentAnalysis | null>(null);
  const [documentId, setDocumentId] = React.useState<string | null>(null);
  const [uploadState, setUploadState] = React.useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = React.useState("");
  const [question, setQuestion] = React.useState("");
  const [answer, setAnswer] = React.useState<GroundedAnswer | null>(null);
  const [asking, setAsking] = React.useState(false);
  const [comparison, setComparison] = React.useState<ComparisonResult | null>(null);
  const [comparing, setComparing] = React.useState(false);
  const [checked, setChecked] = React.useState<Record<string, boolean>>({});

  async function uploadDocument(file?: File | null) {
    if (!file) return;
    setUploadState("loading");
    setError("");
    const form = new FormData();
    form.append("document", file);
    try {
      const response = await fetch("/api/documents/analyze", { method: "POST", body: form });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error?.message ?? "Document analysis failed.");
      setAnalysis(payload.analysis);
      setDocumentId(payload.documentId);
      setChecked({});
      setActiveTab("overview");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Document analysis failed.");
      setUploadState("error");
      return;
    }
    setUploadState("idle");
  }

  async function askQuestion(event: React.FormEvent) {
    event.preventDefault();
    if (!documentId || !question.trim()) return;
    setAsking(true);
    setError("");
    try {
      const response = await fetch(`/api/documents/${documentId}/question`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error?.message ?? "Question failed.");
      setAnswer(payload.answer);
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
      const response = await fetch("/api/documents/compare", { method: "POST", body: data });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error?.message ?? "Comparison failed.");
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
    ["lawyer", ClipboardList, "Lawyer prep"]
  ];

  return (
    <main>
      <header className="topbar">
        <div className="brand" aria-label="ClauseWise">
          <Scale aria-hidden="true" />
          <div>
            <strong>ClauseWise</strong>
            <span>Understand legal documents before you sign.</span>
          </div>
        </div>
        <div className="privacy-pill"><Lock size={16} /> In-memory demo processing</div>
      </header>

      <section className="hero" aria-labelledby="hero-title">
        <div className="hero-copy">
          <p className="eyebrow">Legal information assistant</p>
          <h1 id="hero-title">Make complex legal documents easier to navigate.</h1>
          <p>Upload a PDF, DOCX, or TXT file to get a grounded summary, attention areas, clause explanations, checklists, comparison, and lawyer-prep questions.</p>
        </div>
        <UploadPanel onUpload={uploadDocument} state={uploadState} />
      </section>

      <section className="disclaimer" role="note">
        <Scale aria-hidden="true" />
        <p><strong>Legal safety:</strong> ClauseWise provides legal information and document assistance, not professional legal advice. It cites document evidence where possible and tells you when the document does not answer a question.</p>
      </section>

      {error && <div className="error" role="alert"><AlertTriangle /> {error}</div>}

      <nav className="tabs" aria-label="Document workspace">
        {tabs.map(([id, Icon, label]) => (
          <button key={id} className={activeTab === id ? "active" : ""} onClick={() => setActiveTab(id)}>
            <Icon size={17} aria-hidden="true" /> {label}
          </button>
        ))}
      </nav>

      <section className="workspace">
        {!analysis && activeTab !== "compare" ? <EmptyState /> : null}
        {analysis && activeTab === "overview" && (
          <Overview analysis={analysis} completed={completed} checked={checked} setChecked={setChecked} />
        )}
        {analysis && activeTab === "clauses" && <Clauses analysis={analysis} />}
        {analysis && activeTab === "qa" && (
          <QA question={question} setQuestion={setQuestion} askQuestion={askQuestion} answer={answer} asking={asking} />
        )}
        {activeTab === "compare" && <Compare compareDocuments={compareDocuments} comparing={comparing} comparison={comparison} />}
        {analysis && activeTab === "lawyer" && <LawyerPrep analysis={analysis} />}
      </section>
    </main>
  );
}

function UploadPanel({ onUpload, state }: { onUpload: (file?: File | null) => void; state: string }) {
  const inputId = React.useId();
  return (
    <div className="upload-panel">
      <label htmlFor={inputId}>
        <Upload aria-hidden="true" />
        <strong>{state === "loading" ? "Analyzing document..." : "Upload legal document"}</strong>
        <span>PDF, DOCX, or TXT up to the configured size limit</span>
      </label>
      <input id={inputId} type="file" accept=".pdf,.docx,.txt" onChange={(event) => onUpload(event.target.files?.[0])} />
    </div>
  );
}

function EmptyState() {
  return (
    <div className="empty">
      <HelpCircle />
      <h2>Start with a document</h2>
      <p>Once uploaded, ClauseWise will show what to care about, cite supporting text, and help you prepare better questions.</p>
    </div>
  );
}

function Overview({ analysis, completed, checked, setChecked }: { analysis: DocumentAnalysis; completed: number; checked: Record<string, boolean>; setChecked: React.Dispatch<React.SetStateAction<Record<string, boolean>>> }) {
  return (
    <div className="grid two">
      <article className="panel">
        <h2>Document Overview</h2>
        <dl>
          <dt>Type</dt><dd>{analysis.overview.documentType}</dd>
          <dt>Parties</dt><dd>{analysis.overview.parties.length ? analysis.overview.parties.join(", ") : "Not clearly stated"}</dd>
          <dt>Effective date</dt><dd>{analysis.overview.effectiveDate ?? "Not clearly stated"}</dd>
          <dt>Duration</dt><dd>{analysis.overview.duration ?? "Not clearly stated"}</dd>
        </dl>
        <p>{analysis.summary}</p>
      </article>
      <article className="panel">
        <h2>What You Should Care About</h2>
        <div className="attention-list">
          {analysis.attentionItems.length ? analysis.attentionItems.map((item) => <AttentionCard key={item.title} item={item} />) : <p>No high-priority attention areas were detected. A professional review may still be useful.</p>}
        </div>
      </article>
      <article className="panel wide">
        <div className="panel-title">
          <h2>Action Checklist</h2>
          <span>{completed}/{analysis.checklist.length} complete</span>
        </div>
        <div className="checklist">
          {analysis.checklist.map((item) => (
            <label key={item.id}>
              <input type="checkbox" checked={checked[item.id] ?? item.completed} onChange={(event) => setChecked((prev) => ({ ...prev, [item.id]: event.target.checked }))} />
              <span>{item.text}</span>
            </label>
          ))}
        </div>
      </article>
    </div>
  );
}

function Clauses({ analysis }: { analysis: DocumentAnalysis }) {
  return (
    <div className="clauses">
      {analysis.clauses.length ? analysis.clauses.map((clause) => (
        <article className="panel" key={`${clause.title}-${clause.original.slice(0, 20)}`}>
          <div className="panel-title">
            <h2>{clause.title}</h2>
            <span>{clause.category}</span>
          </div>
          <Section title="Original" text={clause.original} />
          <Section title="Plain English" text={clause.plainEnglish} />
          <Section title="Practical Meaning" text={clause.practicalMeaning} />
          <div className="mini-list"><strong>What to check</strong>{clause.whatToCheck.map((item) => <p key={item}>{item}</p>)}</div>
          <Section title="Professional Review" text={clause.professionalReview} />
          {clause.citation && <Citation citation={clause.citation} />}
        </article>
      )) : <EmptyState />}
    </div>
  );
}

function QA({ question, setQuestion, askQuestion, answer, asking }: { question: string; setQuestion: (value: string) => void; askQuestion: (event: React.FormEvent) => void; answer: GroundedAnswer | null; asking: boolean }) {
  return (
    <div className="grid two">
      <form className="panel ask" onSubmit={askQuestion}>
        <h2>Ask About This Document</h2>
        <label htmlFor="question">Question</label>
        <textarea id="question" value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Can I terminate this agreement? What happens if I miss a payment?" />
        <button className="primary" disabled={asking || question.trim().length < 3}>{asking ? "Searching evidence..." : "Ask with evidence"}</button>
      </form>
      <article className="panel">
        <h2>Grounded Answer</h2>
        {answer ? (
          <>
            <Section title="Answer" text={answer.answer} />
            <Section title="What this means" text={answer.whatThisMeans} />
            <div className="mini-list"><strong>What to clarify</strong>{answer.whatToClarify.map((item) => <p key={item}>{item}</p>)}</div>
            <Section title="Professional review recommended?" text={answer.professionalReviewRecommended} />
            {answer.evidence.map((citation) => <Citation key={citation.excerpt} citation={citation} />)}
          </>
        ) : <p className="muted">Answers appear here with evidence from the uploaded document.</p>}
      </article>
    </div>
  );
}

function Compare({ compareDocuments, comparing, comparison }: { compareDocuments: (event: React.FormEvent<HTMLFormElement>) => void; comparing: boolean; comparison: ComparisonResult | null }) {
  return (
    <div className="grid two">
      <form className="panel compare-form" onSubmit={compareDocuments}>
        <h2>Compare Two Documents</h2>
        <label>Original version<input name="documentA" type="file" accept=".pdf,.docx,.txt" /></label>
        <label>New version<input name="documentB" type="file" accept=".pdf,.docx,.txt" /></label>
        <button className="primary" disabled={comparing}>{comparing ? "Comparing..." : "Compare meaningfully"}</button>
      </form>
      <article className="panel">
        <h2>Comparison Results</h2>
        {comparison ? (
          <>
            <Section title="Summary" text={comparison.summary} />
            <List title="Added clauses" items={comparison.addedClauses} />
            <List title="Removed clauses" items={comparison.removedClauses} />
            {comparison.modifiedClauses.map((item) => <Section key={item.title} title={item.title} text={item.practicalImpact} />)}
          </>
        ) : <p className="muted">Upload two versions to find meaningful changes, not just raw text differences.</p>}
      </article>
    </div>
  );
}

function LawyerPrep({ analysis }: { analysis: DocumentAnalysis }) {
  return (
    <div className="grid two">
      <article className="panel"><h2>Consultation Summary</h2><p>{analysis.lawyerPrep.documentSummary}</p><List title="Important clauses" items={analysis.lawyerPrep.importantClauses} /></article>
      <article className="panel"><List title="Questions to ask" items={analysis.lawyerPrep.questionsToAsk} /><List title="Information to bring" items={analysis.lawyerPrep.informationToBring} /><List title="Areas to clarify" items={analysis.lawyerPrep.areasRequiringClarification} /></article>
    </div>
  );
}

function AttentionCard({ item }: { item: DocumentAnalysis["attentionItems"][number] }) {
  return (
    <div className={clsx("attention", item.severity.toLowerCase().replace(" ", "-"))}>
      <span>{item.severity}</span>
      <strong>{item.title}</strong>
      <p>{item.explanation}</p>
      {item.citation && <Citation citation={item.citation} />}
    </div>
  );
}

function Citation({ citation }: { citation: NonNullable<DocumentAnalysis["attentionItems"][number]["citation"]> }) {
  return <blockquote><CheckCircle2 size={15} aria-hidden="true" /> <span><strong>{citation.label}:</strong> {citation.excerpt}</span></blockquote>;
}

function Section({ title, text }: { title: string; text: string }) {
  return <section className="section"><h3>{title}</h3><p>{text}</p></section>;
}

function List({ title, items }: { title: string; items: string[] }) {
  return <div className="mini-list"><strong>{title}</strong>{items.length ? items.map((item) => <p key={item}>{item}</p>) : <p>Not clearly stated.</p>}</div>;
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
