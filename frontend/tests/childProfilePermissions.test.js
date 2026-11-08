import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { setImmediate } from "node:timers/promises";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import { transformWithEsbuild } from "vite";
import * as permissions from "../../shared/pageAccess.mjs";

const source = await readFile(new URL("../src/Pages/ChildProfile.jsx", import.meta.url), "utf8");
const { code } = await transformWithEsbuild(source, "ChildProfile.jsx", { loader: "jsx", format: "cjs", jsx: "automatic" });
const nodeText = (node) => Array.isArray(node) ? node.map(nodeText).join("") :
  node == null || typeof node === "boolean" ? "" : typeof node !== "object" ? String(node) : nodeText(node.props?.children);
const find = (node, predicate) => {
  if (!node || typeof node !== "object") return null;
  if (Array.isArray(node)) return node.map((child) => find(child, predicate)).find(Boolean) || null;
  return predicate(node) ? node : find(node.props?.children, predicate);
};

async function mountPage(roles) {
  const values = [];
  const effects = [];
  const pending = [];
  const saves = [];
  const deletions = [];
  const child = { _id: "child-id", name: "Existing child", grade: 2, firstParent: "Existing parent" };
  let cursor = 0;
  let tree;
  const jsx = (type, props) => ({ type, props });
  const module = { exports: {} };
  const save = (method) => async (url, body) => {
    saves.push({ method, url, body: JSON.parse(JSON.stringify(body)) });
    return { data: { success: true, message: "Child saved" } };
  };
  runInNewContext(code, {
    module,
    console,
    window: { confirm: () => true },
    require(specifier) {
      if (specifier === "react/jsx-runtime") return { jsx, jsxs: jsx };
      if (specifier === "react") return {
        useContext: () => ({ backendUrl: "", userData: { role: roles, name: "Current user", phone: "123", job: "Teacher" } }),
        useState(initial) {
          const index = cursor++;
          if (!(index in values)) values[index] = initial;
          return [values[index], (next) => { values[index] = typeof next === "function" ? next(values[index]) : next; }];
        },
        useMemo: (callback) => callback(),
        useCallback: (callback) => callback,
        useEffect(callback) {
          const index = cursor++;
          if (!effects[index]) {
            effects[index] = true;
            pending.push(callback);
          }
        },
      };
      if (specifier.includes("AppContent")) return { AppContent: {} };
      if (specifier.includes("pageAccess")) return permissions;
      if (specifier.includes("Navbar")) return () => null;
      if (specifier === "lucide-react") return Object.fromEntries(
        ["AlertTriangle", "BriefcaseBusiness", "Loader2", "MapPin", "Pencil", "Phone", "Plus", "Save", "Search", "Trash2", "UserRound", "Users", "X"].map((name) => [name, "svg"])
      );
      if (specifier === "react-toastify") return { toast: { success() {}, error(message) { assert.fail(message); } } };
      if (specifier.includes("axios")) return {
        get: async () => ({ data: { success: true, children: [child] } }),
        post: save("POST"), put: save("PUT"),
        delete: async (url) => { deletions.push(url); return { data: { success: true } }; },
      };
      throw new Error(`Unexpected import: ${specifier}`);
    },
  });
  const expand = (node) => {
    if (!node || typeof node !== "object") return node;
    if (Array.isArray(node)) return node.map(expand);
    if (typeof node.type === "function") return expand(node.type(node.props));
    return { ...node, props: { ...node.props, children: expand(node.props?.children) } };
  };
  const render = () => {
    cursor = 0;
    tree = expand(module.exports.default());
    pending.splice(0).forEach((callback) => callback());
  };
  render();
  await setImmediate();
  render();
  return {
    saves, deletions, render,
    button(label) { return find(tree, (node) => node.type === "button" && nodeText(node).trim() === label); },
    field(name) { return find(tree, (node) => node.props?.name === name); },
    submit() { return find(tree, (node) => node.type === "form").props.onSubmit({ preventDefault() {} }); },
  };
}

test("leaders can create and edit child profiles without a Delete action", async () => {
  for (const roles of [["leader"], ["parent", "leader"]]) {
    const page = await mountPage(roles);
    assert.ok(page.button("Add Child"));
    assert.ok(page.button("Edit"));
    assert.equal(page.button("Delete"), null);

    page.button("Add Child").props.onClick(); page.render();
    assert.equal(page.field("firstParent").props.value, "");
    page.field("name").props.onChange({ target: { name: "name", value: "New child" } });
    page.field("grade").props.onChange({ target: { name: "grade", value: "3" } });
    page.render();
    await page.submit(); page.render();
    assert.equal(page.saves[0].method, "POST");
    assert.equal(page.saves[0].url, "/api/children");
    assert.equal(page.saves[0].body.name, "New child");
    assert.equal(page.saves[0].body.grade, 3);

    page.button("Edit").props.onClick(); page.render();
    assert.equal(page.field("name").props.value, "Existing child");
    page.field("name").props.onChange({ target: { name: "name", value: "Edited child" } });
    page.render();
    await page.submit(); page.render();
    assert.equal(page.saves[1].method, "PUT");
    assert.equal(page.saves[1].url, "/api/children/child-id");
    assert.equal(page.saves[1].body.name, "Edited child");
    assert.deepEqual(page.deletions, []);
  }
});

test("parents retain creation only while admins, Pascal, and Pamela have edit and delete controls", async () => {
  const parent = await mountPage(["parent"]);
  assert.ok(parent.button("Add Child"));
  assert.equal(parent.button("Edit"), null);
  assert.equal(parent.button("Delete"), null);
  parent.button("Add Child").props.onClick(); parent.render();
  assert.equal(parent.field("firstParent").props.value, "Current user");

  for (const roles of [["admin"], ["pascal"], ["pamela"], ["parent", "admin"], ["leader", "admin"], ["leader", "pamela"]]) {
    const page = await mountPage(roles);
    assert.ok(page.button("Add Child"));
    assert.ok(page.button("Edit"));
    assert.ok(page.button("Delete"));
    await page.button("Delete").props.onClick();
    assert.deepEqual(page.deletions, ["/api/children/child-id"]);
  }
});
