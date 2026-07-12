import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { appendAFile } from "../helper/fsHelper";

export function createWriteLTMTool(memoryRoot: string, userData: { userId: string; projectId: string }) {
    return tool(
        async ({ content }) => {
            const now = new Date();
            const formattedDate = now.toISOString();
            const memoryContent = `## [Time: ${formattedDate}] \n${content}\n\n`;
            try {
                return await appendAFile(memoryRoot, `MEMORY-${userData.userId}.md`, memoryContent);
            } catch (error: any) {
                return JSON.stringify({ message: "Failed to write to long-term memory", error: error.message });
            }
        },
        {
            name: "writeLTM",
            description: "Write content into Long-Term Memory (MEMORY-{userId}.md)",
            schema: z.object({
                content: z.string().describe("The content to store in long-term memory"),
            }),
        }
    );
}

export function getWriteLTMTool(memoryRoot: string, userData: { userId: string; projectId: string }) {
    return createWriteLTMTool(memoryRoot, userData);
}
