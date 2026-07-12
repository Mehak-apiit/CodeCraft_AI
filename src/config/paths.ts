import path from 'path';
import fs from 'fs';

/**
 * Unified workspace root for all code tools (file, bash, AST, git, RAG, graph, todo).
 * All tools resolve paths relative to this directory.
 */
export const WORKSPACE_ROOT = path.resolve(process.cwd(), "public", "agent-working-dir");

/**
 * Legacy alias — prefer WORKSPACE_ROOT in new code.
 */
export const WORKING_DIR = WORKSPACE_ROOT;

/** Chat history metadata (separate from workspace). */
export const CHAT_HISTORY_DIR = path.resolve(process.cwd(), "public", "chat-history");

/** Memory agent root (separate from workspace). */
export const MEMORY_DIR = path.resolve(process.cwd(), "public", "memory");

/**
 * Ensure the workspace directory exists. Call once at startup or before tool execution.
 */
export function ensureWorkspaceDir(): void {
    if (!fs.existsSync(WORKSPACE_ROOT)) {
        fs.mkdirSync(WORKSPACE_ROOT, { recursive: true });
    }
}
