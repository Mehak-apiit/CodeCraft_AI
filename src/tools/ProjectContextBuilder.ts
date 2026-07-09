import { tool } from "@langchain/core/tools";
import { z } from "zod";
import fs from "fs/promises";
import path from "path";
import { WORKING_DIR } from "./fileSystem";

/**
 * Directory Structure:
 * .agent/
 *   index.md
 *   modules/
 *   embeddings.json
 */

const AGENT_DIR = path.join(WORKING_DIR, ".agent");
const INDEX_PATH = path.join(AGENT_DIR, "index.md");
const MODULES_DIR = path.join(AGENT_DIR, "modules");
const EMBEDDINGS_PATH = path.join(AGENT_DIR, "embeddings.json");

/**
 * Utils
 */
function escapeRegex(str: string) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function touchTimestamp(content: string) {
    return content.replace(
        /> Last updated: .*/,
        `> Last updated: ${new Date().toISOString()}`
    );
}

function safeModuleName(name: string): string {
    const sanitized = name.replace(/[^a-zA-Z0-9_-]/g, "");
    if (!sanitized || sanitized !== name) {
        throw new Error(`Invalid module name: "${name}". Only letters, numbers, _, - allowed.`);
    }
    return sanitized;
}

/**
 * Ensure directories exist
 */
async function ensureAgentDir() {
    await fs.mkdir(MODULES_DIR, { recursive: true });

    try {
        await fs.access(INDEX_PATH);
    } catch {
        const template = `# Agent Memory - Index

> Auto-maintained. Keep concise.
> Last updated: ${new Date().toISOString()}

## Project Overview

*Not yet analyzed*

## Tech Stack

*Not yet detected*

## Entry Points

*Not yet identified*

## Module Map

*Not yet mapped*

## Key Conventions

*Not yet observed*

## Known Issues

*Not recorded*`;

        await fs.writeFile(INDEX_PATH, template, "utf-8");
    }
}

/**
 * Section Replace
 */
function safeSectionReplace(
    content: string,
    section: string,
    newContent: string,
    append = false
) {
    const regex = new RegExp(
        `(## ${escapeRegex(section)}\\n)([\\s\\S]*?)(?=\\n## |$)`
    );

    const match = content.match(regex);

    if (match) {
        const existing = match[2].trim();
        const finalContent = append
            ? existing + "\n" + newContent
            : newContent;

        return content.replace(regex, `## ${section}\n${finalContent}\n`);
    }

    return `${content.trim()}\n\n## ${section}\n${newContent}\n`;
}

/**
 * READ INDEX
 */
export const readAgentIndexTool = tool(
    async () => {
        await ensureAgentDir();
        const content = await fs.readFile(INDEX_PATH, "utf-8");

        const files = await fs.readdir(MODULES_DIR);
        const modules = files
            .filter((f) => f.endsWith(".md"))
            .map((f) => `- ${f.replace(".md", "")}`)
            .join("\n");

        return `.agent/index.md\n\n${content}\n\nModules:\n${modules || "None"}`;
    },
    {
        name: "read_agent_index",
        description: "Read project memory index",
        schema: z.object({}),
    }
);

/**
 * UPDATE INDEX
 */
export const updateAgentIndexTool = tool(
    async ({ section, content, append }) => {
        await ensureAgentDir();

        let current = await fs.readFile(INDEX_PATH, "utf-8");
        current = safeSectionReplace(current, section, content, append ?? false);
        current = touchTimestamp(current);

        await fs.writeFile(INDEX_PATH, current, "utf-8");

        return `Updated section: ${section}`;
    },
    {
        name: "update_agent_index",
        description: "Update index sections",
        schema: z.object({
            section: z.string(),
            content: z.string(),
            append: z.boolean().optional(),
        }),
    }
);

/**
 * READ MODULE
 */
export const readAgentModuleTool = tool(
    async ({ module_name }) => {
        await ensureAgentDir();
        const safeName = safeModuleName(module_name);
        const filePath = path.join(MODULES_DIR, `${safeName}.md`);

        try {
            const content = await fs.readFile(filePath, "utf-8");
            return content;
        } catch {
            return `Module "${safeName}" not found`;
        }
    },
    {
        name: "read_agent_module",
        description: "Read module memory",
        schema: z.object({
            module_name: z.string(),
        }),
    }
);

/**
 * WRITE MODULE
 */
export const writeAgentModuleTool = tool(
    async ({ module_name, section, content, append }) => {
        await ensureAgentDir();
        const safeName = safeModuleName(module_name);

        const filePath = path.join(MODULES_DIR, `${safeName}.md`);

        let current = "";

        try {
            current = await fs.readFile(filePath, "utf-8");
        } catch {
            current = `# Module: ${safeName}

> Last updated: ${new Date().toISOString()}

## Overview

*Not yet analyzed*

## Key Files

*Not yet identified*

## API

*Not yet documented*

## Patterns

*Not yet observed*

## Dependencies

*Not yet mapped*

## Issues

*None*`;
        }

        current = safeSectionReplace(current, section, content, append ?? false);
        current = touchTimestamp(current);

        await fs.writeFile(filePath, current, "utf-8");

        return `Module ${safeName} updated`;
    },
    {
        name: "write_agent_module",
        description: "Write module memory",
        schema: z.object({
            module_name: z.string(),
            section: z.string(),
            content: z.string(),
            append: z.boolean().optional(),
        }),
    }
);

/**
 * LIST MODULES
 */
export const listAgentModulesTool = tool(
    async () => {
        await ensureAgentDir();

        const files = await fs.readdir(MODULES_DIR);
        const modules = files
            .filter((f) => f.endsWith(".md"))
            .map((f) => f.replace(".md", ""));

        return modules.length ? modules : "No modules found";
    },
    {
        name: "list_agent_modules",
        description: "List modules",
        schema: z.object({}),
    }
);

/**
 * READ EMBEDDINGS INDEX
 */
export const readEmbeddingsIndexTool = tool(
    async () => {
        try {
            const raw = await fs.readFile(EMBEDDINGS_PATH, "utf-8");
            const data = JSON.parse(raw);

            return Object.entries(data)
                .map(([file, info]: any) => {
                    return `${file} - ${new Date(info.embeddedAt).toLocaleString()}`;
                })
                .join("\n");
        } catch {
            return "No embeddings found";
        }
    },
    {
        name: "read_embeddings_index",
        description: "Check embedded files",
        schema: z.object({}),
    }
);

/**
 * EXPORT ALL
 */
export const agentMemoryTools = [
    readAgentIndexTool,
    updateAgentIndexTool,
    readAgentModuleTool,
    writeAgentModuleTool,
    listAgentModulesTool,
    readEmbeddingsIndexTool,
];

/**
 * TEST RUN
 */
if (require.main === module) {
    async function main() {
        console.log("=== Reading Agent Index ===");
        const index = await readAgentIndexTool.invoke({});
        console.log(index);

        console.log("\n=== Updating Agent Index ===");
        const update = await updateAgentIndexTool.invoke({
            section: "Project Overview",
            content: "CodeCraft AI - AI-powered coding assistant with memory system",
        });
        console.log(update);

        console.log("\n=== Writing Module ===");
        const write = await writeAgentModuleTool.invoke({
            module_name: "fileSystem",
            section: "Overview",
            content: "Handles file operations: read, write, edit, tree, search",
        });
        console.log(write);

        console.log("\n=== Reading Module ===");
        const mod = await readAgentModuleTool.invoke({ module_name: "fileSystem" });
        console.log(mod);

        console.log("\n=== Listing Modules ===");
        const list = await listAgentModulesTool.invoke({});
        console.log(list);

        console.log("\n=== All Tests Passed ===");
    }
    main();
}
