import { Router } from 'express';
import { postChatStream } from './controllers/chatController';
import { getChatHistory } from './chatHistoryController';

const router = Router();

router.post('/chat/stream', postChatStream);
router.get('/chat/history', getChatHistory);

router.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

export { router as apiRouter };
