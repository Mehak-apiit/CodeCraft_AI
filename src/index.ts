import { config } from './config';
import express from 'express';
import { bootStrapApp } from './app/bootstrap/index';
import { createLogger } from './utils/logger';

const logger = createLogger('Main');

process.on('unhandledRejection', (reason: any) => {
    logger.error('Unhandled Promise Rejection', reason);
});

process.on('uncaughtException', (error: Error) => {
    logger.error('Uncaught Exception', error);
    process.exit(1);
});

const app = express();
bootStrapApp(app, config.port);
