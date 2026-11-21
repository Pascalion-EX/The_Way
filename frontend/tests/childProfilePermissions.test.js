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

async function mountPage(roles, childOverrides = {}) {
  const values = [];
  const effects = [];
  const pending = [];
  const saves = [];
  const deletions = [];
  const child = { _id: "child-id", name: "Existing child", grade: 2, firstParent: "Existing parent", ...childOverrides };
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
      if (specifier.includes("DatePicker")) return (props) => jsx("input", props);
      if (specifier === "lucide-react") return Object.fromEntries(
        ["AlertTriangle", "BriefcaseBusiness", "CalendarDays", "Loader2", "MapPin", "Pencil", "Phone", "Plus", "Save", "Search", "Trash2", "UserRound", "Users", "X"].map((name) => [name, "svg"])
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
    get tree() { return tree; },
    button(label) { return find(tree, (node) => node.type === "button" && nodeText(node).trim() === label); },
    field(name) { return find(tree, (node) => node.props?.name === name); },
    submit() { return find(tree, (node) => node.type === "form").props.onSubmit({ preventDefault() {} }); },
  };
}

test("servants can create and edit child profiles without a Delete action", async () => {
  for (const roles of [["servant"], ["parent", "servant"]]) {
    const page = await mountPage(roles);
    assert.ok(page.button("Add Child"));
    assert.ok(page.button("Edit"));
    assert.equal(page.button("Delete"), null);

    page.button("Add Child").props.onClick(); page.render();
    assert.equal(page.field("firstParent").props.value, "");
    assert.equal(page.field("birthday").props.value, "");
    page.field("name").props.onChange({ target: { name: "name", value: "New child" } });
    page.field("grade").props.onChange({ target: { name: "grade", value: "3" } });
    page.render();
    await page.submit(); page.render();
    assert.equal(page.saves[0].method, "POST");
    assert.equal(page.saves[0].url, "/api/children");
    assert.equal(page.saves[0].body.name, "New child");
    assert.equal(page.saves[0].body.grade, 3);
    assert.equal(page.saves[0].body.birthday, null);

    page.button("Edit").props.onClick(); page.render();
    assert.equal(page.field("name").props.value, "Existing child");
    assert.equal(page.field("birthday").props.value, "");
    page.field("name").props.onChange({ target: { name: "name", value: "Edited child" } });
    page.render();
    await page.submit(); page.render();
    assert.equal(page.saves[1].method, "PUT");
    assert.equal(page.saves[1].url, "/api/children/child-id");
    assert.equal(page.saves[1].body.name, "Edited child");
    assert.equal(page.saves[1].body.birthday, null);
    assert.deepEqual(page.deletions, []);
  }
});

test("parents can create a child with an optional birthday", async () => {
  const page = await mountPage(["parent"]);
  page.button("Add Child").props.onClick(); page.render();
  const birthday = page.field("birthday");
  assert.equal(birthday.props.type, "date");
  assert.equal(birthday.props.required, false);
  assert.ok(find(page.tree, (node) => node.type === "label" && node.props.htmlFor === birthday.props.id));
  for (const [name, value] of [["name", "New child"], ["grade", "3"], ["birthday", "2016-05-14"]]) {
    page.field(name).props.onChange({ target: { name, value } });
  }
  page.render();
  await page.submit();
  assert.equal(page.saves[0].method, "POST");
  assert.equal(page.saves[0].body.birthday, "2016-05-14");
});

test("saved birthdays display, prefill the date picker, survive unrelated edits, and can be changed or cleared", async () => {
  const page = await mountPage(["servant"], { birthday: "2016-05-14T00:00:00.000Z" });
  assert.match(nodeText(page.tree), /Birthday14 May 2016/);
  page.button("Edit").props.onClick(); page.render();
  assert.equal(page.field("birthday").props.value, "2016-05-14");
  page.field("name").props.onChange({ target: { name: "name", value: "Renamed child" } });
  page.render();
  await page.submit(); page.render();
  assert.equal(page.saves[0].method, "PUT");
  assert.equal(page.saves[0].body.birthday, "2016-05-14");

  for (const [index, value] of ["2016-05-15", ""].entries()) {
    page.button("Edit").props.onClick(); page.render();
    page.field("birthday").props.onChange({ target: { name: "birthday", value } });
    page.render();
    await page.submit(); page.render();
    assert.equal(page.saves[index + 1].body.birthday, value || null);
  }
});

test("existing children without birthdays remain readable and editable", async () => {
  for (const birthday of [undefined, null]) {
    const page = await mountPage(["servant"], { birthday });
    assert.match(nodeText(page.tree), /BirthdayNot provided/);
    page.button("Edit").props.onClick(); page.render();
    assert.equal(page.field("birthday").props.value, "");
    await page.submit();
    assert.equal(page.saves[0].body.birthday, null);
  }
});

test("parents retain creation only while admins, Pascal, and Pamela have edit and delete controls", async () => {
  const parent = await mountPage(["parent"]);
  assert.ok(parent.button("Add Child"));
  assert.equal(parent.button("Edit"), null);
  assert.equal(parent.button("Delete"), null);
  parent.button("Add Child").props.onClick(); parent.render();
  assert.equal(parent.field("firstParent").props.value, "Current user");

  for (const roles of [["admin"], ["pascal"], ["pamela"], ["parent", "admin"], ["servant", "admin"], ["servant", "pamela"]]) {
    const page = await mountPage(roles);
    assert.ok(page.button("Add Child"));
    assert.ok(page.button("Edit"));
    assert.ok(page.button("Delete"));
    await page.button("Delete").props.onClick();
    assert.deepEqual(page.deletions, ["/api/children/child-id"]);
  }
});
