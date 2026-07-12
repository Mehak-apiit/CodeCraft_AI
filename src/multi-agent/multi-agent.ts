import {
    END,
    START,
    StateGraph,
    Annotation,
    MessagesAnnotation,
    Command,
    MemorySaver
} from "@langchain/langgraph";
import { LLM } from "../llm/llm";
import path from "path";
import { memoryStore } from "../memory-agent/memo/memoryStore";
import { createMemoryAgent } from "../memory-agent";
import { AIMessage, HumanMessage } from "@langchain/core/messages";
import { codeAgent } from "../coder-agent/coderAgent";

const llm = LLM.getInstance("cohere");
const memoryRoot = path.resolve(process.cwd(), "public", "memory");

const StateAnnotation = Annotation.Root({
    ...MessagesAnnotation.spec,
    projectId: Annotation<string>(),
    userId: Annotation<string>(),
    nextNode: Annotation<string>(),
    coderAgentContext: Annotation<string>(),
    selectedTools: Annotation<any[]>(),
    coderAgentMessage: Annotation<string | null>(),
});

const memoryAgentNode = async (state: any, config: any) => {
    console.log("=================memoryBuilder====================================");
    const { userId, projectId } = state;
    const last = state.messages
        .filter((m: any) => m._getType() === "human")
        .slice(-1)[0];
    const { streamMemoryAgentResult } = await createMemoryAgent({ model: llm, userId, projectId });
    const { fullContent, coderAgentContext } = await streamMemoryAgentResult(last?.content, config);
    const shouldHandoff = fullContent.includes("__TRANSFER__");
    if (shouldHandoff) {
        return new Command({
            update: { messages: [new AIMessage(fullContent)], coderAgentContext: coderAgentContext },
            goto: "coderAgent",
        });
    }
    return new Command({
        update: { messages: [new AIMessage(fullContent)], nextNode: END },
        goto: END
    });
};

const toolSelectorAgentNode = async (state: any, config: any) => {
    const selectedTools: any[] = [];
    const statusUpdate = new HumanMessage({
        content: `[SYSTEM_NOTIFICATION]: Tool access GRANTED.`
    });
    return new Command({
        update: {
            selectedTools: [...selectedTools],
            messages: [statusUpdate]
        },
        goto: "coderAgent"
    });
};

const coderAgentNode = async (state: any, agentConfig: any) => {
    console.log("=================coderAgent====================================");
    const { userId, projectId } = state;
    const memo = new memoryStore(memoryRoot, { userId, projectId });
    const cleanMessages = state.messages.filter((m: any) => {
        return !m.content?.includes("__TRANSFER__");
    });
    const last = state.messages
        .filter((m: any) => m._getType() === "human")
        .slice(-1)[0];

    const result = await codeAgent(last?.content || "", state.selectedTools, { userId, projectId }) as any;
    const aiResponse = result?.messages?.[result.messages.length - 1]?.content ?? "";
    await memo.logInteraction("Coder-Agent", aiResponse, new Date());

    const shouldHandoff = aiResponse.includes("__TRANSFER__");
    if (shouldHandoff) {
        return new Command({
            update: {
                coderAgentMessage: aiResponse,
                nextNode: "toolSelectorAgent"
            },
            goto: "toolSelectorAgent",
        });
    }
    return new Command({
        update: { messages: [new AIMessage(aiResponse)], nextNode: END },
        goto: END,
    });
};

const checkpointer = new MemorySaver();

const workflow = new StateGraph(StateAnnotation)
    .addNode("memoryAgent", memoryAgentNode)
    .addNode("coderAgent", coderAgentNode)
    .addNode("toolSelectorAgent", toolSelectorAgentNode)
    .addEdge(START, "memoryAgent")
    .addConditionalEdges('memoryAgent', (state) => {
        if (state.nextNode === "coderAgent") {
            return "coderAgent";
        }
        return END;
    })
    .addConditionalEdges('coderAgent', (state) => {
        if (state.nextNode === "toolSelectorAgent") {
            return "toolSelectorAgent";
        }
        return END;
    })
    .addEdge("toolSelectorAgent", 'coderAgent');

export const graph = workflow.compile({ checkpointer });
