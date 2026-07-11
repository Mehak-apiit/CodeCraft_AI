import { RunnableLambda } from "@langchain/core/runnables";

export const toolMonitor = new RunnableLambda({
    func: async (input: any) => {
        const toolCall = input.toolCall || input;
        console.log(`Executing tool =============== :${toolCall.name}`);
        console.log(`Arguments ===================: ${JSON.stringify(toolCall.args)}`);

        try {
            const result = await input.handler(input);
            console.log("Tool completed successfully=========");
            return result;
        } catch (e: any) {
            console.log(`Tool failed: ${e.message || e}`);
            throw e;
        }
    },
});
