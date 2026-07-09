import { CohereEmbeddings } from "@langchain/cohere";
import { PineconeStore } from "@langchain/pinecone";
import { getIndex, ensureIndexExists } from "./pinecone-config";

let embeddingsInstance: CohereEmbeddings | null = null;

function getEmbeddings(): CohereEmbeddings {
    if (!embeddingsInstance) {
        const apiKey = process.env.COHERE_API_KEY;
        if (!apiKey) throw new Error("COHERE_API_KEY is not set in environment");
        embeddingsInstance = new CohereEmbeddings({
            model: "embed-english-v3.0",
            apiKey,
        });
    }
    return embeddingsInstance;
}

async function getVectorStore() {
    await ensureIndexExists();
    const index = getIndex();
    const embeddings = getEmbeddings();
    return PineconeStore.fromExistingIndex(embeddings, {
        pineconeIndex: index,
        maxConcurrency: 5,
    });
}

export async function queryMultiVector({
    userId,
    projectId,
    query,
    kChildren = 6,
    kParents = 3,
}: {
    userId: string;
    projectId?: string;
    query: string;
    kChildren?: number;
    kParents?: number;
}) {
    const vectorStore = await getVectorStore();

    const childFilter: Record<string, any> = {
        docType: "child",
        userId,
        ...(projectId ? { projectId } : {}),
    };

    const childDocs = await vectorStore.similaritySearch(query, kChildren, childFilter);
    console.log(`[RAG] Found ${childDocs.length} child matches`);

    if (childDocs.length === 0) {
        return { query, retrievedDocs: [], childMatches: 0 };
    }

    const parentIds = [
        ...new Set(
            childDocs
                .map((doc: any) => doc.metadata.parentId)
                .filter((id: string | undefined) => id != null)
        ),
    ];

    console.log(`[RAG] Fetching ${parentIds.length} parent chunks`);

    const parentFilter: Record<string, any> = {
        docType: "parent",
        userId,
        ...(projectId ? { projectId } : {}),
    };

    const allParents = await vectorStore.similaritySearch(query, kParents * 3, parentFilter);

    const retrievedDocs = allParents
        .filter((doc: any) => parentIds.includes(doc.metadata.parentId || doc.metadata.chunkId))
        .slice(0, kParents);

    console.log(`[RAG] Retrieved ${retrievedDocs.length} parent documents`);

    return {
        query,
        retrievedDocs,
        childMatches: childDocs.length,
    };
}

if (require.main === module) {
    async function main() {
        console.log("Testing retrieval pipeline...");
        console.log("Note: Requires COHERE_API_KEY and PINECONE_API_KEY in .env");

        const result = await queryMultiVector({
            userId: "test-user",
            projectId: "test-project",
            query: "how to use bash tool",
            kChildren: 3,
            kParents: 2,
        });

        console.log("Result:", {
            query: result.query,
            childMatches: result.childMatches,
            parentDocs: result.retrievedDocs.length,
        });
    }

    main().catch((err) => {
        console.error("Test failed:", err.message);
        process.exit(1);
    });
}
