# Design Patterns In Use

This is the technical backing for the constitution's Clause IV (layer
separation). `quality-checker` uses it as an objective quality bar;
`implementer` and `planner` use it as an implementation/design guide. Based on
the official [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)'s
recommended practices (`McpServer`, registering tools via `server.tool(...)`)
and standard Node/TypeScript practice for separating transport, business
logic, and data access.

---

## General rule: 3 layers, one direction of dependency

```
┌─────────────────────────────────────────────┐
│  src/infraestructure/tools/*.ts              │  ← MCP protocol (transport)
│  - defines the input schema (Zod)            │
│  - validates                                 │
│  - calls exactly ONE service                 │
│  - formats the result as an MCP response     │
└───────────────────┬───────────────────────────┘
                     │ calls
┌────────────────────▼──────────────────────────┐
│  src/services/*.ts                             │  ← business logic
│  - pure business rules                         │
│  - receives PrismaClient injected              │
│  - doesn't know what MCP is, doesn't know what │
│    WhatsApp is                                 │
└────────────────────┬──────────────────────────┘
                      │ uses
┌─────────────────────▼─────────────────────────┐
│  PrismaClient (packages/shared or core)        │  ← data access
└─────────────────────────────────────────────────┘
```

A tool never jumps straight to Prisma for anything involving a business
decision (calculations, role-based filters, combining several entities). It
may use Prisma directly only for the trivial "fetch this by id" case with no
rule wrapped around it — the moment a rule appears (even a single `if`), that
rule belongs in a service.

---

## 1. Module Pattern

**What it is.** In TypeScript/Node, every file is a module. The pattern is
grouping related logic into its own file and exporting only what other files
need.

**Why we need it.** So `server.ts` doesn't grow into a file with thousands of
lines. Every tool lives in its own file under
`src/infraestructure/tools/`, every service in its own under `src/services/`.

```typescript
// src/infraestructure/tools/projectStatusTool.ts
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ProjectService } from '../../services/projectService.js';

export function registerProjectStatusTool(server: McpServer, projectService: ProjectService) {
  server.tool(
    'getProjectStatus',
    "Returns a project's status, visible to the authenticated user",
    { projectId: z.string(), userRole: z.string(), userPhone: z.string() },
    async ({ projectId, userRole, userPhone }) => {
      const result = await projectService.getStatusForUser(projectId, { userRole, userPhone });
      return { content: [{ type: 'text', text: JSON.stringify(result) }] };
    },
  );
}

// src/core/server.ts
import { registerProjectStatusTool } from '../infraestructure/tools/projectStatusTool.js';
// ...
registerProjectStatusTool(server, projectService);
```

The tool doesn't decide what `userRole` is allowed to see — the service does
(Clause V).

---

## 2. Service Layer

**What it is.** The abstraction layer between tools (presentation/protocol)
and Prisma (data access). Holds the pure business logic.

**Why we need it.** So tools don't fill up with business rules. Also, two
different tools may need the same rule (e.g. computing a project's progress)
— living in a service makes it reusable and testable in isolation, without
spinning up the whole MCP server.

```typescript
// src/services/projectService.ts
import { PrismaClient } from '@prisma/client';

export interface UserContext {
  userRole: string;
  userPhone: string;
}

export class ProjectService {
  constructor(private readonly prisma: PrismaClient) {}

  async getStatusForUser(projectId: string, ctx: UserContext) {
    // The role/phone filter lives here, in exactly one place (Clause V).
    const project = await this.prisma.project.findFirst({
      where: {
        id: projectId,
        ...this.visibilityFilterFor(ctx),
      },
    });

    if (!project) {
      return { visible: false };
    }

    return { visible: true, status: project.status, progress: project.progressPercent };
  }

  private visibilityFilterFor(ctx: UserContext) {
    // A real business rule: defined in the spec, not invented here "just in case".
    // See the corresponding BR in the roles/visibility spec.
    return { authorizedUsers: { some: { phone: ctx.userPhone } } };
  }
}
```

---

## 3. Dependency Injection (DI)

**What it is.** A component doesn't create its own dependencies
(`new PrismaClient()` inside a class) — they're passed in from outside,
normally via the constructor.

**Why we need it.** It's what makes testability possible (Clause III —
Vitest verification, required today for `services/orchestrator`).
`ProjectService` receives `prisma` via its constructor; in a test, we pass a
mock instead of a real connection, without touching the database.

`PrismaClient` is instantiated **exactly once**, at bootstrap
(`src/core/server.ts` or a dedicated composition module), and injected down
into each service. No service or tool ever does `new PrismaClient()` on its
own.

```typescript
// src/core/server.ts — the only place PrismaClient gets instantiated
import { PrismaClient } from '@prisma/client';
import { ProjectService } from '../services/projectService.js';

const prisma = new PrismaClient();
const projectService = new ProjectService(prisma); // injected

// src/services/projectService.test.ts — unit test, no real DB
import { mockDeep, type DeepMockProxy } from 'vitest-mock-extended';
import { PrismaClient } from '@prisma/client';
import { ProjectService } from './projectService.js';

let prisma: DeepMockProxy<PrismaClient>;
let service: ProjectService;

beforeEach(() => {
  prisma = mockDeep<PrismaClient>();
  service = new ProjectService(prisma);
});

test('does not expose the project when the phone is not authorized', async () => {
  prisma.project.findFirst.mockResolvedValueOnce(null);
  const result = await service.getStatusForUser('project-1', {
    userRole: 'citizen',
    userPhone: '+549...',
  });
  expect(result.visible).toBe(false);
});
```

> Note: this project uses **Vitest**, not Jest — `vitest-mock-extended` is
> the equivalent of `jest-mock-extended` for this runner. `vitest-mock-extended`
> isn't installed yet; add it when the first service actually needs a deep
> Prisma mock like the one above.

---

## 4. Strategy Pattern

**What it is.** Defines a family of interchangeable algorithms, selected at
runtime, instead of a growing `if/else` or `switch`.

**Why we need it.** The domain varies by entity type (project type) or by
role (which data aggregation a government official sees vs. a citizen).
Today's one fully-realized example is LLM providers
(`services/orchestrator/src/llm/`):

```typescript
interface ILlmProvider {
  getName(): string;
  generateResponse(/* ... */): Promise<LlmResponse>;
}

class OpenAIProvider implements ILlmProvider {
  /* ... */
}
```

The same shape applies to the target Public Works domain once it's built —
e.g. visibility rules that vary by role:

```typescript
// src/services/visibilityStrategies.ts
interface VisibilityStrategy {
  filterFor(userPhone: string): object; // shape of a Prisma `where`
}

export class CitizenVisibility implements VisibilityStrategy {
  filterFor(userPhone: string) {
    return { authorizedUsers: { some: { phone: userPhone } } };
  }
}

export class OfficialVisibility implements VisibilityStrategy {
  filterFor(userPhone: string) {
    return { agency: { owners: { some: { phone: userPhone } } } };
  }
}

// src/services/projectService.ts
export class ProjectService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly strategyByRole: Record<string, VisibilityStrategy>,
  ) {}

  async getStatusForUser(projectId: string, ctx: UserContext) {
    const strategy = this.strategyByRole[ctx.userRole];
    if (!strategy) return { visible: false }; // unknown role: never "wide open by default"
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, ...strategy.filterFor(ctx.userPhone) },
    });
    return project ? { visible: true, status: project.status } : { visible: false };
  }
}
```

No strategy gets implemented for a role the spec hasn't defined — that would
be guessing a business rule (Clause I). A `Record<string, VisibilityStrategy>`
with no entry for a role is, deliberately, "not visible" by default (fail
closed), never "visible" by default (fail open).

## 5. Factory Pattern

**What it is.** Centralizes construction of a Strategy implementation, so
callers never need to know the full set of concrete classes.

```typescript
class LlmProviderFactory {
  static createDefault(): ILlmProvider {
    const provider = process.env.LLM_PROVIDER;
    switch (provider) {
      case 'openai':
        return new OpenAIProvider(/* ... */);
      // one case per ILlmProvider implementation
    }
  }
}
```

`LlmProviderFactory` is the **only** place in the codebase allowed to know
about every concrete `ILlmProvider`. Everything else depends on the
`ILlmProvider` interface only — without a factory, every caller would need
its own switch statement to pick an implementation, which defeats the point
of Strategy.

**When to add a new factory**: only when there's a real Strategy interface
behind it with more than one implementation, or one imminently planned. A
factory with a single concrete product is over-engineering —
`quality-checker` will flag it, not praise it as "good practice ahead of
time."

---

## Recommended adoption order

You don't need all four/five patterns from day one of a given tool:

1. **Always start with Module Pattern.** It's the basis of folder
   organization (`tools/`, `services/`).
2. **Introduce Service Layer** as soon as a tool starts having more than
   10–15 lines of logic that isn't pure protocol parsing/formatting.
3. **Dependency Injection from the start** in any new service — don't defer
   it "until there are tests," because it's a more expensive refactor later.
4. **Strategy Pattern** when real variation by role or entity type shows up —
   not before, to avoid an abstraction with a single caller (`quality-checker`
   flags that as over-engineering).
5. **Factory Pattern** only once a Strategy interface actually has, or is
   about to have, more than one implementation.

## What `quality-checker` checks here

- Does a tool have business logic inside it instead of delegating to a
  service?
- Is there a `new PrismaClient()` anywhere outside the single composition
  point?
- Does a new service receive its dependencies via constructor, or does it
  create them itself?
- Does an `if`/`switch` on role or entity type already have 3+ branches and
  keep growing — should it be a Strategy instead?
- Does every visibility strategy/filter default to fail-closed, never
  fail-open?

## Where this applies today

- `services/orchestrator/src/llm/` — `ILlmProvider`, `OpenAIProvider`,
  `LlmProviderFactory`. The only fully-realized example of Strategy + Factory
  in the repo right now.
- `services/mcp-server/src/infraestructure/tools/` — Module Pattern (one file
  per tool) is in place; Service Layer + DI is the target shape but there's
  currently a single example tool (`helloWorldTool.ts`) with no real
  dependency to inject yet. Apply Service Layer + DI as soon as a tool
  touches Prisma or any other real dependency — don't wait for a second tool
  to justify it.

See also [`context.md`](./context.md) for the target domain this will apply
to (Projects/Public Works), and [`conventions/architecture.md`](./conventions/architecture.md)
for the folder-level rules these patterns live inside of.
