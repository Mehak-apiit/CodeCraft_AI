import { filesystemTools } from "./fileSystem";
import { bashTool } from "./bash";
import { graphTools } from "./importGraph";
import { agentMemoryTools } from "./ProjectContextBuilder";
import { ragTools } from "./rag";
import { astAnalyzeTool } from "./ast";
import { gitTools } from "./git";
import { todoListTools } from "./todo";
import { createTaskTool } from "./task/task";
import { thinkTool } from "./task/thinkTool";

export interface ToolEntry {
    description: string;
    tools: string[];
    skill: string | null;
    loadedTools: any[];
}

const filesystemEntry: ToolEntry = {
    description: "Full file operations - write, edit, search, ls, file tree",
    tools: ["read_file", "write_file", "edit_file", "file_tree", "ls", "search_file"],
    skill: "filesystem",
    loadedTools: filesystemTools,
};

const bashEntry: ToolEntry = {
    description: "Shell execution - run commands, npm, node",
    tools: ["bash"],
    skill: "bash",
    loadedTools: [bashTool],
};

const graphEntry: ToolEntry = {
    description: "Import dependency map - build graph, query deps, impact analysis",
    tools: ["build_import_graph", "query_import_graph", "impact_analysis"],
    skill: "graph",
    loadedTools: graphTools,
};

const memoryEntry: ToolEntry = {
    description: "Agent memory - index, modules, embeddings",
    tools: ["read_agent_index", "update_agent_index", "read_agent_module", "write_agent_module", "list_agent_modules", "read_embeddings_index"],
    skill: "memory",
    loadedTools: agentMemoryTools,
};

const ragEntry: ToolEntry = {
    description: "Semantic search - embed codebase files and query by concept",
    tools: ["embed_codebase", "query_codebase"],
    skill: "rag",
    loadedTools: ragTools,
};

const astEntry: ToolEntry = {
    description: "Code structure analysis - extract functions, classes, types from JS/TS files",
    tools: ["ast_analyze"],
    skill: "ast",
    loadedTools: [astAnalyzeTool],
};

const gitEntry: ToolEntry = {
    description: "Git awareness - diff, log, status (read-only)",
    tools: ["git_diff", "git_log", "git_status"],
    skill: "git",
    loadedTools: gitTools,
};

const todoEntry: ToolEntry = {
    description: "Task management - create, read, update workflow todos",
    tools: ["write_todos", "read_todos", "update_todos", "get_next_runnable_tasks"],
    skill: "todo",
    loadedTools: todoListTools,
};

const taskEntry: ToolEntry = {
    description: "Spawn subagents for parallel or isolated tasks",
    tools: ["task"],
    skill: null,
    loadedTools: [],
};

const thinkEntry: ToolEntry = {
    description: "Strategic reflection tool for reasoning before acting",
    tools: ["think_tool"],
    skill: null,
    loadedTools: [thinkTool],
};

export const TOOL_REGISTRY: Record<string, ToolEntry> = {
    filesystem: filesystemEntry,
    bash: bashEntry,
    graph: graphEntry,
    memory: memoryEntry,
    rag: ragEntry,
    ast: astEntry,
    git: gitEntry,
    todo: todoEntry,
    task: taskEntry,
    think: thinkEntry,
};

export function loadAllTools(model?: any, config?: any): any[] {
    const allTools: any[] = [];
    for (const entry of Object.values(TOOL_REGISTRY)) {
        allTools.push(...entry.loadedTools);
    }
    if (model) {
        allTools.push(createTaskTool(model, config));
    }
    return allTools;
}

export function loadToolCategory(category: string): any[] {
    const entry = TOOL_REGISTRY[category];
    if (!entry) {
        throw new Error(`Unknown tool category: ${category}`);
    }
    return [...entry.loadedTools];
}

export function listToolCategories(): string[] {
    return Object.keys(TOOL_REGISTRY);
}

export function listAllToolNames(): string[] {
    return Object.values(TOOL_REGISTRY).flatMap((entry) => entry.tools);
}
