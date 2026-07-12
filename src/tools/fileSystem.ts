import { tool } from "@langchain/core/tools";
import { z } from "zod";
import fs from "fs/promises";
import path from "path";
import { WORKSPACE_ROOT } from "../config/paths";

export const WORKING_DIR = WORKSPACE_ROOT;

const IGNORE_DIRS = new Set([
    "node_modules", ".git", "dist", "build", ".next",
    ".nuxt", "coverage", ".cache", "__pycache__", ".turbo", "out",
]);

export function safePath(filePath: string) {
    const resolved = path.resolve(WORKING_DIR, filePath);
    if (!resolved.startsWith(WORKING_DIR)) {
        throw new Error(`Path traversal blocked: ${filePath}`);
    }
    return resolved;
}

async function buildTree(dir: string, prefix = ""): Promise<string> {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const filtered = entries.filter((e) => !IGNORE_DIRS.has(e.name));
    let result = "";
    for (let i = 0; i < filtered.length; i++) {
        const e = filtered[i];
        const isLast = i === filtered.length - 1;
        const connector = isLast ? "└── " : "├── ";
        const childPrefix = isLast ? "    " : "│   ";
        if (e.isDirectory()) {
            result += `${prefix}${connector}${e.name}/\n`;
            const sub = await buildTree(path.join(dir, e.name), prefix + childPrefix);
            result += sub;
        } else {
            result += `${prefix}${connector}${e.name}\n`;
        }
    }
    return result;
}

export const readFileTool = tool(
    async ({ file_path, start_line, end_line }) => {
        try {
            const fullPath = safePath(file_path);
            const raw = await fs.readFile(fullPath, "utf-8");
            const lines = raw.split("\n");
            const from = start_line ? start_line - 1 : 0;
            const to = end_line ? end_line : lines.length;
            const slice = lines.slice(from, to);
            const numberedSlice = slice.map((l, i) => `${from + i + 1} | ${l}`).join("\n");
            const rangeInfo = (start_line || end_line) ? `(lines ${from + 1}-${to})` : "";
            return `${file_path}${rangeInfo}\n\`\`\`\n${numberedSlice}\n\`\`\``;
        } catch (err: any) {
            return `Error reading file: ${err.message}`;
        }
    },
    {
        name: "read_file",
        description: "Read the contents of a file with line numbers. Optionally read a specific line range.",
        schema: z.object({
            file_path: z.string().describe("Path relative to the working directory"),
            start_line: z.number().optional().describe("First line to read (1-indexed). Omit to read from start."),
            end_line: z.number().optional().describe("Last line to read (inclusive). Omit to read to end."),
        }),
    }
);

export const writeFileTool = tool(
    async ({ file_path, content }) => {
        try {
            const fullPath = safePath(file_path);
            await fs.mkdir(path.dirname(fullPath), { recursive: true });
            await fs.writeFile(fullPath, content, "utf-8");
            const lineCount = content.split("\n").length;
            return `Written: ${file_path} (${lineCount} lines)`;
        } catch (err: any) {
            return `Error writing file: ${err.message}`;
        }
    },
    {
        name: "write_file",
        description: "Create a new file or fully overwrite an existing one. For targeted edits, use edit_file instead.",
        schema: z.object({
            file_path: z.string().describe("Path relative to the working directory"),
            content: z.string().describe("Full file content to write"),
        }),
    }
);

export const editFileTool = tool(
    async ({ file_path, old_str, new_str }) => {
        try {
            const fullPath = safePath(file_path);
            const content = await fs.readFile(fullPath, "utf-8");
            const occurrences = content.split(old_str).length - 1;
            if (occurrences === 0) {
                return `old_str not found in ${file_path}. Check that it matches the file exactly.`;
            }
            if (occurrences > 1) {
                return `old_str found ${occurrences} times in ${file_path}. It must be unique.`;
            }
            const updated = content.replace(old_str, new_str);
            await fs.writeFile(fullPath, updated, "utf-8");
            const removed = old_str.split("\n").length;
            const added = new_str.split("\n").length;
            return `Edited: ${file_path} (-${removed} lines / +${added} lines)`;
        } catch (err: any) {
            return `Error editing file: ${err.message}`;
        }
    },
    {
        name: "edit_file",
        description: "Surgically edit a file by replacing a unique string (old_str) with new content. old_str must appear exactly once. Always read_file before editing so you have the exact content.",
        schema: z.object({
            file_path: z.string().describe("Path relative to the working directory"),
            old_str: z.string().describe("The exact string to replace"),
            new_str: z.string().describe("The replacement string"),
        }),
    }
);

export const fileTreeTool = tool(
    async ({ directory }) => {
        try {
            const targetDir = directory ? safePath(directory) : WORKING_DIR;
            const label = directory || ".";
            const tree = await buildTree(targetDir);
            return `${label}/\n${tree || "empty"}`;
        } catch (err: any) {
            return `Error building file tree: ${err.message}`;
        }
    },
    {
        name: "file_tree",
        description: "Get a full recursive file tree of the project. Excludes node_modules, .git, dist. Use this at the start of every session to understand the project layout.",
        schema: z.object({
            directory: z.string().optional().describe("Subdirectory to tree"),
        }),
    }
);

export const listDirTool = tool(
    async ({ directory }) => {
        try {
            const fullPath = directory ? safePath(directory) : WORKING_DIR;
            const entries = await fs.readdir(fullPath, { withFileTypes: true });
            const lines = entries.map((e) => {
                const type = e.isDirectory() ? "[dir]" : "[file]";
                return `${type} ${e.name}`;
            });
            return `Contents of ${directory || "."}:\n${lines.join("\n")}`;
        } catch (err: any) {
            return `Error listing directory: ${err.message}`;
        }
    },
    {
        name: "ls",
        description: "List files and directories at a given path.",
        schema: z.object({
            directory: z.string().optional().describe("Directory relative to working dir"),
        }),
    }
);

export const searchFileTool = tool(
    async ({ query, file_pattern, case_sensitive }) => {
        try {
            const { glob } = await import("glob");
            const files = await glob(file_pattern || "**/*.{js,ts,jsx,tsx}", {
                cwd: WORKING_DIR,
                ignore: ["**/node_modules/**", "**/.git/**", "**/dist/**", "**/build/**"],
                nodir: true,
            });
            const flags = case_sensitive ? "g" : "gi";
            const regex = new RegExp(query, flags);
            const results = [];
            for (const file of files) {
                const fullPath = path.join(WORKING_DIR, file);
                const content = await fs.readFile(fullPath, "utf-8");
                const lines = content.split("\n");
                const matches: string[] = [];
                lines.forEach((line, i) => {
                    regex.lastIndex = 0;
                    if (regex.test(line)) {
                        matches.push(` ${i + 1}: ${line.trim()}`);
                    }
                });
                if (matches.length > 0) {
                    results.push(`${file} (${matches.length} match${matches.length > 1 ? "es" : ""})\n${matches.join("\n")}`);
                }
            }
            if (results.length === 0) return `No matches found for "${query}"`;
            return `"${query}" - ${results.length} file(s):\n\n${results.join("\n\n")}`;
        } catch (err: any) {
            return `Error searching files: ${err.message}`;
        }
    },
    {
        name: "search_file",
        description: "Search for a string or regex pattern across files (like grep). Returns matching lines.",
        schema: z.object({
            query: z.string().describe("String or regex pattern to search for"),
            file_pattern: z.string().optional().describe("Glob to limit files, e.g. '**/*.ts'"),
            case_sensitive: z.boolean().optional().describe("Case-sensitive match"),
        }),
    }
);

export const filesystemTools = [
    readFileTool,
    writeFileTool,
    editFileTool,
    fileTreeTool,
    listDirTool,
    searchFileTool,
];
