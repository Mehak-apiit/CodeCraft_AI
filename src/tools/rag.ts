import { tool } from "@langchain/core/tools";
import { z } from "zod";
import fs from "fs/promises";
import path from "path";
import { WORKING_DIR } from "./fileSystem";

export const embedCodebaseTool = tool(
    async ({ file_pattern, userId, projectId }) => {
        try {
            const { glob } = await import("glob");
            const { embedFilesWithAST } = await import("../rag/embedding");
            const pattern = file_pattern ?? "**/*.{js,ts,jsx,tsx}";
            const allFiles = await glob(pattern, {
                cwd: WORKING_DIR,
                ignore: [
                    "**/node_modules/**",
                    "**/.git/**",
                    "**/dist/**",
                    "**/build/**",
                    "**/*.min.js",
                    "**/.agent/**",
                ],
                nodir: true,
                absolute: false,
            });

            if (!allFiles.length) return `No files matched "${pattern}"`;

            const files: { path: string; content: string }[] = [];
            const skipped: string[] = [];

            for (const filePath of allFiles) {
                try {
                    const content = await fs.readFile(
                        path.join(WORKING_DIR, filePath),
                        "utf-8"
                    );
                    if (!content.trim()) {
                        skipped.push(`${filePath} (empty)`);
                        continue;
                    }
                    if (content.length > 500_000) {
                        skipped.push(`${filePath} (too large)`);
                        continue;
                    }
                    files.push({ path: filePath, content });
                } catch (err: any) {
                    skipped.push(`${filePath} (${err.message})`);
                }
            }

            if (!files.length) return "No readable files to embed";

            const result = await embedFilesWithAST({ files, userId, projectId });

            return (
                `Embedded ${files.length} files (AST-aware)\n` +
                `${result.parentCount} AST chunks + ${result.childCount} sub-chunks = ${result.total} total\n` +
                (skipped.length ? `Skipped: ${skipped.join(", ")}` : "")
            );
        } catch (err: any) {
            return `Embedding error: ${err.message}`;
        }
    },
    {
        name: "embed_codebase",
        description:
            "Embed codebase files using AST-aware chunking. Each chunk is a complete function, class, or type. Check read_embeddings_index first to avoid re-embedding.",
        schema: z.object({
            file_pattern: z.string().optional().describe("Glob pattern (default: all JS/TS)"),
            userId: z.string().describe("User ID"),
            projectId: z.string().optional().describe("Project ID"),
        }),
    }
);

export const queryCodebaseTool = tool(
    async ({ query, userId, projectId, k_parents, k_children }) => {
        try {
            const { queryMultiVector } = await import("../rag/retrieval");
            const { retrievedDocs, childMatches } = await queryMultiVector({
                userId,
                projectId,
                query,
                kChildren: k_children ?? 6,
                kParents: k_parents ?? 3,
            });

            if (!retrievedDocs.length)
                return `No results for "${query}" (${childMatches} sub-matches, no parents). Run embed_codebase first?`;

            const results = retrievedDocs.map((doc: any, i: number) => {
                const file = doc.metadata.filePath ?? doc.metadata.source ?? "unknown";
                const label = doc.metadata.label ? `[${doc.metadata.label}]` : "";
                const line = doc.metadata.line ? ` line ${doc.metadata.line}` : "";
                const body =
                    doc.pageContent.length > 1200
                        ? doc.pageContent.slice(0, 1200) + "\n// ...(truncated)"
                        : doc.pageContent;

                return `### ${i + 1}. ${file}${label}${line}\n\`\`\`\n${body}\n\`\`\``;
            });

            return `"${query}" - ${childMatches} matches -> ${retrievedDocs.length} AST chunks:\n\n${results.join("\n\n")}`;
        } catch (err: any) {
            return `Query error: ${err.message}`;
        }
    },
    {
        name: "query_codebase",
        description: "Semantic search over embedded code. Returns complete AST chunks.",
        schema: z.object({
            query: z.string().describe("Natural language or code query"),
            userId: z.string().describe("User ID"),
            projectId: z.string().optional().describe("Project ID"),
            k_parents: z.number().optional().describe("Parent chunks to retrieve (default 3)"),
            k_children: z.number().optional().describe("Sub-chunks to search (default 6)"),
        }),
    }
);

export const ragTools = [embedCodebaseTool, queryCodebaseTool];
