import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { setImmediate } from "node:timers/promises";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import { transformWithEsbuild } from "vite";

const source = await readFile(new URL("../src/Pages/Attendance.jsx", import.meta.url), "utf8");
const { code } = await transformWithEsbuild(source, "Attendance.jsx", { loader: "jsx", format: "cjs", jsx: "automatic" });
const roster = [
  { _id: "year-3-child", name: "Year 3 child", grade: 3 },
  { _id: "year-4-child", name: "Year 4 child", grade: 4 },
];
const nodeText = (node) => Array.isArray(node) ? node.map(nodeText).join("") :
  node == null || typeof node === "boolean" ? "" : typeof node !== "object" ? String(node) : nodeText(node.props?.children);
const find = (node, predicate) => {
  if (!node || typeof node !== "object") return null;
  if (Array.isArray(node)) return node.map((child) => find(child, predicate)).find(Boolean) || null;
  return predicate(node) ? node : find(node.props?.children, predicate);
};

async function mountPage({ roles = ["leader"], access = { allClasses: false, grade: 3 }, denied = false } = {}) {
  const values = [];
  const effects = [];
  const pending = [];
  const saves = [];
  const errors = [];
  const children = access.allClasses ? roster : roster.filter((child) => child.grade === access.grade);
  let cursor = 0;
  let tree;
  const jsx = (type, props) => ({ type, props });
  const module = { exports: {} };
  runInNewContext(code, {
    module,
    console: { error() {} },
    require(specifier) {
      if (specifier === "react/jsx-runtime") return { jsx, jsxs: jsx };
      if (specifier === "react") return {
        useContext: () => ({ backendUrl: "", userData: { role: roles, class: denied ? 0 : 3 } }),
        useState(initial) {
          const index = cursor++;
          if (!(index in values)) values[index] = typeof initial === "function" ? initial() : initial;
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
      if (specifier.includes("Navbar")) return () => null;
      if (specifier === "lucide-react") return Object.fromEntries(
        ["CalendarDays", "CheckCircle2", "Clock3", "Loader2", "Save", "Search", "Users", "XCircle", "CircleHelp"].map((name) => [name, "svg"])
      );
      if (specifier === "react-toastify") return { toast: { success() {}, error(message) { errors.push(message); } } };
      if (specifier === "axios") return {
        get: async (url) => {
          if (denied) throw Object.assign(new Error("Assigned year required"), {
            response: { data: { message: "You need an assigned year to take attendance." } },
          });
          return { data: url.endsWith("/children") ? { children, access } : {
            // Include an unrelated record to verify it cannot enter a leader's saved attendance.
            attendance: roster.map((child) => ({ child, status: "absent", notes: "" })),
          } };
        },
        post: async (url, body) => {
          saves.push({ url, body: JSON.parse(JSON.stringify(body)) });
          return { data: { success: true } };
        },
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
    saves, errors, render,
    get tree() { return tree; },
    yearSelector() { return find(tree, (node) => node.type === "select" && node.props["aria-label"] === "Filter by year"); },
    button(label) { return find(tree, (node) => node.type === "button" && nodeText(node).trim() === label); },
  };
}

test("a Year 3 leader sees a locked year selector and saves only Year 3 attendance", async () => {
  const page = await mountPage();
  const selector = page.yearSelector();
  assert.equal(selector.props.disabled, true);
  assert.equal(selector.props.value, "3");
  assert.equal(nodeText(selector), "Year 3");
  assert.match(nodeText(page.tree), /assigned year: Year 3/);
  assert.match(nodeText(page.tree), /Year 3 child/);
  assert.doesNotMatch(nodeText(page.tree), /Year 4 child/);
  page.button("Mark All Present").props.onClick(); page.render();
  await page.button("Save Attendance").props.onClick();
  assert.equal(page.saves[0].url, "/api/attendance/weekly");
  assert.deepEqual(page.saves[0].body.attendance, [{ child: "year-3-child", status: "present", notes: "" }]);
  assert.deepEqual(page.errors, []);
});

test("admin, Pascal, and Pamela can select any year, including when they also have the leader role", async () => {
  for (const role of ["admin", "pascal", "pamela"]) {
    for (const roles of [[role], ["leader", role]]) {
      const page = await mountPage({ roles, access: { allClasses: true, grade: null } });
      const selector = page.yearSelector();
      assert.equal(selector.props.disabled, false);
      assert.equal(selector.props.value, "0");
      for (let year = 1; year <= 12; year++) {
        assert.ok(find(selector, (node) => node.type === "option" && node.props.value === String(year)));
      }
      assert.match(nodeText(selector), /All Years/);
      assert.match(nodeText(page.tree), /Year 3 child/);
      assert.match(nodeText(page.tree), /Year 4 child/);
      selector.props.onChange({ target: { value: "4" } }); page.render();
      assert.equal(page.yearSelector().props.value, "4");
      assert.doesNotMatch(nodeText(page.tree), /Year 3 child/);
      assert.match(nodeText(page.tree), /Year 4 child/);
      await page.button("Save Attendance").props.onClick();
      assert.ok(page.saves[0].body.attendance.some((record) => record.child === "year-4-child"));
      assert.deepEqual(page.errors, []);
    }
  }
});

test("a leader without an assigned year cannot select a year or save attendance", async () => {
  const page = await mountPage({ denied: true });
  assert.equal(page.yearSelector().props.disabled, true);
  assert.equal(page.button("Save Attendance"), null);
  assert.match(nodeText(page.tree), /You need an assigned year/);
  assert.deepEqual(page.saves, []);
});
