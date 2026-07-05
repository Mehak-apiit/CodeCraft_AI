import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { parse } from "@babel/parser";
import * as t from "@babel/types";
import fs from "fs/promises";
import path from "path";

const PROJECT_ROOT = path.resolve(process.cwd());

function safeProjectPath(filePath: string) {
  const resolved = path.resolve(PROJECT_ROOT, filePath);
  if (!resolved.startsWith(PROJECT_ROOT)) {
    throw new Error(`Path traversal blocked: ${filePath}`);
  }
  return resolved;
}

/**
 * FORMAT PARAMS (with types)
 */
function formatParam(param: any, code: string): any {
  if (t.isIdentifier(param)) {
    return {
      name: param.name,
      type: param.typeAnnotation?.start != null && param.typeAnnotation?.end != null
        ? code.slice(param.typeAnnotation.start, param.typeAnnotation.end)
        : null,
    };
  }

  if (t.isAssignmentPattern(param)) {
    if (t.isIdentifier(param.left)) {
      return {
        name: param.left.name,
        default: true,
      };
    }
  }

  if (t.isRestElement(param)) {
    if (t.isIdentifier(param.argument)) {
      return {
        name: `...${param.argument.name}`,
      };
    }
  }

  return { name: "param" };
}

/**
 * CHECK TOP LEVEL
 */
function isTopLevel(node: any) {
  return node?.parent?.type === "Program";
}

/**
 * EXTRACT STRUCTURE (ADVANCED)
 */
function extractStructure(ast: t.File, code: string) {
  const visited = new WeakSet();

  const result = {
    imports: [] as any[],
    exports: [] as any[],
    functions: [] as any[],
    classes: [] as any[],
    types: [] as any[],
    enums: [] as any[],
    variables: [] as any[],
  };

  function visit(node: any) {
    if (!node || typeof node !== "object") return;
    if (visited.has(node)) return;
    visited.add(node);

    switch (node.type) {
      /**
       * IMPORTS (dependency ready)
       */
      case "ImportDeclaration":
        result.imports.push({
          from: node.source.value,
          specifiers: node.specifiers.map((s: any) => ({
            imported: s.imported?.name || "default",
            local: s.local?.name,
          })),
        });
        break;

      /**
       * EXPORTS
       */
      case "ExportNamedDeclaration":
        if (node.declaration) {
          if (t.isFunctionDeclaration(node.declaration)) {
            result.exports.push({
              name: node.declaration.id?.name,
              type: "function",
            });
          }
          if (t.isClassDeclaration(node.declaration)) {
            result.exports.push({
              name: node.declaration.id?.name,
              type: "class",
            });
          }
        }

        node.specifiers?.forEach((s: any) => {
          result.exports.push({
            name: s.exported.name,
            type: "named",
          });
        });
        break;

      case "ExportDefaultDeclaration":
        result.exports.push({ name: "default", type: "default" });
        break;

      /**
       * FUNCTIONS
       */
      case "FunctionDeclaration":
        result.functions.push({
          name: node.id?.name || "anonymous",
          params: node.params.map((p: any) => formatParam(p, code)),
          async: node.async,
          generator: node.generator,
          returnType: node.returnType
            ? code.slice(node.returnType.start, node.returnType.end)
            : null,
          bodyPreview: code.slice(node.start, node.start + 120),
          line: node.loc?.start.line,
        });
        break;

      case "ArrowFunctionExpression":
        if (node.parent?.type === "VariableDeclarator") {
          result.functions.push({
            name: node.parent.id?.name || "arrowFn",
            params: node.params.map((p: any) => formatParam(p, code)),
            async: node.async,
            returnType: node.returnType
              ? code.slice(node.returnType.start, node.returnType.end)
              : null,
            bodyPreview: code.slice(node.start, node.start + 120),
            line: node.loc?.start.line,
          });
        }
        break;

      /**
       * CLASSES (with methods + constructors)
       */
      case "ClassDeclaration":
        result.classes.push({
          name: node.id?.name || "anonymous",
          methods: node.body.body.map((m: any) => {
            if (t.isClassMethod(m) && t.isIdentifier(m.key)) {
              return {
                name: m.key.name,
                kind: m.kind,
                async: m.async,
                params: m.params.map((p: any) => formatParam(p, code)),
              };
            }
          }).filter(Boolean),
          line: node.loc?.start.line,
        });
        break;

      /**
       * TYPES / INTERFACES
       */
      case "TSInterfaceDeclaration":
        result.types.push({
          kind: "interface",
          name: node.id.name,
          body: code.slice(node.start, node.end),
        });
        break;

      case "TSTypeAliasDeclaration":
        result.types.push({
          kind: "type",
          name: node.id.name,
          body: code.slice(node.start, node.end),
        });
        break;

      /**
       * ENUMS
       */
      case "TSEnumDeclaration":
        result.enums.push({
          name: node.id.name,
          members: node.members.map((m: any) => m.id.name),
        });
        break;

      /**
       * VARIABLES (ONLY TOP LEVEL)
       */
      case "VariableDeclaration":
        if (isTopLevel(node)) {
          node.declarations.forEach((decl: any) => {
            if (t.isIdentifier(decl.id)) {
              result.variables.push({
                name: decl.id.name,
                kind: node.kind,
                valuePreview: decl.init
                  ? code.slice(decl.init.start, decl.init.start + 80)
                  : null,
              });
            }
          });
        }
        break;
    }

    /**
     * RECURSION
     */
    for (const key in node) {
      const value = node[key];

      if (Array.isArray(value)) {
        value.forEach((v) => {
          if (v && typeof v.type === "string") {
            v.parent = node;
            visit(v);
          }
        });
      } else if (value && typeof value.type === "string") {
        value.parent = node;
        visit(value);
      }
    }
  }

  visit(ast);
  return result;
}

/**
 * RENDER (AI FRIENDLY + HUMAN FRIENDLY)
 */
function renderStructure(filePath: string, s: any) {
  const out: string[] = [`# AST ANALYSIS: ${filePath}\n`];

  if (s.imports.length) {
    out.push("## Imports");
    s.imports.forEach((i: any) => {
      out.push(`from '${i.from}'`);
      i.specifiers.forEach((sp: any) => {
        out.push(`  - ${sp.imported} as ${sp.local}`);
      });
    });
  }

  if (s.functions.length) {
    out.push("\n## Functions");
    s.functions.forEach((f: any) => {
      out.push(
        `${f.name}(${f.params.map((p: any) => p.name).join(", ")})`
      );
    });
  }

  if (s.classes.length) {
    out.push("\n## Classes");
    s.classes.forEach((c: any) => {
      out.push(`${c.name}`);
      c.methods.forEach((m: any) => {
        out.push(`  ↳ ${m.name}(${m.params.map((p: any) => p.name).join(", ")})`);
      });
    });
  }

  if (s.types.length) {
    out.push("\n## Types / Interfaces");
    s.types.forEach((t: any) => {
      out.push(`${t.kind} ${t.name}`);
    });
  }

  if (s.enums.length) {
    out.push("\n## Enums");
    s.enums.forEach((e: any) => {
      out.push(`${e.name}: ${e.members.join(", ")}`);
    });
  }

  if (s.variables.length) {
    out.push("\n## Variables");
    s.variables.forEach((v: any) => {
      out.push(`${v.kind} ${v.name}`);
    });
  }

  if (s.exports.length) {
    out.push("\n## Exports");
    s.exports.forEach((e: any) => {
      out.push(`${e.name} (${e.type})`);
    });
  }

  return out.join("\n");
}

/**
 * TOOL
 */
export const astAnalyzeTool = tool(
  async ({ file_path }) => {
    try {
      const fullPath = safeProjectPath(file_path);
      const code = await fs.readFile(fullPath, "utf-8");

      const ast = parse(code, {
        sourceType: "module",
        plugins: ["typescript", "jsx"],
      });

      const structure = extractStructure(ast, code);
      return renderStructure(file_path, structure);
    } catch (err: any) {
      return `AST Error: ${err.message}`;
    }
  },
  {
    name: "ast_analyze",
    description:
      "Advanced AST tool for deep code understanding, navigation, and dependency analysis",
    schema: z.object({
      file_path: z.string().describe("Path to the file relative to project root (e.g. 'src/tools/bash.ts')"),
    }),
  }
);

if (require.main === module) {
  async function main() {
    const res = await astAnalyzeTool.invoke({ file_path: "src/tools/bash.ts" });
    console.log(res);
  }
  main();
}