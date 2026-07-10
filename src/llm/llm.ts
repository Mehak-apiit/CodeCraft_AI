import { ChatCohere } from "@langchain/cohere";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";

type LLMType = "cohere" | "cohere-fast";

export class LLM {
    private static instances: Partial<Record<LLMType, BaseChatModel>> = {};

    private constructor() {}

    public static getInstance(type: LLMType = "cohere"): BaseChatModel {
        if (!LLM.instances[type]) {
            switch (type) {
                case "cohere":
                    if (!process.env.COHERE_API_KEY) {
                        throw new Error("COHERE_API_KEY is not set");
                    }
                    LLM.instances[type] = new ChatCohere({
                        model: "command-a-03-2025",
                        temperature: 0.3,
                        apiKey: process.env.COHERE_API_KEY,
                    });
                    break;

                case "cohere-fast":
                    if (!process.env.COHERE_API_KEY) {
                        throw new Error("COHERE_API_KEY is not set");
                    }
                    LLM.instances[type] = new ChatCohere({
                        model: "command-r7b-12-2024",
                        temperature: 0.3,
                        apiKey: process.env.COHERE_API_KEY,
                    });
                    break;

                default:
                    throw new Error(`Unknown LLM type: ${type}`);
            }
        }
        return LLM.instances[type]!;
    }
}
