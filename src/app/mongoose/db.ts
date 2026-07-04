import mongoose from "mongoose";
export async function dbConnection(){
    try {
        await mongoose.connect(process.env.DB_URL as string);
        console.log("MongoDB connected");
    } catch (err: any) {
        console.log("MongoDB connection error:", err.message);
    }
}