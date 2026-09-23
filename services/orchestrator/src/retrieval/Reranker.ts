import { AutoModelForSequenceClassification, AutoTokenizer, type PreTrainedModel, type PreTrainedTokenizer } from '@huggingface/transformers';
import type { SearchKnowledgeEntriesResult } from '../mcp/searchKnowledgeEntriesResult.js';

export interface RerankedResult extends SearchKnowledgeEntriesResult {
  score: number;
}

export interface Reranker {
  rerank(query: string, candidates: SearchKnowledgeEntriesResult[], topK: number): Promise<RerankedResult[]>;
}

const DEFAULT_MODEL = 'Xenova/ms-marco-MiniLM-L-6-v2';

// Calibrated against real vault data (spec 001-reasoning-pipeline §7.1): a
// genuinely relevant note scored ~0.997, unrelated ones ~0.0016/~0.00001 —
// 0.5 sits with real margin on both sides. Below this bar, a candidate is
// dropped entirely (AC3), not just deprioritized.
const MINIMUM_SCORE = 0.5;

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

/**
 * Local, in-process cross-encoder reranker (orchestrator/001-reasoning-pipeline
 * §7.4 — reasoning-pipeline concern, not knowledge-store's).
 *
 * Uses the raw model + tokenizer, not the `pipeline('text-classification',
 * ...)` wrapper — found during implementation: this model has a single
 * regression output (a raw MS-MARCO relevance logit), and the pipeline
 * wrapper unconditionally softmaxes its output as if it were a multi-class
 * classifier. `softmax` of one value is always exactly `1`, which made
 * every candidate score identically "1.0" regardless of actual relevance —
 * confirmed empirically before switching to this approach. The raw logit,
 * sigmoid-normalized to (0, 1), gives real separation (e.g. a genuinely
 * relevant note scored ~0.997 vs. ~0.001 for an unrelated one in a real
 * test against this vault's data).
 */
export class TransformersJsReranker implements Reranker {
  private modelPromise: Promise<{ tokenizer: PreTrainedTokenizer; model: PreTrainedModel }> | null = null;

  constructor(private readonly modelName: string = DEFAULT_MODEL) {}

  private async load(): Promise<{ tokenizer: PreTrainedTokenizer; model: PreTrainedModel }> {
    if (!this.modelPromise) {
      this.modelPromise = Promise.all([
        AutoTokenizer.from_pretrained(this.modelName),
        AutoModelForSequenceClassification.from_pretrained(this.modelName),
      ]).then(([tokenizer, model]) => ({ tokenizer, model }));
    }
    return this.modelPromise;
  }

  async rerank(
    query: string,
    candidates: SearchKnowledgeEntriesResult[],
    topK: number,
  ): Promise<RerankedResult[]> {
    if (candidates.length === 0) {
      return [];
    }

    const { tokenizer, model } = await this.load();
    const scored: RerankedResult[] = [];

    for (const candidate of candidates) {
      const text = `${candidate.title}: ${candidate.summary}`;
      const inputs = tokenizer(query, { text_pair: text, padding: true, truncation: true });
      const { logits } = await model(inputs);
      const score = sigmoid(logits.data[0] as number);
      scored.push({ ...candidate, score });
    }

    return scored
      .filter((c) => c.score >= MINIMUM_SCORE)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }
}
