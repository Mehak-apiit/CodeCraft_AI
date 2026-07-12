import { Request, Response } from 'express';
import { readChatHistoryTool } from "../../tools/chat-history/chatHistoryTools";

export async function getChatHistory(req: Request, res: Response) {
    try {
        const userId = req.query.userId as string;
        const projectId = req.query.projectId as string;
        if (!userId || !projectId) {
            return res.status(400).json({ ok: false, message: "userId and projectId are required" });
        }
        const retrievedMessages = await readChatHistoryTool.invoke({ userId, projectId });
        const messages = JSON.parse(retrievedMessages as string);
        return res.json({ messages });
    } catch (err: any) {
        console.error("Chat history error:", err);
        return res.status(500).json({
            ok: false,
            message: err.message || "Internal Server Error"
        });
    }
}
