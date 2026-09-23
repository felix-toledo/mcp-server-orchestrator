'use server';

import { knowledgeStoreClient, type VaultFolder } from '../lib/knowledge-store-client';

export async function createVaultFolder(path: string): Promise<VaultFolder> {
  return knowledgeStoreClient.createVaultFolder(path);
}
