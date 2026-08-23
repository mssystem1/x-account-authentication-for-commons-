"use client";

import type { IntegrityAuditResult, IntegrityEvidence, SupporterProfile } from "@/lib/integrity-types";

function verdictMeta(verdict: IntegrityAuditResult["report"]["verdict"]) {
  if (verdict === "LIKELY_ORGANIC") return { label: "Likely organically supported", className: "recommend-good", icon: "✓" };
  if (verdict === "HIGH_COORDINATION_RISK") return { label: "High coordination risk", className: "recommend-bad", icon: "!" };
  if (verdict === "INSUFFICIENT_DATA") return { label: "Insufficient Commons data", className: "recommend-warn", icon: "?" };
  return { label: "Mixed support pattern", className: "recommend-warn", icon: "•" };
}

function evidenceIcon(item: IntegrityEvidence) {
  if (item.impact === "positive") return "✓";
  if (item.impact === "risk") return "!";
  return "•";
}

function pct(value: number) {
  return `${Math.round(value * 100)}%`;
}

export function ResultPanel({ result, standalone = false }: { result: IntegrityAuditResult; standalone?: boolean }) {
  const verdict = verdictMeta(result.report.verdict);
  const shareUrl = result.permalink || (typeof window !== "undefined" ? window.location.href : "");
  const insufficient = result.report.verdict === "INSUFFICIENT_DATA";

  const share = () => {
    const scoreText = insufficient ? "Commons Integrity: insufficient data" : `Commons Integrity ${result.metrics.integrityScore}/100`;
    const text = `I audited @${result.handle}'s Commons leaderboard support with VouchGuard.\n\n${scoreText}\nOrganic Support ${result.metrics.organicSupport}\nCoordination Risk ${result.metrics.coordinationRisk}\nEstimated score from net support ${pct(result.stats.estimatedNetSupportShare)}\n\nSee how the rank was built:`;
    window.open(`https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(shareUrl)}`, "_blank", "noopener,noreferrer");
  };

  return <section className="result-shell" aria-live="polite">
    <div className="result-topline">
      <div>
        <p className="eyebrow">COMMONS LEADERBOARD AUDIT</p>
        <h2>@{result.handle}</h2>
        <p className="muted">{result.commons.rank ? `Commons rank #${result.commons.rank.toLocaleString()}` : "Commons rank unavailable"} · {result.commons.totalPoints.toLocaleString()} total points</p>
      </div>
      <div className="result-header-actions">
        <a className="ghost-button" href={`https://x.com/${result.handle}`} target="_blank" rel="noreferrer">Open X ↗</a>
        <a className="ghost-button" href="https://commonsmade.com/vouch" target="_blank" rel="noreferrer">Open Commons ↗</a>
      </div>
    </div>

    {result.mode === "demo" && <div className="demo-banner">Simulation mode — this result uses a synthetic Commons support graph.</div>}

    <div className="verdict-grid">
      <div className="confidence-card">
        <span className="eyebrow">COMMONS INTEGRITY</span>
        <div className="confidence-number">{insufficient ? "—" : result.metrics.integrityScore}</div>
        <div className={`recommendation ${verdict.className}`}><span>{verdict.icon}</span>{verdict.label}</div>
        <p>{result.report.headline}</p>
        <p>{result.report.explanation}</p>
      </div>
      <div className="profile-context">
        <div className="context-row"><span>Incoming vouches</span><strong>{result.stats.incomingVouches}</strong></div>
        <div className="context-row"><span>Incoming slashes</span><strong>{result.stats.incomingSlashes}</strong></div>
        <div className="context-row"><span>Vouch points</span><strong>+{result.stats.vouchPoints.toLocaleString()}</strong></div>
        <div className="context-row"><span>Slash points</span><strong>-{result.stats.slashPoints.toLocaleString()}</strong></div>
        <div className="context-row"><span>Net ledger impact</span><strong>{result.stats.netLedgerImpact >= 0 ? "+" : ""}{result.stats.netLedgerImpact.toLocaleString()}</strong></div>
        <div className="context-row"><span>Est. pre-ledger/base</span><strong>{result.stats.estimatedTargetBasePoints.toLocaleString()}</strong></div>
        <div className="context-row"><span>Est. score from net support</span><strong>{pct(result.stats.estimatedNetSupportShare)}</strong></div>
        <div className="context-row"><span>Unique vouchers</span><strong>{result.stats.uniqueVouchers}</strong></div>
        <div className="context-row"><span>Second-hop coverage</span><strong>{pct(result.stats.graphCoverage)}</strong></div>
        <div className="context-row"><span>Reciprocal vouchers</span><strong>{result.stats.reciprocalVoucherCount} · {pct(result.stats.reciprocalVoucherRatio)}</strong></div>
        <div className="context-row"><span>Largest support cluster</span><strong>{result.stats.largestComponentSize} · {pct(result.stats.largestComponentShare)}</strong></div>
        <div className="context-row"><span>Grok confidence</span><strong>{Math.round(result.report.confidence * 100)}%</strong></div>
      </div>
    </div>

    <div className="score-grid integrity-score-grid">
      <Score label="Organic support" value={insufficient ? null : result.metrics.organicSupport} positive />
      <Score label="Coordination risk" value={insufficient ? null : result.metrics.coordinationRisk} />
      <Score label="Reciprocity risk" value={insufficient ? null : result.metrics.reciprocityRisk} />
      <Score label="Bot/Sybil support risk" value={insufficient ? null : result.metrics.botSybilSupportRisk} />
    </div>

    <div className="network-grid">
      <NetworkStat label="Net support share*" value={pct(result.stats.estimatedNetSupportShare)} />
      <NetworkStat label="Est. base*" value={result.stats.estimatedTargetBasePoints.toLocaleString()} />
      <NetworkStat label="Net ledger impact" value={`${result.stats.netLedgerImpact >= 0 ? "+" : ""}${result.stats.netLedgerImpact.toLocaleString()}`} />
      <NetworkStat label="Top supporter share" value={pct(result.stats.top1PointShare)} />
      <NetworkStat label="Top 5 point share" value={pct(result.stats.top5PointShare)} />
      <NetworkStat label="Internal vouch edges" value={String(result.stats.internalVouchEdges)} />
      <NetworkStat label="15m max burst" value={`${result.stats.maxVouches15m} vouches`} />
      <NetworkStat label="60m max burst" value={`${result.stats.maxVouches60m} vouches`} />
      <NetworkStat label="Median voucher base*" value={result.stats.medianEstimatedBasePoints.toLocaleString()} />
    </div>
    <p className="estimate-note">* Estimated from the current Commons total and observed ledger impacts. These values are context for how the rank was built, not official Commons base-score fields.</p>

    <section className="evidence-section">
      <div className="section-heading"><div><p className="eyebrow">WHY THIS SCORE</p><h3>Observed Commons graph signals</h3></div></div>
      <div className="evidence-list">{result.evidence.map((item, index) => <article className={`evidence evidence-${item.impact}`} key={`${item.label}-${index}`}><div className="evidence-icon">{evidenceIcon(item)}</div><div><div className="evidence-title"><strong>{item.label}</strong><span>severity {Math.round(item.severity)}/100</span></div><p>{item.observation}</p></div></article>)}</div>
    </section>

    <section className="evidence-section">
      <div className="section-heading"><div><p className="eyebrow">GROK VERDICT</p><h3>Interpretation of the Commons support network</h3></div></div>
      <div className="signal-columns">
        <div className="signal-card"><strong>Organic signals</strong><ul>{result.report.organicSignals.map((item) => <li key={item}>{item}</li>)}</ul></div>
        <div className="signal-card"><strong>Risk signals</strong><ul>{result.report.riskSignals.map((item) => <li key={item}>{item}</li>)}</ul></div>
      </div>
      {result.report.caveats.length > 0 && <div className="uncertainties"><strong>Important caveats</strong><ul>{result.report.caveats.map((item) => <li key={item}>{item}</li>)}</ul></div>}
    </section>

    <section className="evidence-section">
      <div className="section-heading"><div><p className="eyebrow">SUPPORTERS</p><h3>Who moved this creator’s Commons score?</h3></div><span>{result.supporters.length} actor/action rows</span></div>
      <div className="supporter-table-wrap">
        <table className="supporter-table">
          <thead><tr><th>Account</th><th>Action</th><th>Impact</th><th>Est. base</th><th>Rank</th><th>Incoming actors</th><th>Reciprocal</th><th>Internal links</th></tr></thead>
          <tbody>{result.supporters.slice(0, 40).map((supporter, index) => <SupporterRow key={`${supporter.handle}-${supporter.action}-${index}`} supporter={supporter} />)}</tbody>
        </table>
      </div>
    </section>

    <section className="evidence-section">
      <div className="section-heading"><div><p className="eyebrow">COMMONS LEDGER</p><h3>Incoming vouches and slashes</h3></div><span>{result.sourceEntries.length} events</span></div>
      <div className="ledger-list">{result.sourceEntries.slice(0, 60).map((entry, index) => <article className="ledger-row" key={`${entry.authorHandle}-${entry.kind}-${index}`}><div><strong>@{entry.authorHandle}</strong><span className={`ledger-kind ledger-${entry.kind}`}>{entry.kind}</span></div><div className="ledger-meta"><strong>{entry.kind === "vouch" ? "+" : "-"}{Math.abs(entry.points).toLocaleString()}</strong>{entry.createdAt && <span>{new Date(entry.createdAt).toLocaleString()}</span>}{entry.tweetUrl && <a href={entry.tweetUrl} target="_blank" rel="noreferrer">Source ↗</a>}</div></article>)}</div>
    </section>

    <div className="result-footer-actions">
      <button className="primary-button" onClick={share}>Share integrity audit on X</button>
      {!standalone && <a className="ghost-button" href={result.permalink}>Open public audit</a>}
      <a className="ghost-button" href="/methodology">Read methodology</a>
    </div>
    <p className="disclaimer">VouchGuard analyzes public Commons ledger relationships. Coordination, reciprocity, or thin support can be risk signals, but they do not prove that accounts are bots, Sybils, controlled by one person, or acting improperly.</p>
  </section>;
}

function Score({ label, value, positive = false }: { label: string; value: number | null; positive?: boolean }) {
  if (value === null) return <div className="metric-card metric-warn"><div><span>{label}</span><strong>—</strong></div><div className="metric-track"><span style={{ width: "0%" }} /></div></div>;
  const level = positive ? (value >= 70 ? "good" : value >= 45 ? "warn" : "bad") : (value < 35 ? "good" : value < 65 ? "warn" : "bad");
  return <div className={`metric-card metric-${level}`}><div><span>{label}</span><strong>{value}</strong></div><div className="metric-track"><span style={{ width: `${value}%` }} /></div></div>;
}

function NetworkStat({ label, value }: { label: string; value: string }) {
  return <div className="network-stat"><span>{label}</span><strong>{value}</strong></div>;
}

function SupporterRow({ supporter }: { supporter: SupporterProfile }) {
  return <tr>
    <td><a href={`https://x.com/${supporter.handle}`} target="_blank" rel="noreferrer">@{supporter.handle} ↗</a></td>
    <td><span className={`ledger-kind ledger-${supporter.action}`}>{supporter.action}</span></td>
    <td>{supporter.action === "vouch" ? "+" : "-"}{Math.abs(supporter.points).toLocaleString()}</td>
    <td>{supporter.estimatedBasePoints.toLocaleString()}</td>
    <td>{supporter.commonsRank ? `#${supporter.commonsRank}` : "—"}</td>
    <td>{supporter.graphLoaded ? supporter.uniqueIncomingActors : "—"}</td>
    <td>{supporter.graphLoaded ? supporter.reciprocatedByTarget ? "Yes" : "No" : "—"}</td>
    <td>{supporter.graphLoaded ? supporter.internalVouchLinks : "—"}</td>
  </tr>;
}
