import dotenv from "dotenv";
import mongoose from "mongoose";

dotenv.config();

const MONGO_URI: string =
  process.env.MONGO_URI ?? "mongodb://127.0.0.1:27017/os_archive";

mongoose.connect(MONGO_URI)
  .catch((err: Error) => {
    console.error("MongoDB connection error:", err);
  });

const db = mongoose.connection;

db.on("error", (err: Error) => {
  console.error("MongoDB connection error:", err);
});

db.once("open", () => {
  console.log("Connected to MongoDB!");
});

export default mongoose;
