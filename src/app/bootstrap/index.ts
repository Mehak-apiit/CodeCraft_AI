import { Express } from 'express';
import { expressServer } from './express/expressServer';
import { dbConnection } from '../mongoose/db';
import { createLogger } from '../../utils/logger';
import { config } from '../../config';

const logger = createLogger('Bootstrap');

export async function bootStrapApp(app: Express, PORT: number) {
    try {
        if (config.mongoUrl) {
            await dbConnection();
            logger.info("MongoDB connected");
        } else {
            logger.warn("MongoDB not configured - running without database");
        }
    } catch (err: any) {
        logger.error("Failed to connect to MongoDB", err);
        logger.warn("Continuing without database...");
    }

    expressServer(app, PORT);
}
