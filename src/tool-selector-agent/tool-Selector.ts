import {
    END,
    START,
    StateGraph,
    Annotation,
    MessagesAnnotation,
    Command
} from "@langchain/langgraph";
import {
    AIMessage,
    SystemMessage,
    HumanMessage,
} from "@langchain/core/messages";
import z from "zod";
import { LLM } from "../llm/llm";

export async function toolSelector(llm:any, input:string){
    const toolNames = z.object({
        tools: z.array(z.string()).describe('List of usable tools'),
    }).describe('return a list of tools');
    const structuredLlm = llm.withStructuredOutput(toolNames);
    const result = await structuredLlm.invoke([
        new SystemMessage(
            `<system_message>
            Your are a **Tool Discovery & Provisioning Agent**.
            ## Objective
            Your job is to select the numbers of tools based on the user input
            ## Output Format
            you must returns an array of tools based on user input.
            eg:['write_file','edit_file',etc...]
            ## Restriction
            Do not pass into an array a tool which do not exist from tool-registry</system_message>`
        ),
        new HumanMessage(input)
    ]);
    return {result, toolMapContent: ""};
}

export const toolSelectorAgent = async (state:any, config: any)=>{
    const cleanMessage = state.coderAgentMessage || "";
    const llm = LLM.getInstance("cohere");
    const {result, toolMapContent} = await toolSelector(llm, cleanMessage);
    return new Command({
        update: {messages: [new AIMessage(JSON.stringify(result))], nextNode: END},
        goto: END
    });
};
