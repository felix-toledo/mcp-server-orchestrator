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
});

export const UpdateKnowledgeEntryInputSchema = z.object({
  content: z.string().min(1),
});

export const SearchKnowledgeEntriesQuerySchema = z.object({
  q: z.string().min(1),
  limit: z.coerce.number().int().min(1).max(5).default(5),
});

export type CreateUserInput = z.infer<typeof CreateUserInputSchema>;
export type CreateKnowledgeEntryInput = z.infer<typeof CreateKnowledgeEntryInputSchema>;
export type UpdateKnowledgeEntryInput = z.infer<typeof UpdateKnowledgeEntryInputSchema>;
export type SearchKnowledgeEntriesQuery = z.infer<typeof SearchKnowledgeEntriesQuerySchema>;
