import type { Express } from "express";
import { createServer, type Server } from "node:http";
import referralRoutes from "./routes/referral.routes";

export async function registerRoutes(app: Express): Promise<Server> {
  // API Routes
  app.use('/api/referrals', referralRoutes);

  const httpServer = createServer(app);

  return httpServer;
}
