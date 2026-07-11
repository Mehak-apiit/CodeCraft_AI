import { tool } from "@langchain/core/tools";
import { z } from "zod";

export const transferTool = tool(
    async ({context}, config) => {
        try {
            return `<think>__TRANSFER__ + ${context}</think>`;
        } catch (error) {
            return JSON.stringify({error: "Error occurred, please try again"});
        }
    },
    {
        name: "transferTool",
        description: "This tool allows you to transfer control to Assistant-2. Return the result as a final response.",
        schema: z.object({
            context: z.string().describe("The context to transfer to the next agent"),
        }),
    }
);
