import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { exec } from "child_process";
import { promisify } from "util";
import path from "path";
import fs from "fs";

const execAsync = promisify(exec);

/**
 * ✅ FIX: Always use a stable project sandbox folder
 * (NOT just public/working-dir confusion)
 */
const WORKING_DIR = path.resolve(process.cwd(), "sandbox");

const MAX_OUTPUT_CHARS = 8000;

const isWindows = process.platform === "win32";
const SHELL = isWindows ? "cmd.exe" : "/bin/bash";

/**
 * Dangerous commands blocked
 */
const BLOCKED_PATTERNS = [
    /rm\s+-rf\s+\/(?!\w)/,
    />\s*\/dev\//,
    /mkfs/,
    /dd\s+if=/,
    /:\(\)\s*\{.*\}/,
    /sudo\s+rm/,
    /shutdown|reboot|halt/,
    /curl\s+.*\|\s*(?:bash|sh|zsh)/,
    /wget\s+.*\|\s*(?:bash|sh|zsh)/,
    /\beval\b/,
    /base64\s+.*\|\s*(?:bash|sh)/,
];

/**
 * Commands that may hang
 */
const INTERACTIVE_PATTERNS = [
    /\bnpm\s+init\b(?!.*-y)/i,
    /\bapt(?:-get)?\s+install\b(?!.*-y)/i,
    /\bgit\s+commit\b(?!.*-m)/i,
    /\b(?:nano|vim?|vi|emacs|less|more)\b/i,
    /\bssh\b/i,
];

async function ensureWorkingDir() {
    await fs.promises.mkdir(WORKING_DIR, { recursive: true });
}

/**
 * Fix Windows/Linux interactive commands
 */
function normalizeCommand(command: string): string {
    if (isWindows) {
        if (/^rd\s+\/s\s+/i.test(command) && !/\/q/i.test(command)) {
            return command.replace(/rd\s+\/s/i, "rd /s /q");
        }
    } else {
        if (/npm\s+init(?!.*-y)/.test(command)) return command + " -y";
        if (/apt(?:-get)?\s+install(?!.*-y)/.test(command))
            return command.replace(/install/, "install -y");
    }
    return command;
}

/**
 * Prevent huge output crashes
 */
function truncateOutput(output: string): string {
    if (output.length <= MAX_OUTPUT_CHARS) return output;

    const half = Math.floor(MAX_OUTPUT_CHARS / 2);

    return (
        output.slice(0, half) +
        `\n\n... [truncated ${output.length - MAX_OUTPUT_CHARS} chars] ...\n\n` +
        output.slice(-half)
    );
}

/**
 * MAIN TOOL
 */
export const bashTool = tool(
    async ({ command, timeout }) => {
        await ensureWorkingDir();

        console.log("📁 Running in:", WORKING_DIR);
        console.log("⚡ Command:", command);

        // ❌ Block dangerous commands
        for (const pattern of BLOCKED_PATTERNS) {
            if (pattern.test(command)) {
                return `❌ Blocked dangerous command: "${command}"`;
            }
        }

        // ⚠️ Handle interactive commands
        for (const pattern of INTERACTIVE_PATTERNS) {
            if (pattern.test(command)) {
                const fixed = normalizeCommand(command);

                if (fixed !== command) {
                    command = fixed;
                } else {
                    return `⚠️ Interactive command detected (may hang): "${command}"`;
                }
            }
        }

        try {
            const { stdout, stderr } = await execAsync(command, {
                cwd: WORKING_DIR,
                timeout: Math.min(Math.max(timeout ?? 20, 5), 120) * 1000,
                maxBuffer: 1024 * 1024 * 2,
                shell: SHELL,
            });

            const out: string[] = [];

            if (stdout?.trim()) {
                out.push(`STDOUT:\n${truncateOutput(stdout.trim())}`);
            }

            if (stderr?.trim()) {
                out.push(`STDERR:\n${truncateOutput(stderr.trim())}`);
            }

            return out.length ? out.join("\n\n") : "Command completed successfully";
        } catch (err: any) {
            const msg: string[] = [err.message];

            if (err.stdout) {
                msg.push(`STDOUT:\n${truncateOutput(err.stdout)}`);
            }

            if (err.stderr) {
                msg.push(`STDERR:\n${truncateOutput(err.stderr)}`);
            }

            return `❌ Command failed:\n${msg.join("\n")}`;
        }
    },
    {
        name: "bash",
        description:
            "Safe cross-platform shell tool running inside sandbox directory. Used for npm, git, build commands.",
        schema: z.object({
            command: z.string().min(1).max(2000),
            timeout: z.number().min(5).max(120).optional(),
        }),
    }
);

/**
 * TEST RUN
 */
async function main() {
    const res = await bashTool.invoke({
        command: "mkdir Mehak",
        timeout: 60,
    });

    console.log("\n📌 RESULT:\n", res);
}

main();