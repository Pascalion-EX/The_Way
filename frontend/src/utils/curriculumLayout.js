export const NODE_WIDTH = 220;
export const NODE_HEIGHT = 100;
const GAP_X = 52;
const GAP_Y = 88;
const MARGIN = 60;

// Lay out siblings in separate columns and center parents over their children.
export const layoutCurriculum = (nodes, edges, rootId = "root") => {
  const children = new Map(nodes.map((node) => [node.id, []]));
  for (const edge of edges) children.get(edge.source)?.push(edge.target);
  const order = [];
  const depth = new Map([[rootId, 0]]);
  const pending = [rootId];
  while (pending.length) {
    const id = pending.pop();
    order.push(id);
    for (const child of children.get(id) || []) {
      if (depth.has(child)) continue;
      depth.set(child, depth.get(id) + 1);
      pending.push(child);
    }
  }
  const widths = new Map();
  for (const id of [...order].reverse()) {
    const descendants = children.get(id) || [];
    widths.set(id, Math.max(1, descendants.reduce((sum, child) => sum + (widths.get(child) || 1), 0)));
  }
  const positions = {};
  const starts = new Map([[rootId, 0]]);
  for (const id of order) {
    const start = starts.get(id);
    positions[id] = {
      x: MARGIN + (start + (widths.get(id) - 1) / 2) * (NODE_WIDTH + GAP_X),
      y: MARGIN + depth.get(id) * (NODE_HEIGHT + GAP_Y),
    };
    let cursor = start;
    for (const child of children.get(id) || []) {
      starts.set(child, cursor);
      cursor += widths.get(child) || 1;
    }
  }
  return {
    positions,
    width: MARGIN * 2 + (widths.get(rootId) || 1) * (NODE_WIDTH + GAP_X) - GAP_X,
    height: MARGIN * 2 + Math.max(0, ...depth.values()) * (NODE_HEIGHT + GAP_Y) + NODE_HEIGHT,
  };
};
