import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import { transformWithEsbuild } from "vite";

const find = (node, predicate) => {
  if (!node || typeof node !== "object") return null;
  if (Array.isArray(node)) return node.map((child) => find(child, predicate)).find(Boolean);
  return predicate(node) ? node : find(node.props?.children, predicate);
};

test("event dates survive all-day changes and timed events submit the selected local date and time", async () => {
  const source = await readFile(new URL("../src/Pages/CreateEvent.jsx", import.meta.url), "utf8");
  const { code } = await transformWithEsbuild(source, "CreateEvent.jsx", { loader: "jsx", format: "cjs", jsx: "automatic" });
  const state = [];
  const saves = [];
  let cursor;
  const jsx = (type, props) => ({ type, props });
  const module = { exports: {} };
  runInNewContext(code, {
    module,
    console: { log() {} },
    require(specifier) {
      if (specifier === "react/jsx-runtime") return { jsx, jsxs: jsx };
      if (specifier === "react") return {
        useContext: () => ({ backendUrl: "" }),
        useState(initial) {
          const index = cursor++;
          if (!(index in state)) state[index] = initial;
          return [state[index], (next) => { state[index] = typeof next === "function" ? next(state[index]) : next; }];
        },
      };
      if (specifier === "react-router-dom") return { useNavigate: () => () => {} };
      if (specifier.includes("AppContent")) return { AppContent: {} };
      if (specifier.includes("Navbar") || specifier.includes("DatePicker")) return () => null;
      if (specifier === "react-toastify") return { toast: { success() {}, error(message) { assert.fail(message); } } };
      if (specifier.includes("axios")) return { post: async (url, body) => {
        saves.push({ url, body: JSON.parse(JSON.stringify(body)) });
        return { data: { success: true } };
      } };
      throw new Error(`Unexpected import: ${specifier}`);
    },
  });
  const render = () => { cursor = 0; return module.exports.default(); };
  let tree = render();
  const change = (name, value, type = "text") => {
    find(tree, (node) => node.props?.name === name).props.onChange({ target: { name, value, type, checked: value } });
    tree = render();
  };
  change("title", "Service meeting");
  change("startDate", "2010-07-13", "date");
  change("endDate", "2010-07-14", "date");
  change("allDay", false, "checkbox");
  assert.equal(find(tree, (node) => node.props?.name === "startDate").props.type, "datetime-local");
  assert.equal(find(tree, (node) => node.props?.name === "startDate").props.value, "2010-07-13T00:00");
  assert.equal(find(tree, (node) => node.props?.name === "endDate").props.value, "2010-07-14T00:00");
  change("startDate", "2010-07-13T14:30", "datetime-local");
  change("endDate", "2010-07-14T15:30", "datetime-local");
  await find(tree, (node) => node.type === "form").props.onSubmit({ preventDefault() {} });
  assert.equal(saves[0].body.startDate, "2010-07-13T14:30");
  assert.equal(saves[0].body.endDate, "2010-07-14T15:30");
  assert.equal(saves[0].body.allDay, false);
  change("allDay", true, "checkbox");
  assert.equal(find(tree, (node) => node.props?.name === "startDate").props.value, "2010-07-13");
  assert.equal(find(tree, (node) => node.props?.name === "endDate").props.value, "2010-07-14");
});
