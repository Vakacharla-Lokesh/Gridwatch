import { Server } from "socket.io";
import type { Server as HTTPServer } from "http";
import { createAdapter } from "@socket.io/redis-adapter";
import { redis, getRedisStatus } from "../lib/redis.js";
import { getEnv } from "../config/env.js";

let io: Server | null = null;

interface SocketUser {
  id: string;
  role: "operator" | "supervisor";
  zones: string[];
}

export function initializeIO(server: HTTPServer): Server {
  const { clientUrl } = getEnv();
  io = new Server(server, {
    cors: {
      origin: clientUrl,
      credentials: true,
    },
  });

  // Use Redis adapter if available (enables multi-instance scaling)
  if (redis) {
    const redisStatus = getRedisStatus();
    console.log(
      `🔴 [Redis] Adapter ${redisStatus.available ? "enabled" : "disabled"}`,
    );

    try {
      io.adapter(createAdapter(redis, redis));
      console.log(
        `✅ [Socket.IO] Redis adapter configured for multi-instance scaling`,
      );
    } catch (error) {
      console.warn(`⚠️  [Socket.IO] Failed to configure Redis adapter:`, error);
    }
  } else {
    console.log(
      `⚠️  [Socket.IO] Redis not configured - using in-memory adapter (single instance only)`,
    );
  }

  io.on("connection", (socket) => {
    console.log(`📡 [Socket.IO] Client connected: ${socket.id}`);

    // Extract user from query or auth
    const user = extractUser(socket);

    if (!user) {
      console.warn(`⚠️  [Socket.IO] No user info, disconnecting ${socket.id}`);
      socket.disconnect();
      return;
    }

    // Join zone-scoped rooms
    if (user.role === "supervisor") {
      // Supervisors join special 'supervisor' room (sees all zones)
      socket.join("supervisor");
      console.log(
        `✅ [Socket.IO] Supervisor ${user.id} joined supervisor room`,
      );
    } else {
      // Operators join zone-specific rooms
      for (const zone of user.zones) {
        socket.join(`zone:${zone}`);
        console.log(`✅ [Socket.IO] Operator ${user.id} joined zone:${zone}`);
      }
    }

    // Handle disconnection
    socket.on("disconnect", () => {
      console.log(`📡 [Socket.IO] Client disconnected: ${socket.id}`);
    });

    // For testing: allow clients to request current state
    socket.on("request-state", (callback) => {
      callback({ connected: true, user, role: user.role });
    });
  });

  console.log(`🚀 [Socket.IO] Server initialized`);
  return io;
}

/**
 * Get the Socket.IO instance (already initialized)
 */
export function getIO(): Server {
  if (!io) {
    throw new Error("Socket.IO not initialized. Call initializeIO() first.");
  }
  return io;
}

/**
 * Extract user from socket handshake
 * Simplified: read user_id and role from query or auth header
 */
function extractUser(socket: any): SocketUser | null {
  try {
    // Option 1: Query string (for testing)
    const queryUserId = socket.handshake.query.user_id;
    const queryRole = socket.handshake.query.role || "operator";
    const queryZones = socket.handshake.query.zones
      ? String(socket.handshake.query.zones).split(",")
      : [];

    if (queryUserId) {
      return {
        id: String(queryUserId),
        role: queryRole as "operator" | "supervisor",
        zones: queryZones,
      };
    }

    // Option 2: Auth header with Bearer token (for production)
    const authHeader =
      socket.handshake.auth?.token || socket.handshake.headers?.authorization;
    if (authHeader) {
      // In production: verify JWT and extract user
      // For assessment: simplified token parsing
      const token = authHeader.replace("Bearer ", "");
      // Placeholder: actual implementation would verify JWT
      // For now, attach user from middleware
      const user = (socket.request as any).user;
      if (user) {
        return {
          id: user.id,
          role: user.role,
          zones: user.zones || [],
        };
      }
    }

    return null;
  } catch (error) {
    console.error("Error extracting user:", error);
    return null;
  }
}

/**
 * Get current connection stats (for debugging)
 */
export function getConnectionStats(): {
  connectedClients: number;
  rooms: Record<string, number>;
} {
  try {
    if (!io) {
      return { connectedClients: 0, rooms: {} };
    }

    const sockets = io.sockets.sockets;
    const rooms = io.sockets.adapter.rooms;

    const roomStats: Record<string, number> = {};
    rooms.forEach((value, key) => {
      if (!key.startsWith("/")) {
        // Skip default namespace rooms
        roomStats[key] = value.size;
      }
    });

    return {
      connectedClients: sockets.size,
      rooms: roomStats,
    };
  } catch (error) {
    console.error("[Realtime] Error getting connection stats:", error);
    return { connectedClients: 0, rooms: {} };
  }
}
