# Tasks — Onboarding

Base: [`plan.md`](./plan.md) §6.

- [x] **T1 — Scaffold `services/frontend`**: done — Next.js 15/React 19,
  standalone `tsconfig.json`, `next.config.ts`, `vitest.config.ts`,
  `app/layout.tsx` + `app/globals.css` (hand-written, no Tailwind),
  `.env.example`. Root `package.json` gained `dev:frontend`/
  `build:frontend`/`start:frontend`. One repo-wide fix needed along the way:
  `eslint.config.mjs`'s naming-convention rule forced `camelCase` on every
  function including React components — added a PascalCase exception for
  names starting with an uppercase letter (matches `naming.md`'s already-
  documented component rule), and added `.next/`/`next-env.d.ts` to the
  global ESLint `ignores` (Next's own generated files aren't meant to be
  linted).
- [x] **T2 — `lib/knowledge-store-client.ts`**: done, 8 tests passing.
- [x] **T3 — `actions/submit-onboarding.ts`**: done, 4 tests passing
  (AC2 happy path + call order, AC4 × 2 invalid-input cases, plus a
  knowledge-store-failure-surfaces-as-form-error case beyond the spec's
  explicit ACs).
- [x] **T4 — `OnboardingForm.tsx` + `app/onboarding/page.tsx`**: done.
  Redirects to `/` client-side (`useRouter().push`) on a `'success'` form
  state rather than calling `redirect()` inside the Server Action itself —
  keeps `submitOnboarding` a pure, easily-mocked function for T3's tests.
- [x] **T5 — `app/page.tsx` onboarding gate**: done (AC1/AC3). Filled in
  fully, not just gated — mounts `ChatPanel` (`frontend/002-chat`) and
  `ExplorerPanel` (`frontend/003-explorer`) directly, since both were
  implemented in the same pass. No dedicated test, as planned — verify
  manually once `knowledge-store` has a live database (see
  `knowledge-store/001-vectorization/tasks.md` T3).

**Verified**: `pnpm run build`/`lint`/`test` all pass for `services/frontend`
(and the whole monorepo). Not yet verified against a *live* `knowledge-store`
— same blocker as `knowledge-store/001-vectorization`'s T3/T9.
