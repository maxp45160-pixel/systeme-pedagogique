import { readFileSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runInThisContext } from "node:vm";

const appRootDefault = resolve(dirname(fileURLToPath(import.meta.url)), "../../app");
const dependencies = createRequire(resolve(appRootDefault, "package.json"));
const modules = [
  "lib/dev/workflow-ast-parser.ts",
  "lib/dev/workflow-scanner.ts",
  "lib/dev/workflow-ux-scanner.ts",
  "lib/dev/workflow-scan-partage.ts",
  "lib/domain/workflow-graphe.ts",
];
const builtins = new Set(["fs/promises", "path"]);

// Trusted repository modules only, never application entry points. A fresh module
// graph also resets the scanner's mtime cache; no global require hook or chdir.
function scannerLoader(appRoot) {
  const ts = dependencies("typescript");
  const src = resolve(appRoot, "src");
  if (!statSync(src).isDirectory()) throw new Error(`Source directory missing: ${src}`);
  const allowed = new Set(modules.map(name => resolve(src, name)));
  const cache = new Map();
  const localProcess = Object.freeze({ cwd: () => resolve(appRoot) });

  function load(filename) {
    if (!allowed.has(filename)) throw new Error(`Workflow module not allowed: ${filename}`);
    if (cache.has(filename)) return cache.get(filename).exports;
    const module = { exports: {} };
    cache.set(filename, module);
    const requireLocal = request => {
      if (request === "typescript" || builtins.has(request)) return dependencies(request);
      if (!request.startsWith("./") && !request.startsWith("../") && !request.startsWith("@/")) {
        throw new Error(`Workflow dependency not allowed: ${request}`);
      }
      let target = request.startsWith("@/")
        ? resolve(src, request.slice(2))
        : resolve(dirname(filename), request);
      if (!target.endsWith(".ts")) target += ".ts";
      return load(target);
    };
    const source = ts.transpileModule(readFileSync(filename, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
      },
      fileName: filename,
    }).outputText;
    const evaluate = runInThisContext(
      `(function(exports, require, module, __filename, __dirname, process) {\n${source}\n})`,
      { filename },
    );
    evaluate(module.exports, requireLocal, module, filename, dirname(filename), localProcess);
    return module.exports;
  }
  return name => load(resolve(src, name));
}

/** Recomputes a workflow view from the source tree, without loading the app. */
export async function scanWorkflowView(view, { appRoot = appRootDefault } = {}) {
  if (!["architecture", "ux-macro", "ux-atomique"].includes(view)) {
    throw new Error(`Unknown workflow view: ${view}`);
  }
  const load = scannerLoader(appRoot);
  if (view === "architecture") return load("lib/dev/workflow-scanner.ts").scannerWorkflow();
  return load("lib/dev/workflow-ux-scanner.ts").scannerUxJourney({
    mode: view === "ux-macro" ? "macro" : "atomique",
  });
}

function integerLimit(name, value, min, max) {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${name} must be an integer between ${min} and ${max}`);
  }
}

function pick(value, keys) {
  return Object.fromEntries(keys.filter(key => value[key] !== undefined).map(key => [key, value[key]]));
}

/** Bounded outgoing context. Conditions remain evidence, never evaluated here. */
export function projectWorkflow(graph, {
  root,
  depth = 1,
  maxNodes = 40,
  maxEdges = 100,
  includeFrame = false,
} = {}) {
  integerLimit("depth", depth, 0, 10);
  integerLimit("maxNodes", maxNodes, 1, 200);
  integerLimit("maxEdges", maxEdges, 0, 500);
  if (typeof includeFrame !== "boolean") throw new Error("includeFrame must be boolean");
  if (root !== undefined && (typeof root !== "string" || !root)) throw new Error("root must be a nonempty node id");
  const limits = { depth, maxNodes, maxEdges, includeFrame };
  const result = {
    format: "twiny-workflow-context", version: 1, status: "ok", root: root ?? null,
    limits, nodes: [], edges: [], truncated: false,
    omitted: { depthNodes: 0, nodeLimitNodes: 0, edges: 0 },
  };
  if (!root || !graph.noeuds.some(node => node.id === root)) {
    const roots = graph.noeuds.filter(node => node.type === "page");
    return {
      ...result,
      status: root ? "root-not-found" : "root-required",
      roots: roots.slice(0, maxNodes).map(node => pick(node, ["id", "libelle", "url"])),
      omittedRoots: Math.max(0, roots.length - maxNodes),
      truncated: roots.length > maxNodes,
    };
  }
  const filtered = {
    noeuds: graph.noeuds,
    liens: includeFrame ? graph.liens : graph.liens.filter(edge => !edge.cadre),
  };
  const { parcourirWorkflow } = scannerLoader(appRootDefault)("lib/domain/workflow-graphe.ts");
  const bfs = parcourirWorkflow(filtered, root);
  const withinDepth = bfs.noeuds.filter(node => bfs.profondeurs.get(node.id) <= depth);
  const selected = withinDepth.slice(0, maxNodes);
  const ids = new Set(selected.map(node => node.id));
  const edges = bfs.liens.filter(edge => ids.has(edge.source) && ids.has(edge.target)).slice(0, maxEdges);
  result.nodes = selected.map(node => pick(node, ["id", "type", "libelle", "url", "groupe", "condition", "heuristique"]));
  result.edges = edges.map(edge => pick(edge, ["source", "target", "type", "libelle", "declencheur", "condition", "cadre"]));
  result.omitted = {
    depthNodes: bfs.noeuds.length - withinDepth.length,
    nodeLimitNodes: withinDepth.length - selected.length,
    edges: bfs.liens.length - edges.length,
  };
  result.truncated = Object.values(result.omitted).some(count => count > 0);
  return result;
}
