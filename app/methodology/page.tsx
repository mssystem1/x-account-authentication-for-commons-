export default function MethodologyPage() {
  return (
    <main>
      <header className="site-header page-width"><a className="brand" href="/"><span className="brand-mark">V</span><span>VouchGuard <em>AI</em></span></a><nav><a href="/">Scanner</a><a href="https://github.com/mssystem1/x-account-authentication-for-commons-" target="_blank" rel="noreferrer">GitHub ↗</a></nav></header>
      <article className="methodology page-width">
        <p className="eyebrow">METHODOLOGY · VG-2026.08.7</p>
        <h1>Account behavior, not one post.</h1>
        <p className="lead">VouchGuard uses the official X API to resolve the account and retrieve a five-post quick sample, then Grok 4.5 evaluates the sample together with public account metadata. The displayed scores are computed in application code, not chosen by the model.</p>

        <h2>How evidence is collected</h2>
        <div className="method-grid">
          <div><strong>Exact identity</strong><p>The X API resolves the requested username to a concrete user ID. That identity is cached for 24 hours to avoid paying for the same lookup on every scan.</p></div>
          <div><strong>Five-post quick scan</strong><p>Each fresh assessment retrieves at most five authored posts from the last 180 days. Reposts are excluded; originals, replies and quote posts remain useful evidence.</p></div>
          <div><strong>Account context</strong><p>Grok also receives account age, follower/following counts, lifetime post count, bio and post engagement metrics.</p></div>
          <div><strong>Cost bounded</strong><p>At the current X rates assumed by the product, five Post reads are about $0.025. A first identity lookup adds about $0.010; cached identity scans stay near $0.025 X-side.</p></div>
          <div><strong>Trusted source URLs</strong><p>Evidence links shown by the model are restricted to post URLs actually supplied in the X API dataset.</p></div>
          <div><strong>Confidence capped</strong><p>The quick sample is intentionally small, so model confidence is capped even when Grok is highly certain.</p></div>
          <div><strong>Fallback behavior</strong><p>If official X API retrieval is unavailable, bounded native Grok X Search can be used, but insufficient retrieval produces UNSCORABLE rather than invented scores.</p></div>
        </div>

        <h2>What Grok measures</h2>
        <div className="method-grid">
          <div><strong>Content originality</strong><p>Original thought, varied language and meaningful content versus mechanical repetition.</p></div>
          <div><strong>Identity continuity</strong><p>Persistent interests, projects, voice and account history over time.</p></div>
          <div><strong>Engagement quality</strong><p>Conversations and substantive interactions versus generic reciprocal replies.</p></div>
          <div><strong>Social diversity</strong><p>Diversity of public counterparties and communities.</p></div>
          <div><strong>Campaign concentration</strong><p>How much activity is dominated by points, rewards, quests, vouches and campaigns.</p></div>
          <div><strong>Reciprocity pressure</strong><p>Patterns such as forced return engagement, vouch-back behavior and repetitive exchange requests.</p></div>
          <div><strong>Automation pattern</strong><p>Templating, repeated language and mechanically consistent behavior.</p></div>
          <div><strong>Temporal anomalies</strong><p>Unusually regular or implausible public activity patterns.</p></div>
          <div><strong>Network coordination</strong><p>Closed reciprocal patterns or repeated coordinated-looking counterparties visible from the target's public behavior. This is not ownership proof.</p></div>
        </div>

        <h2>Final score formulas</h2>
        <pre>{`Authenticity =
  Originality × 26% + Continuity × 24% + Engagement × 18%
  + Diversity × 14% + (100 − Automation) × 10%
  + (100 − Campaign Concentration) × 8%

Farmer Risk =
  Campaign Concentration × 36% + Reciprocity × 28%
  + (100 − Originality) × 14% + (100 − Diversity) × 8%
  + Network Coordination × 14%

Bot Risk =
  Automation × 46% + Temporal Anomalies × 24%
  + (100 − Originality) × 14% + (100 − Engagement) × 16%

Sybil Risk =
  Network Coordination × 42% + (100 − Diversity) × 18%
  + Automation × 14% + Reciprocity × 16%
  + Campaign Concentration × 10%`}</pre>

        <h2>Data-sufficiency rules</h2>
        <ul>
          <li>VouchGuard refuses to score when the exact profile cannot be resolved or fewer than five authored posts are available.</li>
          <li>Five posts across fewer than three distinct activity days are treated as limited coverage and cap confidence.</li>
          <li>Five posts across at least three distinct days can qualify as a sufficient quick scan when combined with public account metadata.</li>
          <li>Even a sufficient five-post quick scan has a hard AI-confidence ceiling of 78%.</li>
          <li>An all-neutral model vector around 50 is treated as a retrieval/model failure, not a real assessment.</li>
          <li>Unscorable results are not cached, so temporary retrieval problems can be retried.</li>
        </ul>

        <h2>Important limitations</h2>
        <ul>
          <li>“Sybil Risk” means coordination signals, not proof that several accounts share one owner.</li>
          <li>A farmer can be a real human. Authenticity and farming are intentionally separate metrics.</li>
          <li>Crypto, airdrop, Kaito, points or Commons participation alone is not treated as farming.</li>
          <li>Required Commons command text is not treated as bot evidence merely because the syntax repeats.</li>
          <li>The low-cost quick scan trades depth for cost; users should inspect evidence before acting.</li>
          <li>Slash is always a human decision. The product requires evidence review before composing a slash.</li>
        </ul>
      </article>
    </main>
  );
}
