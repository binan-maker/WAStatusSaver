import type { Express } from "express";
import { createServer, type Server } from "node:http";
import { registerPaymentRoutes } from "./payment-routes";

export async function registerRoutes(app: Express): Promise<Server> {
  registerPaymentRoutes(app);
  
  const httpServer = createServer(app);

  return httpServer;
}
