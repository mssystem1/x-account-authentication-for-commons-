# VouchGuard AI

> **Audit the Commons leaderboard.** See how a creator’s rank was built — and whether incoming vouches or incoming slashes may have distorted it.

**Live:** https://vouchguard-ai.vercel.app

VouchGuard AI is a responsive Next.js application for **Commons Made leaderboard integrity analysis**.

The product uses the data that actually changes Commons scores: the creator’s **incoming vouch/slash ledger**. It reconstructs positive-support and negative-attack networks separately, computes deterministic graph statistics, and then uses **Grok 4.5** only to explain the measured evidence.

The current methodology is **`vg-commons-2026.08.3`**.

---

## The problem

A single “this creator looks organic” score is not enough for Commons.

An account can simultaneously have:

- legitimate, diverse incoming vouches;
- a leaderboard position that is highly dependent on incoming support;
- hundreds of incoming slashes;
- a possible coordinated slasher cluster;
- or coordinated positive support and coordinated attacks at the same time.

VouchGuard therefore does **not** collapse everything into one authenticity number.

The v3 model answers two independent questions:

### 1. Support Integrity

> Does the incoming **VOUCH** network look diverse and natural, or reciprocal / concentrated / coordinated?

### 2. Slash Attack Risk

> Has the rank been materially hit by **SLASH** actions, and does the sampled slasher network show timing or graph patterns consistent with coordination?

Heavy slashing is **not automatically called a bot attack**. VouchGuard explicitly separates **attack pressure** from **attack coordination**.

---

## Main output

A creator report exposes:

- **Support Integrity** — positive-support quality, 0–100, higher is better.
- **Slash Attack Risk** — combined slash pressure + attack coordination, 0–100, higher is riskier.
- **Support Coordination Risk** — reciprocity, supporter components, timing, concentration and thin-account signals.
- **Attack Pressure** — how materially slashes affected the account regardless of who controlled the slashers.
- **Attack Coordination Risk** — timing + sampled slasher-network relationships + thin-account/context signals.
- **Bot/Sybil Network Risk** — conservative graph-only suspicion; never proof of ownership or automation.
- **Rank Distortion Risk** — estimated risk that observed leaderboard position was strongly driven/distorted by coordinated support or heavy slashing.
- **Rank Reliability** — `100 − Rank Distortion Risk`.

The report also shows the complete incoming Commons ledger, top vouchers, top slashers, graph coverage, timing bursts, point concentration and Grok’s separate support/attack interpretation.

---

## Verdicts

VouchGuard currently uses these deterministic verdict states:

```text
LIKELY_ORGANIC
SUPPORT_REVIEW
SUPPORT_COORDINATION_RISK
HEAVY_SLASH_PRESSURE
SLASH_ATTACK_RISK
CONTESTED_MANIPULATION
INSUFFICIENT_DATA
```

### `LIKELY_ORGANIC`

Observed positive support looks healthy, graph coverage is adequate, and there is no major slash-attack signal.

### `SUPPORT_REVIEW`

Used when positive support cannot safely receive a strong organic verdict — for example, a rank is highly dependent on incoming vouches but only a small part of the voucher graph has been inspected.

### `SUPPORT_COORDINATION_RISK`

The positive VOUCH network itself contains strong coordination indicators.

### `HEAVY_SLASH_PRESSURE`

The rank was heavily affected by negative actions, but available Commons graph data is not sufficient to claim that the attackers are coordinated.

### `SLASH_ATTACK_RISK`

Heavy slash pressure is accompanied by stronger timing / connected-network / thin-account evidence.

### `CONTESTED_MANIPULATION`

Both the positive supporter network and the negative slasher network contain strong coordination signals.

### `INSUFFICIENT_DATA`

Too little Commons ledger evidence exists for a meaningful result.

---

# Architecture

```mermaid
flowchart TD
    U[User enters @creator] --> API[POST /api/scan]
    API --> CACHE{Fresh Vercel Blob audit?}
    CACHE -->|yes| RESULT[Return audit]
    CACHE -->|no| TARGET[Commons target ledger]

    TARGET --> VOUCHES[All incoming vouches]
    TARGET --> SLASHES[All incoming slashes]

    VOUCHES --> VSAMPLE[Sample up to 30 voucher ledgers]
    SLASHES --> SSAMPLE[Sample up to 30 slasher ledgers]

    VSAMPLE --> VGRAPH[Voucher graph]
    SSAMPLE --> SGRAPH[Slasher graph]

    VGRAPH --> ENGINE[Deterministic rank-risk engine]
    SGRAPH --> ENGINE
    TARGET --> ENGINE

    ENGINE --> SCORES[Support / attack / distortion metrics]
    SCORES --> GROK[Grok 4.5 explanation]
    GROK --> STORE[Vercel Blob]
    GROK --> RESULT
    RESULT --> UI[Responsive creator audit UI]
```

## System overview

```mermaid
graph LR
  subgraph Browser[Desktop / Mobile]
    HOME[Creator search]
    REPORT[Rank audit]
    PUBLIC[Public /u/:handle]
  end

  subgraph Vercel[Next.js / Vercel]
    SCAN[/api/scan]
    HEALTH[/api/health]
    AUDIT[Audit orchestrator]
    GRAPH[Graph engine]
    VERDICT[Verdict engine]
    CACHE[Vercel Blob]
  end

  subgraph Commons[Commons Made]
    LEDGER[/targets/:handle/ledger]
  end

  subgraph xAI[xAI]
    GROK[Grok 4.5]
  end

  HOME --> SCAN
  SCAN --> CACHE
  SCAN --> AUDIT
  AUDIT --> LEDGER
  LEDGER --> GRAPH
  GRAPH --> VERDICT
  VERDICT --> GROK
  GROK --> CACHE
  CACHE --> PUBLIC
  GROK --> REPORT
  HEALTH --> Browser
```

---

# Commons data source

The core endpoint is:

```text
GET https://api.commonsmade.com/game/events/genesis/targets/{handle}/ledger
```

VouchGuard normalizes the response into:

```ts
interface CommonsLedgerEntry {
  kind: "vouch" | "slash";
  authorHandle: string;
  points: number;
  tweetUrl: string | null;
  createdAt: string | null;
}
```

The target ledger gives all incoming actions that affected the creator. To reconstruct second-hop relationships, VouchGuard loads ledgers of selected vouchers and slashers.

There is no assumption that an incoming slash means the target did something wrong, or that a large slash wave automatically means bots.

---

# Independent second-hop sampling

This is critical to v3.

Older versions used one shared second-hop quota. A heavily-vouched creator could consume every graph slot, leaving **zero slasher ledgers inspected** even after hundreds of incoming slashes.

v3 uses separate budgets:

```text
up to 30 voucher ledgers
+
up to 30 slasher ledgers
```

Each side uses a mixed strategy:

```text
~60% highest-impact actors
+
remaining slots from most-recent actors
```

This lets the graph see both:

- accounts that moved the score most;
- accounts involved in recent timing bursts.

If the same actor appears on both sides, the union prevents duplicate fetches.

---

# Support Integrity

The positive-support engine considers:

- number of unique vouchers;
- total vouch points;
- target ↔ voucher reciprocity;
- positive links among voucher accounts;
- largest connected voucher component;
- observed edges per sampled voucher;
- top-1 / top-5 point concentration;
- HHI concentration;
- 15-minute / 60-minute vouch bursts;
- thin, low-power sampled vouchers;
- voucher graph coverage.

A large connected component can matter even when global graph density appears small, because only a subset of the full supporter graph is sampled.

---

# Slash Attack Risk

The negative side is analyzed independently.

## Attack Pressure

Measures how strongly slashes changed the creator’s observed rank using:

- unique slasher count;
- total slash points;
- negative action share;
- slash impact relative to estimated pre-ledger/base contribution.

High pressure means **the rank was heavily affected**. It does not establish bot ownership.

## Attack Coordination Risk

Measures coordination evidence using:

- 5-minute slash bursts;
- 15-minute slash bursts;
- 60-minute slash bursts;
- positive links among sampled slasher accounts;
- largest connected slasher component;
- point concentration;
- thin-account context;
- slasher graph coverage.

If pressure is high but graph coverage is low, VouchGuard prefers `HEAVY_SLASH_PRESSURE` rather than pretending coordination was proven or disproven.

---

# Rank dependence and distortion

VouchGuard derives context from the observed ledger:

```text
Net Ledger Impact
  = Vouch Points − Slash Points

Estimated Pre-Ledger/Base Contribution
  = Current Commons Total − Net Ledger Impact
```

This is an **estimate from observed ledger arithmetic**, not an official Commons base-score field.

For positive totals:

```text
Estimated Net Support Share
  = max(Net Ledger Impact, 0) / Current Total
```

A 90% support share does **not** mean manipulation. It means the current positive total depends heavily on incoming support, so stronger graph coverage is required before calling that rank organically supported.

`Rank Distortion Risk` combines:

- suspicious positive-support influence weighted by support dependence;
- negative slash pressure weighted by how dominant negative actions are.

---

# Grok 4.5

Grok is **not the scoring engine**.

The TypeScript application computes all numeric metrics and the controlling verdict first. Grok then receives:

- target rank / total points;
- deterministic metrics;
- network statistics;
- top sampled voucher rows;
- top sampled slasher rows;
- evidence objects.

Grok returns:

```text
headline
explanation
supportAssessment
attackAssessment
organicSignals[]
supportRiskSignals[]
attackRiskSignals[]
caveats[]
confidence
```

The code overwrites any Grok verdict with the deterministic application verdict, so the LLM cannot silently change the classification.

The prompt explicitly instructs Grok that:

- heavy slashing is not proof of bots;
- low slasher coverage means coordination is unresolved, not absent;
- Bot/Sybil Network Risk is probabilistic;
- reciprocity alone is not abuse;
- high support dependence can simply mean popularity;
- external facts not present in the Commons graph must not be invented.

---

# Project structure

```text
app/
  api/
    health/route.ts
    scan/route.ts
  methodology/page.tsx
  u/[handle]/page.tsx
  globals.css
  integrity.css
  layout.tsx
  page.tsx

components/
  Scanner.tsx
  ResultPanel.tsx

lib/
  audit.ts
  commons.ts
  grok-integrity.ts
  integrity.ts
  integrity-types.ts
  verdict.ts
  rate-limit.ts
  storage.ts
  utils.ts

sdk/
  index.ts

e2e/
  ui.spec.ts

tests/
  integrity.test.ts
  ...

.github/workflows/
  ci.yml
  live-production.yml
  deploy-vercel.yml
```

---

# Environment variables

The core audit does **not require an X API Bearer Token**.

```env
# Required for Grok explanations in production.
XAI_API_KEY=

# Optional model override.
XAI_MODEL=grok-4.5-latest

# Created automatically when Vercel Blob is connected.
BLOB_READ_WRITE_TOKEN=

# Default 6 hour audit cache.
SCAN_CACHE_TTL_SECONDS=21600

# Per-instance rate limiter.
SCAN_RATE_LIMIT_PER_MINUTE=12

# Must be false in production.
VOUCHGUARD_DEMO_MODE=false

# Canonical deployment URL.
NEXT_PUBLIC_APP_URL=https://vouchguard-ai.vercel.app
```

---

# Local development

Requirements:

```text
Node.js 22.x
npm
```

Install and run:

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open:

```text
http://localhost:3000
```

## Demo mode

No Commons or xAI calls are required for synthetic UI testing:

```bash
VOUCHGUARD_DEMO_MODE=true npm run dev
```

Useful demo handles:

```text
alice_builder
bot_swarm_01
attacked_victim
```

`attacked_victim` is specifically a regression scenario for:

> clean/independent positive support + a mass slash wave

It must never receive a blanket `LIKELY_ORGANIC` verdict.

---

# API

## `POST /api/scan`

```json
{
  "handle": "cryptokaai",
  "refresh": true
}
```

Representative response shape:

```json
{
  "handle": "cryptokaai",
  "methodologyVersion": "vg-commons-2026.08.3",
  "commons": {
    "rank": 94238,
    "totalPoints": -391033
  },
  "metrics": {
    "supportIntegrity": 74,
    "supportCoordinationRisk": 34,
    "slashAttackRisk": 81,
    "attackPressure": 92,
    "attackCoordinationRisk": 66,
    "botSybilNetworkRisk": 50,
    "rankDistortionRisk": 74,
    "rankReliability": 26
  },
  "stats": {
    "uniqueVouchers": 238,
    "uniqueSlashers": 175,
    "vouchPoints": 2748314,
    "slashPoints": 3179069,
    "vouchGraphCoverage": 0.126,
    "slashGraphCoverage": 0.171
  },
  "report": {
    "verdict": "HEAVY_SLASH_PRESSURE"
  }
}
```

Numbers are live data and can change as Commons changes.

## `GET /api/health`

Expected production shape:

```json
{
  "ok": true,
  "mode": "live",
  "model": "grok-4.5-latest",
  "xaiConfigured": true,
  "primaryData": "commons-ledger",
  "xApiRequired": false,
  "storage": "vercel-blob",
  "methodologyVersion": "vg-commons-2026.08.3"
}
```

---

# TypeScript SDK

```ts
import { VouchGuardClient } from "./sdk/index";

const guard = new VouchGuardClient({
  baseUrl: "https://vouchguard-ai.vercel.app",
});

const audit = await guard.auditCreator("cryptokaai", { refresh: true });

console.log(audit.metrics.supportIntegrity);
console.log(audit.metrics.slashAttackRisk);
console.log(audit.metrics.rankReliability);
console.log(audit.report.verdict);
```

---

# Tests

## Static / unit / build

```bash
npm run typecheck
npm test
npm run build
```

The integrity suite includes regressions for:

- independent organic-looking supporter networks;
- reciprocal voucher rings;
- rank-dependence arithmetic;
- slash-adjusted net support;
- organic vouches + mass slashing;
- independent voucher and slasher graph construction.

## Production-server E2E simulation

```bash
npm run test:e2e
```

## Desktop + mobile UI QA

```bash
npx playwright install chromium
npm run test:ui
```

The browser suite checks:

- 1440px desktop report;
- 390px phone report;
- 360px table containment;
- no page-level horizontal overflow;
- support + attack sections;
- attack-victim verdict UX;
- methodology mobile readability.

## Live production validation

Use GitHub Actions → **Live Production Validation**.

It verifies:

- public production URL;
- `/api/health`;
- methodology version;
- live Commons audit;
- all dual-axis metrics;
- voucher/slasher graph statistics;
- Grok support and attack explanations.

---

# Vercel

Production target:

```text
https://vouchguard-ai.vercel.app
```

The project uses standard Next.js server routes and Vercel Blob. No database is required for v1.

Do not expose `XAI_API_KEY` or `BLOB_READ_WRITE_TOKEN` in browser-side environment variables.

---

# Interpretation and safety

VouchGuard is an **integrity / anomaly decision-support system**, not an accusation engine.

It can say:

```text
heavy slash pressure
support coordination risk
slash attack risk
Bot/Sybil network risk
rank distortion risk
```

It should not state as fact:

```text
this person used bots
these accounts share one owner
this creator is a scammer
this slasher is a Sybil
```

Those claims require evidence that Commons ledger graph structure alone does not establish.

The purpose of the product is to make the structure visible so users and the Commons team can investigate the right accounts and clusters.

---

## License

Add the license that matches the intended public distribution model before final public release.
