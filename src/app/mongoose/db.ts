import mongoose from "mongoose";
export async function dbConnection(){
    if (!process.env.DB_URL) {
        console.log("No DB_URL set, skipping MongoDB connection");
        return;
    }
    try {
        await mongoose.connect(process.env.DB_URL, {
            serverSelectionTimeoutMS: 2000,
        });
        console.log("MongoDB connected");
    } catch (err: any) {
        console.log("MongoDB unavailable, running without database:", err.message);
        try { await mongoose.disconnect(); } catch {}
    }
}