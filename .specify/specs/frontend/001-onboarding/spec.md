# Spec — Onboarding

| | |
|---|---|
| **Status** | Draft — Open Questions resolved 2026-09-18 (see README), no longer blocked on Clause I |
| **Group** | frontend |
| **Depends on** | [`knowledge-store/001-vectorization`](../../knowledge-store/001-vectorization/spec.md) — needs `POST /users`, `GET /users/me`, `POST /knowledge-entries` |
| **Open Questions** | Resolved — see [`.specify/specs/README.md`](../../README.md#open-questions-blocking-all-4-specs-resolve-before-any-advances-to-plan) for the log |
| **Constitution clauses in play** | I, IV (layering — Server Actions calling `knowledge-store`, never a Client Component) |

## 1. Goal

A first-time ALMA user answers who they are and what they want ALMA for, so
ALMA has a starting point and the vault gets its first note.

## 2. User Story & Acceptance Criteria

As a first-time ALMA user, I answer who I am and what I want ALMA for, so
ALMA has a starting point and my vault gets its first note.

- **AC1**: Given no `User` row exists in `knowledge-store`'s database
  (`GET /users/me` → `404`), when the frontend loads, then it shows the
  onboarding form (name, email, and a single-select of the 5 `Purpose`
  options — see §3) instead of the main chat/explorer view.
- **AC2**: Given I submit the form with a valid name, a validly-formatted
  email, and one purpose selected, then exactly one `User` row is created
  (`POST /users`), and a `conocimientos.md` `KnowledgeEntry` is created
  (`POST /knowledge-entries` — file + DB row, embedded) containing those
  answers.
- **AC3**: Given a `User` row already exists (`GET /users/me` → `200`), when
  the frontend loads (any later run), then onboarding is skipped and the
  main view loads directly.
- **AC4**: Given I submit an invalid email or no purpose selected, then the
  form shows a validation error and no `User`/`KnowledgeEntry` is created
  (nothing is sent to `knowledge-store`).

## 3. `Purpose` options (user-facing copy in Spanish — see
[`docs/context.md`](../../../../docs/context.md#naming-convention-for-this-domain))

| Enum value (code) | Onboarding option (Spanish, shown to the user) |
|---|---|
| `PERSONAL_DAILY` | día a día personal (recordatorios, notas, organización) |
| `AUTOMATION_PRODUCTIVITY` | automatizaciones y productividad |
| `PROJECTS_WORK` | proyectos y trabajo |
| `SECOND_BRAIN_STUDY` | segundo cerebro / estudio e investigación |
| `TEAM_BUSINESS` | uso en equipo o empresa |

## 4. Folder structure (new files under `services/frontend`)

```
services/frontend/src/
├── app/
│   └── onboarding/page.tsx        # shown instead of the main view while GET /users/me is 404
├── actions/
│   └── submit-onboarding.ts       # Server Action: POST /users then POST /knowledge-entries
├── components/onboarding/
│   └── OnboardingForm.tsx
└── lib/
    └── knowledge-store-client.ts  # shared with frontend/003-explorer — framework-agnostic HTTP client
```

## 5. Defaults & Assumptions (mark any correction inline)

1. **Onboarding gates the whole app**: the root layout/page checks
   `GET /users/me` server-side before rendering anything else — there's no
   route a first-time user can reach that skips it.
2. **`conocimientos.md` content**: composed from the submitted name/email/
   purpose as plain Markdown (exact copy/template is an implementation
   detail for `plan.md`, not a business rule — the *fact* that this file
   gets created is the acceptance criterion, AC2).
3. **No "edit my profile" screen this iteration** — see Out of Scope.

## 6. Out of Scope — Future Work

- Editing onboarding answers after the fact (changing name/email/purpose).
- Multi-user onboarding (a second `User`) — blocked on the constitution's
  Clause V becoming binding again.
