# ATLAS_UI_INTELLIGENCE.md
### Design Language Extraction & Atlas Translation (Research Note)

*Status: standalone research document, not merged into the Design Bible. Anonymized by design — no company names, product names, logos, or exact source values appear anywhere below. Findings are restated entirely in Atlas's own vocabulary, with hue/value intentionally shifted away from any source system rather than copied.*

---

## 1. What Recurs Across the Reference Set

Read as a collection, five principles recur often enough to be a transferable design language rather than any one company's house style:

1. **A single brand accent is treated as scarce, not decorative.** The saturated brand color appears only on primary actions, active/selected states, and a small number of protected brand moments — never as a background fill, never tinting a shadow, never repeated more than once per screen composition. Some systems separate a "marketing" shade of an accent from a "product/compliance" shade of the same hue, keeping them named and used differently.
2. **Type carries hierarchy through role and weight, not through a large family count.** Two or three functional type roles (display/heading, body/reading, small utility/caption) rather than many bespoke sizes. A distinctive display face, where one exists, is reserved for brand moments and kept separate from the workhorse reading face.
3. **Geometry is a deliberate signal, not a default.** Some systems commit to fully square control geometry as a statement of function-first restraint; others commit to full pill/capsule geometry as a statement of approachability — but always singular and consistent across the whole surface.
4. **Content is the brand; chrome recedes.** The interface's job is to disappear behind the actual content a user came for, sometimes stated as an explicit numeric floor on content density.
5. **States and motion are first-class design surface, not implementation afterthought.** Empty/loading/error/success/disabled states each documented individually with their own tone and visual rule; motion bound to named duration/easing tokens, with springy/bouncy easing explicitly banned in trust-sensitive contexts.

## 2. Translating Each Principle Into Atlas's Own Language

**Accent scarcity** strengthens an existing Design Bible principle rather than replacing it. Atlas already has per-theme accent colors rather than one universal brand color, so the transferable rule is a usage discipline applying *within* every theme: whichever accent a given Brand Theme uses, it should appear on primary actions and active states only, never as a decorative fill or repeated background tint — at most one accent-colored element per composition, regardless of which theme is active.

**Two shades of one hue for two different jobs** is worth adopting deliberately: Atlas could reserve a slightly different value of each theme's accent for structural/compliance-adjacent actions (a final approve/generate action, a destructive confirmation) versus general marketing/decorative accents inside generated assets.

**Two-to-three type roles** directly matches Atlas's existing Typography Philosophy (Heading/Body/Accent). The contribution here is discipline around *where* the display/accent role is allowed to appear: reserved for genuine brand moments, never body reading — a general Atlas rule, not a single-theme rule.

**Geometry as a single deliberate choice per theme** — each of Atlas's themes could commit to one geometry signature and hold it consistently, adding a geometry dimension alongside color/typography/required-elements in the existing Theme Rules.

**Content-recedes, chrome-light** directly matches the Constitution's existing rule that Atlas should never visually outweigh the user's own product. The contribution here is making this measurable: an explicit density floor for Atlas's own result screens — a minimum number of the user's own generated results visible per viewport before Atlas's own chrome is allowed to reduce that further.

**A real states taxonomy is a genuine gap in Atlas's current Foundation set.** Neither the Design Bible nor the Prompt Bible currently specifies empty/loading/error/success/disabled handling with the same rigor applied to visual composition. Specific, warm, non-generic copy per state; a loading treatment matched to the shape of the real content being loaded; a disabled treatment that never fully removes a control's presence.

**Motion tokens and a no-bounce rule.** Atlas's existing Animation Rules already forbid bounce and excessive glow. Naming Atlas's own duration/easing tokens explicitly, and stating the reason as explicitly as the strongest reference does — that Atlas mediates a moment of real commercial trust (a creator deciding whether to publish something they're about to sell) — would meaningfully strengthen the existing rule's justification.

## 3. What Is Deliberately Not Proposed

No new hex values, no new font stack, and no rewrite of any existing Brand Theme — Atlas's existing three-theme palette system should not be replaced by principles lifted from other systems. What's above is a set of disciplines and gaps, translated into Atlas's own already-established vocabulary.

## 4. Suggested Application

Useful input for strengthening the Design Bible (accent scarcity as a checkable rule, geometry-per-theme, a Deference density floor, expanded Animation Rules justification) and for a candidate new gap (a states taxonomy) — addressed formally in `ATLAS_UI_BIBLE.md` §12.

---

*End of ATLAS_UI_INTELLIGENCE.md — standalone research document.*
