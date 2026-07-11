import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { appendAFile } from "../helper/fsHelper";

export function createWriteLTMTool(memoryRoot: string, userData: {userId: string; projectId: string}) {
    return tool(
        async ({content}) => {
            const now = new Date();
            const formattedDate = now.toTimeString().slice(0, 8);
            const memoryContent = `## [Time: ${formattedDate}] \n${content}\n\n`;
            try {
                return await appendAFile(memoryRoot, `MEMORY-${userData.userId}.md`, memoryContent);
            } catch (error: any) {
                return JSON.stringify({message: "Failed to write to long-term memory"});
            }
        },
        {
            name: "writeLTM",
            description: "This tool allows you to write into the LongTerm memory MEMORY.md",
            schema: z.object({
                content: z.string(),
            }),
        }
    );
}

export const writeLTMTool = tool(
    async ({content}) => {
        const now = new Date();
        const formattedDate = now.toTimeString().slice(0, 8);
        const memoryContent = `## [Time: ${formattedDate}] \n${content}\n\n`;
        return `Written to LTM: ${content.substring(0, 100)}...`;
    },
    {
        name: "writeLTM",
        description: "This tool allows you to write into the LongTerm memory MEMORY.md",
        schema: z.object({
            content: z.string(),
        }),
    }
);
