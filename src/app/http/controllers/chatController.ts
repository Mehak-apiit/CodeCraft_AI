import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { Command } from '@langchain/langgraph';
import { graph } from "../../../multi-agent/multi-agent";
import { writeToChatHistoryTool } from "../../../tools/chat-history/chatHistoryTools";

interface UserInput {
    message: string;
    userId: string;
    projectId: string;
    resumeDecision?: any;
    existingThreadId?: string;
}

export const postChatStream = async (req: Request, res: Response) => {
    try {
        const { message, userId, projectId, resumeDecision, existingThreadId }: UserInput = req.body;
        const thread_id = existingThreadId || `thread-${uuidv4()}`;

        const state = await graph.getState({ configurable: { thread_id } });
        if (resumeDecision && !state.next?.length) {
            return res.status(400).json({
                error: "Cannot resume: No active checkpoint found for this thread."
            });
        }

        const input: any = resumeDecision
            ? new Command({ resume: resumeDecision })
            : { messages: [{ role: "user", content: message }], userId, projectId };

        const graphStream = await graph.stream(
            input,
            {
                streamMode: "custom",
                subgraphs: true,
                recursionLimit: 300,
                configurable: { userId, projectId, thread_id }
            }
        );

        res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache,no-transform');
        res.setHeader('Connection', 'keep-alive');

        const sendSSE = (event: string, data: any) => {
            res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
        };

        if (!resumeDecision && message) {
            await writeToChatHistoryTool.invoke({
                messages: [{ role: 'user', content: message, userId, projectId }]
            });
        }

        let streamingText = '';
        let thinkingBuffer = "";
        let inThinking = false;

        try {
            for await (const [namespace, chunk] of graphStream) {
                if (chunk && (chunk as any).interruptResult) {
                    const result = (chunk as any).interruptResult;
                    sendSSE("interrupt", { interrupt: result });
                    return res.end();
                }
                if ((chunk as any).manager_name) {
                    const content = (chunk as any)?.content || "";
                    const parts = content.split(/(<think>|<\/think>)/);
                    parts.forEach((part: string) => {
                        if (part === "<think>") {
                            inThinking = true;
                        } else if (part === "</think>") {
                            inThinking = false;
                        } else if (part.length > 0) {
                            if (inThinking) {
                                thinkingBuffer += part;
                                sendSSE("thinking", { thinking: part });
                            } else {
                                streamingText += part;
                                sendSSE("message", { message: part });
                            }
                        }
                    });
                }
            }

            sendSSE("end", { ok: true });
            if (streamingText || thinkingBuffer) {
                await writeToChatHistoryTool.invoke({
                    messages: [{ role: 'ai', thinking: thinkingBuffer, content: streamingText, userId, projectId }]
                });
            }
            res.end();
        } catch (streamError: any) {
            console.error('Streaming Error:', streamError?.message);
            sendSSE("error", { error: streamError.message });
            res.end();
        }
    } catch (err: any) {
        console.error('Route Error:', err);
        if (!res.headersSent) {
            res.status(500).json({ ok: false, error: err.message });
        } else {
            res.end();
        }
    }
};
