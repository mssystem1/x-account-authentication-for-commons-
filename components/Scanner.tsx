"use client";

import { FormEvent, useEffect, useState } from "react";
import type { ScanResult } from "@/lib/types";
import { ResultPanel } from "./ResultPanel";

const scanSteps = ["Resolving X identity","Reading account history","Evaluating original content","Checking farming patterns","Checking automation signals","Investigating network coordination","Calculating VouchGuard scores"];

export function Scanner() {
  const [handle, setHandle] = useState("");
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    const initialHandle = new URLSearchParams(window.location.search).get("handle");
    if (initialHandle) setHandle(initialHandle);
  }, []);

  useEffect(() => {
    if (!loading) return;
    const timer = window.setInterval(() => setStep((current) => Math.min(scanSteps.length - 1, current + 1)), 2600);
    return () => window.clearInterval(timer);
  }, [loading]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!handle.trim()) return;
    setError(""); setResult(null); setLoading(true); setStep(0);
    try {
      const response = await fetch("/api/scan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ handle: handle.trim() }) });
      const payload = await response.json() as ScanResult | { error?: string };
      if (!response.ok) throw new Error("error" in payload && payload.error ? payload.error : "Scan failed.");
      setResult(payload as ScanResult);
    } catch (scanError) {
      setError(scanError instanceof Error ? scanError.message : "Scan failed.");
    } finally { setLoading(false); }
  }

  return <>
    <section className="scanner-card">
      <form onSubmit={submit}>
        <label htmlFor="handle">X ACCOUNT</label>
        <div className="scan-input-row">
          <div className="handle-input"><span>@</span><input id="handle" name="handle" autoComplete="off" autoCapitalize="none" placeholder="username" value={handle} onChange={(event) => setHandle(event.target.value)} disabled={loading} /></div>
          <button className="scan-button" disabled={loading || !handle.trim()}>{loading ? "Scanning…" : "Scan account"}</button>
        </div>
        <p className="input-help">Grok investigates public account-level behavior across X. VouchGuard turns the evidence into transparent risk metrics.</p>
      </form>
      {loading && <div className="scan-progress"><div className="pulse-orb" aria-hidden="true"><span /></div><div><strong>{scanSteps[step]}</strong><p>Grok 4.5 + X Search · account-level investigation</p></div><div className="progress-dots" aria-hidden="true">{scanSteps.map((_, index) => <span key={index} className={index <= step ? "active" : ""} />)}</div></div>}
      {error && <div className="error-box"><strong>Scan could not complete.</strong><span>{error}</span></div>}
    </section>
    {result && <ResultPanel result={result} />}
  </>;
}
