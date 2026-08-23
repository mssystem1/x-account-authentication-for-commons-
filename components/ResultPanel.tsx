"use client";

import type { IntegrityAuditResult, IntegrityEvidence, SupporterProfile } from "@/lib/integrity-types";

function verdictMeta(verdict: IntegrityAuditResult["report"]["verdict"]) {
  if (verdict === "LIKELY_ORGANIC") return { label: "Likely organic in sampled graph", className: "recommend-good", icon: "✓" };
  if (verdict === "SUPPORT_REVIEW") return { label: "Support needs review", className: "recommend-warn", icon: "?" };
  if (verdict === "SUPPORT_COORDINATION_RISK") return { label: "Coordinated support risk", className: "recommend-bad", icon: "!" };
  if (verdict === "HEAVY_SLASH_PRESSURE") return { label: "Rank heavily hit by slashing", className: "recommend-bad", icon: "!" };
  if (verdict === "SLASH_ATTACK_RISK") return { label: "Coordinated slash-attack risk", className: "recommend-bad", icon: "!" };
  if (verdict === "CONTESTED_MANIPULATION") return { label: "Contested / manipulation signals", className: "recommend-bad", icon: "!" };
  return { label: "Insufficient Commons data", className: "recommend-warn", icon: "?" };
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
  const vouchers = result.supporters.filter((supporter) => supporter.action === "vouch");
  const slashers = result.supporters.filter((supporter) => supporter.action === "slash");
  const supportEvidence = result.evidence.filter((item) => item.domain === "support");
  const attackEvidence = result.evidence.filter((item) => item.domain === "attack");
  const contextEvidence = result.evidence.filter((item) => item.domain === "rank" || item.domain === "coverage");

  const share = () => {
    const text = `I audited @${result.handle}'s Commons rank with VouchGuard.\n\nSupport Integrity ${result.metrics.supportIntegrity}/100\nSlash Attack Risk ${result.metrics.slashAttackRisk}/100\nRank Reliability ${result.metrics.rankReliability}/100\n\n${verdict.label}\n\nSee the vouch + slash graph:`;
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

    {result.mode === "demo" && <div className="demo-banner">Simulation mode — this result uses a synthetic Commons vouch/slash graph.</div>}

    <div className="verdict-grid">
      <div className="confidence-card">
        <span className="eyebrow">RANK VERDICT</span>
        <div className={`recommendation ${verdict.className}`}><span>{verdict.icon}</span>{verdict.label}</div>
        <h3 className="audit-headline">{result.report.headline}</h3>
        <p>{result.report.explanation}</p>
        <div className="dual-axis-summary">
          <div><span>Support Integrity</span><strong>{result.metrics.supportIntegrity}</strong></div>
          <div><span>Slash Attack Risk</span><strong>{result.metrics.slashAttackRisk}</strong></div>
        </div>
      </div>
      <div className="profile-context">
        <div className="context-row"><span>Incoming vouches</span><strong>{result.stats.incomingVouches}</strong></div>
        <div className="context-row"><span>Incoming slashes</span><strong>{result.stats.incomingSlashes}</strong></div>
        <div className="context-row"><span>Vouch points</span><strong>+{result.stats.vouchPoints.toLocaleString()}</strong></div>
        <div className="context-row"><span>Slash points</span><strong>-{result.stats.slashPoints.toLocaleString()}</strong></div>
        <div className="context-row"><span>Net ledger impact</span><strong>{result.stats.netLedgerImpact >= 0 ? "+" : ""}{result.stats.netLedgerImpact.toLocaleString()}</strong></div>
        <div className="context-row"><span>Est. pre-ledger/base</span><strong>{result.stats.estimatedTargetBasePoints.toLocaleString()}</strong></div>
        <div className="context-row"><span>Est. net support share</span><strong>{pct(result.stats.estimatedNetSupportShare)}</strong></div>
        <div className="context-row"><span>Negative action share</span><strong>{pct(result.stats.negativeActionShare)}</strong></div>
        <div className="context-row"><span>Grok confidence</span><strong>{Math.round(result.report.confidence * 100)}%</strong></div>
      </div>
    </div>

    <div className="score-grid integrity-score-grid">
      <Score label="Support integrity" value={result.metrics.supportIntegrity} positive />
      <Score label="Slash attack risk" value={result.metrics.slashAttackRisk} />
      <Score label="Support coordination" value={result.metrics.supportCoordinationRisk} />
      <Score label="Rank distortion risk" value={result.metrics.rankDistortionRisk} />
    </div>

    <div className="network-grid">
      <NetworkStat label="Rank reliability" value={`${result.metrics.rankReliability}/100`} />
      <NetworkStat label="Attack pressure" value={`${result.metrics.attackPressure}/100`} />
      <NetworkStat label="Attack coordination" value={`${result.metrics.attackCoordinationRisk}/100`} />
      <NetworkStat label="Bot/Sybil network risk" value={`${result.metrics.botSybilNetworkRisk}/100`} />
      <NetworkStat label="Voucher graph coverage" value={`${result.stats.analyzedVouchers}/${result.stats.uniqueVouchers} · ${pct(result.stats.vouchGraphCoverage)}`} />
      <NetworkStat label="Slasher graph coverage" value={`${result.stats.analyzedSlashers}/${result.stats.uniqueSlashers} · ${pct(result.stats.slashGraphCoverage)}`} />
    </div>

    <section className="evidence-section">
      <div className="section-heading"><div><p className="eyebrow">SUPPORT INTEGRITY</p><h3>How was the account vouched?</h3></div></div>
      <p className="section-explainer">{result.report.supportAssessment}</p>
      <div className="evidence-list">{supportEvidence.map((item, index) => <Evidence key={`${item.label}-${index}`} item={item} />)}</div>
    </section>

    <section className="evidence-section attack-section">
      <div className="section-heading"><div><p className="eyebrow">SLASH ATTACK ANALYSIS</p><h3>Was the rank hit by mass or coordinated slashing?</h3></div></div>
      <p className="section-explainer">{result.report.attackAssessment}</p>
      <div className="attack-stats">
        <NetworkStat label="Unique slashers" value={String(result.stats.uniqueSlashers)} />
        <NetworkStat label="Slash points removed" value={`-${result.stats.slashPoints.toLocaleString()}`} />
        <NetworkStat label="Max 5m burst" value={`${result.stats.maxSlashes5m} slashes`} />
        <NetworkStat label="Max 15m burst" value={`${result.stats.maxSlashes15m} slashes`} />
        <NetworkStat label="Max 60m burst" value={`${result.stats.maxSlashes60m} slashes`} />
        <NetworkStat label="Largest slasher cluster" value={`${result.stats.slasherLargestComponentSize} · ${pct(result.stats.slasherLargestComponentShare)}`} />
      </div>
      <div className="evidence-list">{attackEvidence.map((item, index) => <Evidence key={`${item.label}-${index}`} item={item} />)}</div>
    </section>

    <section className="evidence-section">
      <div className="section-heading"><div><p className="eyebrow">RANK CONTEXT</p><h3>How trustworthy is the observed leaderboard position?</h3></div></div>
      <div className="evidence-list">{contextEvidence.map((item, index) => <Evidence key={`${item.label}-${index}`} item={item} />)}</div>
    </section>

    <section className="evidence-section">
      <div className="section-heading"><div><p className="eyebrow">GROK INTERPRETATION</p><h3>What the graph does — and does not — show</h3></div></div>
      <div className="signal-columns">
        <div className="signal-card"><strong>Organic / independent signals</strong><ul>{result.report.organicSignals.map((item) => <li key={item}>{item}</li>)}</ul></div>
        <div className="signal-card"><strong>Support-risk signals</strong><ul>{result.report.supportRiskSignals.map((item) => <li key={item}>{item}</li>)}</ul></div>
        <div className="signal-card"><strong>Attack-risk signals</strong><ul>{result.report.attackRiskSignals.map((item) => <li key={item}>{item}</li>)}</ul></div>
      </div>
      {result.report.caveats.length > 0 && <div className="uncertainties"><strong>Important caveats</strong><ul>{result.report.caveats.map((item) => <li key={item}>{item}</li>)}</ul></div>}
    </section>

    <ActorTable title="Top vouchers" eyebrow="POSITIVE SUPPORT" actors={vouchers} />
    <ActorTable title="Top slashers" eyebrow="NEGATIVE SUPPORT / ATTACKERS" actors={slashers} />

    <section className="evidence-section">
      <div className="section-heading"><div><p className="eyebrow">COMMONS LEDGER</p><h3>Incoming vouches and slashes</h3></div><span>{result.sourceEntries.length} events</span></div>
      <div className="ledger-list">{result.sourceEntries.slice(0, 80).map((entry, index) => <article className="ledger-row" key={`${entry.authorHandle}-${entry.kind}-${index}`}><div><strong>@{entry.authorHandle}</strong><span className={`ledger-kind ledger-${entry.kind}`}>{entry.kind}</span></div><div className="ledger-meta"><strong>{entry.kind === "vouch" ? "+" : "-"}{Math.abs(entry.points).toLocaleString()}</strong>{entry.createdAt && <span>{new Date(entry.createdAt).toLocaleString()}</span>}{entry.tweetUrl && <a href={entry.tweetUrl} target="_blank" rel="noreferrer">Source ↗</a>}</div></article>)}</div>
    </section>

    <div className="result-footer-actions">
      <button className="primary-button" onClick={share}>Share rank audit on X</button>
      {!standalone && <a className="ghost-button" href={result.permalink}>Open public audit</a>}
      <a className="ghost-button" href="/methodology">Read methodology</a>
    </div>
    <p className="disclaimer">VouchGuard analyzes public Commons ledger relationships. Heavy slashing can show that a rank was strongly affected, but does not by itself prove a bot attack. Coordination and Bot/Sybil Network Risk are probabilistic graph signals, not determinations of account ownership, automation, intent, or wrongdoing.</p>
  </section>;
}

function Evidence({ item }: { item: IntegrityEvidence }) {
  return <article className={`evidence evidence-${item.impact}`}><div className="evidence-icon">{evidenceIcon(item)}</div><div><div className="evidence-title"><strong>{item.label}</strong><span>{item.domain} · severity {Math.round(item.severity)}/100</span></div><p>{item.observation}</p></div></article>;
}

function Score({ label, value, positive = false }: { label: string; value: number; positive?: boolean }) {
  const level = positive ? (value >= 70 ? "good" : value >= 45 ? "warn" : "bad") : (value < 35 ? "good" : value < 65 ? "warn" : "bad");
  return <div className={`metric-card metric-${level}`}><div><span>{label}</span><strong>{value}</strong></div><div className="metric-track"><span style={{ width: `${value}%` }} /></div></div>;
}

function NetworkStat({ label, value }: { label: string; value: string }) {
  return <div className="network-stat"><span>{label}</span><strong>{value}</strong></div>;
}

function ActorTable({ title, eyebrow, actors }: { title: string; eyebrow: string; actors: SupporterProfile[] }) {
  return <section className="evidence-section">
    <div className="section-heading"><div><p className="eyebrow">{eyebrow}</p><h3>{title}</h3></div><span>{actors.length} unique actor rows</span></div>
    <div className="supporter-table-wrap">
      <table className="supporter-table">
        <thead><tr><th>Account</th><th>Impact</th><th>Est. base</th><th>Rank</th><th>Incoming actors</th><th>Same-side vouch links</th><th>Target returned action</th><th>Graph</th></tr></thead>
        <tbody>{actors.slice(0, 40).map((actor, index) => <ActorRow key={`${actor.handle}-${actor.action}-${index}`} actor={actor} />)}</tbody>
      </table>
    </div>
  </section>;
}

function ActorRow({ actor }: { actor: SupporterProfile }) {
  const returned = actor.action === "vouch" ? actor.reciprocatedByTarget : actor.retaliatedByTarget;
  return <tr>
    <td><a href={`https://x.com/${actor.handle}`} target="_blank" rel="noreferrer">@{actor.handle} ↗</a></td>
    <td>{actor.action === "vouch" ? "+" : "-"}{Math.abs(actor.points).toLocaleString()}</td>
    <td>{actor.estimatedBasePoints.toLocaleString()}</td>
    <td>{actor.commonsRank ? `#${actor.commonsRank}` : "—"}</td>
    <td>{actor.graphLoaded ? actor.uniqueIncomingActors : "—"}</td>
    <td>{actor.graphLoaded ? actor.internalVouchLinks : "—"}</td>
    <td>{actor.graphLoaded ? returned ? "Yes" : "No" : "—"}</td>
    <td>{actor.graphLoaded ? "Loaded" : "Not sampled"}</td>
  </tr>;
}
