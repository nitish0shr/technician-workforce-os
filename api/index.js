// Vercel serverless entry point.
//
// On Vercel the static client in /dist is served straight from the CDN, and only
// /api/* is routed here (see vercel.json rewrites). This wraps the same Express
// API router the standalone server uses, minus app.listen(), and exports the app
// as the function handler — an Express app is itself a (req, res) handler.
import express from "express";
import cors from "cors";
import apiRouter from "../server/api.js";
import { boot } from "../server/boot.js";

boot(); // seed the in-memory SQLite on cold start

const app = express();
app.use(cors({ origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(",") : true }));
app.use(express.json({ limit: "1mb" }));
app.use(express.text({ type: ["text/csv", "text/plain"], limit: "4mb" }));
app.use("/api", apiRouter);

export default app;
