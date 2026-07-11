import { Document } from "@langchain/core/documents";
import { memoryStore, UserData } from "./memoryStore";
import { compressSTMTool } from "../tools/compressSTMTool";
import { docEmbeddingMultiVector } from "../retriever/multivector-retriever";
import { estimateTokens } from "../helper/estimateTokens";

export class ContextBuilder {
    private memory: memoryStore;
    private modelContextLimit: number;
    private userData: UserData;

    constructor(memoryStoreInstance: memoryStore, modelContextLimit: number, userData: UserData) {
        this.memory = memoryStoreInstance;
        this.modelContextLimit = modelContextLimit;
        this.userData = userData;
    }

    async assemble(userQuery: string, options = {}) {
        const systemPrompt = await this.memory.readMemoryFiles(`system_prompt-${this.userData.userId}.md`);
        const userProfile = await this.memory.readMemoryFiles(`MEMORY-${this.userData.userId}.md`);
        const todayLog = await this.memory.readToday(new Date());

        const contextLayers = [
            `# System Layer\n${systemPrompt}`,
            `# Profile Layer\n${userProfile}`,
            `# Recent STM Layer\n${todayLog}`,
        ];

        const context = contextLayers.join("\n\n");
        const finalPrompt = `${context}\n\n# New Input\n${userQuery}`;
        const numberOfTokens = estimateTokens(finalPrompt);

        if (numberOfTokens > this.modelContextLimit) {
            console.log("========start compression =======");
            const compressedData = await compressSTMTool.invoke({message: finalPrompt}) as string;
            console.log("========finish compression =======");

            const now = new Date();
            await this.memory.logToArchive("Assistant", compressedData, now);

            const docToEmbed = new Document({
                pageContent: compressedData,
                metadata: {title: "user daily log summary"},
            });

            await Promise.all([
                docEmbeddingMultiVector({
                    userId: this.userData.userId,
                    allDocs: [docToEmbed],
                }),
                this.memory.emptyAFileContent(),
            ]);
            console.log("========finish embedding =======");
        }

        return {
            prompt: finalPrompt,
            diagnostics: {
                estimatedTokens: numberOfTokens,
            },
        };
    }
}
