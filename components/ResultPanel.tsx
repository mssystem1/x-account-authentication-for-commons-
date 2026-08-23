"use client";

import { useMemo, useState } from "react";
import type { EvidenceItem, ScanResult } from "@/lib/types";

function recommendationCopy(result: ScanResult) {
  if (result.recommendation === "VOUCH") return { label: "Likely safe to vouch", className: "recommend-good", icon: "✓" };
  if (result.recommendation === "REVIEW_SLASH") return { label: "High risk — review evidence", className: "recommend-bad", icon: "!" };
  if (result.recommendation === "UNSCORABLE") return { label: "Insufficient X data — rescan", className: "recommend-warn", icon: "?" };
  return { label: "Skip / investigate further", className: "recommend-warn", icon: "?" };
}

function evidenceIcon(item: EvidenceItem) {
  if (item.impact === "positive") return "✓";
  if (item.impact === "risk") return "!";
  return "•";
}

export function ResultPanel({ result, standalone = false }: { result: ScanResult; standalone?: boolean }) {
  const [slashReview, setSlashReview] = useState(false);
  const [reviewed, setReviewed] = useState(false);
  const rec = recommendationCopy(result);
  const scores = result.scores;
  const shareUrl = result.permalink || (typeof window !== "undefined" ? window.location.href : "");
  const highRiskEvidence = result.evidence.filter((item) => item.impact !== "positive");
  const displayEvidence = result.evidence.slice().sort((a, b) => b.severity - a.severity);
  const sourceCount = useMemo(() => new Set(result.sourceUrls).size, [result.sourceUrls]);

  const xCompose = (action: "vouch" | "slash") => {
    if (!scores) return;
    const text = `Hey @commonsmade, ${action} @${result.handle}`;
    window.open(`https://x.com/intent/post?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
  };

  const share = () => {
    if (!scores) return;
    const text = `I scanned @${result.handle} with VouchGuard before spending a Commons action.\n\nAuthenticity ${scores.authenticity} · Farmer ${scores.farmerRisk} · Bot ${scores.botRisk} · Sybil ${scores.sybilRisk}\n\nCheck the evidence:`;
    window.open(`https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(shareUrl)}`, "_blank", "noopener,noreferrer");
  };

  return <section className="result-shell" aria-live="polite">
    <div className="result-topline">
      <div><p className="eyebrow">ACCOUNT ASSESSMENT</p><h2>@{result.handle}</h2><p className="muted">{result.profile.bioSummary}</p></div>
      <a className="ghost-button" href={`https://x.com/${result.handle}`} target="_blank" rel="noreferrer">Open X ↗</a>
    </div>

    {result.mode === "demo" && <div className="demo-banner">Simulation mode — this result is synthetic and never calls xAI.</div>}

    <div className="verdict-grid">
      <div className="confidence-card">
        <span className="eyebrow">VOUCH CONFIDENCE</span>
        <div className="confidence-number">{scores ? scores.vouchConfidence : "—"}</div>
        <div className={`recommendation ${rec.className}`}><span>{rec.icon}</span>{rec.label}</div>
        <p>{result.summary}</p>
      </div>
      <div className="profile-context">
        <div><span>History</span><p>{result.profile.accountHistory}</p></div>
        <div><span>Activity</span><p>{result.profile.activitySummary}</p></div>
        <div className="context-row"><span>Data coverage</span><strong>{result.coverage.postsObserved} posts · {result.coverage.distinctDaysObserved} days</strong></div>
        <div className="context-row"><span>Coverage status</span><strong>{result.coverage.sufficiency}</strong></div>
        <div className="context-row"><span>Retrieval mode</span><strong>{result.diagnostics.retrievalMode}</strong></div>
        <div className="context-row"><span>Search calls</span><strong>{result.diagnostics.xSearchCalls} X · {result.diagnostics.webSearchCalls} web</strong></div>
        <div className="context-row"><span>Verified target posts</span><strong>{result.diagnostics.directTargetSources}</strong></div>
        <div className="context-row"><span>AI confidence</span><strong>{Math.round(result.confidence * 100)}% · {result.confidenceLabel}</strong></div>
        <div className="context-row"><span>Public X sources</span><strong>{sourceCount}</strong></div>
        <div className="context-row"><span>Model</span><strong>{result.model}</strong></div>
      </div>
    </div>

    <div className="score-grid">
      <Score label="Authenticity" value={scores?.authenticity ?? null} positive />
      <Score label="Farmer risk" value={scores?.farmerRisk ?? null} />
      <Score label="Bot risk" value={scores?.botRisk ?? null} />
      <Score label="Sybil risk" value={scores?.sybilRisk ?? null} />
    </div>

    {scores ? <div className="decision-bar">
      <button className="action action-vouch" onClick={() => xCompose("vouch")}>♥ Vouch on X</button>
      <button className="action action-skip" onClick={() => setSlashReview(false)}>Skip</button>
      <button className="action action-slash" onClick={() => setSlashReview(true)}>⚔ Review for slash</button>
    </div> : <div className="decision-bar">
      <a className="action action-skip" href={`/?handle=${encodeURIComponent(result.handle)}`}>↻ Retry account scan</a>
      <a className="action action-skip" href={`https://x.com/${result.handle}`} target="_blank" rel="noreferrer">Inspect account on X ↗</a>
    </div>}

    {scores && slashReview && <div className="slash-review">
      <div><p className="eyebrow">SLASH REVIEW</p><h3>Review evidence before acting</h3><p>VouchGuard reports behavioral risk signals. It does not prove that an account is a bot, a farmer, or controlled by the same person as another account.</p></div>
      <ul>{highRiskEvidence.slice(0, 5).map((item, index) => <li key={`${item.label}-${index}`}>{item.label}: {item.observation}</li>)}</ul>
      <label className="review-checkbox"><input type="checkbox" checked={reviewed} onChange={(event) => setReviewed(event.target.checked)} /> I reviewed the evidence and will make my own decision.</label>
      <button className="action action-slash" disabled={!reviewed} onClick={() => xCompose("slash")}>Compose slash on X</button>
    </div>}

    <div className="evidence-section" id="evidence">
      <div className="section-heading"><div><p className="eyebrow">EVIDENCE</p><h3>Why the model saw these patterns</h3></div><span>{result.evidence.length} observations</span></div>
      <div className="evidence-list">{displayEvidence.map((item, index) => <article className={`evidence evidence-${item.impact}`} key={`${item.category}-${item.label}-${index}`}><div className="evidence-icon">{evidenceIcon(item)}</div><div><div className="evidence-title"><strong>{item.label}</strong><span>{item.category} · {Math.round(item.confidence * 100)}% confidence</span></div><p>{item.observation}</p>{item.sourceUrls.length > 0 && <div className="source-links">{item.sourceUrls.map((url, sourceIndex) => <a key={url} href={url} target="_blank" rel="noreferrer">Source {sourceIndex + 1} ↗</a>)}</div>}</div></article>)}</div>
    </div>

    {result.uncertainties.length > 0 && <div className="uncertainties"><strong>Uncertainties</strong><ul>{result.uncertainties.map((item) => <li key={item}>{item}</li>)}</ul></div>}

    <div className="result-footer-actions">
      {scores && <button className="primary-button" onClick={share}>Share assessment on X</button>}
      {!standalone && <a className="ghost-button" href={result.permalink}>Open public result</a>}
      <a className="ghost-button" href="/methodology">Read methodology</a>
    </div>
    <p className="disclaimer">VouchGuard is an independent decision-support tool. Scores are probabilistic behavioral assessments of public X activity, not factual determinations of identity, intent, wrongdoing, or account ownership.</p>
  </section>;
}

function Score({ label, value, positive = false }: { label: string; value: number | null; positive?: boolean }) {
  if (value === null) {
    return <div className="metric-card metric-warn"><div><span>{label}</span><strong>—</strong></div><div className="metric-track"><span style={{ width: "0%" }} /></div></div>;
  }
  const level = positive ? (value >= 70 ? "good" : value >= 45 ? "warn" : "bad") : (value < 35 ? "good" : value < 65 ? "warn" : "bad");
  return <div className={`metric-card metric-${level}`}><div><span>{label}</span><strong>{value}</strong></div><div className="metric-track"><span style={{ width: `${value}%` }} /></div></div>;
}
