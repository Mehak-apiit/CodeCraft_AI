import { Document } from "@langchain/core/documents";
import { HumanMessage } from "@langchain/core/messages";
import { LLM } from "../../llm/llm";
import { ChatCohere } from "@langchain/cohere";

export const formatDocumentAsString = (documents: Document[]) => {
    return documents.map((doc) => doc?.pageContent).join("\n\n");
};

export async function bm25Retriever(document: string, query: string) {
    const newDoc = new Document({
        pageContent: document,
        metadata: {
            title: "user :" + "DAILY_LOG_ARCHIVE",
        },
    });

    const textsplitters = await import("@langchain/textsplitters");
    const bm25Module = require("@langchain/community/retrievers/bm25");

    const docSplitter = new textsplitters.RecursiveCharacterTextSplitter({chunkSize: 800, chunkOverlap: 200});
    const splitDocs = await docSplitter.splitDocuments([newDoc]);
    const BM25Retriever = bm25Module.BM25Retriever;
    const retriever = BM25Retriever.fromDocuments([...splitDocs], {k: 4});
    const data = await retriever.invoke(query);
    const docToString = formatDocumentAsString(data);
    const filteredData = await extractRelevantDocument(query, docToString);
    return filteredData;
}

export async function extractRelevantDocument(query: string, doc: string) {
    const llm = LLM.getInstance("cohere");
    const prompt = `You are a relevance filter for a Retrieval-Augmented Generation (RAG) system.
Task: Select ONLY the parts of the context that are directly useful for answering the user's question.
Rules:
- Extract text EXACTLY as it appears in the context (verbatim)
- DO NOT paraphrase, summarize, explain or edit.
- The extracted text MUST clearly and explicitly help answer the question.
- If a passage is only loosely related, EXCLUDE it.
- If NO part of the context is directly relevant, return exactly: ""

User Question: ${query}

Retrieved Data: ${doc}

Return ONLY the extracted context text.`;

    const response = await llm.invoke([new HumanMessage(prompt)]);
    return response?.content;
}
