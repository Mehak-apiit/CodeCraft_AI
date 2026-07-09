import { CohereEmbeddings } from "@langchain/cohere";
import { PineconeStore } from "@langchain/pinecone";
import { v4 as uuidv4 } from "uuid";
import { chunkFileByAST } from "./chunker";
import { getIndex, ensureIndexExists } from "./pinecone-config";
import path from "path";

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

function createChildrenFromParent(parentDoc: Record<string, any>, parentId: string) {
    const lines = parentDoc.pageContent.split("\n");
    const mid = Math.ceil(lines.length / 2);
    const halves = [
        lines.slice(0, mid).join("\n"),
        lines.slice(mid).join("\n"),
    ].filter((h) => h.trim().length > 0);

    return halves.map((half, i) => ({
        pageContent: half,
        metadata: {
            ...parentDoc.metadata,
            docType: "child",
            parentId,
            chunkId: `child-${parentId}-${i}`,
            source: parentDoc.metadata.filePath || "unknown",
            chunkIndex: i,
        },
    }));
}

async function getEmbeddedFileHashes(userId: string, projectId: string): Promise<Set<string>> {
    try {
        const vectorStore = await getVectorStore();
        const results = await vectorStore.similaritySearch("*", 10000, {
            docType: "parent",
            userId,
            ...(projectId ? { projectId } : {}),
        });
        const hashes = new Set<string>();
        for (const doc of results) {
            if (doc.metadata?.filePath) {
                hashes.add(doc.metadata.filePath);
            }
        }
        return hashes;
    } catch {
        return new Set();
    }
}

export async function embedFilesWithAST({
    files,
    userId,
    projectId = "default",
}: {
    files: { path: string; content: string }[];
    userId: string;
    projectId?: string;
}) {
    const embeddings = getEmbeddings();
    const vectorStore = await getVectorStore();

    const existingFiles = await getEmbeddedFileHashes(userId, projectId);
    const newFiles = files.filter((f) => !existingFiles.has(f.path));

    if (newFiles.length === 0) {
        console.log("[RAG] All files already embedded, skipping");
        return { fileChunkMap: {}, parentCount: 0, childCount: 0, total: 0 };
    }

    const parentDocs: any[] = [];
    const childDocs: any[] = [];
    const fileChunkMap: Record<string, number> = {};

    for (const { path: filePath, content } of newFiles) {
        const ext = path.extname(filePath).toLowerCase();
        const chunks = chunkFileByAST(content, filePath, ext);
        let fcc = 0;

        for (const chunk of chunks) {
            const parentId = uuidv4();
            const parentDoc = {
                pageContent: chunk.pageContent,
                metadata: {
                    ...chunk.metadata,
                    docType: "parent",
                    chunkId: parentId,
                    parentId,
                    source: filePath,
                    userId,
                    projectId,
                    filePath,
                    embeddedAt: new Date().toISOString(),
                },
            };
            parentDocs.push(parentDoc);

            if (chunk.pageContent.length > 600) {
                const children = createChildrenFromParent(parentDoc, parentId).map((c) => ({
                    ...c,
                    metadata: { ...c.metadata, userId, projectId, filePath },
                }));
                childDocs.push(...children);
                fcc += children.length;
            }
        }

        fileChunkMap[filePath] = chunks.length;
        console.log(`[RAG] ${filePath} -> ${chunks.length} AST chunks, ${fcc} children`);
    }

    if (parentDocs.length === 0) {
        console.log("[RAG] No new chunks to embed");
        return { fileChunkMap, parentCount: 0, childCount: 0, total: 0 };
    }

    console.log(`[RAG] Upserting ${parentDocs.length} parents + ${childDocs.length} children...`);

    const allDocs = [...parentDocs, ...childDocs];
    const BATCH_SIZE = 100;
    for (let i = 0; i < allDocs.length; i += BATCH_SIZE) {
        const batch = allDocs.slice(i, i + BATCH_SIZE);
        await vectorStore.addDocuments(batch);
        console.log(`[RAG] Upserted batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(allDocs.length / BATCH_SIZE)}`);
    }

    console.log(`[RAG] Done`);

    return {
        fileChunkMap,
        parentCount: parentDocs.length,
        childCount: childDocs.length,
        total: parentDocs.length + childDocs.length,
    };
}

if (require.main === module) {
    async function main() {
        const sampleFiles = [
            {
                path: "src/tools/bash.ts",
                content: `import { tool } from "@langchain/core/tools";
export function bashTool() { return "hello"; }`,
            },
        ];

        const result = await embedFilesWithAST({
            files: sampleFiles,
            userId: "test-user",
            projectId: "test-project",
        });

        console.log("Result:", result);
    }

    main().catch((err) => {
        console.error("Test failed:", err.message);
        process.exit(1);
    });
}
