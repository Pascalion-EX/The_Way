import assert from "node:assert/strict";
import { test } from "node:test";
import { layoutCurriculum, NODE_HEIGHT, NODE_WIDTH } from "../src/utils/curriculumLayout.js";

test("an empty curriculum has a visible root inside the canvas", () => {
  const { positions, width, height } = layoutCurriculum([{ id: "root" }], []);
  assert.ok(positions.root.x >= 0);
  assert.ok(positions.root.y >= 0);
  assert.ok(width >= positions.root.x + NODE_WIDTH);
  assert.ok(height >= positions.root.y + NODE_HEIGHT);
});

test("uneven branches have no overlapping nodes and keep parents above their children", () => {
  const ids = ["root", "a", "b", "a1", "a2", "a3", "b1", "b2", "deep"];
  const edges = [
    ["root", "a"], ["root", "b"], ["a", "a1"], ["a", "a2"],
    ["a", "a3"], ["b", "b1"], ["b", "b2"], ["a2", "deep"],
  ].map(([source, target]) => ({ source, target }));
  const { positions, width, height } = layoutCurriculum(ids.reverse().map((id) => ({ id })), edges);
  assert.equal(Object.keys(positions).length, ids.length);
  for (const { source, target } of edges) {
    assert.ok(positions[source].y + NODE_HEIGHT < positions[target].y);
  }
  for (const [index, a] of Object.values(positions).entries()) {
    assert.ok(a.x >= 0 && a.x + NODE_WIDTH <= width);
    assert.ok(a.y >= 0 && a.y + NODE_HEIGHT <= height);
    for (const b of Object.values(positions).slice(index + 1)) {
      const overlapX = a.x < b.x + NODE_WIDTH && b.x < a.x + NODE_WIDTH;
      const overlapY = a.y < b.y + NODE_HEIGHT && b.y < a.y + NODE_HEIGHT;
      assert.equal(overlapX && overlapY, false);
    }
  }
  assert.ok(positions.root.x > positions.a.x && positions.root.x < positions.b.x);
});

test("long lesson paths can be laid out without recursive stack overflow", () => {
  const nodes = [{ id: "root" }, ...Array.from({ length: 10000 }, (_, index) => ({ id: `lesson-${index}` }))];
  const edges = nodes.slice(1).map((node, index) => ({ source: nodes[index].id, target: node.id }));
  const { positions } = layoutCurriculum(nodes, edges);
  assert.equal(Object.keys(positions).length, nodes.length);
  assert.equal(positions["lesson-9999"].x, positions.root.x);
  assert.ok(positions["lesson-9999"].y > positions["lesson-9998"].y);
});
