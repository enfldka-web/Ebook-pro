# Atlas Prompt Bible
### Permanent Prompting Philosophy

*This handbook defines how Atlas communicates with AI — not what any specific prompt says. It contains no prompt templates, no system prompts, and no implementation text. Anywhere a current mechanism is named as an example, treat it as an illustrative anchor for a permanent principle, not the principle itself.*

---

## Table of Contents

**Part I — Foundation**
0. Reading This Document
1. Core Philosophy: Prompts Are Architecture, Not Text
2. Relationship to the Other Foundation Documents

**Part II — Prompt Philosophy & Communication**
3. Prompt Philosophy
4. AI Communication Principles

**Part III — Prompt Architecture**
5. Prompt Architecture
6. The Prompt Pipeline
7. Prompt Composition Strategy
8. Prompt Layering

**Part IV — Governance & Reuse**
9. Prompt Governance
10. Prompt Reusability
11. Prompt Versioning
12. Prompt Safety

**Part V — Quality & Evolution**
13. Prompt Quality Standards
14. Prompt Evaluation
15. Relationship to the QA Bible
16. Prompt Evolution
17. Prompt North Star
18. Prompt Anti-Patterns

---

## 0. Reading This Document

This document does not tell anyone what to type into a prompt. It tells every future engineer, for every future AI capability Atlas ever adds, *how to think* about the boundary between Atlas and the model it's talking to — what belongs in a request, what must never be in one, and why a request should be built the way it's built.

---

## 1. Core Philosophy: Prompts Are Architecture, Not Text

The single idea this entire document exists to establish: **a prompt is not a piece of writing — it is a structural artifact, assembled from typed, governed inputs, and its quality is judged by the reliability of what it produces, not by the cleverness of how it reads.**

This reframes the standard for prompt quality entirely: **a prompt is good not because it is well-written, but because it is well-structured.** Atlas prefers a simple, deterministic structure that reliably produces a good result over a clever one that produces a great result sometimes and an unpredictable one otherwise.

---

## 2. Relationship to the Other Foundation Documents

- **Constitution** → timeless principles.
- **Architecture Handbook** → technical structure: how systems are built, where credentials live.
- **Product Bible** → business philosophy: what outcome the user is actually paying for.
- **Design Bible** → visual philosophy.
- **Prompt Bible (this document)** → AI generation philosophy: how the *intent* behind all four of the above is faithfully translated into a request a model can act on.

The Prompt Bible is the bridge, not a fifth independent authority. If a prompt appears to be "deciding" something, that decision has leaked in from the wrong layer.

---

# Part II — Prompt Philosophy & Communication

## 3. Prompt Philosophy

Atlas talks to AI models the way a well-run studio briefs a specialist: with a clear intent, the relevant context, explicit constraints, and a precise definition of what a finished, acceptable answer looks like. **Prompt quality is measured by output quality, not prompt complexity.**

## 4. AI Communication Principles

- **Be explicit, never implicit.**
- **State the goal in terms of outcome, not technique.**
- **Separate what the model may decide from what it may not.**
- **Never ask a model to do Atlas's job.**

---

# Part III — Prompt Architecture

## 5. Prompt Architecture

A prompt is the final, assembled output of a pipeline — never handwritten as one piece for one use. It is built from discrete, independently-sourced inputs, combined in a fixed, repeatable order.

## 6. The Prompt Pipeline

```
Intent
   ↓  what outcome is actually being asked for
Context
   ↓  the material/situation this request is grounded in
Knowledge
   ↓  what Atlas already knows and has decided
Creative Direction
   ↓  what this specific output should depict or express, and why
Constraints
   ↓  the non-negotiable boundaries this output must respect
Output Specification
   ↓  the precise shape a valid answer must take
Validation
   ↓  checking the result against the specification before it's trusted
Revision
   ↓  a defined path back to an earlier stage when validation fails
```

**Why each stage exists, and why they are kept separate:** Intent is separated from everything after it because *what outcome is wanted* must be settled before *how to achieve it* is decided. Context is separated from Intent because raw material and the desired outcome are different kinds of input with different failure modes. Knowledge is separated from Context because it must never be re-derived or re-guessed by the model — if Atlas has already decided something, the prompt states it as a fact. Creative Direction is separated from Constraints because *what to express* and *what is forbidden* are different kinds of instruction. Constraints exist as their own stage precisely so they can never be silently dropped or softened during composition. Output Specification is separated from everything above it because "what should this express" and "what shape must the answer take" are independent concerns. Validation exists because no output should be trusted merely because it was produced. Revision exists as a defined, repeatable path — not an ad hoc retry.

## 7. Prompt Composition Strategy

Composition follows a fixed field order and a fixed inclusion rule: **only fields that have passed through every earlier stage are eligible to appear, and they appear in the same order every time.** This is what makes it structurally impossible for something that shouldn't be in a prompt to end up in one.

## 8. Prompt Layering

1. **System-level layer** — how the model should behave in general.
2. **Brand/strategy layer** — what has already been decided about this specific product's positioning and voice.
3. **Creative-direction layer** — what this specific generation should express.
4. **Constraint layer** — the non-negotiable boundaries.
5. **Output-shape layer** — the precise form the answer must take.

Layering exists so that a change to one concern can be made at its own layer without touching, or risking, any other layer.

---

# Part IV — Governance & Reuse

## 9. Prompt Governance

| Belongs **inside** a prompt | Belongs **outside** a prompt (referenced, not repeated) |
|---|---|
| The specific intent, context, and constraints for *this* generation | Standing business strategy — referenced, never re-explained from scratch |
| The creative direction for *this* specific asset | Visual-language rules — a prompt invokes a decision already made, never restates the reasoning |
| The precise output shape required | System architecture — invisible to the prompt by design |
| Constraints specific to this request | General safety/compliance policy that applies to every request |

**The general rule: a prompt states what is unique to this specific generation, and references — never restates — everything that was already decided elsewhere.**

## 10. Prompt Reusability

A prompt-pipeline stage should be reusable across every content type that shares its shape, not rebuilt per feature.

## 11. Prompt Versioning

Every meaningful change to a prompt's composition is a decision worth being able to trace later: what changed, why, and what effect it had. At minimum, composed prompts and the reasoning behind meaningful changes to them should be treated as something worth recording.

## 12. Prompt Safety

- **What must never enter a prompt going out:** anything internal-only — reasoning traces, confidence scores, competitor or internal-tool names, credentials, or any user data beyond what's strictly needed.
- **What must never be trusted coming back in:** model output is never assumed well-formed, safe, or on-brief — it is always validated before being treated as real.

---

# Part V — Quality & Evolution

## 13. Prompt Quality Standards

- **Consistency** — the same intent, composed the same way, should produce comparable quality every time.
- **Determinism** — as much of a prompt's structure as possible should be fixed and predictable.
- **Maintainability** — a future engineer should be able to change one layer without needing to understand or risk every other layer.
- **Readability** — a composed prompt should be understandable by a human reviewing it.
- **Modularity** — each pipeline stage and layer is a separate, independently replaceable unit.
- **Composability** — stages and layers should combine predictably into a whole.
- **Traceability** — given a result, it should be possible to reconstruct which intent, context, and constraints produced it.

## 14. Prompt Evaluation

A prompt's quality is judged by whether its output reliably satisfies the Output Specification and Constraints it was given — not by subjective impressions of the prompt text itself, and not by any single impressive result.

## 15. Relationship to the QA Bible

**The Prompt Bible defines how Atlas should ask AI to generate something. The QA Bible defines how the resulting output is verified before it is trusted or shipped.**

## 16. Prompt Evolution

Models, providers, and capabilities will change continuously; the principles in this document are written to survive all of that change, because they describe *how Atlas thinks about talking to AI*, not any specific way of talking to any specific model.

## 17. Prompt North Star

Every stage, layer, and rule in this document exists in service of one question:

> **Does this prompt reduce uncertainty while preserving meaningful creativity?**

A prompt exists to remove ambiguity everywhere Atlas has already made a decision, while preserving genuine creative freedom only where creativity actually benefits the creator and the buyer. A prompt that leaves an already-decided question open to the model is incomplete. A prompt that constrains everything, including the parts where creative judgment is genuinely the point, is equally flawed. Atlas's responsibility — not the model's — is to determine where that boundary sits.

## 18. Prompt Anti-Patterns

- **Duplicate instructions.**
- **Mixed responsibilities between layers.**
- **Hidden or implicit constraints.**
- **Repeating business or design decisions inside prompts.**
- **Prompts making business decisions instead of communicating them.**
- **Prompts deciding visual language instead of referencing the Design Bible.**
- **Repeated context that increases ambiguity.**
- **Prompt bloat.**
- **Prompt cleverness replacing structure.**
- **Prompting for reasoning that Atlas already owns.**
- **Including internal-only information.**
- **Depending on model behavior instead of deterministic structure.**

Each of these creates the same downstream cost: a prompt that cannot be trusted, explained, safely changed, or relied upon to produce the same quality twice.

---

*End of Atlas Prompt Bible.*
