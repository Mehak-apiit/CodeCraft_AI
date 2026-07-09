import fs from "fs";
import path from "path";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { v4 as uuid, validate as isUUID } from "uuid";
import { WORKING_DIR } from "./fileSystem";

const BASE_DIR = path.join(WORKING_DIR, ".agent-todos");

const InputTaskSchema = z.object({
    task: z.string(),
    assigned_to: z.string(),
    status: z
        .enum(["pending", "in_progress", "completed", "blocked"])
        .default("pending"),
    parent_id: z.string().optional(),
    dependencies: z.array(z.string()).optional(),
});

export const write_todos = tool(
    async ({ filename, todos }: { filename: string; todos: any[] }) => {
        try {
            await fs.promises.mkdir(BASE_DIR, { recursive: true });
            const realFileName = filename.endsWith(".json") ? filename : `${filename}.json`;
            const filePath = path.join(BASE_DIR, realFileName);
            const now = new Date().toISOString();

            const enriched = todos.map((t) => ({
                id: uuid(),
                task: t.task,
                assigned_to: t.assigned_to,
                status: t.status ?? "pending",
                parent_id: t.parent_id,
                dependencies: t.dependencies ?? [],
                created_at: now,
                updated_at: now,
            }));

            await fs.promises.writeFile(filePath, JSON.stringify(enriched, null, 2), "utf8");

            return `TODO list saved: ${realFileName}\n${JSON.stringify(enriched, null, 2)}`;
        } catch (error: any) {
            return `Error writing TODO list: ${error.message}`;
        }
    },
    {
        name: "write_todos",
        description: "Creates a structured TODO list for a workflow. Each task gets a UUID, timestamps, and status.",
        schema: z.object({
            filename: z.string().describe("Name of the TODO file (e.g. 'research-plan' or 'tasks/frontend')"),
            todos: z.array(InputTaskSchema),
        }),
    }
);

export const read_todos = tool(
    async ({ filename }: { filename: string }) => {
        try {
            const realFileName = filename.endsWith(".json") ? filename : `${filename}.json`;
            const filePath = path.join(BASE_DIR, realFileName);

            if (!fs.existsSync(filePath)) {
                return "No TODO list found";
            }

            const raw = await fs.promises.readFile(filePath, "utf-8");
            const todos = JSON.parse(raw);
            return JSON.stringify(todos, null, 2);
        } catch (error: any) {
            return `Error reading TODO list: ${error.message}`;
        }
    },
    {
        name: "read_todos",
        description: "Read a workflow TODO list",
        schema: z.object({
            filename: z.string().describe("Filename containing the TODO list"),
        }),
    }
);

export const update_todos = tool(
    async ({ filename, updates }: { filename: string; updates: any[] }) => {
        try {
            const invalidIds = updates.filter((u: any) => !isUUID(u.id));
            if (invalidIds.length > 0) {
                return "Invalid task IDs detected. Please use valid UUIDs.";
            }

            const realFileName = filename.endsWith(".json") ? filename : `${filename}.json`;
            const filePath = path.join(BASE_DIR, realFileName);

            if (!fs.existsSync(filePath)) {
                return "No TODO list found";
            }

            const raw = await fs.promises.readFile(filePath, "utf8");
            let todos = JSON.parse(raw);

            updates.forEach((u: any) => {
                const index = todos.findIndex((t: any) => t.id === u.id);
                if (index !== -1) {
                    todos[index] = {
                        ...todos[index],
                        ...u,
                        updated_at: new Date().toISOString(),
                    };
                }
            });

            await fs.promises.writeFile(filePath, JSON.stringify(todos, null, 2), "utf8");
            return "TODO list updated successfully";
        } catch (error: any) {
            return `Error updating TODO list: ${error.message}`;
        }
    },
    {
        name: "update_todos",
        description: "Updates tasks in a workflow TODO list by their UUID. Only include fields that need to change.",
        schema: z.object({
            filename: z.string(),
            updates: z.array(
                z.object({
                    id: z.string(),
                    task: z.string().optional(),
                    assigned_to: z.string().optional(),
                    status: z.enum(["pending", "in_progress", "completed", "blocked"]).optional(),
                })
            ),
        }),
    }
);

export const get_next_runnable_tasks = tool(
    async ({ filename }: { filename: string }) => {
        try {
            const realFileName = filename.endsWith(".json") ? filename : `${filename}.json`;
            const filePath = path.join(BASE_DIR, realFileName);

            if (!fs.existsSync(filePath)) return "No TODO list found";

            const raw = await fs.promises.readFile(filePath, "utf8");
            const todos = JSON.parse(raw);

            const completedIds = new Set(
                todos.filter((t: any) => t.status === "completed").map((t: any) => t.id)
            );

            const runnable = todos.filter((t: any) => {
                if (t.status !== "pending") return false;
                const deps = t.dependencies || [];
                return deps.every((depId: string) => completedIds.has(depId));
            });

            if (runnable.length === 0) return "No runnable tasks found";

            return JSON.stringify(runnable, null, 2);
        } catch (error: any) {
            return `Error getting runnable tasks: ${error.message}`;
        }
    },
    {
        name: "get_next_runnable_tasks",
        description: "Get pending tasks whose dependencies are all completed",
        schema: z.object({
            filename: z.string().describe("Filename containing the TODO list"),
        }),
    }
);

export const todoListTools = [write_todos, read_todos, update_todos, get_next_runnable_tasks];
