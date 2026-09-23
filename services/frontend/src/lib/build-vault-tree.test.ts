import { describe, expect, it } from 'vitest';
import { buildVaultTree } from './build-vault-tree';
import type { KnowledgeEntrySummary, VaultFolder } from './knowledge-store-client';

function folder(overrides: Partial<VaultFolder> = {}): VaultFolder {
  return { id: 'f1', path: 'proyectos', parentId: null, summary: '', ...overrides };
}

function entry(overrides: Partial<KnowledgeEntrySummary> = {}): KnowledgeEntrySummary {
  return { id: 'k1', path: 'nota.md', title: 'Nota', summary: '', folderId: null, updatedAt: '', ...overrides };
}

describe('buildVaultTree', () => {
  it('returns an empty tree for an empty vault', () => {
    expect(buildVaultTree([], [])).toEqual([]);
  });

  it('places root-level notes and folders at the top', () => {
    const tree = buildVaultTree([folder({ id: 'f1', path: 'proyectos' })], [entry({ id: 'k1', title: 'Suelta' })]);

    expect(tree).toHaveLength(2);
    expect(tree.find((n) => n.type === 'folder')?.name).toBe('proyectos');
    expect(tree.find((n) => n.type === 'note')?.name).toBe('Suelta');
  });

  it('nests a note inside its folder', () => {
    const tree = buildVaultTree(
      [folder({ id: 'f1', path: 'proyectos' })],
      [entry({ id: 'k1', title: 'Idea', folderId: 'f1' })],
    );

    expect(tree).toHaveLength(1);
    expect(tree[0].children).toEqual([{ type: 'note', id: 'k1', name: 'Idea' }]);
  });

  it('nests folders multiple levels deep, using the last path segment as the name', () => {
    const tree = buildVaultTree(
      [
        folder({ id: 'f1', path: 'proyectos', parentId: null }),
        folder({ id: 'f2', path: 'proyectos/tfg', parentId: 'f1' }),
      ],
      [entry({ id: 'k1', title: 'Idea', folderId: 'f2' })],
    );

    expect(tree).toHaveLength(1);
    expect(tree[0].name).toBe('proyectos');
    expect(tree[0].children?.[0].name).toBe('tfg');
    expect(tree[0].children?.[0].children).toEqual([{ type: 'note', id: 'k1', name: 'Idea' }]);
  });
});
