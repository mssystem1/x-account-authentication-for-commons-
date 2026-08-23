export default function MethodologyPage() {
  return (
    <main>
      <header className="site-header page-width"><a className="brand" href="/"><span className="brand-mark">V</span><span>VouchGuard <em>AI</em></span></a><nav><a href="/">Auditor</a><a href="https://github.com/mssystem1/x-account-authentication-for-commons-" target="_blank" rel="noreferrer">GitHub ↗</a></nav></header>
      <article className="methodology page-width">
        <p className="eyebrow">METHODOLOGY · VG-COMMONS-2026.08.2</p>
        <h1>Audit how the rank was built.</h1>
        <p className="lead">VouchGuard starts from Commons’ own target ledger, not from a random X-post sample. It reconstructs the incoming vouch/slash network, measures how much of the current score is attributable to observed ledger actions, inspects supporter relationships, then asks Grok 4.5 to explain the deterministic evidence.</p>

        <h2>Primary data</h2>
        <div className="method-grid">
          <div><strong>Target ledger</strong><p>Every incoming Commons vouch and slash for the requested creator is read, including actor handle, point impact, timestamp and source post when supplied.</p></div>
          <div><strong>Second-hop supporter graph</strong><p>VouchGuard loads up to 40 high-impact supporter/slasher ledgers to see whether the target reciprocated them and whether supporters strongly vouch one another.</p></div>
          <div><strong>No X API required</strong><p>The normal Commons integrity audit does not need paid X timeline retrieval. X is only used for outbound links/source inspection.</p></div>
          <div><strong>Graph coverage</strong><p>If Commons rate limits or second-hop ledgers cannot be loaded, coverage falls and the final score receives a confidence penalty.</p></div>
        </div>

        <h2>How much did support create the current score?</h2>
        <div className="method-grid">
          <div><strong>Net ledger impact</strong><p>Observed incoming vouch points minus observed incoming slash points.</p></div>
          <div><strong>Estimated pre-ledger/base contribution</strong><p>Current Commons total minus observed net ledger impact. This is explicitly an estimate derived from the ledger, not an official Commons base-score field.</p></div>
          <div><strong>Estimated net support share</strong><p>The positive net ledger impact divided by the current Commons total, capped to 0–100%. It answers how dependent the current score appears to be on incoming support.</p></div>
          <div><strong>Context, not guilt</strong><p>A creator can be highly support-dependent and still be organically supported. Support dependence does not increase coordination risk by itself.</p></div>
        </div>

        <h2>What VouchGuard measures</h2>
        <div className="method-grid">
          <div><strong>Organic support</strong><p>High when support is diverse, weakly reciprocal, not dominated by a closed cluster, and not concentrated into synchronized bursts.</p></div>
          <div><strong>Coordination risk</strong><p>Combines connected-supporter concentration, internal vouch density, reciprocity, timing concentration and point concentration.</p></div>
          <div><strong>Reciprocity risk</strong><p>Measures how many incoming vouchers appear to have been vouched back by the target.</p></div>
          <div><strong>Point concentration</strong><p>Measures whether one or a few vouchers dominate reputation impact. High concentration is context, not proof of manipulation.</p></div>
          <div><strong>Timing risk</strong><p>Measures the largest 15-minute and 60-minute vouch bursts recorded by the Commons ledger.</p></div>
          <div><strong>Thin-support risk</strong><p>Flags vouchers that are both far below the target supporter median in estimated vouch power and have very little incoming Commons graph support.</p></div>
          <div><strong>Bot/Sybil support risk</strong><p>A combined coordination indicator. It does not prove that accounts are automated or share one owner.</p></div>
        </div>

        <h2>Important interpretation rules</h2>
        <ul>
          <li>Reciprocal vouching alone is not proof of abuse.</li>
          <li>A strong creator may legitimately contribute a large share of points, so point concentration is never decisive by itself.</li>
          <li>Dense internal supporter links plus high reciprocity plus synchronized timing are stronger together than any single signal.</li>
          <li>Vouch power is estimated from the Commons rule that an action moves roughly 35% of the actor’s base score; this estimate is contextual, not an official base-score field.</li>
          <li>Target base/support-dependence values are reconstructed from the current total and observed ledger actions and are always labelled estimates.</li>
          <li>“Bot/Sybil risk” is a behavioral-network risk label, not an identity determination.</li>
          <li>If too little support data exists, the UI suppresses the headline/component scores instead of presenting sparse evidence as certainty.</li>
          <li>Grok does not set the numeric scores. It receives the already-computed graph statistics and produces a human-readable verdict.</li>
        </ul>

        <h2>Final output</h2>
        <p>The headline <strong>Commons Integrity Score</strong> summarizes how organic the observed support network looks after a graph-coverage penalty. The page separately shows how support-dependent the current Commons total appears to be, along with component risks, supporters, reciprocal relationships, cluster statistics and the original incoming Commons events.</p>
      </article>
    </main>
  );
}
