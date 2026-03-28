import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { pool } from "../db/index.js";

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: "operator" | "supervisor";
        zones: string[];
      };
    }
  }
}

export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    // Try JWT token first (new auth flow)
    const authHeader = req.headers.authorization;
    let userId: string | null = null;

    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.slice(7);
      const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-key";

      try {
        const decoded = jwt.verify(token, JWT_SECRET) as {
          userId: string;
          email: string;
          role: string;
        };
        userId = decoded.userId;
      } catch {
        return res.status(401).json({ error: "Invalid or expired token" });
      }
    } else {
      // Fallback: check x-user-id header (for backwards compatibility)
      userId = req.headers["x-user-id"] as string;
    }

    if (!userId) {
      return res.status(401).json({ error: "Missing authentication" });
    }

    const result = await pool.query(
      `SELECT 
         u.id, 
         u.email, 
         u.role, 
         COALESCE(array_agg(uz.zone_id) FILTER (WHERE uz.zone_id IS NOT NULL), '{}') as zones
       FROM users u
       LEFT JOIN user_zones uz ON u.id = uz.user_id
       WHERE u.id = $1
       GROUP BY u.id`,
      [userId],
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: "User not found" });
    }

    req.user = result.rows[0];
    next();
  } catch (error) {
    console.error("Auth middleware error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

export function zoneGuard(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (req.user.role === "supervisor") {
    return next();
  }

  const requestedZoneId =
    req.query.zone_id || req.params.zone_id || req.body.zone_id;

  if (requestedZoneId && !req.user.zones.includes(requestedZoneId as string)) {
    return res.status(403).json({ error: "Forbidden - Zone access denied" });
  }

  next();
}

export function supervisorOnly(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (!req.user || req.user.role !== "supervisor") {
    return res
      .status(403)
      .json({ error: "Forbidden - Supervisor access required" });
  }

  next();
}
