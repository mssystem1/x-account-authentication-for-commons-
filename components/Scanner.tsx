"use client";

import { FormEvent, useEffect, useState } from "react";
import type { IntegrityAuditResult } from "@/lib/integrity-types";
import { ResultPanel } from "./ResultPanel";

const auditSteps = [
  "Loading Commons creator ledger",
  "Collecting vouchers and slashers",
  "Building supporter graph",
  "Checking reciprocal vouch patterns",
  "Measuring clusters and timing",
  "Calculating Commons integrity",
  "Grok is writing the verdict",
];

export function Scanner() {
  const [handle, setHandle] = useState("");
  const [result, setResult] = useState<IntegrityAuditResult | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    const initialHandle = new URLSearchParams(window.location.search).get("handle");
    if (initialHandle) setHandle(initialHandle);
  }, []);

  useEffect(() => {
    if (!loading) return;
    const timer = window.setInterval(() => setStep((current) => Math.min(auditSteps.length - 1, current + 1)), 1800);
    return () => window.clearInterval(timer);
  }, [loading]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!handle.trim()) return;
    setError("");
    setResult(null);
    setLoading(true);
    setStep(0);
    try {
      const response = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handle: handle.trim() }),
      });
      const payload = await response.json() as IntegrityAuditResult | { error?: string };
      if (!response.ok) throw new Error("error" in payload && payload.error ? payload.error : "Audit failed.");
      setResult(payload as IntegrityAuditResult);
    } catch (auditError) {
      setError(auditError instanceof Error ? auditError.message : "Audit failed.");
    } finally {
      setLoading(false);
    }
  }

  return <>
    <section className="scanner-card">
      <form onSubmit={submit}>
        <label htmlFor="handle">COMMONS CREATOR</label>
        <div className="scan-input-row">
          <div className="handle-input"><span>@</span><input id="handle" name="handle" aria-label="COMMONS CREATOR" autoComplete="off" autoCapitalize="none" placeholder="username" value={handle} onChange={(event) => setHandle(event.target.value)} disabled={loading} /></div>
          <button className="scan-button" disabled={loading || !handle.trim()}>{loading ? "Auditing…" : "Audit creator"}</button>
        </div>
        <p className="input-help">VouchGuard reads the creator’s Commons ledger, traces who vouched or slashed them, inspects supporter-to-supporter relationships, and estimates whether the leaderboard position looks organic or coordinated.</p>
      </form>
      {loading && <div className="scan-progress"><div className="pulse-orb" aria-hidden="true"><span /></div><div><strong>{auditSteps[step]}</strong><p>Commons ledger graph + deterministic metrics + Grok 4.5 verdict</p></div><div className="progress-dots" aria-hidden="true">{auditSteps.map((_, index) => <span key={index} className={index <= step ? "active" : ""} />)}</div></div>}
      {error && <div className="error-box"><strong>Audit could not complete.</strong><span>{error}</span></div>}
    </section>
    {result && <ResultPanel result={result} />}
  </>;
}
