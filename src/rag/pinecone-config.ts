import { Pinecone as PineconeClient } from "@pinecone-database/pinecone";

const INDEX_NAME = process.env.PINECONE_INDEX_NAME || "codecraft-index";
const DIMENSION = 1536;
const METRIC = "cosine";

let cachedClient: PineconeClient | null = null;

export function getPineconeClient(): PineconeClient {
    if (!cachedClient) {
        const apiKey = process.env.PINECONE_API_KEY;
        if (!apiKey) throw new Error("PINECONE_API_KEY is not set in environment");
        cachedClient = new PineconeClient({ apiKey });
    }
    return cachedClient;
}

export async function ensureIndexExists(): Promise<void> {
    const pinecone = getPineconeClient();
    const indexes = await pinecone.listIndexes();
    const existing = indexes.indexes?.find((idx: any) => idx.name === INDEX_NAME);

    if (existing) {
        console.log(`[Pinecone] Index "${INDEX_NAME}" already exists`);
        return;
    }

    console.log(`[Pinecone] Creating index "${INDEX_NAME}"...`);
    await pinecone.createIndex({
        name: INDEX_NAME,
        dimension: DIMENSION,
        metric: METRIC,
        spec: {
            serverless: {
                cloud: "aws",
                region: "us-east-1",
            },
        },
    } as any);

    console.log(`[Pinecone] Index "${INDEX_NAME}" created successfully`);
}

export function getIndex() {
    const pinecone = getPineconeClient();
    return pinecone.Index(INDEX_NAME);
}

export { INDEX_NAME };
