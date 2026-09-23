'use client';

import { useState } from 'react';
import type { TreeNode } from '../../lib/build-vault-tree';

function TreeNodeRow({
  node,
  depth,
  selectedEntryId,
  currentFolderId,
  onSelectEntry,
  onSelectFolder,
  onDeleteFolder,
}: {
  node: TreeNode;
  depth: number;
  selectedEntryId: string | null;
  currentFolderId: string | null;
  onSelectEntry: (id: string) => void;
  onSelectFolder: (id: string) => void;
  onDeleteFolder: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const indent = { paddingLeft: `${depth * 14 + 10}px` };

  if (node.type === 'note') {
    return (
      <li>
        <button
          type="button"
          className={`vault-tree__item ${node.id === selectedEntryId ? 'vault-tree__item--active' : ''}`}
          style={indent}
          onClick={() => onSelectEntry(node.id)}
        >
          {node.name}
        </button>
      </li>
    );
  }

  return (
    <li>
      <div
        className={`vault-tree__folder ${node.id === currentFolderId ? 'vault-tree__folder--active' : ''}`}
        style={indent}
      >
        <button
          type="button"
          className="vault-tree__folder-toggle"
          onClick={() => {
            setExpanded((prev) => !prev);
            onSelectFolder(node.id);
          }}
        >
          {expanded ? '▾' : '▸'} {node.name}
        </button>
        <button type="button" className="vault-tree__delete" aria-label={`Borrar carpeta ${node.name}`} onClick={() => onDeleteFolder(node.id)}>
          ×
        </button>
      </div>
      {expanded && node.children && node.children.length > 0 && (
        <ul className="vault-tree__children">
          {node.children.map((child) => (
            <TreeNodeRow
              key={child.id}
              node={child}
              depth={depth + 1}
              selectedEntryId={selectedEntryId}
              currentFolderId={currentFolderId}
              onSelectEntry={onSelectEntry}
              onSelectFolder={onSelectFolder}
              onDeleteFolder={onDeleteFolder}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

export function VaultTree({
  tree,
  selectedEntryId,
  currentFolderId,
  onSelectEntry,
  onSelectFolder,
  onDeleteFolder,
}: {
  tree: TreeNode[];
  selectedEntryId: string | null;
  currentFolderId: string | null;
  onSelectEntry: (id: string) => void;
  onSelectFolder: (id: string) => void;
  onDeleteFolder: (id: string) => void;
}) {
  if (tree.length === 0) {
    return <p className="vault-tree__empty">Todavía no hay nada en tu bóveda.</p>;
  }

  return (
    <ul className="vault-tree">
      {tree.map((node) => (
        <TreeNodeRow
          key={node.id}
          node={node}
          depth={0}
          selectedEntryId={selectedEntryId}
          currentFolderId={currentFolderId}
          onSelectEntry={onSelectEntry}
          onSelectFolder={onSelectFolder}
          onDeleteFolder={onDeleteFolder}
        />
      ))}
    </ul>
  );
}
