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
          <div className="hero-badge"><span /> COMMONS RANK INTELLIGENCE</div>
          <h1>Audit the<br /><span>leaderboard.</span></h1>
          <p>See both sides of a Commons rank: whether incoming vouches look independent or coordinated, and whether mass slashing may have distorted the creator’s position. VouchGuard reconstructs both graphs from Commons’ own ledger and lets Grok explain the evidence.</p>
          <div className="hero-points"><span>Vouch integrity</span><span>Slash attack analysis</span><span>Rank distortion</span></div>
        </div>
        <div className="hero-visual" aria-hidden="true">
          <div className="radar-ring radar-one" /><div className="radar-ring radar-two" /><div className="radar-ring radar-three" />
          <div className="radar-center"><span>VG</span><small>RANK<br />AUDIT</small></div>
          <div className="radar-chip chip-a">SUPPORT <strong>82</strong></div>
          <div className="radar-chip chip-b">ATTACK RISK <strong>64</strong></div>
          <div className="radar-chip chip-c">RELIABILITY <strong>41</strong></div>
        </div>
      </section>
      <section className="page-width scan-area"><Scanner /></section>
      <section className="how page-width">
        <div className="section-heading"><div><p className="eyebrow">HOW IT WORKS</p><h2>Follow every force moving the rank.</h2></div></div>
        <div className="how-grid">
          <article><span>01</span><h3>Read Commons</h3><p>Load every incoming vouch and slash recorded by Commons for the creator, including actor, point impact and timestamp.</p></article>
          <article><span>02</span><h3>Trace both sides</h3><p>Sample voucher and slasher ledgers independently so a large support network can never hide the attacker graph.</p></article>
          <article><span>03</span><h3>Separate the risks</h3><p>Measure Support Integrity, slash pressure, attack coordination, timing, rank distortion and Bot/Sybil Network Risk separately.</p></article>
          <article><span>04</span><h3>Explain with Grok</h3><p>Grok receives the measured Commons graph and explains what looks organic, what needs review, and what the data cannot prove.</p></article>
        </div>
      </section>
      <footer className="page-width footer"><div className="brand"><span className="brand-mark">V</span><span>VouchGuard AI</span></div><p>Independent Commons leaderboard integrity analysis · Built by @mssystem1</p></footer>
    </main>
  );
}
