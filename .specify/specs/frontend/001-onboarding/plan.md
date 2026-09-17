# Plan — Onboarding

Base: [`spec.md`](./spec.md). This is the first frontend spec implemented,
so it also covers the one-time `services/frontend` scaffold (Next.js App
Router, per [`docs/conventions/frontend.md`](../../../../docs/conventions/frontend.md)).
Contracts below are signatures only.

## 1. `services/frontend` scaffold (shared prerequisite, this task only)

- Next.js 15, App Router, TypeScript, **no Tailwind/component library** —
  one small `app/globals.css` with hand-written styles. Default, flagged:
  keeps the dependency surface minimal for a PoC; revisit if the UI grows
  past what plain CSS comfortably handles.
- **`tsconfig.json` does NOT extend the repo root `tsconfig.json`** — Next's
  own build (not `tsc`) needs `moduleResolution: "bundler"` and `jsx:
  "preserve"`, incompatible with the root's `NodeNext` settings the other 3
  services share. Deliberate deviation, not an oversight.
- Port `30022` (`docs/ports.md`), via `PORT` — Next's dev server needs
  `next dev -p $PORT`, it doesn't read `PORT` itself like the Express
  services do.
- Root `package.json` gains `dev:frontend`/`build:frontend`/`start:frontend`.
- Vitest required here (Clause III) — `vitest.config.ts` with a `node`
  environment for `lib/`/`actions/` unit tests (no jsdom/component rendering
  tests this iteration — components stay thin enough that testing the
  Server Actions and `lib/` clients they call covers the ACs; see each
  spec's test strategy).

## 2. Layering

```
app/ (routes only) → actions/ (Server Actions, call lib/) → lib/ (HTTP clients, framework-agnostic)
components/ (presentation, receive data via props — no fetching inside)
```

Same direction as the backend services: a route/component never calls
`fetch` directly, only through `actions/` → `lib/`.

## 3. Contracts

```typescript
// src/lib/knowledge-store-client.ts
export interface Purpose {
  // string union, see spec §3 — kept as a type here, Zod schema lives in actions/
}
export interface CreateUserInput { name: string; email: string; purpose: Purpose }
export interface CurrentUser { id: string; name: string; email: string; purpose: Purpose }

export class KnowledgeStoreClient {
  constructor(private readonly baseUrl: string) {}
  createUser(input: CreateUserInput): Promise<CurrentUser>;          // throws on non-2xx (incl. 409)
  getCurrentUser(): Promise<CurrentUser | null>;                      // null on 404, throws on other non-2xx
  createKnowledgeEntry(input: { title: string; content: string }): Promise<{ id: string; path: string }>;
}
```

```typescript
// src/actions/submit-onboarding.ts
const OnboardingInputSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  purpose: PurposeSchema, // same 5-value enum as knowledge-store's, duplicated here deliberately —
                          // see docs/conventions/frontend.md: lib/ has zero knowledge-store internals
});

export async function submitOnboarding(
  prevState: OnboardingFormState,
  formData: FormData,
): Promise<OnboardingFormState>; // AC2, AC4 — validation errors returned as form state, not thrown
```

`submitOnboarding` calls `knowledgeStoreClient.createUser(...)`, then
`knowledgeStoreClient.createKnowledgeEntry({ title: 'Conocimientos',
content: <template from name/email/purpose> })` (AC2) — both through one
`KnowledgeStoreClient` instance constructed once in `lib/knowledge-store-client.ts`'s
module scope (`export const knowledgeStoreClient = new KnowledgeStoreClient(...)`),
matching the framework-agnostic-singleton pattern Server Actions can import
directly (no request-scoped DI framework needed for a PoC this size).

## 4. Onboarding gate (AC1, AC3)

`app/page.tsx` (Server Component): calls `knowledgeStoreClient.getCurrentUser()`.
`null` → `redirect('/onboarding')`. Otherwise renders the main view
(chat + explorer, see `frontend/002-chat`/`frontend/003-explorer`).
`app/onboarding/page.tsx` does the inverse check (a user who already exists
gets redirected to `/`) so the URL can't be used to re-trigger onboarding.

## 5. Test strategy (Vitest)

| Target | Covers |
|---|---|
| `OnboardingInputSchema` (Zod) | AC4 — invalid email / missing purpose rejected |
| `submitOnboarding` (mocked `KnowledgeStoreClient`) | AC2 happy path (both calls made, in order); AC4 (no calls made on invalid input) |
| `KnowledgeStoreClient.createUser`/`getCurrentUser` (mocked `fetch`) | 409 surfaces as a thrown error the action can catch; 404 on `getCurrentUser` returns `null`, not a throw |

No component-render test for `OnboardingForm.tsx`/the gating `redirect()`
calls this iteration — see plan §1's note on test scope.

## 6. Build order → `tasks.md`

1. Scaffold `services/frontend` (§1).
2. `lib/knowledge-store-client.ts` + tests.
3. `actions/submit-onboarding.ts` + tests.
4. `components/onboarding/OnboardingForm.tsx` + `app/onboarding/page.tsx`.
5. `app/page.tsx`'s onboarding gate (also the entry point
   `frontend/002-chat`/`003-explorer` build their own content into).
