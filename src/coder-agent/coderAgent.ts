import { ChatCohere } from "@langchain/cohere";
import { MemorySaver } from "@langchain/langgraph-checkpoint";
import { loadAllTools } from "../tools/toolRegistry";
import { BASE_PROMPT } from "./prompt/system_prompt";
import "dotenv/config";

const memory = new MemorySaver();

function getModel() {
    return new ChatCohere({
        model: 'command-a-03-2025',
        temperature: 0,
        apiKey: process.env.COHERE_API_KEY,
    });
}

export async function codeAgent(
    userInput: any,
    selectedTools: any[] = [],
    agentConfig: Record<string, any> = {}
) {
    const allTools = loadAllTools();
    const { createReactAgent } = require("@langchain/langgraph/prebuilt");

    const agent = createReactAgent({
        llm: getModel(),
        tools: allTools,
        checkpointSaver: memory,
        messageModifier: BASE_PROMPT,
    });

    const result = await agent.invoke(
        {
            messages: [
                { role: 'user', content: userInput }
            ]
        },
        {
            configurable: {
                thread_id: `coder-${agentConfig.userId}-${agentConfig.projectId}`,
                projectId: agentConfig.projectId,
                userId: agentConfig.userId
            }
        }
    );
    return result;
}
