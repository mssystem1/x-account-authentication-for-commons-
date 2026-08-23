import { Scanner } from "@/components/Scanner";

export default function HomePage() {
  return (
    <main>
      <header className="site-header page-width">
        <a className="brand" href="/"><span className="brand-mark">V</span><span>VouchGuard <em>AI</em></span></a>
        <nav><a href="/methodology">Methodology</a><a href="https://github.com/mssystem1/x-account-authentication-for-commons-" target="_blank" rel="noreferrer">GitHub ↗</a></nav>
      </header>
      <section className="hero page-width">
        <div className="hero-copy">
          <div className="hero-badge"><span /> BUILT FOR COMMONS</div>
          <h1>Scan before<br /><span>you vouch.</span></h1>
          <p>AI-powered X account analysis for detecting farming, bot-like behavior and coordinated/Sybil patterns before you spend a scarce Commons action.</p>
          <div className="hero-points"><span>Account-level analysis</span><span>Evidence-backed</span><span>Human decides</span></div>
        </div>
        <div className="hero-visual" aria-hidden="true">
          <div className="radar-ring radar-one" /><div className="radar-ring radar-two" /><div className="radar-ring radar-three" />
          <div className="radar-center"><span>VG</span><small>ACCOUNT<br />INTELLIGENCE</small></div>
          <div className="radar-chip chip-a">AUTHENTICITY <strong>91</strong></div>
          <div className="radar-chip chip-b">BOT RISK <strong>08</strong></div>
          <div className="radar-chip chip-c">SYBIL RISK <strong>14</strong></div>
        </div>
      </section>
      <section className="page-width scan-area"><Scanner /></section>
      <section className="how page-width">
        <div className="section-heading"><div><p className="eyebrow">HOW IT WORKS</p><h2>One account. Four independent signals.</h2></div></div>
        <div className="how-grid">
          <article><span>01</span><h3>Investigate X</h3><p>Grok 4.5 uses native X Search to inspect the public account history, replies, conversations, recurring counterparties and behavioral patterns.</p></article>
          <article><span>02</span><h3>Extract evidence</h3><p>The LLM returns structured sub-signals and public source links. It does not get to output the final VouchGuard score.</p></article>
          <article><span>03</span><h3>Score transparently</h3><p>Deterministic weights produce Authenticity, Farmer Risk, Bot Risk, Sybil Risk and Vouch Confidence.</p></article>
          <article><span>04</span><h3>You decide</h3><p>Vouch, skip, or review evidence before composing a slash. VouchGuard never posts or acts on your behalf.</p></article>
        </div>
      </section>
      <footer className="page-width footer"><div className="brand"><span className="brand-mark">V</span><span>VouchGuard AI</span></div><p>Independent decision-support for Commons · Built by @mssystem1</p></footer>
    </main>
  );
}
