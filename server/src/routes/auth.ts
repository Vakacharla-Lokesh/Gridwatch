import { Router, type Request, type Response, type NextFunction } from "express";
import * as jwt from "jsonwebtoken";
import { pool } from "../db/index.js";
import { authMiddleware } from "../middleware/auth.js";
import { blacklistToken } from "../lib/redis.js";
import { getEnv } from "../config/env.js";

const router = Router();

interface LoginRequest {
  email: string;
  password?: string; // Optional for demo
}

interface LoginResponse {
  token: string;
  user: {
    id: string;
    email: string;
    role: string;
  };
}

/**
 * POST /auth/login
 * Authenticate user and return JWT token
 * For demo: any email in the users table works (password verification not implemented)
 */
router.post("/auth/login", async (req: Request, res: Response) => {
  try {
    const { email } = req.body as LoginRequest;

    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    // Look up user in database
    const result = await pool.query(
      "SELECT id, email, role FROM users WHERE email = $1",
      [email.toLowerCase()],
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: "User not found" });
    }

    const user = result.rows[0];

    // Generate JWT token - cast expiresIn to match expected type
    const { jwtSecret, jwtExpiry } = getEnv();
    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      jwtSecret,
      { expiresIn: jwtExpiry } as any,
    );

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
    } as LoginResponse);
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Login failed" });
  }
});

/**
 * POST /auth/logout
 * Invalidates the token by adding it to Redis blacklist
 * Client also removes token from localStorage
 */
router.post("/auth/logout", async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.slice(7);
      const { jwtSecret } = getEnv();

      try {
        const decoded = jwt.verify(token, jwtSecret) as { exp?: number };
        // Calculate remaining TTL
        const expiresIn = decoded.exp ? Math.max(0, decoded.exp - Math.floor(Date.now() / 1000)) : 86400;
        // Blacklist the token (prevents reuse)
        await blacklistToken(token, expiresIn);
      } catch {
        // Invalid token - return success anyway (user logged out)
      }
    }

    res.json({ message: "Logged out successfully" });
  } catch (error) {
    console.error("Logout error:", error);
    res.status(500).json({ error: "Logout failed" });
  }
});

/**
 * GET /auth/me
 * Returns current user info from JWT
 * Protected route - requires valid token
 */
router.get("/auth/me", authMiddleware, (req: Request, res: Response) => {
  // Auth middleware will have already validated the token
  const user = (req as any).user;
  if (!user) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  res.json({ user });
});

export default router;
