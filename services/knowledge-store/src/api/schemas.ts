import { z } from 'zod';

export const PurposeSchema = z.enum([
  'PERSONAL_DAILY',
  'AUTOMATION_PRODUCTIVITY',
  'PROJECTS_WORK',
  'SECOND_BRAIN_STUDY',
  'TEAM_BUSINESS',
]);

export const CreateUserInputSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  purpose: PurposeSchema,
});

export const CreateKnowledgeEntryInputSchema = z.object({
  title: z.string().min(1),
  content: z.string().min(1),
  tags: z.array(z.string()).optional(),
  folderPath: z.string().min(1).optional(),
});

export const CreateVaultFolderInputSchema = z.object({
  path: z.string().min(1),
});

export const UpdateKnowledgeEntryInputSchema = z.object({
  content: z.string().min(1),
});

export const SearchKnowledgeEntriesQuerySchema = z.object({
  q: z.string().min(1),
  // Max raised 5 → 20 for orchestrator/001-reasoning-pipeline's RAG-top-20
  // fetch (spec §5) — the original 5-item cap was 002-retrieval's own
  // default before the reranker existed to narrow a wider candidate set.
  limit: z.coerce.number().int().min(1).max(20).default(5),
});

export const AppendChatMessageInputSchema = z.object({
  role: z.enum(['USER', 'ASSISTANT', 'TOOL']),
  content: z.string().min(1),
});

// orchestrator/003-teams team-chat amendment — omitted/undefined means a
// regular main-chat session, same "absent means default" shape already used
// by AgentInputSchema above.
export const CreateChatSessionInputSchema = z.object({
  teamId: z.string().min(1).optional(),
});

// orchestrator/002-multi-agent AC1 — omitting a field means "inherit
// everything" (mapped to null in AgentService); an explicit [] means "none."
// .nullable() alone isn't enough since the field can also be absent entirely.
export const AgentInputSchema = z.object({
  name: z.string().min(1),
  systemPromptAddendum: z.string().min(1),
  allowedTools: z.array(z.string()).nullable().optional(),
  allowedSkills: z.array(z.string()).nullable().optional(),
  pipelineSteps: z.array(z.string()).nullable().optional(),
});

export type CreateUserInput = z.infer<typeof CreateUserInputSchema>;
export type CreateKnowledgeEntryInput = z.infer<typeof CreateKnowledgeEntryInputSchema>;
export type UpdateKnowledgeEntryInput = z.infer<typeof UpdateKnowledgeEntryInputSchema>;
export type SearchKnowledgeEntriesQuery = z.infer<typeof SearchKnowledgeEntriesQuerySchema>;
export type AppendChatMessageInput = z.infer<typeof AppendChatMessageInputSchema>;
export type CreateChatSessionInput = z.infer<typeof CreateChatSessionInputSchema>;
export const SkillInputSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  instructions: z.string().min(1),
});

export const HierarchyEntrySchema = z.object({
  agentId: z.string().min(1),
  managerAgentId: z.string().min(1).nullable(),
});

export const TeamInputSchema = z.object({
  name: z.string().min(1),
  memberAgentIds: z.array(z.string()).min(1),
  coordinatorAgentId: z.string().min(1),
  projectFolderIds: z.array(z.string()),
  allowedSkillIds: z.array(z.string()).nullable().optional(),
  // orchestrator/003-teams §3 amendment — optional org chart. null/omitted
  // = full mesh (every member sees every other), the original default.
  hierarchy: z.array(HierarchyEntrySchema).nullable().optional(),
});

export const UpsertTelegramLinkInputSchema = z.object({
  botToken: z.string().min(1),
  // telegram-bot/001-channel amendment (2026-09-17) — AC2's first-contact
  // binding is superseded by an explicit allowlist; empty/omitted means
  // fail-closed (nobody gets bound) until at least one is configured.
  allowedUsernames: z.array(z.string()).optional(),
});

export const UpdateTelegramLinkBindingInputSchema = z.object({
  chatId: z.string().min(1).optional(),
  currentSessionId: z.string().min(1).optional(),
  // Settings UX fix (2026-09-17) — lets the allowlist be edited without
  // re-sending the bot token (the frontend never has it to resend anyway;
  // /status deliberately never exposes it).
  allowedUsernames: z.array(z.string()).optional(),
});

// voice-assistant/001-wake-word-channel §5.3 — the §4 shared-session
// pointer, PATCH /voice-profile's only writable field this round.
export const UpdateVoiceProfileInputSchema = z.object({
  currentSessionId: z.string().min(1),
});

// Settings > Voz's engine/voice picker — PATCH /voice-profile/tts-preference.
// ttsVoiceId is required for ELEVENLABS (an ElevenLabs voice_id) and must be
// absent/null for KOKORO — enforced with `superRefine` since it depends on
// the sibling field, not expressible as a plain per-field rule.
export const UpdateTtsPreferenceInputSchema = z
  .object({
    ttsEngine: z.enum(['KOKORO', 'ELEVENLABS']),
    ttsVoiceId: z.string().min(1).nullable().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.ttsEngine === 'ELEVENLABS' && !value.ttsVoiceId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'ttsVoiceId is required when ttsEngine is ELEVENLABS',
        path: ['ttsVoiceId'],
      });
    }
  });

export type CreateVaultFolderInput = z.infer<typeof CreateVaultFolderInputSchema>;
export type AgentInput = z.infer<typeof AgentInputSchema>;
export type SkillInput = z.infer<typeof SkillInputSchema>;
export type TeamInput = z.infer<typeof TeamInputSchema>;
export type HierarchyEntry = z.infer<typeof HierarchyEntrySchema>;
export type UpsertTelegramLinkInput = z.infer<typeof UpsertTelegramLinkInputSchema>;
export type UpdateTelegramLinkBindingInput = z.infer<typeof UpdateTelegramLinkBindingInputSchema>;
export type UpdateVoiceProfileInput = z.infer<typeof UpdateVoiceProfileInputSchema>;
export type UpdateTtsPreferenceInput = z.infer<typeof UpdateTtsPreferenceInputSchema>;
