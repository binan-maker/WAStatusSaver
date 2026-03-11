import type { Express } from "express";
import { createServer, type Server } from "node:http";

export async function registerRoutes(app: Express): Promise<Server> {
  // API Routes configured here
  
  const httpServer = createServer(app);

  return httpServer;
}
