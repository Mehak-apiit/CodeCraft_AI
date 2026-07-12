import { MongoClient } from "mongodb";
import { MongoDBSaver } from "@langchain/langgraph-checkpoint-mongodb";

let mongodbClient: MongoClient | null = null;
let checkpointerInstance: any = null;

export function getMongoClient(): MongoClient {
    if (!mongodbClient) {
        const dbUrl = process.env.DB_URL;
        if (!dbUrl) {
            throw new Error("DB_URL is not set in environment variables");
        }
        mongodbClient = new MongoClient(dbUrl);
    }
    return mongodbClient;
}

export function getCheckpointer(): any {
    if (!checkpointerInstance) {
        const client = getMongoClient();
        checkpointerInstance = new MongoDBSaver({ client } as any);
    }
    return checkpointerInstance;
}

export function isConnected(): boolean {
    return mongodbClient !== null;
}
