import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { SystemMessage, HumanMessage } from "@langchain/core/messages";
import { LLM } from "../../llm/llm";

const SYSTEM_PROMPT = `
You are a Memory Compression Agent.
Your task is to compress a full daily chat log into a clean, durable summary.
Rules:
- Remove all internal reasoning traces such as <think> blocks.
- Ignore system prompts, tool calls, and assistant planning text.
- Extract only meaningful conversational content.
- Remove timestamps and formatting noise.
- Do not rewrite the conversation as dialogue.
- Do not add new information.
- Preserve stable user facts.
- Keep summary concise (max 150-250 words).

Output Format:
# Daily Log Summary
Date: {date}
Status: Compressed

## Overview
{1-2 sentence high-level description}

## Key Facts Extracted
- {fact 1}
- {fact 2}

## Conversation Summary
{Short narrative summary}
`.trim();

export const compressSTMTool = tool(
    async ({message}) => {
        const llm = LLM.getInstance("cohere");
        const res = await llm.invoke([
            new SystemMessage(SYSTEM_PROMPT),
            new HumanMessage(message),
        ]);
        return res?.content;
    },
    {
        name: "summarize_message",
        description: "Compress and summarize long-term conversation context",
        schema: z.object({
            message: z.string().describe("Raw text or concatenated messages to be summarized"),
        }),
    }
);
