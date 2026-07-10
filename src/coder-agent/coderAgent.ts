import { HumanMessage } from "@langchain/core/messages";
import { createReactAgent } from "@langchain/langgraph/dist/prebuilt";
import { MemorySaver } from "@langchain/langgraph-checkpoint";
import { LLM } from "../llm/llm";
import { BASE_PROMPT } from "./prompt/system_prompt";
import { loadAllTools } from "../tools/toolRegistry";
import "dotenv/config";

const memory = new MemorySaver();

export async function codeAgent(userInput: string) {
    const model = LLM.getInstance("cohere");
    const tools = loadAllTools();

    const agent = createReactAgent({
        llm: model,
        tools,
        checkpointSaver: memory,
        messageModifier: BASE_PROMPT,
    });

    const result = await agent.invoke(
        {
            messages: [
                new HumanMessage(
                    `You are working on a Windows computer. Do not use Linux-only commands.\n\n${userInput}`
                ),
            ],
        },
        { configurable: { thread_id: "coder-session" }, recursionLimit: 300 }
    );

    return result;
}

if (require.main === module) {
    async function runCoder() {
        const result = await codeAgent(`
You are starting a brand new session on this project.
Follow your session start checklist exactly in order:
1. read_agent_index - load whatever memory exists
2. list_agent_module - check what module files exist
3. build_import_graph - scan all JS/TS files and map dependencies
4. file_tree - get the full project layout
5. ast_analyze - pick the 3 most central files from the import graph and analyze each one
6. update_agent_index - update these sections: Project Overview, Tech Stack, Entry Points, Module Map, Key Conventions

At the end, print a summary of:
- How many files were found
- What modules you created in .agent/modules/
- The top 3 most imported files
- Any isolated (potentially dead) files
- What entry points were detected
        `);

        const lastMsg = result.messages[result.messages.length - 1];
        console.log("\n=== Agent Response ===\n");
        console.log(lastMsg.content);
    }

    runCoder().catch(console.error);
}
