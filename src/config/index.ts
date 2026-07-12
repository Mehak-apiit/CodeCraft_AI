import 'dotenv/config';

function required(key: string): string {
    const value = process.env[key];
    if (!value) {
        throw new Error(`Missing required environment variable: ${key}`);
    }
    return value;
}

function optional(key: string, defaultValue: string = ''): string {
    return process.env[key] || defaultValue;
}

export const config = {
    port: parseInt(optional('PORT', '5000')),
    nodeEnv: optional('NODE_ENV', 'development'),
    isProduction: optional('NODE_ENV', 'development') === 'production',

    cohereApiKey: required('COHERE_API_KEY'),
    pineconeApiKey: optional('PINECONE_API_KEY'),
    pineconeIndexName: optional('PINECONE_INDEX_NAME', 'codecraft-index'),

    mongoUrl: optional('DB_URL'),
    useMongoSession: optional('USE_MONGO_SESSION', 'false') === 'true',

    githubClientId: optional('GITHUB_CLIENT_ID'),
    githubClientSecret: optional('GITHUB_CLIENT_SECRET'),
    callBackUrl: optional('CALL_BACK_URL', 'http://localhost:5000/auth/github/callback'),
    cookieKey: optional('COOKIE_KEY', 'dev-secret-change-in-production'),
    frontAppUrl: optional('FRONT_APP_URL', '/'),

    memoryRoot: optional('MEMORY_ROOT', ''),
    logLevel: optional('LOG_LEVEL', 'info'),
} as const;
