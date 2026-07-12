import express from "express";
import cors from "cors";
import { Express, Request, Response } from "express";
import { createLogger } from "../../../utils/logger";
import { config } from "../../../config";
import { codeAgent } from "../../../coder-agent/coderAgent";
import { writeToChatHistoryTool, readChatHistoryTool } from "../../../tools/chat-history/chatHistoryTools";

const logger = createLogger('ExpressServer');

export function expressServer(app: Express, PORT: number) {
    app.use(cors({ origin: '*', credentials: true }));
    app.use(express.json());

    app.get('/', (req: Request, res: Response) => {
        res.json({ message: "Server is up", version: "1.0.0" });
    });

    app.get('/api/health', (req: Request, res: Response) => {
        res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });

    app.get('/api/chat/history', async (req: Request, res: Response) => {
        try {
            const userId = req.query.userId as string;
            const projectId = req.query.projectId as string;
            if (!userId || !projectId) {
                return res.status(400).json({ ok: false, message: "userId and projectId required" });
            }
            const result = await readChatHistoryTool.invoke({ userId, projectId });
            const messages = JSON.parse(result as string);
            return res.json({ messages });
        } catch (err: any) {
            return res.status(500).json({ ok: false, error: err.message });
        }
    });

    app.post('/api/chat', async (req: Request, res: Response) => {
        try {
            const { message, userId = "default", projectId = "default" } = req.body;
            if (!message) {
                return res.status(400).json({ ok: false, error: "message is required" });
            }

            logger.info(`Chat request: "${message}" from user=${userId}`);

            try {
                await writeToChatHistoryTool.invoke({
                    messages: [{ role: 'user', content: message, userId, projectId }]
                });
            } catch (e: any) {
                logger.warn(`Chat history write failed: ${e.message}`);
            }

            const result = await codeAgent(message, [], { userId, projectId });
            const rawContent = result?.messages?.[result.messages.length - 1]?.content ?? "No response";
            const aiResponse = typeof rawContent === 'string' ? rawContent : JSON.stringify(rawContent);

            try {
                await writeToChatHistoryTool.invoke({
                    messages: [{ role: 'ai', content: aiResponse, userId, projectId }]
                });
            } catch (e: any) {
                logger.warn(`Chat history write failed: ${e.message}`);
            }

            logger.info(`Chat response: ${aiResponse.slice(0, 100)}`);
            return res.json({ ok: true, response: aiResponse });
        } catch (err: any) {
            logger.error(`Chat error: ${err.message}`);
            return res.status(500).json({ ok: false, error: err.message });
        }
    });

    process.on('uncaughtException', (err) => {
        logger.error('Uncaught Exception (caught by handler)', err);
    });

    process.on('unhandledRejection', (reason) => {
        logger.error('Unhandled Rejection (caught by handler)', reason);
    });

    app.listen(PORT, () => {
        logger.info(`Express server running at http://localhost:${PORT}`);
    });
}
