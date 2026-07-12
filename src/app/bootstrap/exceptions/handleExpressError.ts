import { Request, Response, NextFunction } from 'express';
import { createLogger } from '../../../utils/logger';
import { config } from '../../../config';

const logger = createLogger('ErrorHandler');

export function handleExpressError(err: Error, req: Request, res: Response, next: NextFunction) {
    logger.error(`${req.method} ${req.path} - ${err.message}`, err);

    if (err.message.includes('Path traversal')) {
        return res.status(403).json({ ok: false, error: 'Access denied: path traversal blocked' });
    }

    if (err.message.includes('not found') || err.message.includes('ENOENT')) {
        return res.status(404).json({ ok: false, error: 'Resource not found' });
    }

    const statusCode = (err as any).statusCode || 500;
    res.status(statusCode).json({
        ok: false,
        error: config.nodeEnv === 'production' ? 'Internal server error' : err.message,
    });
}
