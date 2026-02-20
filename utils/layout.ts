import * as d3 from "d3";
import { TreeNode } from "../types";

export interface HierarchyDatum {
  id: string;
  details: TreeNode;
}

export type LayoutNode = d3.HierarchyPointNode<HierarchyDatum>;

export const calculateTreeLayout = (
  treeData: Record<string, TreeNode>,
  viewportWidth: number,
  viewportHeight: number,
): { nodes: LayoutNode[]; links: d3.HierarchyPointLink<HierarchyDatum>[] } => {
  if (!treeData || Object.keys(treeData).length === 0) {
    return { nodes: [], links: [] };
  }

  const keys = Object.keys(treeData);

  // Identify all valid nodes.
  // We'll treat ANY node that has no valid parent in the tree as a "root" of its own subtree.
  const roots: string[] = [];
  const validParents = new Set(keys);

  keys.forEach((id) => {
    const p = treeData[id].p;
    // It's a root if p is explictly null/undefined, OR if its parent doesn't exist in the data (hallucination)
    // Filter out obvious noise like printf/malloc hallucinated nodes that shouldn't start their own massive tree
    const isLibraryFunc =
      treeData[id].l.toLowerCase().includes("printf") ||
      treeData[id].l.toLowerCase().includes("malloc");
    if (
      (p === null || p === "null" || p === undefined || !validParents.has(p)) &&
      !isLibraryFunc
    ) {
      roots.push(id);
    }
  });

  // Fallback if absolutely everything is broken
  if (roots.length === 0) {
    roots.push(keys[0]);
  }

  // Define our invisible super root
  const SUPER_ROOT_ID = "__SUPER_ROOT__";

  const createHierarchyNode = (id: string, isSuper = false) => ({
    id,
    details: isSuper
      ? ({
          l: "SUPER",
          p: null,
          level: -1,
          children: roots,
          type: "standard",
        } as TreeNode)
      : treeData[id],
    children: [] as any[],
  });

  const map = new Map<string, any>();
  const superRootNode = createHierarchyNode(SUPER_ROOT_ID, true);
  map.set(SUPER_ROOT_ID, superRootNode);

  // Create objects for all real nodes
  keys.forEach((id) => {
    map.set(id, createHierarchyNode(id));
  });

  // Link children (Real nodes)
  keys.forEach((id) => {
    const node = treeData[id];
    let parentId = node.p;
    if (parentId === "null") parentId = null;

    if (parentId && map.has(parentId)) {
      const parent = map.get(parentId);
      const current = map.get(id);
      // Ensure we don't accidentally push roots into their own children or something weird
      if (!roots.includes(id)) {
        parent.children.push(current);
      }
    }
  });

  // Attach all logical roots to the super root
  roots.forEach((rId) => {
    superRootNode.children.push(map.get(rId));
  });

  const root = d3.hierarchy<HierarchyDatum>(
    superRootNode as unknown as HierarchyDatum,
  );

  // Layout Configuration
  // Increase gap for forest layout visually
  const NODE_SIZE_X = 260;
  const LEVEL_HEIGHT = 130;

  const leafCount = root.leaves().length;
  const depth = root.height;

  const treeWidth = Math.max(viewportWidth, leafCount * NODE_SIZE_X * 1.2);
  const treeHeight = Math.max(viewportHeight, depth * LEVEL_HEIGHT);

  const treeLayout = d3.tree<HierarchyDatum>().size([treeWidth, treeHeight]);
  const layoutRoot = treeLayout(root);

  // Extract descendants and links, but FILTER OUT the super root
  let finalNodes = layoutRoot
    .descendants()
    .filter((n) => n.data.id !== SUPER_ROOT_ID);

  // The layout links will contain links *from* super root. Filter those out too.
  let finalLinks = layoutRoot
    .links()
    .filter((l) => l.source.data.id !== SUPER_ROOT_ID);

  // Shift everything UP by LEVEL_HEIGHT so the real roots start at y=0 instead of y=130
  finalNodes.forEach((n) => {
    n.y = Math.max(0, n.y - LEVEL_HEIGHT);
  });

  return {
    nodes: finalNodes,
    links: finalLinks,
  };
};
