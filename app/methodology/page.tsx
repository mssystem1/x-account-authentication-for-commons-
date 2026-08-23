export default function MethodologyPage() {
  return (
    <main>
      <header className="site-header page-width"><a className="brand" href="/"><span className="brand-mark">V</span><span>VouchGuard <em>AI</em></span></a><nav><a href="/">Scanner</a><a href="https://github.com/mssystem1/x-account-authentication-for-commons-" target="_blank" rel="noreferrer">GitHub ↗</a></nav></header>
      <article className="methodology page-width">
        <p className="eyebrow">METHODOLOGY · VG-2026.08.1</p>
        <h1>Account behavior, not one post.</h1>
        <p className="lead">VouchGuard uses Grok with native X Search as an investigator, then computes the displayed scores in application code. The AI is not allowed to make a definitive identity or wrongdoing determination.</p>
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
          <div><strong>Network coordination</strong><p>Closed reciprocal clusters, synchronized behavior and repeated coordinated counterparties.</p></div>
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
        <h2>Important limitations</h2>
        <ul>
          <li>“Sybil Risk” means coordination signals, not proof that several accounts share one owner.</li>
          <li>A farmer can be a real human. Authenticity and farming are intentionally separate metrics.</li>
          <li>Crypto, airdrop, Kaito, points or Commons participation alone is not treated as farming.</li>
          <li>Required Commons command text is not treated as bot evidence merely because the syntax repeats.</li>
          <li>Low-data accounts should receive lower confidence, not automatically higher risk.</li>
          <li>Slash is always a human decision. The product requires evidence review before composing a slash.</li>
        </ul>
      </article>
    </main>
  );
}
