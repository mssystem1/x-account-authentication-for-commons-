export default function MethodologyPage() {
  return (
    <main>
      <header className="site-header page-width"><a className="brand" href="/"><span className="brand-mark">V</span><span>VouchGuard <em>AI</em></span></a><nav><a href="/">Auditor</a><a href="https://github.com/mssystem1/x-account-authentication-for-commons-" target="_blank" rel="noreferrer">GitHub ↗</a></nav></header>
      <article className="methodology page-width">
        <p className="eyebrow">METHODOLOGY · VG-COMMONS-2026.08.3</p>
        <h1>Audit how the rank was built.</h1>
        <p className="lead">VouchGuard starts from Commons’ own target ledger and deliberately treats positive support and negative attacks as two different questions. It reconstructs incoming vouches and slashes, samples both sides of the second-hop graph independently, calculates deterministic metrics, then asks Grok 4.5 to explain the evidence.</p>

        <h2>Why there is no single “integrity” number anymore</h2>
        <div className="method-grid">
          <div><strong>Support Integrity</strong><p>How natural the incoming VOUCH network looks: diversity, reciprocity, supporter clusters, timing, concentration and sampled account thinness.</p></div>
          <div><strong>Slash Attack Risk</strong><p>How strongly the account has been hit by negative actions, combined with timing and graph evidence that may indicate coordinated attackers.</p></div>
          <div><strong>Attack pressure ≠ bots</strong><p>Many slashers or millions of removed points can prove the rank was heavily affected. They cannot by themselves prove that the attackers are automated or controlled by one operator.</p></div>
          <div><strong>Bot/Sybil Network Risk</strong><p>This narrower metric only increases from graph coordination and thin-account patterns. It is explicitly probabilistic, not an identity verdict.</p></div>
        </div>

        <h2>Primary Commons data</h2>
        <div className="method-grid">
          <div><strong>Target ledger</strong><p>Every incoming Commons vouch and slash for the requested creator is read, including actor handle, point impact, timestamp and source post when supplied.</p></div>
          <div><strong>Separate second-hop budgets</strong><p>Up to 30 voucher ledgers and up to 30 slasher ledgers are sampled independently. A popular account with hundreds of vouchers can therefore no longer consume every graph slot and hide its slasher network.</p></div>
          <div><strong>Impact + recency sampling</strong><p>Each side reserves most slots for high-impact actors and the remaining slots for recent actors. This captures both score-moving accounts and coordinated bursts.</p></div>
          <div><strong>No paid X API required</strong><p>The core rank audit uses Commons data. X links remain available for human inspection, but follower count or X Premium is not required for the normal score.</p></div>
        </div>

        <h2>How much did ledger activity move the rank?</h2>
        <div className="method-grid">
          <div><strong>Net ledger impact</strong><p>Observed incoming vouch points minus observed incoming slash points.</p></div>
          <div><strong>Estimated pre-ledger/base contribution</strong><p>Current Commons total minus observed net ledger impact. This is a derived estimate, not an official Commons base-score field.</p></div>
          <div><strong>Estimated net support share</strong><p>Positive net ledger impact divided by the current positive Commons total. It shows how support-dependent the current score appears to be.</p></div>
          <div><strong>Rank Distortion Risk</strong><p>Combines suspicious positive-support influence with the magnitude of negative slash pressure. It describes how unstable/externally-driven the observed rank may be, not whether the creator did anything wrong.</p></div>
        </div>

        <h2>Support-side signals</h2>
        <ul>
          <li>Unique voucher count and point diversity.</li>
          <li>How many vouchers appear to have been vouched back by the target.</li>
          <li>Largest connected voucher component and same-side vouch links.</li>
          <li>Top-1 / top-5 point concentration and HHI.</li>
          <li>Vouch timing bursts.</li>
          <li>Thin low-power voucher accounts in the sampled graph.</li>
          <li>Voucher graph coverage. Low coverage prevents an overconfident “organic” verdict for highly support-dependent ranks.</li>
        </ul>

        <h2>Slash-attack signals</h2>
        <ul>
          <li>Unique slasher count and total points removed.</li>
          <li>Negative-action share: slashes as a fraction of all absolute incoming vouch/slash impact.</li>
          <li>Slash impact relative to the estimated pre-ledger/base contribution.</li>
          <li>Maximum 5-minute, 15-minute and 60-minute slash bursts.</li>
          <li>Largest connected slasher component and positive links among sampled slashers.</li>
          <li>Top-1 / top-5 slash-point concentration.</li>
          <li>Thin low-power slasher accounts in the sampled graph.</li>
          <li>Slasher graph coverage. Low coverage means coordination is unresolved — never “proven absent.”</li>
        </ul>

        <h2>Verdict logic</h2>
        <div className="method-grid">
          <div><strong>Likely organic</strong><p>Support looks healthy with adequate graph coverage and no major negative attack pressure.</p></div>
          <div><strong>Support needs review</strong><p>Usually used when the rank is highly dependent on incoming vouches but too little of the supporter graph has been sampled for a strong positive verdict.</p></div>
          <div><strong>Heavy slash pressure</strong><p>The rank has been strongly affected by slashing, but the Commons-only graph does not yet establish coordinated attackers.</p></div>
          <div><strong>Slash attack risk</strong><p>Heavy negative pressure is accompanied by meaningful timing/cluster/thin-account coordination signals.</p></div>
          <div><strong>Support coordination risk</strong><p>The positive vouch network itself contains strong coordination patterns.</p></div>
          <div><strong>Contested manipulation</strong><p>Both positive support and negative slash activity contain strong coordination signals.</p></div>
        </div>

        <h2>Grok’s role</h2>
        <p>Grok does not choose the numeric scores and cannot override the deterministic verdict. It receives the already-computed Commons statistics, top sampled vouchers/slashers and evidence, then writes separate support and attack interpretations. It is instructed not to call users bots or Sybils as facts.</p>

        <h2>Important limitations</h2>
        <ul>
          <li>Commons ledgers expose incoming actions. They do not provide a bulk outgoing-action feed, so second-hop relationships are reconstructed by loading other targets’ ledgers.</li>
          <li>A mass slash wave can be genuine community punishment, coordinated community action, a bot attack, or a mixture. Commons-only data can estimate the pattern but cannot prove the operator behind accounts.</li>
          <li>Follower counts, X Premium, account age and post behavior are not currently used in the core score. They can be added later as an optional deep identity check for suspicious actors.</li>
          <li>Reciprocity, point concentration and community membership are context signals. None is proof of wrongdoing by itself.</li>
          <li>Public leaderboard mirrors can lag behind the live Commons ledger while the experiment/team is changing scores or cleaning bots.</li>
        </ul>
      </article>
    </main>
  );
}
