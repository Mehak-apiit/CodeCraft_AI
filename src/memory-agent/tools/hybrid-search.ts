import { tool } from "@langchain/core/tools";
import { z } from "zod";
import path from "path";
import { memoryStore } from "../memo/memoryStore";

export const retrieveRelevantLTMTool = tool(
    async ({query}, config) => {
        const projectId = config.configurable?.projectId || "";
        const userId = config.configurable?.userId || "";

        const memoryRoot = path.resolve(process.cwd(), "public", "memory");
        const memoryManager = new memoryStore(memoryRoot, {userId, projectId});

        try {
            const archiveLog = await memoryManager.readArchiveFile();
            if (!archiveLog.exist) {
                return "No long-term memory found yet.";
            }

            const { bm25Retriever } = await import("../retriever/bm25Retriever");
            const results = await bm25Retriever(archiveLog.data, query);
            return results || "No relevant long-term memory found for this query.";
        } catch (error: any) {
            return `Error retrieving long-term memory: ${error.message}`;
        }
    },
    {
        name: "retrieve_relevant_ltm",
        description: "Retrieve relevant long-term memory entries using semantic and BM25 search",
        schema: z.object({
            query: z.string().describe("The search query to find relevant long-term memories"),
        }),
    }
);
