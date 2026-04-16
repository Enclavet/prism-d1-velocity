/**
 * Health check route handler.
 *
 * Implements: specs/health-check.md
 *
 * @route GET /health
 * @returns 200 with { status, uptime, timestamp }
 */

import { Router, Request, Response } from "express";

interface HealthResponse {
  status: "ok" | "degraded";
  uptime: number;
  timestamp: string;
}

const router = Router();

const startTime = Date.now();

/**
 * @route GET /health
 * @param _req - Express request (unused)
 * @param res - Express response
 * @returns 200 with HealthResponse
 */
router.get("/health", (_req: Request, res: Response) => {
  const response: HealthResponse = {
    status: "ok",
    uptime: Math.floor((Date.now() - startTime) / 1000),
    timestamp: new Date().toISOString(),
  };

  res.status(200).json(response);
});

export default router;
