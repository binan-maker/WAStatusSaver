import type { Express } from "express";
import { createServer, type Server } from "node:http";
import { registerPaymentRoutes } from "./payment-routes";
import { registerUserRoutes } from "./user-routes";

export async function registerRoutes(app: Express): Promise<Server> {
  registerPaymentRoutes(app);
  registerUserRoutes(app);

  const httpServer = createServer(app);

  return httpServer;
}
