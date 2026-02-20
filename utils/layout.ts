import * as d3 from 'd3';
import { TreeNode } from '../types';

export interface HierarchyDatum {
  id: string;
  details: TreeNode;
}

export type LayoutNode = d3.HierarchyPointNode<HierarchyDatum>;

export const calculateTreeLayout = (
  treeData: Record<string, TreeNode>, 
  viewportWidth: number, 
  viewportHeight: number
): { nodes: LayoutNode[], links: d3.HierarchyPointLink<HierarchyDatum>[] } => {
  
  if (!treeData || Object.keys(treeData).length === 0) {
    return { nodes: [], links: [] };
  }

  const keys = Object.keys(treeData);

  // Robust check for root: p is null, "null", undefined, OR p points to itself (weird edge case)
  let rootId = keys.find(id => {
      const p = treeData[id].p;
      return p === null || p === "null" || p === undefined;
  });

  // Fallback: If no null-parent found, check if any node is NOT pointed to by others (the source)
  if (!rootId) {
      const allParents = new Set(keys.map(k => treeData[k].p).filter(p => p && p !== "null"));
      rootId = keys.find(k => !allParents.has(k));
  }

  // Hard Fallback: Just take the first key
  if (!rootId) {
    console.warn("Visualizer: No explicit root found. Defaulting to first node.");
    rootId = keys[0];
  }

  // Sanitize the root's parent pointer to ensure D3 doesn't loop
  if (treeData[rootId]) {
      treeData[rootId].p = null;
  }

  // Helper to create node structure
  const createHierarchyNode = (id: string) => ({
    id,
    details: treeData[id],
    children: [] as any[]
  });

  const rootNode = createHierarchyNode(rootId);
  const map = new Map<string, any>();
  map.set(rootId, rootNode);

  // First pass: create all node objects
  keys.forEach(id => {
    if (id !== rootId) {
      map.set(id, createHierarchyNode(id));
    }
  });

  // Second pass: link children
  keys.forEach(id => {
    if (id === rootId) return;
    
    const node = treeData[id];
    let parentId = node.p;
    
    // Normalize parent ID
    if (parentId === "null") parentId = null;

    if (parentId && map.has(parentId)) {
      const parent = map.get(parentId);
      const current = map.get(id);
      // Avoid cycles: check if current is already an ancestor of parent (unlikely but safe)
      parent.children.push(current);
    } 
  });

  const root = d3.hierarchy<HierarchyDatum>(rootNode as unknown as HierarchyDatum);
  
  // Layout Configuration
  const NODE_SIZE_X = 260; 
  const LEVEL_HEIGHT = 130; 

  const leafCount = root.leaves().length;
  const depth = root.height; 

  const treeWidth = Math.max(viewportWidth, leafCount * NODE_SIZE_X);
  const treeHeight = Math.max(viewportHeight, (depth + 1) * LEVEL_HEIGHT); 
  
  const treeLayout = d3.tree<HierarchyDatum>().size([treeWidth, treeHeight]); 
  
  const layoutRoot = treeLayout(root);

  return {
    nodes: layoutRoot.descendants(),
    links: layoutRoot.links()
  };
};