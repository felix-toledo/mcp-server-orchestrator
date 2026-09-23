import type { KnowledgeEntrySummary, VaultFolder } from './knowledge-store-client';

export interface TreeNode {
  type: 'folder' | 'note';
  id: string;
  name: string;
  children?: TreeNode[];
}

function lastSegment(path: string): string {
  const segments = path.split('/').filter(Boolean);
  return segments[segments.length - 1] ?? path;
}

export function buildVaultTree(folders: VaultFolder[], entries: KnowledgeEntrySummary[]): TreeNode[] {
  const folderNodes = new Map<string, TreeNode>();
  for (const folder of folders) {
    folderNodes.set(folder.id, { type: 'folder', id: folder.id, name: lastSegment(folder.path), children: [] });
  }

  const roots: TreeNode[] = [];

  for (const folder of folders) {
    const node = folderNodes.get(folder.id)!;
    if (folder.parentId && folderNodes.has(folder.parentId)) {
      folderNodes.get(folder.parentId)!.children!.push(node);
    } else {
      roots.push(node);
    }
  }

  for (const entry of entries) {
    const node: TreeNode = { type: 'note', id: entry.id, name: entry.title };
    if (entry.folderId && folderNodes.has(entry.folderId)) {
      folderNodes.get(entry.folderId)!.children!.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}
