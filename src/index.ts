import express from "express";
import 'dotenv/config';
import {bootStrapApp} from './app/bootstrap/index';
process.on('unhandledRejection', () => {});
process.on('uncaughtException', () => {});
const app = express();
const PORT = parseInt(process.env.PORT as string)
bootStrapApp(app, PORT);