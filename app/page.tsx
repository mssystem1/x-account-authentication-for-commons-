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
          <div className="hero-badge"><span /> COMMONS INTEGRITY INTELLIGENCE</div>
          <h1>Audit the<br /><span>leaderboard.</span></h1>
          <p>See how a Commons creator climbed: genuine independent vouches, reciprocal support, concentrated clusters, or coordination patterns. VouchGuard reconstructs the support graph from Commons’ own ledger and lets Grok explain the evidence.</p>
          <div className="hero-points"><span>Commons-native data</span><span>Support graph</span><span>Grok verdict</span></div>
        </div>
        <div className="hero-visual" aria-hidden="true">
          <div className="radar-ring radar-one" /><div className="radar-ring radar-two" /><div className="radar-ring radar-three" />
          <div className="radar-center"><span>VG</span><small>COMMONS<br />INTEGRITY</small></div>
          <div className="radar-chip chip-a">ORGANIC <strong>88</strong></div>
          <div className="radar-chip chip-b">COORD RISK <strong>12</strong></div>
          <div className="radar-chip chip-c">RECIPROCITY <strong>09</strong></div>
        </div>
      </section>
      <section className="page-width scan-area"><Scanner /></section>
      <section className="how page-width">
        <div className="section-heading"><div><p className="eyebrow">HOW IT WORKS</p><h2>Follow the reputation, not the profile.</h2></div></div>
        <div className="how-grid">
          <article><span>01</span><h3>Read Commons</h3><p>Load every incoming vouch and slash recorded by Commons for the creator, including actor, point impact and timestamp.</p></article>
          <article><span>02</span><h3>Trace supporters</h3><p>Inspect supporter ledgers to detect target reciprocity, supporter-to-supporter vouches, closed components and thin support histories.</p></article>
          <article><span>03</span><h3>Measure integrity</h3><p>Deterministic graph metrics calculate organic support, coordination, reciprocity, concentration, timing and bot/Sybil-support risk.</p></article>
          <article><span>04</span><h3>Explain with Grok</h3><p>Grok receives the measured Commons graph—not an open-ended X search—and turns it into an evidence-aware leaderboard verdict.</p></article>
        </div>
      </section>
      <footer className="page-width footer"><div className="brand"><span className="brand-mark">V</span><span>VouchGuard AI</span></div><p>Independent Commons leaderboard integrity analysis · Built by @mssystem1</p></footer>
    </main>
  );
}
