# Atlas Design Bible
### Elevated from design.md v1 — Permanent Visual & Commercial Design Reference

*This is an evolution of the original Atlas Design Bible v1, not a replacement. Every rule, theme, constraint, and requirement originally defined remains in force below, unchanged in substance. What's added is the reasoning — why each rule exists, what business objective it protects, and how it connects to the Constitution, the Architecture Handbook, and the Product Bible.*

---

## Table of Contents

**Part I — Foundation & Scope**
0. Reading This Document
1. Design Vision
2. Relationship to the Other Foundation Documents

**Part II — Design Principles**
3. The Five Design Principles

**Part III — Commercial Design Philosophy**
4. Why Premium Design Builds Trust
5. Visual Philosophy
6. Commercial Design Psychology
7. Information Hierarchy
8. Typography Philosophy
9. Color Philosophy
10. Whitespace Philosophy
11. Composition Philosophy

**Part IV — Brand Identity System**
12. Brand Theme Philosophy
13. Theme Rules — Premium / Study Note / Handwriting
14. Theme Cards

**Part V — Product Surface Philosophy**
15. Thumbnail Philosophy
16. Hero Philosophy
17. Detail Page Philosophy
18. Overlay Philosophy
19. Product Mockup Philosophy

**Part VI — Execution Rules**
20. Layout Rules
21. Animation Rules
22. Preview == Export

**Part VII — Governance**
23. Design Governance
24. Relationship to the Prompt Bible and QA Bible
25. Future Evolution

**Part VIII — Atlas Design Language**
26. Atlas Design Language
27. Design Decision Framework
28. Design Anti-Patterns
29. Design North Star

---

## 0. Reading This Document

A durable design handbook earns its permanence by explaining **why**, not merely **what**. Every color, font, required element, and forbidden element from the original document appears below exactly as it was, still as the source of truth for implementation. What this elevation adds is a *why* beside every *what* — because a rule without a reason is easy to accidentally break under pressure, and a rule with a reason survives contact with a deadline.

Two facts recur throughout this handbook: (1) Atlas's visual language exists for exactly one commercial purpose — to make a buyer trust a product enough to pay for it, in the few seconds they spend deciding; (2) nothing here is implementation documentation, code documentation, or onboarding documentation — it explains why Atlas looks the way it does and must keep looking that way.

---

## 1. Design Vision

Atlas's visual language exists for exactly one commercial purpose: **to make a buyer trust a product enough to pay for it, in the few seconds they spend deciding.**

This is not a general design-quality aspiration. A marketplace buyer judges a listing's thumbnail before reading a single word of its description, and that judgment is made in seconds, against every other listing competing for the same click. Atlas's visual language is the mechanism by which a creator with no design skill produces something that survives that judgment.

The long-term vision is that Atlas's visual output becomes recognizable *as quality* even to a viewer who has never heard of Atlas. Atlas's visual identity is not meant to be famous. It is meant to make *the user's* product look worth paying for, every time, by default, without requiring design judgment from the user.

---

## 2. Relationship to the Other Foundation Documents

- **Constitution** → timeless principles: why Atlas exists, whose success it serves, what never changes.
- **Architecture Handbook** → technical boundaries: how the system is structured to make anything in this document possible.
- **Product Bible** → business philosophy: what Atlas is, who it serves, why premium quality matters commercially.
- **Design Bible (this document)** → visual language and commercial execution: what "premium," "trustworthy," and "calm" actually look like, pixel by pixel.

Two specific inheritances anchor everything below: from the **Constitution** — Atlas's own interface must never visually compete with the user's product; from the **Product Bible** — "premium over volume" and "simplicity over complexity" are business principles, not aesthetic preferences, and every design rule below is a specific, enforceable translation of one or both.

---

## 3. The Five Design Principles

### 3.1 Beautiful by Default

*Rule:* a user who knows nothing about design gets a high-quality result from default settings alone. Complex configuration is never required.

*Why it exists:* Atlas's primary user has no design skill and no design vocabulary — asking them to make aesthetic decisions is asking them to fail at something they were never equipped for.

*What it prevents:* a product whose visual quality is a lottery based on the user's personal taste.

### 3.2 Brand First

*Rule:* every surface — ebook, thumbnail, detail page, and export result — must read as one brand. UI and output must never look like two different designs.

*Why it exists:* a buyer who sees a thumbnail, then a detail page, then the delivered ebook, is silently checking whether this is one coherent, professionally-run product or an assembled patchwork.

*Business objective supported:* one approved strategy must present as one product.

### 3.3 Preview First

*Rule:* Preview outweighs configuration. Preview must always be the single most prominent element on screen.

*Why it exists:* a user should be looking at what they're about to sell, not at a settings panel.

*What it protects:* user confidence — a large, clear preview is what lets a non-designer see that the result is good.

### 3.4 One Click

*Rule:* minimize the number of clicks. Selecting one Brand Pack should be sufficient to apply font, color, buttons, cards, thumbnail, and detail-page treatment automatically.

*Why it exists:* every additional decision Atlas asks a user to make is a place a non-designer can make a choice they're not equipped to evaluate.

*Problem it prevents:* decision fatigue that stalls a first-time user before they ever reach a finished product.

### 3.5 Premium SaaS

*Rule:* the interface must not look like an admin panel. Target UX references: Canva, Gamma, Framer, Apple.

*Why it exists:* an interface that looks like internal tooling silently tells the user "this is a utility, not a premium production studio," undermining trust in the *output* before the user has even reached it.

---

# Part III — Commercial Design Philosophy

## 4. Why Premium Design Builds Trust

A buyer cannot inspect an ebook's actual content before purchasing it — they are buying on trust signals alone. For a digital product sold sight-unseen, design quality is itself a component of the product's perceived value.

## 5. Visual Philosophy

Atlas's visual language should feel **calm rather than noisy** — restrained color use, generous whitespace, clear hierarchy, no more than one or two focal points per surface. A busy, competing-for-attention layout forces the eye to work to find what matters, and every extra second of visual effort is a second closer to the buyer moving to the next listing instead.

This is also why Atlas deliberately avoids generic, obviously-AI-generated imagery as a visual signature: imagery that reads as "obviously AI" undermines exactly the trust a buyer needs to extend before purchasing.

## 6. Commercial Design Psychology

- **Consistency signals competence.** A viewer who sees the same color logic, typography, and spacing language across every surface unconsciously reads that as evidence of a competent team.
- **Restraint signals confidence; visual noise signals compensation.**
- **A clear focal point converts better than a busy one.**
- **The first visual impression sets the price expectation.**

## 7. Information Hierarchy

Every Atlas-produced surface must have exactly one primary message, communicated first, before any secondary detail.

## 8. Typography Philosophy

Body text uses Pretendard by default; handwritten/script fonts are reserved for badges, notes, and emphasis phrases only; full-body handwritten typesetting is forbidden. A body typeface must prioritize legibility over personality; a display or handwritten typeface earns its place only where its *personality*, not its *legibility*, is the point.

## 9. Color Philosophy

Color in Atlas is never decorative — it is always a signal of which Brand Pack, and therefore which commercial positioning, a product belongs to. Each Theme Rule specifies not just an allowed palette but explicit forbidden colors/effects.

## 10. Whitespace Philosophy

Whitespace is not empty space — it is the mechanism by which a viewer's eye is told what to look at and what to ignore.

## 11. Composition Philosophy

Every visual surface Atlas produces should be composable back to one sentence: "the eye goes here, then here."

---

# Part IV — Brand Identity System

## 12. Brand Theme Philosophy

Current Brand Themes are Premium, Study Note, and Handwriting; future Brand Themes include Business, Creator, Minimal, Finance, Healthcare, Education. A Brand Theme is never a color scheme choice — it is a **positioning and trust strategy** expressed visually.

## 13. Theme Rules — Premium / Study Note / Handwriting

### Premium
- **Mood:** 고급 · 전문가 · AI · 투자 · 부업
- **Colors:** Black, Charcoal, Gold, Ivory
- **Typography:** Heading — Noto Serif KR; Body — Pretendard; Accent — Pretendard Bold
- **Forbidden:** purple buttons, neon effects, excessive glow

*Why:* Premium exists to make an expert-level, high-price product credible. Purple buttons, neon, and glow are forbidden because they are visual markers of tech-startup playfulness, directly at odds with "expert/investment/luxury."

### Study Note
- **Mood:** 공부노트 · 플래너 · 건강 · 자기계발 · 육아
- **Colors:** Ivory, Beige, Brown, Sage, Yellow
- **Required elements:** ruled lines, dot grid, sticky notes, checklists, highlighter marks, bookmarks
- **Typography:** Heading — Noto Serif KR; Body — Pretendard; Accent — Poor Story
- **Forbidden:** dark cards, black backgrounds

*Why:* the trust signal a buyer needs is "this feels like something I could actually use daily," not "this is authoritative." Dark backgrounds are forbidden because they read as formal/serious in exactly the way this theme is trying not to.

### Handwriting
- **Mood:** 다이어리 · 루틴 · 감성 · 기록 · 메모
- **Colors:** Warm Ivory, Dusty Pink, Warm Brown, Soft Blue
- **Required elements:** hand-drawn underlines, washi/masking tape, memos, stickers, handwritten accent marks
- **Typography:** Heading — Noto Serif KR; Body — Pretendard; Accent — Single Day
- **Forbidden:** full-body handwritten script, childish/infantile design

*Why:* trust is built through warmth and intimacy rather than authority or utility. Childish design is forbidden because "emotional warmth" and "juvenile" are different positioning claims entirely.

## 14. Theme Cards

*Rule:* text-only buttons for theme selection are forbidden; theme selection must always be presented as a card containing a real thumbnail sample, a real sales-page sample, the font pairing, the color palette, and recommended use categories.

*Why:* a non-designer cannot make the Brand Pack decision from a text label alone — showing the actual downstream output lets the user evaluate the *actual commercial consequence* of their choice before committing to it.

---

# Part V — Product Surface Philosophy

## 15. Thumbnail Philosophy

A thumbnail's entire job, commercially, is to earn a click in a field of competing listings — evaluated in under a second. Thumbnail composition must resolve to one or two focal elements, never more. The product itself must be prominent enough in frame to be legible even at small marketplace-grid size.

## 16. Hero Philosophy

The Hero carries a different burden than the thumbnail: the buyer has already clicked, so trust is partially earned, but the Hero must confirm — in the same visual language and campaign mood as the thumbnail that earned the click — that this was the right decision.

## 17. Detail Page Philosophy

A detail page's job is to walk a buyer from curiosity to purchase confidence across a sequence of pages, each with a distinct commercial purpose. Visual consistency across all pages is what makes the sequence read as one persuasive argument rather than a set of unrelated slides.

## 18. Overlay Philosophy

The Overlay is where a generated background becomes a finished, on-brand commercial asset — because AI-generated text inside an image is unreliable and cannot be evaluated for hierarchy or brand consistency before it exists.

## 19. Product Mockup Philosophy

Wherever an ebook is depicted as a physical or device-displayed object, the mockup must be large and undistorted enough in frame to read as the actual product being sold.

---

# Part VI — Execution Rules

## 20. Layout Rules

Configuration/settings are placed on the left; Preview is placed on the right. Preview must always occupy the largest visual area on screen.

## 21. Animation Rules

Allowed motion is limited to fade, hover, and scale, at 150–220ms. Bounce, excessive glow, and continuous/looping motion are forbidden. Motion in a premium product should confirm an interaction happened, not entertain.

## 22. Preview == Export

The Preview shown to the user and the final exported result must be identical. A Preview that looks better than the actual export is forbidden — this is treated as an invariant, not a target.

---

# Part VII — Governance

## 23. Design Governance

Before building any new interface, this document must be read first. Any design that conflicts with it is not implemented. Where the right choice is ambiguous, the answer is to ask the user — never to decide unilaterally.

## 24. Relationship to the Prompt Bible and QA Bible

**The Design Bible defines principles. The Prompt Bible defines how AI should generate outputs using those principles. The QA Bible defines how generated outputs are validated against those principles.** These responsibilities must never overlap.

## 25. Future Evolution

As Atlas grows into new Brand Themes and new product surfaces, every addition should be evaluated by the same method: identify the business/positioning claim first, then derive the visual rule from that claim — never the reverse.

---

# Part VIII — Atlas Design Language

## 26. Atlas Design Language

Every other part of this document describes what Atlas *looks like* today. This section describes something that should not change even when all of that does: **how Atlas makes a visual decision.**

A Brand Theme is a dialect. Atlas Design Language is the grammar underneath every dialect. A viewer who has seen all three should still be able to recognize a fourth, not-yet-invented theme as unmistakably *Atlas*. That recognizability is made of four permanent qualities:

- **Restraint.** Every theme is more restrained than it could be.
- **Deference.** Atlas's own interface, and every visual flourish inside a generated asset, defers to the user's actual product.
- **Clarity of intent.** Every visual element earns its place by carrying information — never by existing purely for visual interest.
- **Commercial honesty.** A visual choice never implies something about the product's positioning, price, or quality that isn't true.

## 27. Design Decision Framework

1. **Whose attention does this serve?**
2. **Does this make the user's product more prominent, or does it compete with it?**
3. **Can the eye's path be described in one sentence?**
4. **Does this hold up restrained, or does it only work maximized?**
5. **Would this still make sense in a Brand Theme that doesn't exist yet?**
6. **Is this reversible if wrong?**

## 28. Design Anti-Patterns

- **Decoration without information.**
- **Novelty for its own sake.**
- **Style outweighing Preview.**
- **Accidental consistency.**
- **"It looks impressive in isolation" as the sole justification.**
- **Generic AI aesthetic.**
- **Mistaking complexity for premium.**

## 29. Design North Star

Every principle, rule, theme, and anti-pattern in this document exists in service of one question — the last check any future design decision must pass:

> **Does this design help the creator sell with more confidence?**

Not: is this beautiful. Not: is this novel. Not: is this technically impressive. Not: is this the most creative execution possible. Beauty, novelty, and technical sophistication earn their place in Atlas only when they increase a buyer's trust, strengthen the creator's brand, improve clarity, or help the creator sell with more confidence.

When a future decision has no other section to check it against, this is the question to return to. If the honest answer is yes, the decision belongs in Atlas. If the honest answer is no, or merely "it looks good," it does not, no matter how well-crafted it is.

---

*End of Atlas Design Bible.*
