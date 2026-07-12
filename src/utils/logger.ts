type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_PRIORITY: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
};

const currentLevel: LogLevel = (process.env.LOG_LEVEL as LogLevel) || 'info';

function shouldLog(level: LogLevel): boolean {
    return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[currentLevel];
}

function formatMessage(level: LogLevel, context: string, message: string, data?: any): string {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level.toUpperCase()}] [${context}]`;
    if (data !== undefined) {
        return `${prefix} ${message} ${JSON.stringify(data, null, 0)}`;
    }
    return `${prefix} ${message}`;
}

export function createLogger(context: string) {
    return {
        debug: (message: string, data?: any) => {
            if (shouldLog('debug')) console.debug(formatMessage('debug', context, message, data));
        },
        info: (message: string, data?: any) => {
            if (shouldLog('info')) console.log(formatMessage('info', context, message, data));
        },
        warn: (message: string, data?: any) => {
            if (shouldLog('warn')) console.warn(formatMessage('warn', context, message, data));
        },
        error: (message: string, error?: any) => {
            if (shouldLog('error')) {
                const errorData = error instanceof Error ? { message: error.message, stack: error.stack } : error;
                console.error(formatMessage('error', context, message, errorData));
            }
        },
    };
}
