import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { HumanMessage } from "@langchain/core/messages";
import { getTaskToolDescription, DEFAULT_SUBAGENT_PROMPT } from "./taskToolPrompt";

export const createTool = (model: any, config: any = {}) => {
    return tool(
        async ({ sub_agent, task }: { sub_agent: string; task: string }, toolConfig: any) => {
            if (!task || !sub_agent) {
                return "Please provide sub_agent name and task that will be executed";
            }

            const { createReactAgent } = await import("@langchain/langgraph/prebuilt");
            const subagent = createReactAgent({
                llm: model,
                tools: [...(config.tools || [])],
                messageModifier: `${DEFAULT_SUBAGENT_PROMPT}\n\nTask: ${task}`,
            });

            const subagentStream = await subagent.stream(
                { messages: [new HumanMessage(task)] },
                { streamMode: "messages", ...toolConfig }
            );

            let finalContent = "";
            for await (const event of subagentStream) {
                const chunk = (event as any)[0] || event;
                if (chunk?.role !== "ai") continue;
                if (chunk?.content) {
                    if (toolConfig?.writer) {
                        toolConfig.writer({
                            subagent_name: sub_agent,
                            content: chunk.content,
                        });
                    }
                    finalContent += chunk.content;
                }
            }
            return finalContent;
        },
        {
            name: "task",
            description: getTaskToolDescription(),
            schema: z.object({
                sub_agent: z.string().describe("The name must be unique for each spawned sub-agent, e.g. webscraper"),
                task: z.string().describe("Highly detailed instructions for the subagent"),
            }),
        }
    );
};
