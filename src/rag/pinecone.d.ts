declare module "@pinecone-database/pinecone" {
    export interface PineconeConfig {
        apiKey: string;
    }

    export interface IndexDescription {
        name: string;
        dimension?: number;
        metric?: string;
        status?: any;
        spec?: any;
    }

    export interface CreateIndexParams {
        name: string;
        dimension: number;
        metric: string;
        spec?: any;
    }

    export class Pinecone {
        constructor(config: PineconeConfig);
        Index(indexName: string): any;
        listIndexes(): Promise<{ indexes?: IndexDescription[] }>;
        createIndex(params: CreateIndexParams): Promise<void>;
        deleteIndex(indexName: string): Promise<void>;
    }
}
