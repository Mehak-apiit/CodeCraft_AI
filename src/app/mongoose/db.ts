import mongoose from "mongoose";
import { createLogger } from "../../utils/logger";
import { config } from "../../config";

const logger = createLogger('MongoDB');

export async function dbConnection() {
    if (!config.mongoUrl) {
        logger.warn("No DB_URL configured, skipping MongoDB connection");
        return;
    }

    try {
        await mongoose.connect(config.mongoUrl, {
            serverSelectionTimeoutMS: 5000,
        });
        logger.info("Connected to MongoDB");
    } catch (error: any) {
        logger.error("MongoDB connection failed", error);
        throw error;
    }
}

mongoose.connection.on('error', (err) => {
    logger.error('MongoDB connection error', err);
});

mongoose.connection.on('disconnected', () => {
    logger.warn('MongoDB disconnected');
});
