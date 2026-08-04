# ATLAS_UI_BIBLE.md
### Complete User Experience & Interface System

*Synthesized from the Constitution, Architecture Handbook, Product Bible, Design Bible, Prompt Bible, Editorial Intelligence, and UI Intelligence. Defines Atlas's complete UX: screens, navigation, layout, components, interaction, state, and implementation guidance — grounded in Atlas's actual implemented interface wherever one exists, marked explicitly where a gap remains.*

---

## Table of Contents

**Part I — Foundation**
0. Reading This Document
1. UX Vision

**Part II — Screen & Navigation Architecture**
2. The Application Shell
3. Navigation Structure
4. The Four-Step Core Flow

**Part III — Layout System**
5. Layout Principles
6. Grid & Composition
7. Responsive Behavior (Gap Declaration)

**Part IV — Component Hierarchy**
8. Component Taxonomy
9. Progressive Disclosure System
10. Editorial Components in the Editor

**Part V — Interaction & State System**
11. Interaction Patterns
12. State System
13. Editor Workflow

**Part VI — Dashboard & Product Management**
14. Dashboard Structure
15. Project Lifecycle UI

**Part VII — Implementation Guidelines**
16. Implementation Principles
17. Motion & Feedback
18. Trust Signals in the Interface

**Part VIII — Governance**
19. Relationship to the Other Foundation Documents
20. Future Evolution

---

## 0. Reading This Document

This is a UX and interface system reference, not a visual-style reference — the Design Bible owns color, typography, and visual language; this document owns *structure and behavior*: which screens exist, how a user moves between them, what a component is allowed to do, and what happens when something is loading, empty, or wrong.

---

## 1. UX Vision

Atlas's interface exists to get a user from raw material to a sellable product with the fewest decisions and the least visible machinery possible. Every screen, every component, and every state in this document is answerable to one question: does this help the user finish with something they trust enough to publish.

---

# Part II — Screen & Navigation Architecture

## 2. The Application Shell

Atlas is three top-level screens: **Landing → Auth → App**. The App shell is a sidebar-navigated frame around one real product surface — the Converter — plus three supporting screens (Dashboard, History, Settings). The Converter is not "a feature of the dashboard"; the dashboard is scaffolding around the Converter.

## 3. Navigation Structure

The sidebar carries exactly four destinations — **대시보드 (Dashboard) / 전자책 생성 (Converter) / 내 전자책 (History) / 설정 (Settings)**. Any future sidebar addition should be justified the same way any feature is: does it increase user value, does it simplify rather than clutter.

## 4. The Four-Step Core Flow

```
STEP 1 · 자료 입력  →  STEP 2 · 제목·스타일 선택  →  STEP 3 · 전자책·이미지 생성  →  STEP 4 · 결과 확인
```

Two structural facts matter for every future UI decision:

- **STEP 3 is deliberately one combined screen, not two sequential ones.** Ebook generation progress and image generation progress are shown together, because they are one commercial deliverable, not two unrelated processes.
- **STEP 4 persists STEP 3's image-generation panel rather than replacing it.** A component that shows progress should become the component that shows the result, not hand off to a different one.

A known, named gap: STEP 4 currently forks into three different visual-generation exit paths of differing quality/cost/architecture, presented as if equivalent. Resolving that fork should be the primary goal of any future STEP 4 redesign.

---

# Part III — Layout System

## 5. Layout Principles

- **Preview First** — whatever the user is about to publish is always the largest, most visually dominant element on screen.
- **One Click** — a single meaningful choice should be sufficient input; everything downstream should be computed.
- **Beautiful by Default** — no screen should require the user to make an aesthetic judgment call to get a good result.
- **Brand First** — every screen inside one product session should read as continuous with the others.
- **Premium SaaS, not admin panel.**

## 6. Grid & Composition

Configuration on the left, Preview on the right, Preview always the larger of the two. Any new screen added to the Converter should be evaluated against this same split before inventing a new composition.

## 7. Responsive Behavior (Gap Declaration)

Neither the current implementation nor any Foundation document defines mobile or tablet behavior for the Converter. Whatever responsive system Atlas eventually adopts must preserve the Preview First hierarchy at every viewport size. The actual grid values, breakpoints, and touch-target rules remain undefined and should not be assumed.

---

# Part IV — Component Hierarchy

## 8. Component Taxonomy

**Primary (the user's own output):** the ebook preview, the thumbnail/sales-page result galleries.

**Selection components:** Theme Cards — never text-only buttons; a Brand Pack choice is always shown as a real, previewable card.

**Generation-state components:** the concept/scene cards that carry a generation from planning through completion — the same component across STEP 3 and STEP 4, not two different ones.

**Action components:** a small, consistent button hierarchy — a primary "commit" action, a secondary neutral action, and a destructive/reset action, each visually distinct.

**Disclosure components:** the collapsed-by-default pattern (§9) for anything internal, advanced, or developer-facing.

## 9. Progressive Disclosure System

A single, consistent idiom — collapsed-by-default, expandable on demand — used identically whether the hidden content is an internal analytics dashboard, a Prompt/Scene inspector, or a developer QA tool. **This is the only sanctioned "hide advanced stuff" mechanism in Atlas.**

## 10. Editorial Components in the Editor

Whenever the Editorial Intelligence gap components (Framework/Timeline diagrams, differentiated Tip/Warning/Note/Key-Takeaway blocks, Summary boxes, Checklist blocks, Exercise blocks) are built into the generation pipeline, the default answer for editor UI should be automatic selection with the result shown in Preview — a manual component picker/toolbar should only be added if a real need for manual override is demonstrated.

---

# Part V — Interaction & State System

## 11. Interaction Patterns

**Approval gates are real and singular.** There is exactly one moment the user commits to a costly, real generation step. Any new costly action should route through this same single-gate pattern.

**Regeneration never destroys a prior result.** Every "try again" action appends a new Version rather than overwriting the last one.

**Copy changes and background changes are separable actions.** A user can change wording without paying for a new background image, and can regenerate a background without needing to re-enter copy.

## 12. State System

The most significant genuine UX gap identified in the UI Intelligence research: Atlas does not yet have a formalized empty/loading/error/success/disabled treatment applied consistently across the interface. Proposed system:

- **Empty states** — a specific, warm, one-line reason plus one clear next action, never a bare "no data" message.
- **Loading states** — should reflect the shape of what's actually coming, not a generic spinner unrelated to the content.
- **Error states** — specific and actionable, never generic.
- **Success states** — quiet and confirmatory rather than celebratory.
- **Disabled states** — keep a control visibly present with an explanation, rather than hiding it.

This system is proposed, not yet standardized across every existing screen.

## 13. Editor Workflow

The real, working editor loop for a generated visual asset is: **generate → select a result → apply Atlas's overlay copy → download**, with two lightweight side-branches (copy-only re-overlay, style-modifier-then-regenerate) that both terminate back into the same select-and-download loop.

---

# Part VI — Dashboard & Product Management

## 14. Dashboard Structure

The Dashboard is intentionally thin: a stat summary and a recent-products list, existing to get the user back into either a new or an in-progress Converter session quickly. It should not become a second product surface competing with the Converter for depth or feature count.

## 15. Project Lifecycle UI

A single-slot save/load system exists today — an honest, named limitation. Multi-project management is not currently supported, and any UI work in this area should either clearly communicate the single-slot limitation or be paired with the underlying multi-project storage work the Architecture Handbook already flags as a prerequisite.

---

# Part VII — Implementation Guidelines

## 16. Implementation Principles

Every UI surface in Atlas is implemented as a module that owns a specific region of the interface and re-renders itself on state change — not a framework-component tree. A component's trigger location and its render target do not need to be DOM-adjacent. Internal/advanced data defaults to hidden via the one sanctioned disclosure pattern (§9) — never via a second mechanism.

## 17. Motion & Feedback

Motion in Atlas exists to confirm an interaction happened, never to entertain, and springy/bouncy motion is specifically inappropriate because a user is making real commercial decisions at Atlas's approval gates (§11) — the same reasoning that justifies banning bounce/glow in the Design Bible's Animation Rules.

## 18. Trust Signals in the Interface

Trust in Atlas's UI is built the same way trust in its output is built: through specificity and consistency at every decision point — never a vague "processing," never an unexplained disabled button, never a duplicated confirmation.

---

# Part VIII — Governance

## 19. Relationship to the Other Foundation Documents

- **Constitution** → why the user's product must always outrank Atlas's own chrome.
- **Architecture Handbook** → the actual technical shape this document describes in UX terms.
- **Product Bible** → the business reasoning behind "fewest decisions, highest trust."
- **Design Bible** → visual language; this document never redefines color, type, or theme rules, only how they're arranged and interacted with.
- **Prompt Bible** → why the interface should never surface raw AI reasoning by default.
- **Editorial/UI Intelligence research notes** → the evidence base for §10 and §12's proposed gaps; not binding until formally adopted.

## 20. Future Evolution

The two most consequential open items this document surfaces for future work are: **the STEP 4 three-path visual-generation fork** (§4) and **a formal state-system audit** (§12).

---

*End of ATLAS_UI_BIBLE.md.*
