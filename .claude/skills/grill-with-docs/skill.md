---
name: grill-with-docs
description: A relentless interview with the human about a plan, idea, or ambiguous domain term, until reaching shared understanding, mapped as a decision tree. Mandatory for `planner` during the SDD pipeline's Clarify phase, especially for resolving Provincial Public Works System domain terms (roles, permissions, project statuses, etc.).
---

# grill-with-docs

Interview the user relentlessly about a plan or idea until reaching shared
understanding. Map this as a decision tree: each question depends on its
prerequisites already being resolved.

## How to work

1. **Build the tree before asking.** Identify which decisions depend on
   which. Don't ask about a role's implementation detail if which roles exist
   hasn't been decided yet.
2. **Work in rounds.** In each round, ask only the **frontier** questions:
   the ones whose prerequisites are already resolved (answered in this
   session, or already present in `docs/context.md`/the spec). Don't stack
   questions from different depths of the tree in the same round.
3. **Format for every question**, no exceptions:

   ```
   ❓ **Q1** - **<short title>**: <question body, with the minimum context
   needed to answer without having to go look anything else up> ➡️ <your
   concrete recommendation, with the reason in one sentence>
   ```

4. **Wait for the answers** before generating the next round. Never assume a
   "reasonable" answer and proceed — that's exactly what this skill exists to
   prevent (Constitution Clause I: no business rule is ever guessed).
5. When a round settles a domain term (e.g. "which roles exist in the
   public-works system and what each can see", "what does 'halted project'
   mean"), **write it into `docs/context.md` immediately** — don't wait for
   the whole interview to finish. `docs/context.md` is the living glossary of
   already-resolved domain terms; any agent can check it before asking the
   same thing again.
6. If an answer implies a hard-to-reverse decision with real trade-offs (e.g.
   how a WhatsApp user's phone number is uniquely identified, which
   tenant-isolation model is used, which LLM provider is the default),
   generate an **ADR** in `docs/adr/` using the standard format (context,
   decision, alternatives considered, consequences). A glossary term goes to
   `docs/context.md`; an architectural decision goes to an ADR. If unsure
   which it is, ask: "could this be reversed without rewriting half the
   feature?" — if the answer is no, it's an ADR.

## When this is used

It's the mandatory tool for the `planner` agent during the **Clarify** phase
of the SDD pipeline
(`Constitution → Specify → Clarify → Plan → Tasks → Implement`). It triggers
whenever:

- A domain term appears with no written definition (roles, statuses,
  permissions, public-works data visibility rules).
- A spec has an Open Questions section with unanswered questions.
- A plan requires an architectural decision with trade-offs nobody has
  confirmed yet.

## What NOT to do

- Don't run more than one round of "just in case" questions without waiting
  for an answer.
- Don't answer a domain question yourself because "it's obvious" — if it were
  obvious, it would already be in `docs/context.md` or the spec.
- Don't blend your recommendation into the question in a way that makes it
  hard to tell which is your suggestion and which is the human's decision —
  the ➡️ separator exists for exactly that.
