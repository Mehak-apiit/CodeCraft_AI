import { parse } from "@babel/parser";
import { Document } from "@langchain/core/documents";

/*
AST-aware chunker for JS/TS files

Each chunk = meaningful unit:
- imports (grouped)
- functions
- classes
- exports
- variables

Fallback:
- Non-JS files OR parse failure → character chunking
*/

const MAX_CHUNK_CHARS = 3000;
const JS_TS_EXTS = new Set([".js", ".ts", ".jsx", ".tsx"]);

/* ---------------- PARSER ---------------- */

function babelParse(content: string, ext: string) {
  const isTS = [".ts", ".tsx"].includes(ext);
  const isJSX = [".jsx", ".tsx"].includes(ext);

  return parse(content, {
    sourceType: "module",
    errorRecovery: true,
    plugins: [
      ...(isTS ? ["typescript"] : []),
      ...(isJSX ? ["jsx"] : []),
      "decorators-legacy",
      "classProperties",
      "classPrivateProperties",
      "classPrivateMethods",
      "importMeta",
      "topLevelAwait",
    ] as any,
  });
}

/* ---------------- HELPERS ---------------- */

function nodeSource(content: string, node: any) {
  return content.slice(node.start, node.end);
}

function nodeLabel(node: any): string {
  switch (node.type) {
    case "FunctionDeclaration":
      return `function ${node.id?.name ?? "anonymous"}`;
    case "ClassDeclaration":
      return `class ${node.id?.name ?? "anonymous"}`;
    case "TSInterfaceDeclaration":
      return `interface ${node.id?.name}`;
    case "TSTypeAliasDeclaration":
      return `type ${node.id?.name}`;
    case "TSEnumDeclaration":
      return `enum ${node.id?.name}`;
    case "ExportDefaultDeclaration":
      return `export default`;
    case "ExportNamedDeclaration": {
      if (node.declaration) {
        const inner: string = nodeLabel(node.declaration);
        return `export ${inner}`;
      }
      return `export {...}`;
    }
    case "ExportAllDeclaration":
      return `export *`;
    case "VariableDeclaration": {
      const names = (node.declarations ?? [])
        .map((d: any) => d.id?.name ?? "?")
        .join(", ");
      return `${node.kind} ${names}`;
    }
    case "ImportDeclaration":
      return `import '${node.source?.value}'`;
    default:
      return node.type;
  }
}

/* ---------------- CLASS SPLITTING ---------------- */

function splitClassByMethods(
  content: string,
  classNode: any,
  filePath: string
) {
  const className = classNode.id?.name ?? "anonymous";
  const methods = (classNode.body?.body ?? []).filter(
    (m: any) =>
      m.type === "ClassMethod" || m.type === "ClassPrivateMethod"
  );

  // If small → return whole class
  const fullSource = nodeSource(content, classNode);
  if (fullSource.length <= MAX_CHUNK_CHARS) {
    return [
      new Document({
        pageContent: fullSource,
        metadata: {
          filePath,
          label: `class ${className}`,
          chunkType: "class",
        },
      }),
    ];
  }

  // Split by methods
  const chunks: Document[] = [];

  for (const method of methods) {
    const src = nodeSource(content, method);

    chunks.push(
      new Document({
        pageContent: src,
        metadata: {
          filePath,
          label: `${className}.${method.key?.name ?? "method"}`,
          chunkType: "class-method",
        },
      })
    );
  }

  return chunks;
}

/* ---------------- FALLBACK ---------------- */

function chunkByCharacters(content: string, filePath: string) {
  const lines = content.split("\n");

  const chunks: string[] = [];
  let current: string[] = [];
  let charCount = 0;

  for (const line of lines) {
    current.push(line);
    charCount += line.length + 1;

    if (charCount >= 2000 && line.trim() === "") {
      chunks.push(current.join("\n"));
      current = [];
      charCount = 0;
    }
  }

  if (current.length) chunks.push(current.join("\n"));

  return chunks
    .filter((c) => c.trim().length > 0)
    .map(
      (chunk, i) =>
        new Document({
          pageContent: chunk,
          metadata: {
            filePath,
            chunkIndex: i,
            chunkType: "character",
            charCount: chunk.length,
          },
        })
    );
}

/* ---------------- MAIN FUNCTION ---------------- */

export function chunkFileByAST(
  content: string,
  filePath: string,
  ext: string
): Document[] {
  // Non-JS/TS → fallback
  if (!JS_TS_EXTS.has(ext)) {
    return chunkByCharacters(content, filePath);
  }

  let ast;
  try {
    ast = babelParse(content, ext);
  } catch {
    return chunkByCharacters(content, filePath);
  }

  const body: any[] = ast.program?.body ?? [];
  const documents: Document[] = [];

  let importBuffer: any[] = [];

  for (const node of body) {
    /* -------- IMPORT GROUPING -------- */
    if (node.type === "ImportDeclaration") {
      importBuffer.push(node);
      continue;
    }

    // Flush imports
    if (importBuffer.length) {
      const src = importBuffer
        .map((n) => nodeSource(content, n))
        .join("\n");

      documents.push(
        new Document({
          pageContent: src,
          metadata: {
            filePath,
            label: "imports",
            chunkType: "import",
          },
        })
      );

      importBuffer = [];
    }

    /* -------- NORMAL NODES -------- */

    // Class → special handling
    if (node.type === "ClassDeclaration") {
      documents.push(
        ...splitClassByMethods(content, node, filePath)
      );
      continue;
    }

    const src = nodeSource(content, node);

    if (!src || src.trim().length === 0) continue;

    documents.push(
      new Document({
        pageContent: src,
        metadata: {
          filePath,
          label: nodeLabel(node),
          chunkType: "ast",
          size: src.length,
        },
      })
    );
  }

  // Final import flush
  if (importBuffer.length) {
    const src = importBuffer
      .map((n) => nodeSource(content, n))
      .join("\n");

    documents.push(
      new Document({
        pageContent: src,
        metadata: {
          filePath,
          label: "imports",
          chunkType: "import",
        },
      })
    );
  }

  return documents;
}

if (require.main === module) {
  const sample = `
import express from "express";
import path from "path";

export function helper(x: number): string {
  return String(x);
}

export class UserService {
  async getUser(id: string) {
    return { id };
  }
}

export const config = { port: 3000 };
`;

  const chunks = chunkFileByAST(sample, "test.ts", ".ts");
  chunks.forEach((c, i) => {
    console.log(`[${i}] ${c.metadata.chunkType} | ${c.metadata.label} | ${c.pageContent.length} chars`);
  });
}