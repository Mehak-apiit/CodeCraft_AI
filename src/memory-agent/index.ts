import path from "node:path";
import { createAgent } from "langchain";
import { HumanMessage } from "@langchain/core/messages";
import { memoryStore } from "./memo/memoryStore";
import { ContextBuilder } from "./memo/contextBuilder";
import { retrieveRelevantLTMTool } from "./tools/hybrid-search";
import { transferTool } from "./tools/transferTool";
import { getWriteLTMTool } from "./tools/writeLTMTool";
import { compressSTMTool } from "./tools/compressSTMTool";
import { MEMORY_AGENT_SYSTEM } from "./prompt/memory-prompt";
import { MEMORY_DIR } from "../config/paths";

export async function createMemoryAgent({
    memoryRoot = MEMORY_DIR,
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

    const agent = createAgent({
        model,
        tools: [getWriteLTMTool(memoryRoot, {userId, projectId}), retrieveRelevantLTMTool, transferTool, compressSTMTool],
        systemPrompt: MEMORY_AGENT_SYSTEM,
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

    async function streamMemoryAgentResult(userInput: string, streamConfig: any) {
        const [contextRetriever, _] = await Promise.all([
            contextBuilder.assemble(userInput, {}),
            memo.logInteraction("User", userInput, new Date()),
        ]);

        let fullContent = "";
        for await (const chunk of await agent.stream(
            {messages: [{role: "user", content: contextRetriever?.prompt}]},
            {streamMode: "updates"}
        )) {
            const updates = (chunk as any)?.tools?.messages;
            const req = (chunk as any)?.model_request?.messages;
            if(updates && updates.length > 0){
                if(updates[0].name === "retrieve_relevant_ltm" || updates[0].name === "transferTool"){
                    fullContent += '<think>' + updates[0].content + '</think>';
                    streamConfig?.writer?.({
                        manager_name: "memoryManager",
                        content: '<think>' + updates[0].content + '</think>'
                    });
                }
            }
        }
        await memo.logInteraction("Coder-Agent", fullContent, new Date());
        return {fullContent, coderAgentContext: contextRetriever?.coderAgentContextLayers};
    }

    return {
        invokeMemoryAgent,
        streamMemoryAgentResult
    };
}
