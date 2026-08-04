# Atlas Architecture Handbook
### Permanent Architectural Reference

*This handbook explains WHY Atlas is structured the way it is. It is not implementation documentation, not API documentation, not onboarding documentation, and not code documentation — those should be derived from this handbook, never the reverse. Concrete module/file references appear only where they ground an architectural principle in something real; they are illustrative anchors, not the content itself, and are expected to age as the codebase evolves while the principles they illustrate remain valid.*

---

## Table of Contents

**Part I — Business & Product Foundation**
0. Reading This Handbook
1. Business Architecture
2. Product Architecture

**Part II — System Architecture**
3. Atlas Layer Architecture
4. Module Architecture
5. Service Boundaries
6. Data Ownership
7. Data Flow

**Part III — AI & Design Architecture**
8. AI Workflow Architecture
9. Design Architecture
10. User Flow Architecture

**Part IV — Engineering Foundations**
11. Component Architecture
12. Architecture Principles
13. Folder Philosophy

**Part V — Growth & Governance**
14. Scalability Strategy
15. Future Expansion Strategy
16. Architectural Decision Records
17. Risks and Technical Debt
18. Architecture Roadmap
19. Foundation Consistency

---

## 0. Reading This Handbook

A durable architecture handbook earns its permanence by explaining **why**, not **what**. Anywhere this document names a specific file or function, treat it as a *current example of a principle*, not the principle itself — the principle should outlive the file.

Two facts recur throughout this handbook because they are the two facts most likely to be re-derived painfully from source code if they are not written down once, clearly, here:

1. **Atlas currently contains two independent, non-interoperating systems for producing sellable images** — a modern, provider-backed generation pipeline and an older template-based renderer. Neither is a layer of the other. Every visual-architecture decision must state which one it concerns (§4, §9, §15).
2. **Atlas's business architecture is currently ahead of its technical architecture in exactly one place — identity and monetization — and behind it in exactly one place — turning strong creative/AI architecture into durable, reusable business assets.** §1 and §17 both return to this asymmetry; it is the single most important thing a reader of this handbook should internalize before proposing new work.

---

# Part I — Business & Product Foundation

## 1. Business Architecture

Atlas is a business whose product happens to be software. Every architectural decision must be traceable to a single governing question: **does this make a user's sale more likely?** This section defines the commercial lifecycle the technical architecture exists to serve.

### 1.1 The Commercial Lifecycle

| Stage | Commercial meaning | What the architecture must guarantee at this stage |
|---|---|---|
| **Visitor** | Has not yet trusted Atlas with anything. | The product's value proposition must be legible before any account exists — architecture should never require signup to *understand* Atlas, only to *use* it. |
| **Trial User** | Trusted Atlas enough to try it; has not yet paid. | Must experience one genuinely complete output (ebook + sellable visuals) before being asked to pay — value must be demonstrated before it is gated. |
| **Subscriber** | Has converted trust into payment. | Architecture must be able to distinguish "paid for more" from "hasn't paid," and enforce that distinction at a trusted boundary (§5) — never client-side alone. |
| **Premium / high-tier User** | Highest commercial relationship; expects the least friction and the highest output ceiling. | Architecture must scale generation limits and future features without special-casing — the same extension points (§15) that serve ordinary growth should serve tier growth. |

The **Product Lifecycle** (idea → foundation → phased implementation → QA → release) and the **Customer Lifecycle** (Visitor → Trial → Subscriber → repeat user → possible churn) are distinct and must not be conflated: the product can mature architecturally while the customer relationship is still immature commercially, and vice versa. Atlas today is architecturally further along than it is commercially — strong generation architecture, no real subscription lifecycle. Closing that gap is a named priority in §17 and §18, not an assumption.

**Subscription Lifecycle** is the one commercial concept with no architectural backing today: no trial-to-paid transition event, no renewal, no downgrade, no cancellation exists as a real state machine. This is named explicitly here so no future roadmap conversation treats it as a minor add-on — it is the load-bearing gap between the business this handbook describes and the business Atlas can currently operate.

### 1.2 User Value Flow

```
Raw material (a user's time and domain knowledge)
      ▼
Atlas performs cognitive labor the user could not do quickly or well alone:
structuring, copywriting, positioning, visual direction
      ▼
A sellable digital product (ebook + thumbnail + detail pages + listing copy)
      ▼
A marketplace listing that survives platform review
      ▼
A completed sale — the only outcome this architecture ultimately serves
```

### 1.3 How Technical Architecture Supports (and Currently Fails to Support) This Flow

The **Brand Pack** abstraction (§4.2) is the clearest example of business architecture correctly expressed as software: selecting a Brand Pack is a *pricing and trust-positioning decision* that fans out consistently across copy, visuals, and campaign concept from one selection. This is the pattern future business concepts (pricing tiers, audience segments) should follow — one decision point, consistent downstream consequences — rather than scattering business logic as conditionals across the codebase.

The marketplace compliance layer (§4.4) exists specifically to protect the *business* outcome (a listing that survives review), not just a *content* quality bar — architecture reasoning one layer past correctness into commercial consequence.

Conversely, the entire Subscriber/Billing/Identity stack (§1.1) is business-critical and has no real technical backing (§5, §17). This is the highest-leverage gap between business architecture and technical architecture in the system, and resolving it is a Scale-stage concern (§18), not a detail to be solved incidentally by unrelated feature work.

---

## 2. Product Architecture

### 2.1 Product Shape

From a user's perspective, Atlas is one continuous product organized as: **Landing → Auth → App shell (Dashboard / Converter / History / Settings)**. The Converter *is* the product; the rest is scaffolding around it. It is implemented as a single client-side state machine — one document, state expressed as visible/hidden regions, one shared application state object as the single source of truth. This is a deliberate architectural choice (§11, §14), not an accident, and should be evaluated against §14's Scalability guidance before ever being changed reflexively.

### 2.2 The Product-Level Journey

```
자료 입력 (Material Input)
   → 자료 분석 (Analysis)
      → 제목 선택 (Title Selection)
         → 스타일 선택 / 기획 승인 (Style Selection / Plan Approval)
            → 전자책 + 판매 이미지 생성 (Generation)
               → 결과 확인 및 다운로드 (Results & Delivery)
```

This journey is presented to users as **exactly four steps**. That four-step framing is the canonical product-level description of the journey and the one all future product documents should use — any internal implementation state machine with more granularity is a technical detail, not a product concept, and must never leak into product-facing documentation or terminology.

### 2.3 Two Categories of Deliverable

Atlas produces **written content** (structured, incremental, relatively low per-call cost) and **visual content** (which may be real-generation-backed or template-rendered at zero AI cost — see §4.3). These have different quality bars, cost models, and owning subsystems, and should always be discussed as the distinct categories they are.

---

# Part II — System Architecture

## 3. Atlas Layer Architecture

Atlas has a consistent logical layering even though it is not organized into physical layer folders (§13). Naming these layers is what gives every future module a clear test: *which layer am I, and does my dependency direction respect it?*

| Layer | Responsibility | Depends on |
|---|---|---|
| **Presentation** | Renders state into the interface; wires user intent into events. Never decides business logic itself. | Application |
| **Application** | Orchestrates screen transitions and "what happens when the user acts." Owns the product-level state machine (§2.2). | Business, AI, Generation |
| **Business** | Encodes product/positioning decisions independent of any specific AI call — pricing psychology, marketing voice, campaign concept. | (largely self-contained) |
| **AI (Orchestration)** | Decides *what to ask a model for* and *in what sequence* — independent of *how* the request is transmitted. | Business, Integration |
| **Generation** | Turns an approved plan into an actual artifact (prompt, image, composited output). | Integration |
| **Storage** | Persists or caches state across time. | (leaf layer) |
| **Integration** | The only layer permitted to hold credentials or speak to third-party APIs. | Infrastructure, external services |
| **Infrastructure** | Runtime, configuration, rate limiting, usage accounting. | (leaf layer) |

**The communication rule:** dependencies flow strictly downward. Presentation never bypasses Application to reach Business or Generation directly; Integration never reaches back up to touch the interface; Storage never contains business logic. A layer that finds itself needing to violate this rule is a signal that a responsibility is misplaced, not that the rule should bend.

**Where Atlas currently blurs this boundary:** the image-generation UI controller today combines Presentation and Application responsibility in one place — it both renders and directly decides orchestration. This has been tolerable at current scale because the module is cohesive, but it is the layering seam most likely to cause pain if the interface is ever rebuilt on different presentation technology, and should be split (a pure controller at the Application layer, a pure renderer at the Presentation layer) whenever that rebuild happens — not treated as urgent before then.

---

## 4. Module Architecture

*Reading note: the tables below anchor each architectural responsibility to its current implementation as concrete grounding, consistent with this project's standing "never guess" discipline. Treat the responsibility column as permanent and the file column as a snapshot.*

### 4.1 Product Shell

| Responsibility | Current anchor | Maturity |
|---|---|---|
| Authentication | Client-side mock (`application.js`) | **Not real.** No server-side verification, no session model. Hard blocker for multi-user launch (§1.3, §17). |
| Workspace / progress tracking | `atlasSetWorkspaceStage`, product-level 4-step banner | Real and stable. |
| Project persistence | Single-slot `localStorage` draft | Real but single-project; no draft history. |
| Billing / plan enforcement | Client-side trial counters against configured limits | **Not real** monetization — limit *values* exist, no payment event backs them. |

### 4.2 Content Strategy & Text Generation

| Module role | Responsibility |
|---|---|
| Incremental Generation Engine | Produces the ebook as a sequence of small, resumable calls (outline → chapters → appendices → merge) rather than one large call, with defensive parsing of imperfect structured model output. |
| Progress Persistence | Ensures generation state survives interruption, so partial work is never silently lost. |
| Text Integration Gateway | The single trusted process that holds real model credentials and proxies text-generation requests — client code never calls a text-generation API directly (§5). |
| Planning Orchestrator ("AI Planner") | The single approval gate between "a recommendation exists" and "real, paid generation begins." Computes every downstream strategy artifact from one style selection, before any expensive work runs. |
| Brand Strategy | Produces positioning strategy per Brand Pack — pricing psychology and trust-building angle, not a color theme. |
| Marketing Strategy | Produces the actual words (headline/subheadline/CTA/FAQ) consumed by both text and visual output. |
| Reasoning / Explanation | Produces the "why this recommendation" narrative shown to the user on demand, never by default. |
| Creative Quality Feedback | A diagnostic tool, not a generation engine — evaluates real, user-supplied generated images against structural rules. |

### 4.3 Visual Generation — The Two-System Duality

This is the most consequential architectural fact in the system.

**System A — the provider-backed generation pipeline** (the system all new real-image work should extend):

```
Creative Direction (free, local)
   → Scene → Prompt Composition (whitelisted, provider-neutral)
      → Generation Engine → Provider (real backend | mock | manual import)
         → Overlay (Atlas-controlled copy only)
            → Export
```

| Module role | Responsibility |
|---|---|
| Creative Direction | Produces content *strategy* for each visual asset (angle, composition, product role) before any paid call — local, free, validated for diversity, auto-revised on failure. |
| Generation Contract & Provider Registry | Defines a stable interface any image-generation backend must satisfy, and a registry of interchangeable implementations behind it. |
| Providers | Interchangeable backends behind the Contract — a real paid backend, a zero-cost mock for tests/rehearsal, and a manual-import path that treats a user-supplied file as a generation result. |
| Prompt Composition | Converts a Scene into a backend-facing prompt through a **fixed, whitelisted** field set. |
| Generation Orchestration | Ties a Scene and a Provider together into a trackable job; owns concurrency-limited batching. |
| Generation State | Owns in-progress and completed results as **append-only** collections — the structural basis for non-destructive regeneration (§6). |
| Overlay | The single place Atlas-controlled, whitelisted copy is composited onto a generated background. |
| Production Controller | Wires every user-facing generation action and decides what remains hidden by default. |

**System B — the legacy template-rendering system** (zero AI cost, structurally independent of System A):

| Module role | Responsibility |
|---|---|
| Thumbnail Template Renderer | Canvas/template-based thumbnail compositor with its own internal scoring logic. |
| Detail Page Template Renderer | Same pattern for the multi-page detail page. |
| Legacy Themed Renderer | An even older, multi-theme template path for the detail page. |

**Why this matters architecturally:** a feature request phrased as "improve the thumbnail generator" is ambiguous until the requester states which system they mean. **Every future visual-generation decision must name which system it concerns.** Whether System B is formally deprecated, merged, or permanently productized as a distinct "free/template mode" is an open decision (§16, §17).

### 4.4 Marketplace / Commercial Output

| Module role | Responsibility |
|---|---|
| Listing Generator | Derives marketplace-ready commercial copy (title, description, keywords, FAQ, delivery/buyer notices) purely from the completed product. |
| Compliance Scanner | Flags commercially risky claims as a heuristic safeguard, not a certified guarantee (§17.5). |

### 4.5 Named Responsibilities With No Standing Module

**Hero generation**, a distinct Detail Page module, a distinct Prompt module, a unified Template module, an **Asset Library**, and a genuine **Export module** are not standalone architectural units today. This is a named gap, not an oversight — see §15.2 and §17.1.

---

## 5. Service Boundaries

Nine boundaries exist or will exist around Atlas.

| Boundary | Today | Why separation must be preserved |
|---|---|---|
| **Client** | Static interface, zero secrets, zero trusted decisions. | Anything shippable to an untrusted environment must never need to hold a secret to function correctly. |
| **Gateway** | The one trusted process that reads real credentials and proxies every paid call. | This is what makes "no credential ever reaches the client" enforceable at all. |
| **Provider** | A client-side concept: *which* backend to call, never *how* to authenticate to it. | Keeps generation-backend choice a presentation-layer decision. |
| **Third-party APIs** | Always reached from the Gateway only. | Isolates the blast radius of any external outage, rate limit, or policy change. |
| **Browser Storage** | Device-local, unsynced, lost on device change. | Correctly scoped for a single-device product today. |
| **Server Storage** | Effectively none persistent. | A real, current gap (§17.4). |
| **Future Database** | Does not exist. | Must be introduced behind the Gateway boundary. |
| **Future Authentication** | Does not exist for real. | Must be introduced as Gateway-adjacent. |
| **Future Billing** | Does not exist for real. | Payment integration is exactly the class of secret-bearing, trust-sensitive logic the Gateway boundary exists to contain. |

**The one question every future boundary decision must answer:** *does this let the client hold a secret, or make an authorization decision it should not be trusted to make?*

---

## 6. Data Ownership

| State | Owner (sole writer) | Consumers | Rule that prevents conflict |
|---|---|---|---|
| Analysis output | The analysis stage alone | Planning Orchestrator | Never patched in place. |
| Approved strategy artifacts | **The Planning Orchestrator's approval action — a single, deliberate write point** | Text generation, visual generation, listing generation | Any future module needing different/updated copy must go through approval again. |
| The completed product | The Incremental Generation Engine | Rendering, quality scoring, listing generation | Consumers treat it as immutable-until-regenerated. |
| Visual generation state | A dedicated state module's sanctioned entry points only | Rendering | Direct mutation from any other module is an architectural defect. |
| Persisted project draft | A single serialization function | Load-on-start, restore flows | Any new persisted field is added at that single serialization point. |

**Standing rule for future developers:** before adding new shared state, name its one legitimate writer explicitly, in writing, at the point of first write.

---

## 7. Data Flow

```
User input
   ▼
Analysis
   ▼
Title candidates → locked title
   ▼
Planning Orchestrator (reads analysis + style catalog)
   │
   ├──▶ Approved strategy artifacts
   │         │
   │         ├──▶ Incremental Generation Engine ──▶ completed product
   │         │                                            │
   │         │                                            ▼
   │         │                              Listing Generator ──▶ commercial copy
   │         │
   │         └──▶ Creative Direction ──▶ Scene ──▶ Prompt Composition ──▶
   │                    Generation Orchestration ──▶ Provider ──▶ raw image
   │                                                        │
   │                                                        ▼
   │                                          Overlay (+ marketing copy)
   │                                                        │
   │                                                        ▼
   │                                    Append-only generation results
   │
   ▼
Persisted project draft (product + strategy artifacts persisted;
generated visual assets intentionally NOT persisted — session-only)
```

Two properties here are load-bearing: **Marketing strategy is the only seam between text-generation and visual-generation** (any future asset type should route through this same seam), and **visual generation state is deliberately excluded from persistence today** (a real limitation, not an oversight — resolving it properly is a prerequisite for the Asset Library).

---

# Part III — AI & Design Architecture

## 8. AI Workflow Architecture

### 8.1 The Complete Workflow

```
Material
   ↓  user-provided
Analysis
   ↓  extract topic, audience, differentiation
Title Intelligence
   ↓  candidate titles, scored
Planner
   ↓  the single approval gate
Brand Strategy
   ↓  positioning and pricing psychology
Marketing Strategy
   ↓  the actual words
Creative Direction
   ↓  what each visual should depict, and why it will sell
Prompt Composition
   ↓  whitelisted, backend-facing translation
Image Provider
   ↓  real generation (or a zero-cost substitute for testing/rehearsal)
Overlay
   ↓  Atlas-controlled copy, composited afterward
Export
   ↓  final, deliverable formats
```

### 8.2 Why Each Separation Exists

- **Material → Analysis** are separated so "what the user gave us" and "what we understood" remain independently correctable.
- **Analysis → Title Intelligence** are separated because title quality is its own bar, independent of whether the underlying analysis was correct.
- **Title Intelligence → Planner**: the Planner exists to be the one deliberate moment a human reviews and approves before expensive work begins.
- **Brand Strategy and Marketing Strategy are separated from each other** because they answer different questions for different disciplines.
- **Marketing Strategy → Creative Direction**: words and visual content strategy are decoupled because copy can be iterated far more cheaply than images.
- **Creative Direction → Prompt Composition is the most safety-critical separation in the workflow.** This guarantees internal-only reasoning can never leak into a request sent to a third party, structurally rather than by discipline.
- **Prompt Composition → Provider** is mediated by the Provider abstraction specifically so the rest of the workflow never needs to know which concrete backend produced an asset.
- **Provider → Overlay** is the second most important separation in the system: generated backgrounds never contain user-facing text, because generative text rendering is unreliable. All copy is added afterward, by Atlas.
- **Overlay → Export** are separated because destinations and formats are a distribution concern, not a generation concern.

### 8.3 Cost Model as an Architectural Concern

Every stage above is either **free and local** or **real and paid**, and the workflow is deliberately ordered so that **every free stage a user might want to redo comes before the paid stage it feeds.**

### 8.4 Generation Pipeline Shape

Every generation path in Atlas follows the same shape: **plan for free → make exactly one real call → produce a structured, user-visible result → never silently substitute a different content type on failure.**

### 8.5 Prompt Lifecycle and Versioning

Prompts are composed fresh from a Scene at generation time; there is currently no versioning of the *composition rules themselves*. This is a named, permanent-document-worthy gap.

---

## 9. Design Architecture

### 9.1 Two Different Kinds of Design Decision

- **Content/composition strategy** — owned by Creative Direction (§4.3, §8).
- **Visual language** — owned by the Design Bible.

### 9.2 Relationships Between Visual Modules

Creative Direction (content strategy) feeds both System A's real generation and, indirectly, System B's template selection — but the two systems do not currently share a visual-language source. "Thumbnail," "Hero," and "Detail Page" are role labels applied to entries in the same underlying scene/page sequence, not separate engines. The Overlay stage is the one genuinely unified piece of visual architecture.

### 9.3 The Open Problem the Design Bible Must Resolve

There is no single design-token source that both visual systems draw from today. This is named precisely here so the Design Bible does not have to rediscover it from code archaeology.

---

## 10. User Flow Architecture

```
Landing → Auth → App shell
                     │
                     ▼
              STEP 1 — Material Input
              (file | topic | URL)
                     │
        sufficient? ─┴─ insufficient?
              │              │
              ▼              ▼
        Title candidates   Adaptive follow-up
              │              │
              └──────┬───────┘
                     ▼
              STEP 2 — Title & Style
              select title → select style → approve
                     │
                     ▼
              STEP 3 — Generation
              (product + visuals, one combined view)
                     │
                     ▼
              STEP 4 — Results & Delivery
              (product delivery / visual results / commercial copy)
                     │
        ┌────────────┼────────────┐
        ▼            ▼             ▼
   System A path  System A path  System B path(s)
   (real, primary)                (template alternates)
```

**Major decision points:** input method is a branch, not a state; the adaptive follow-up trigger is a system decision, not a user one; style selection is the single highest-leverage decision point in the entire flow; the STEP 4 fork into multiple visual systems is a real, current UX inconsistency, named for the Product and Design Bibles to resolve.

---

# Part IV — Engineering Foundations

## 11. Component Architecture

Atlas is not built on a component framework — it is a set of modules attached to a shared global namespace, communicating through one shared application-state object and interface-element lookups. A "component" in Atlas means **a module that owns a render function and a specific region of the interface**, not a framework component. This pattern has proven itself by surviving a real structural relocation (a major generation surface was moved to a different part of the product flow without any change to its own rendering module).

**Established cross-cutting conventions:** progressive disclosure (collapsed-by-default, expandable) is the one established idiom for anything internal or advanced. Any AI output that will reach a rendered image or a third-party request must pass through an explicit whitelist before it does.

---

## 12. Architecture Principles

1. **Single Responsibility.** Positioning, wording, and visual concept are three separate responsibilities in three separate modules.
2. **Composition over Duplication.** One Overlay stage and one Prompt Composition stage serve every visual asset type Atlas produces.
3. **Explicit Ownership.** Every important piece of shared state has one declared writer.
4. **Loose Coupling.** The Provider abstraction means the generation orchestration layer never depends on a specific backend by name.
5. **High Cohesion.** Everything related to "turn an approved plan into finished content" for a given content type lives in one place.
6. **Provider Abstraction.** The Contract/Registry/Provider pattern is the reference template for *any* future third-party capability.
7. **Replaceability.** The coexistence of two independent visual systems proves the architecture *can* support full replaceability of a generation approach.
8. **Observability.** The principle Atlas currently applies least well — visibility into failures exists only informally.
9. **Defensive Programming.** Structured model output is never trusted at face value.
10. **Backward Compatibility.** State-loading code defensively fills in fields that did not exist when older data was saved.

---

## 13. Folder Philosophy

Atlas's current source organization is flat and file-per-responsibility rather than nested by domain. Once a flat structure stops being scannable, reorganize **by product capability, not by technical layer** — grouping the provider-backed generation pipeline together, distinctly from the legacy template system.

---

# Part V — Growth & Governance

## 14. Scalability Strategy

**What already scales:** the Provider abstraction, the incremental generation model, the Brand Pack abstraction.

**What will not scale without deliberate redesign, in order of urgency:** a single, flat, global application-state object; device-local storage with no real identity layer; two independent visual-generation systems.

---

## 15. Future Expansion Strategy

### 15.1 The Integration Rule for Any New Module

Before building anything new: check whether an existing module's responsibility already covers or is adjacent to the need.

### 15.2 Future Engines: Two Categories, Not One List

**New generation engines** (a video engine, or the generative parts of an advertisement engine) should be built the way System A's image pipeline was. **New distribution surfaces** (a landing-page engine, an SNS-content engine, an email engine) are **not** new generation pipelines — they are new *consumers* of data Atlas already produces.

### 15.3 The One Prerequisite Almost Everything Else Depends On

Nearly every future engine depends on a real **Asset Library**, so that generated content can be referenced and reused across multiple downstream surfaces.

---

## 16. Architectural Decision Records

**Why this practice exists:** several decisions in this codebase (why a Gateway boundary exists, why Mock is never auto-substituted, why an old visual system was never removed) have had to be reconstructed from evidence rather than a written record. **When an ADR should be created:** when a decision had a real, considered alternative that was rejected; will look arbitrary without context; is expensive to reverse; or establishes a pattern other work is expected to follow.

Typical future ADR topics: which visual-generation system is authoritative going forward; how a second real generation backend would be evaluated; how prompt-composition versioning is introduced; at what point the global state object is restructured; how the Asset Library is built; how real identity and billing are introduced.

---

## 17. Risks and Technical Debt

### 17.1 Current Technical Debt

| Item | Priority | Mitigation direction |
|---|---|---|
| No Asset Library; generated visual assets are not durably persisted | **P0** | Prerequisite investment before further future-engine work (§15.3). |
| No real identity or monetization layer | **P0** | Scale-stage migration (§18), introduced behind the Gateway boundary (§5). |
| Usage/rate-limit state does not survive a process restart | **P0** | Move accounting into durable server storage. |
| Two-system visual duality unresolved | **P1** | Requires an explicit product/architecture decision (§16). |
| No prompt-composition versioning | **P1** | Minimal structured logging of composed output per generation as a first step. |
| Weak observability | **P1** | Introduce structured, queryable signal for generation failures. |
| No shared export abstraction | **P2** | Design as part of building the Asset Library (§15.3). |

### 17.2 Intentional Technical Debt

Flat source organization; legacy visual system kept alongside the new one; single-project persistence — each accepted deliberately, each with a named trigger to revisit.

### 17.3 Future Risks

A flat global state object will not remain tractable as concurrent in-progress work grows. Absent prompt-composition versioning, future optimization work will lack historical data.

### 17.4 Migration Risks

Replacing the identity layer will touch a wide surface of the codebase by nature. Introducing real durable storage will require reconciling today's storage split.

### 17.5 Business Risks

The commercial-compliance safeguard is a heuristic, not a certified guarantee. Real cost control depends entirely on accounting that does not currently survive a restart.

### 17.6 Operational Risks

No monitoring or alerting exists at any level today.

---

## 18. Architecture Roadmap

```
Foundation → Architecture → Design → Product → Prompt → QA
   → Implementation → Optimization → Scale → Enterprise
```

**Foundation** *(current stage)* — the permanent governing documents are authored and approved. **Architecture** — the decisions this handbook leaves open are resolved through the ADR practice. **Design** — the Design Bible resolves the visual-token sourcing problem. **Product** — the Product Bible translates business architecture into concrete product decisions. **Prompt** — the Prompt Bible defines prompt-composition versioning. **QA** — the QA Bible formalizes testing discipline. **Implementation** — the debt named in §17.1 is addressed in priority order. **Optimization** — cost and quality tuning becomes evidence-based. **Scale** — identity, storage, and billing are replaced with real infrastructure. **Enterprise** — multi-tenant and team capability.

**The governing rule across every stage:** each stage's implementation work is bounded by the decisions made in the stages before it.

---

## 19. Foundation Consistency

This handbook establishes the architectural vocabulary for Atlas. Every Foundation document written after it must use these terms consistently, and extend this handbook rather than redefine it.

**Canonical vocabulary:**

| Term | Meaning |
|---|---|
| **System A / System B** | The provider-backed generation pipeline vs. the legacy template-rendering system. |
| **Provider** | An interchangeable backend implementation behind a stable Contract. |
| **Gateway** | The single trusted process boundary where credentials live. |
| **Scene** | The structured, pre-prompt representation of a planned visual asset. |
| **Overlay** | Specifically the Atlas-controlled compositing of whitelisted copy onto a generated background. |
| **Brand Pack / Style** | A business-positioning selection with fanned-out consequences across strategy, copy, and visuals. |
| **Layer** | The eight-layer model defined in §3. |
| **Foundation document** | One of the six permanent governing documents named in the Roadmap (§18). |

---

*End of Atlas Architecture Handbook.*
