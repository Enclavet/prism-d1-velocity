import { Router, Request, Response } from 'express';

const router = Router();

const startTime = Date.now();

// ---------------------------------------------------------------------------
// GET /health — health check endpoint
// ---------------------------------------------------------------------------
router.get('/health', (_req: Request, res: Response) => {
  const now = Date.now();
  const uptimeSeconds = Math.floor((now - startTime) / 1000);

  res.status(200).json({
    status: 'ok',
    uptime: uptimeSeconds,
    timestamp: new Date().toISOString(),
  });
});

export default router;
