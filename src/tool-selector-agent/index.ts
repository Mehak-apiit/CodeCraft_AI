import { ToolEntry, TOOL_REGISTRY } from "../tools/toolRegistry";
import { LLM } from "../llm/llm";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { z } from "zod";
import { createLogger } from "../utils/logger";

const logger = createLogger('ToolSelector');

export async function selectTools(userInput: string): Promise<{
    selectedTools: any[];
    toolNames: string[];
}> {
    const toolDescriptions = Object.entries(TOOL_REGISTRY)
        .map(([category, entry]) => `- ${category}: ${entry.description} (tools: ${entry.tools.join(', ')})`)
        .join('\n');

    const selectionSchema = z.object({
        categories: z.array(z.string()).describe("Tool categories to activate based on user request"),
    });

    const llm = LLM.getInstance("cohere-fast");
    const structuredLlm = llm.withStructuredOutput(selectionSchema);

    const response = await structuredLlm.invoke([
        new SystemMessage(`You are a tool selection agent. Given a user request, select which tool categories to activate.

Available categories:
${toolDescriptions}

Select ONLY the categories needed for the task. Return category names (e.g., "filesystem", "bash", "git").`),
        new HumanMessage(userInput)
    ]);

    const selectedCategories = (response as any).categories || [];
    const selectedTools: any[] = [];
    const toolNames: string[] = [];

    for (const category of selectedCategories) {
        const entry = TOOL_REGISTRY[category];
        if (entry) {
            selectedTools.push(...entry.loadedTools);
            toolNames.push(...entry.tools);
            logger.info(`Activated category: ${category}`);
        }
    }

    return { selectedTools, toolNames };
}
