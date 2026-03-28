import type { Request, Response, NextFunction } from "express";
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
    const userId = req.headers["x-user-id"] as string;

    if (!userId) {
      return res.status(401).json({ error: "Missing x-user-id header" });
    }
    const userResult = await pool.query(
      "SELECT id, email, role FROM users WHERE id = $1",
      [userId],
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: "User not found" });
    }

    const user = userResult.rows[0];

    const zonesResult = await pool.query(
      "SELECT zone_id FROM user_zones WHERE user_id = $1",
      [userId],
    );

    const zones = zonesResult.rows.map((row) => row.zone_id);

    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      zones,
    };

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

  const zoneId = req.query.zone_id || req.params.zone_id;

  if (zoneId && !req.user.zones.includes(zoneId as string)) {
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
