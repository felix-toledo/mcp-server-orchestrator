// Minimal stand-in for knowledge-store + orchestrator, used only by Playwright
// e2e tests (see playwright.config.ts) so the frontend's UI flows can be
// exercised deterministically, without real Postgres, embeddings, or LLM
// calls. Never used outside `test:e2e`.
import express from 'express';

const app = express();
app.use(express.json());

let user = null;
let entries = [];
let nextId = 1;

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.post('/__reset', (_req, res) => {
  user = null;
  entries = [];
  nextId = 1;
  res.status(204).end();
});

app.post('/users', (req, res) => {
  if (user) {
    res.status(409).json({ error: 'A user already exists' });
    return;
  }
  user = { id: 'u1', ...req.body, createdAt: new Date().toISOString() };
  res.status(201).json(user);
});

app.get('/users/me', (_req, res) => {
  if (!user) {
    res.status(404).json({ error: 'No user yet' });
    return;
  }
  res.status(200).json(user);
});

function toSummary(entry) {
  const { id, path, title, summary, createdAt, updatedAt } = entry;
  return { id, path, title, summary, createdAt, updatedAt };
}

app.post('/knowledge-entries', (req, res) => {
  const now = new Date().toISOString();
  const entry = {
    id: `k${nextId++}`,
    path: `${req.body.title.toLowerCase().replace(/\s+/g, '-')}.md`,
    title: req.body.title,
    content: req.body.content,
    summary: req.body.content.slice(0, 200),
    createdAt: now,
    updatedAt: now,
  };
  entries.push(entry);
  res.status(201).json(toSummary(entry));
});

app.get('/knowledge-entries', (_req, res) => {
  const sorted = [...entries].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  res.status(200).json(sorted.map(toSummary));
});

app.get('/knowledge-entries/:id', (req, res) => {
  const entry = entries.find((e) => e.id === req.params.id);
  if (!entry) {
    res.status(404).json({ error: 'Knowledge entry not found' });
    return;
  }
  res.status(200).json(entry);
});

app.put('/knowledge-entries/:id', (req, res) => {
  const entry = entries.find((e) => e.id === req.params.id);
  if (!entry) {
    res.status(404).json({ error: 'Knowledge entry not found' });
    return;
  }
  entry.content = req.body.content;
  entry.summary = req.body.content.slice(0, 200);
  entry.updatedAt = new Date().toISOString();
  res.status(200).json(toSummary(entry));
});

app.post('/api/inquire', (req, res) => {
  const lastUserMessage = [...req.body.messages].reverse().find((m) => m.role === 'user');
  const text = lastUserMessage?.content ?? '';

  if (/guard|acordate|recordá/i.test(text)) {
    const now = new Date().toISOString();
    const entry = {
      id: `k${nextId++}`,
      path: 'nota-desde-el-chat.md',
      title: 'Nota desde el chat',
      content: text,
      summary: text.slice(0, 200),
      createdAt: now,
      updatedAt: now,
    };
    entries.push(entry);
    res.status(200).json({
      success: true,
      message: { role: 'assistant', content: `Listo, guardé la nota "${entry.title}".` },
    });
    return;
  }

  res.status(200).json({
    success: true,
    message: { role: 'assistant', content: 'Hola, soy ALMA (mock). ¿En qué te ayudo?' },
  });
});

const port = process.env.MOCK_BACKEND_PORT || 40099;
app.listen(port, () => {
  console.log(`mock-backend listening on http://localhost:${port}`);
});
