import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import express from "express";
import healthRouter from "../src/routes/health";

const app = express();
app.use(healthRouter);

describe("GET /health", () => {
  it("returns 200 with status ok", async () => {
    const res = await request(app).get("/health");

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });

  it("includes uptime as a number", async () => {
    const res = await request(app).get("/health");

    expect(typeof res.body.uptime).toBe("number");
    expect(res.body.uptime).toBeGreaterThanOrEqual(0);
  });

  it("includes timestamp in ISO 8601 format", async () => {
    const res = await request(app).get("/health");

    expect(res.body.timestamp).toBeDefined();
    // Verify it's a valid ISO 8601 date
    const parsed = new Date(res.body.timestamp);
    expect(parsed.toISOString()).toBe(res.body.timestamp);
  });

  it("responds within 50ms", async () => {
    const start = Date.now();
    await request(app).get("/health");
    const elapsed = Date.now() - start;

    expect(elapsed).toBeLessThan(50);
  });
});
