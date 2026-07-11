import path from "node:path";
import { createReactAgent } from "@langchain/langgraph/dist/prebuilt";
import { HumanMessage } from "@langchain/core/messages";
import { memoryStore } from "./memo/memoryStore";
import { ContextBuilder } from "./memo/contextBuilder";
import { retrieveRelevantLTMTool } from "./tools/hybrid-search";
import { transferTool } from "./tools/transferTool";
import { writeLTMTool } from "./tools/writeLTMTool";
import { compressSTMTool } from "./tools/compressSTMTool";
import { MEMORY_AGENT_SYSTEM } from "./prompt/memory-prompt";

export async function createMemoryAgent({
    memoryRoot = path.resolve(process.cwd(), "public", "memory"),
    model,
    modelContextLimit = 8000,
    userId = "",
    projectId = "",
}: {
    memoryRoot?: string;
    model: any;
    modelContextLimit?: number;
    userId?: string;
    projectId?: string;
} = {} as any) {
    const memo = new memoryStore(memoryRoot, {userId, projectId});
    await memo.init();
    const contextBuilder = new ContextBuilder(memo, modelContextLimit, {userId, projectId});

    const agent = createReactAgent({
        llm: model,
        tools: [writeLTMTool, retrieveRelevantLTMTool, transferTool, compressSTMTool],
        messageModifier: MEMORY_AGENT_SYSTEM,
    });

    async function invokeMemoryAgent(userInput: string) {
        const [contextRetriever, _] = await Promise.all([
            contextBuilder.assemble(userInput, {}),
            memo.logInteraction("User", userInput, new Date()),
        ]);

        const agentOutput = await agent.invoke({
            messages: [
                new HumanMessage(contextRetriever?.prompt),
            ],
        });

        const aiResponse = agentOutput.messages[agentOutput.messages.length - 1].content as string;
        await memo.logInteraction("Assistant", aiResponse, new Date());
        return aiResponse;
    }

    return {
        invokeMemoryAgent,
    };
}
