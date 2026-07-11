import { Document } from "@langchain/core/documents";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { CohereEmbeddings } from "@langchain/cohere";
import { PineconeStore } from "@langchain/pinecone";
import { v4 as uuidv4 } from "uuid";
import { getPineconeClient } from "../../rag/pinecone-config";

async function loadRawDocs(allDocs: Document[]) {
    return allDocs.flat();
}

async function createParentDocs(props: {rawDocs: Document[]; userId: string}) {
    const {rawDocs, userId} = props;
    const parentSplitter = new RecursiveCharacterTextSplitter({chunkSize: 2000, chunkOverlap: 400});
    const parentSplits = await parentSplitter.splitDocuments(rawDocs);
    return parentSplits.map((split: any) => {
        const chunkId = uuidv4();
        split.metadata.docType = "parent";
        split.metadata.chunkId = chunkId;
        split.metadata.parentId = chunkId;
        split.metadata.source = chunkId;
        split.metadata.userId = userId;
        return split;
    });
}

async function createChildDocs(props: {parentDocs: Document[]; userId: string}) {
    const {parentDocs, userId} = props;
    const childSplitter = new RecursiveCharacterTextSplitter({chunkSize: 800, chunkOverlap: 100});
    const childSplits = await childSplitter.splitDocuments(parentDocs);
    return childSplits.map((split: any, i: number) => {
        const parentIndex = Math.floor(i / 4);
        const parentMetadata = parentDocs[parentIndex]?.metadata;
        const childChunkId = uuidv4();
        split.metadata.docType = "child";
        split.metadata.chunkId = childChunkId;
        split.metadata.parentId = parentMetadata?.chunkId;
        split.metadata.source = childChunkId;
        split.metadata.userId = userId;
        return split;
    });
}

export async function docEmbeddingMultiVector(props: {allDocs: Document[]; userId: string}) {
    const {allDocs, userId} = props;
    const embeddings = new CohereEmbeddings({
        model: "embed-english-v3.0",
        apiKey: process.env.COHERE_API_KEY,
    });

    const pinecone = await getPineconeClient();
    const pineconeIndex = pinecone.Index(process.env.PINECONE_INDEX_NAME || "codecraft-index");

    console.log("Loading raw documents...");
    const rawDocs = await loadRawDocs(allDocs);

    console.log("Creating parent chunks...");
    const parentDocs = await createParentDocs({rawDocs, userId});

    console.log("Creating child chunks...");
    const childDocs = await createChildDocs({parentDocs, userId});

    console.log("Storing in Pinecone...");
    const vectorStore = new PineconeStore(embeddings, {
        pineconeIndex,
        maxConcurrency: 5,
    });

    await vectorStore.addDocuments([...parentDocs, ...childDocs]);
    console.log(`Stored: ${parentDocs.length} parent + ${childDocs.length} child chunks`);
    console.log(`Total documents: ${parentDocs.length + childDocs.length}`);
}
