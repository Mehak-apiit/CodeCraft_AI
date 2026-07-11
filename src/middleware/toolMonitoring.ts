export const toolMonitoringMiddleware = {
    name: "ToolMonitoringMiddleware",
    wrapToolCall: async (request: any, handler: any) => {
        console.log(`Executing tool =============== :${request.toolCall?.name || "unknown"}`);
        console.log(`Arguments ===================: ${JSON.stringify(request.toolCall?.args || {})}`);
        try {
            const result = await handler(request);
            console.log("Tool completed successfully=========");
            return result;
        } catch (e: any) {
            console.log(`Tool failed: ${e.message || e}`);
            throw e;
        }
    },
};
