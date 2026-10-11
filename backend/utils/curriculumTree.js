export const CURRICULUM_ROOT_ID = "root";

// Each lesson has one parent. Following every parent chain must reach the root.
export const validateCurriculumTree = (nodes) => {
  if (!Array.isArray(nodes)) return "Nodes must be an array";

  const parents = new Map();
  for (const node of nodes) {
    if (typeof node?.id !== "string" || !node.id.trim() || node.id !== node.id.trim()) {
      return "Each node needs a non-empty string id without surrounding whitespace";
    }
    if (node.id === CURRICULUM_ROOT_ID || parents.has(node.id)) {
      return "Node ids must be unique and cannot be root";
    }
    if (typeof node.parentId !== "string" || !node.parentId.trim()) {
      return "Each lesson node needs a parentId";
    }
    parents.set(node.id, node.parentId);
  }

  const connected = new Set([CURRICULUM_ROOT_ID]);
  for (const id of parents.keys()) {
    const path = new Set();
    let current = id;
    while (!connected.has(current)) {
      if (path.has(current)) return "Curriculum nodes cannot contain cycles";
      if (!parents.has(current)) return "Every parentId must reference root or another curriculum node";
      path.add(current);
      current = parents.get(current);
    }
    for (const visited of path) connected.add(visited);
  }

  return null;
};

export const curriculumGraph = (curriculum) => ({
  rootId: CURRICULUM_ROOT_ID,
  nodes: [
    { id: CURRICULUM_ROOT_ID, type: "root", label: curriculum.name },
    ...curriculum.nodes.map((node) => ({
      id: node.id,
      type: "lesson",
      label: node.lesson?.title || "Unavailable lesson",
      lesson: node.lesson,
    })),
  ],
  edges: curriculum.nodes.map((node) => ({
    source: node.parentId,
    target: node.id,
  })),
});
