import { Document } from "@langchain/core/documents";
import { bm25Retriever } from "./bm25Retriever";

export interface HybridSearchResult {
    documents: Document[];
    scores: number[];
}

export async function hybridSearch(
    query: string,
    archiveContent: string,
    options: { topK?: number } = {}
): Promise<HybridSearchResult> {
    const { topK = 5 } = options;

    try {
        const bm25Results = await bm25Retriever(archiveContent, query);

        const documents: Document[] = [];
        if (bm25Results && typeof bm25Results === 'string' && bm25Results.trim()) {
            documents.push(new Document({
                pageContent: bm25Results,
                metadata: { source: "bm25", score: 1.0 }
            }));
        }

        return {
            documents: documents.slice(0, topK),
            scores: documents.slice(0, topK).map(() => 1.0),
        };
    } catch (error: any) {
        console.error("Hybrid search error:", error.message);
        return { documents: [], scores: [] };
    }
}
