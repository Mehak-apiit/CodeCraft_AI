import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { parse } from "@babel/parser";
import fs from "fs/promises";
import path from "path";
import { WORKING_DIR } from "./fileSystem";

/**

* Paths
  */
  const AGENT_DIR = path.join(WORKING_DIR, ".agent");
  const GRAPH_PATH = path.join(AGENT_DIR, "graph.json");

/**

* Resolve relative import
  */
  function resolveImport(fromFile: string, importPath: string) {
  if (!importPath.startsWith(".")) return null;

const fromDir = path.dirname(fromFile);
const resolved = path.join(fromDir, importPath);

  return resolved.replace(/\\/g, "/");
}

/**

* Resolve actual file
  */
  function resolveToActualFile(importedPath: string, allFiles: Set<string>) {
  const extensions = [
  ".js",
  ".ts",
  ".jsx",
  ".tsx",
  "/index.js",
  "/index.ts",
  "/index.jsx",
  "/index.tsx",
  ];

for (const ext of extensions) {
const candidate = (importedPath + ext).replace(/\\/g, "/");
if (allFiles.has(candidate)) return candidate;
}

return null;
}

/**

* Extract imports
  */
  function extractImports(content: string, ext: string): string[] {
  const isTS = [".ts", ".tsx"].includes(ext);
  const isJSX = [".jsx", ".tsx"].includes(ext);

try {
const ast = parse(content, {
sourceType: "module",
errorRecovery: true,
plugins: [
...(isTS ? ["typescript"] : []),
...(isJSX ? ["jsx"] : []),
"decorators-legacy",
"classProperties",
"importMeta",
"topLevelAwait",
] as any,
});

const imports: string[] = [];

for (const node of ast.program.body as any[]) {
  if (node.type === "ImportDeclaration") {
    imports.push(node.source.value);
  }

  if (
    (node.type === "ExportNamedDeclaration" ||
      node.type === "ExportAllDeclaration") &&
    node.source
  ) {
    imports.push(node.source.value);
  }

  if (node.type === "ExpressionStatement") {
    const expr = node.expression;

    if (
      expr?.type === "CallExpression" &&
      expr.callee?.name === "require" &&
      expr.arguments?.[0]?.type === "StringLiteral"
    ) {
      imports.push(expr.arguments[0].value);
    }
  }
}

return imports;

} catch {
return [];
}
}

/**

* Build graph
  */
  async function buildGraph(files: string[]) {
  files = files.map((f) => f.replace(/\\/g, "/"));
  const fileSet = new Set(files);

const graph: Record<
string,
{ imports: string[]; importedBy: string[]; unresolvedImports: string[] }

> = {};

for (const file of files) {
graph[file] = {
imports: [],
importedBy: [],
unresolvedImports: [],
};
}

for (const file of files) {
let content = "";

try {
  content = await fs.readFile(path.join(WORKING_DIR, file), "utf-8");
} catch {
  continue;
}

const rawImports = extractImports(content, path.extname(file));

for (const imp of rawImports) {
  if (!imp.startsWith(".")) {
    graph[file].unresolvedImports.push(imp);
    continue;
  }

  const relativePath = resolveImport(file, imp);
  if (!relativePath) continue;

  const actualFile = resolveToActualFile(relativePath, fileSet);

  if (actualFile) {
    if (!graph[file].imports.includes(actualFile)) {
      graph[file].imports.push(actualFile);
    }

    if (!graph[actualFile].importedBy.includes(file)) {
      graph[actualFile].importedBy.push(file);
    }
  } else {
    graph[file].unresolvedImports.push(imp);
  }
}

}

return graph;
}

/**

* Analyze graph
  */
  function analyzeGraph(graph: any) {
  const entryPoints: string[] = [];
  const isolated: string[] = [];
  const central: { file: string; importedBy: number }[] = [];

for (const [file, node] of Object.entries(graph)) {
const ibc = (node as any).importedBy.length;
const ic = (node as any).imports.length;


if (ibc === 0 && ic > 0) entryPoints.push(file);
if (ibc === 0 && ic === 0) isolated.push(file);
if (ibc >= 3) central.push({ file, importedBy: ibc });


}

central.sort((a, b) => b.importedBy - a.importedBy);

return {
totalFiles: Object.keys(graph).length,
entryPoints,
isolated,
mostImported: central.slice(0, 5),
};
}

/**

* BUILD GRAPH TOOL
  */
  export const buildImportGraphTool = tool(
  async ({ directory, file_pattern }) => {
  try {
  const base = directory
  ? path.join(WORKING_DIR, directory)
  : WORKING_DIR;

  const pattern = file_pattern ?? "**/*.{js,ts,jsx,tsx}";

  const { glob } = await import("glob");
  const files = await glob(pattern, {
  cwd: base,
  ignore: [
  "**/node_modules/**",
  "**/.git/**",
  "**/dist/**",
  "**/build/**",
  "**/*.min.js",
  "**/.agent/**",
  ],
  nodir: true,
  });

  const relFiles = directory
  ? files.map((f) => path.join(directory, f).replace(/\\/g, "/"))
  : files;

  if (!relFiles.length) {
  return `No JS/TS files found matching "${pattern}"`;
  }

  const graph = await buildGraph(relFiles);
  const summary = analyzeGraph(graph);

  await fs.mkdir(AGENT_DIR, { recursive: true });

  await fs.writeFile(
  GRAPH_PATH,
  JSON.stringify(
  {
  graph,
  summary,
  builtAt: new Date().toISOString(),
  },
  null,
  2
  )
  );

  return `Graph built successfully with ${summary.totalFiles} files.`;
  } catch (err: any) {
  return `Import graph error: ${err.message}`;
  }
  },
  {
  name: "build_import_graph",
  description:
  "Builds a full bidirectional import dependency graph for JS/TS files.",
  schema: z.object({
  directory: z.string().optional(),
  file_pattern: z.string().optional(),
  }),
  }
  );

/**

* QUERY GRAPH TOOL (NEW ✅)
  */
  export const queryImportGraphTool = tool(
  async ({ file_path }) => {
  try {
  const data = JSON.parse(await fs.readFile(GRAPH_PATH, "utf-8"));
  const graph = data.graph;

  if (!graph[file_path]) {
  return `"${file_path}" not found in graph.`;
  }

  const node = graph[file_path];

  return [
  `File: ${file_path}`,
  `Imports (${node.imports.length}):`,
  ...node.imports,
  `\nImported By (${node.importedBy.length}):`,
  ...node.importedBy,
  `\nUnresolved Imports (${node.unresolvedImports.length}):`,
  ...node.unresolvedImports,
  ].join("\n");
  } catch (err: any) {
  return `Query error: ${err.message}`;
  }
  },
  {
  name: "query_import_graph",
  description:
  "Query a specific file in the import graph to see its dependencies and dependents.",
  schema: z.object({
  file_path: z.string(),
  }),
  }
  );

/**

* IMPACT ANALYSIS TOOL
  */
  export const impactAnalysisTool = tool(
  async ({ file_path }) => {
  try {
  const data = JSON.parse(await fs.readFile(GRAPH_PATH, "utf-8"));
  const graph = data.graph;

  if (!graph[file_path]) {
  return `"${file_path}" not found.`;
  }

  const visited = new Set<string>();
  const impacted: string[] = [];

  let queue = [file_path];

  while (queue.length) {
  const next: string[] = [];


   for (const file of queue) {
     if (visited.has(file)) continue;

     visited.add(file);
     impacted.push(file);

     for (const dep of graph[file]?.importedBy ?? []) {
       if (!visited.has(dep)) next.push(dep);
     }
   }

   queue = next;


  }

  return [
  `Impact Analysis for: ${file_path}`,
  `Affected files: ${impacted.length}`,
  ...impacted,
  ].join("\n");
  } catch (err: any) {
  return `Impact analysis error: ${err.message}`;
  }
  },
  {
  name: "impact_analysis",
  description:
  "Find all files affected by a change in a given file.",
  schema: z.object({
  file_path: z.string(),
  }),
  }
  );

/**

* EXPORT
  */
  export const graphTools = [
  buildImportGraphTool,
  queryImportGraphTool,
  impactAnalysisTool,
  ];
