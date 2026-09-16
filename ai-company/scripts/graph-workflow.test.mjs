import assert from "node:assert/strict";
import { appendFileSync, cpSync, mkdirSync, mkdtempSync, rmSync, statSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { projectWorkflow, scanWorkflowView } from "./graph-workflow.mjs";

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../app");
const graph = {
  noeuds: [
    { id: "page:/", type: "page", libelle: "Home", url: "/" },
    { id: "action:a", type: "action", libelle: "A", condition: "signed in", heuristique: true },
    { id: "page:/b", type: "page", libelle: "B" },
    { id: "page:/frame", type: "page", libelle: "Frame" },
  ],
  liens: [
    { source: "page:/", target: "action:a", type: "soumission", libelle: "Submit", condition: "valid", declencheur: "Click" },
    { source: "action:a", target: "page:/b", type: "transition", libelle: "Next" },
    { source: "page:/b", target: "page:/", type: "retour", libelle: "Back" },
    { source: "page:/", target: "page:/frame", type: "navigation", libelle: "Rail", cadre: true },
  ],
};

test("bounded projection retains conditions and heuristics, excluding frame before BFS", () => {
  const result = projectWorkflow(graph, { root: "page:/" });
  assert.deepEqual(result.nodes.map(node => node.id), ["page:/", "action:a"]);
  assert.equal(result.nodes[1].condition, "signed in");
  assert.equal(result.nodes[1].heuristique, true);
  assert.equal(result.edges[0].condition, "valid");
  assert.equal(result.edges[0].declencheur, "Click");
  assert.deepEqual(result.omitted, { depthNodes: 1, nodeLimitNodes: 0, edges: 2 });
  assert.equal(result.truncated, true);
  const all = projectWorkflow(graph, { root: "page:/", depth: 3, includeFrame: true });
  assert.equal(all.nodes.length, 4);
  assert.equal(all.edges.length, 4);
  assert.equal(all.edges.find(edge => edge.cadre).libelle, "Rail");
  assert.equal(all.truncated, false);
});

test("node and edge budgets cannot produce dangling edges or unannounced omission", () => {
  const limited = projectWorkflow(graph, { root: "page:/", depth: 3, maxNodes: 2, maxEdges: 0 });
  assert.equal(limited.nodes.length, 2);
  assert.equal(limited.edges.length, 0);
  assert.deepEqual(limited.omitted, { depthNodes: 0, nodeLimitNodes: 1, edges: 3 });
  const shallow = projectWorkflow(graph, { root: "page:/", depth: 0 });
  assert.equal(shallow.nodes.length, 1);
  assert.equal(shallow.edges.length, 0);
  const edgeLimit = projectWorkflow(graph, { root: "page:/", depth: 3, maxEdges: 1 });
  assert.equal(edgeLimit.edges.length, 1);
  assert.equal(edgeLimit.omitted.edges, 2);
  assert.ok(edgeLimit.edges.every(edge => edgeLimit.nodes.some(node => node.id === edge.source) && edgeLimit.nodes.some(node => node.id === edge.target)));
});

test("missing roots return a bounded page catalogue rather than silently selecting a root", () => {
  const missing = projectWorkflow(graph, { maxNodes: 2 });
  assert.equal(missing.status, "root-required");
  assert.equal(missing.roots.length, 2);
  assert.equal(missing.omittedRoots, 1);
  assert.equal(missing.truncated, true);
  const unknown = projectWorkflow(graph, { root: "unknown" });
  assert.equal(unknown.status, "root-not-found");
  assert.deepEqual(unknown.nodes, []);
});

test("invalid bounds and unsupported views fail explicitly", async () => {
  for (const options of [{ depth: -1 }, { depth: 11 }, { depth: 1.5 }, { maxNodes: 0 }, { maxNodes: 201 }, { maxEdges: -1 }, { maxEdges: 501 }, { includeFrame: "false" }, { root: "" }]) {
    assert.throws(() => projectWorkflow(graph, options));
  }
  await assert.rejects(scanWorkflowView("unknown"), /Unknown workflow view/);
});

test("fresh scanners observe route creation, content changes and deletion without changing cwd", async t => {
  const fixture = mkdtempSync(resolve(tmpdir(), "twiny-workflow-"));
  assert.ok(fixture.startsWith(resolve(tmpdir()) + sep + "twiny-workflow-"));
  t.after(() => rmSync(fixture, { recursive: true, force: true }));
  for (const name of ["workflow-ast-parser", "workflow-scanner", "workflow-ux-scanner", "workflow-scan-partage"]) {
    const destination = resolve(fixture, `src/lib/dev/${name}.ts`);
    mkdirSync(dirname(destination), { recursive: true });
    cpSync(resolve(appRoot, `src/lib/dev/${name}.ts`), destination);
  }
  mkdirSync(resolve(fixture, "src/app/new"), { recursive: true });
  writeFileSync(resolve(fixture, "src/app/page.tsx"), 'export default function Page() { return <h1>Home</h1>; }');
  const cwd = process.cwd();
  const first = await scanWorkflowView("architecture", { appRoot: fixture });
  assert.ok(first.noeuds.some(node => node.id === "page:/"));
  assert.ok(!first.noeuds.some(node => node.id === "page:/new"));
  const route = resolve(fixture, "src/app/new/page.tsx");
  writeFileSync(route, 'export const metadata = { title: "New route" }; export default function Page() { return null; }');
  const second = await scanWorkflowView("architecture", { appRoot: fixture });
  assert.ok(second.noeuds.some(node => node.id === "page:/new"));
  const timestamps = statSync(route);
  writeFileSync(route, 'export const metadata = { title: "Changed route" }; export default function Page() { return null; }');
  utimesSync(route, timestamps.atime, timestamps.mtime);
  const changed = await scanWorkflowView("architecture", { appRoot: fixture });
  assert.equal(changed.noeuds.find(node => node.id === "page:/new").libelle, "Changed route");
  rmSync(route);
  const third = await scanWorkflowView("architecture", { appRoot: fixture });
  assert.ok(!third.noeuds.some(node => node.id === "page:/new"));
  assert.equal(process.cwd(), cwd);
  for (const view of ["ux-macro", "ux-atomique"]) {
    const result = await scanWorkflowView(view, { appRoot: fixture });
    assert.ok(result.noeuds.length > 0);
  }
  appendFileSync(resolve(fixture, "src/lib/dev/workflow-scanner.ts"), '\nimport "node:https";\n');
  await assert.rejects(scanWorkflowView("architecture", { appRoot: fixture }), /dependency not allowed: node:https/);
});
