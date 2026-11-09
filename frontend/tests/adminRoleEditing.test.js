import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import { transformWithEsbuild } from "vite";
import { hasProtectedAccountRole } from "../../shared/accountProtection.mjs";

const source = (await readFile(new URL("../src/Pages/Admin.jsx", import.meta.url), "utf8"))
  .replace("export default Admin;", "export { UserRoleEditor };");
const { code } = await transformWithEsbuild(source, "Admin.jsx", { loader: "jsx", format: "cjs", jsx: "automatic" });
const nodeText = (node) => Array.isArray(node) ? node.map(nodeText).join("") :
  node == null || typeof node === "boolean" ? "" : typeof node !== "object" ? String(node) : nodeText(node.props?.children);
function find(node, predicate) {
  if (!node || typeof node !== "object") return null;
  if (Array.isArray(node)) return node.map((child) => find(child, predicate)).find(Boolean) || null;
  return predicate(node) ? node : find(node.props?.children, predicate);
}

test("admin role edits replace the retired role on save while retaining the user's other roles", async () => {
  for (const originalRoles of [["parent", "leader"], ["parent", "Leader", "servant"], "leader"]) {
    const user = { _id: "existing-user", name: "Existing user", role: originalRoles };
    const saved = [];
    const state = [];
    let cursor = 0;
    const jsx = (type, props) => ({ type, props });
    const module = { exports: {} };
    runInNewContext(code, {
      module,
      require(specifier) {
        if (specifier === "react/jsx-runtime") return { jsx, jsxs: jsx };
        if (specifier === "react") return {
          useState(initial) {
            const index = cursor++;
            if (!(index in state)) state[index] = initial;
            return [state[index], (next) => { state[index] = typeof next === "function" ? next(state[index]) : next; }];
          },
        };
        if (specifier.includes("accountProtection")) return { hasProtectedAccountRole };
        if (specifier.includes("AppContent")) return { AppContent: {} };
        if (["axios", "react-toastify", "lucide-react"].includes(specifier) || specifier.includes("/Components/")) return {};
        throw new Error(`Unexpected import: ${specifier}`);
      },
    });
    const render = () => {
      cursor = 0;
      return module.exports.UserRoleEditor({ user, onSave: async (_, roles) => { saved.push(Array.from(roles)); return true; } });
    };
    let tree = render();
    find(tree, (node) => node.type === "button").props.onClick();
    tree = render();
    assert.deepEqual(saved, [], "Opening the editor must not change the stored role");
    const servantLabel = find(tree, (node) => node.type === "label" && nodeText(node) === "servant");
    assert.equal(find(servantLabel, (node) => node.type === "input").props.checked, true);
    await find(tree, (node) => node.type === "button" && nodeText(node) === "Save roles").props.onClick();
    assert.deepEqual(saved, [Array.isArray(originalRoles) ? ["parent", "servant"] : ["servant"]]);
    assert.deepEqual(user.role, originalRoles, "The displayed user object is only updated after the API saves successfully");
  }
});
