'use server';

import { knowledgeStoreClient, type VaultFolder } from '../lib/knowledge-store-client';

export async function listVaultFolders(): Promise<VaultFolder[]> {
  return knowledgeStoreClient.listVaultFolders();
}
