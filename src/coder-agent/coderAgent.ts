import { HumanMessage } from "@langchain/core/messages";
import { createAgent } from "langchain";
import { MemorySaver } from "@langchain/langgraph-checkpoint";
import { LLM } from "../llm/llm";
import { BASE_PROMPT } from "./prompt/system_prompt";
import "dotenv/config";
import { transferTool } from "@/memory-agent/tools/transferTool";
import { thinkTool } from "@/tools/task/thinkTool";
import { createTaskTool } from "@/tools/task/task";

const subagentConfigs = {
    tools: [ ]
}

const memory = new MemorySaver();

export async function codeAgent(userInput: any, selectedTools:any[]=[], agentConfig:Record<string,any>={}){
    const fixedToolsArray = (Array.isArray(selectedTools) ? selectedTools: []).filter(tool => tool !== undefined)
    const agent = createAgent({
        model: LLM.getInstance('cohere'),
        systemPrompt: `<system>${BASE_PROMPT}</system> \n\n`,
        tools:[
            ...fixedToolsArray,
            transferTool,
            thinkTool,
            createTaskTool(LLM.getInstance("cohere"),subagentConfigs),
        ],
    } as any);
    const result = await agent.invoke(
        {
            messages: [
                new HumanMessage(`
                    Your are collaborating with the tool Selector Agent.
                    if you need a tool, to do a task call
                    the transferTool tool to pass control to the tool selectorAgent,
                    eg: need you to select for me tool_name`),
                new HumanMessage('your are working on windows computer as environment. Do not use linux command'),
                new HumanMessage(userInput)
            ]
        },
        {
            configurable:{
                projectId: agentConfig.projectId,
                userId: agentConfig.userId
            }
        }
    );
    return result;
}
