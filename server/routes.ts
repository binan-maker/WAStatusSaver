import type { Express, Request, Response } from "express";
import { createServer, type Server } from "node:http";
import * as fs from "fs";
import * as path from "path";
import { registerAllPaymentRoutes } from "./payment-routes";
import { registerUserRoutes } from "./user-routes";
import { registerReferralRoutes } from "./referral-routes";

function readTemplate(name: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), "server", "templates", name), "utf-8");
}

export async function registerRoutes(app: Express): Promise<Server> {
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  registerAllPaymentRoutes(app);
  registerUserRoutes(app);
  registerReferralRoutes(app);

  app.get("/privacy-policy", (_req: Request, res: Response) => {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(readTemplate("privacy-policy.html"));
  });

  app.get("/terms", (_req: Request, res: Response) => {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(readTemplate("terms.html"));
  });

  app.get("/pricing", (_req: Request, res: Response) => {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(readTemplate("pricing.html"));
  });

  const httpServer = createServer(app);

  return httpServer;
}
