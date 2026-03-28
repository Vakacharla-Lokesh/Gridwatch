/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState, useRef } from "react";
import io, { Socket } from "socket.io-client";

/**
 * Hook for Socket.IO real-time updates
 *
 * Handles connection/disconnection and provides type-safe event listeners
 *
 * Usage:
 * ```tsx
 * const { socket, isConnected } = useSocket();
 *
 * useEffect(() => {
 *   if (!socket) return;
 *
 *   socket.on('sensor-state-change', (event) => {
 *     console.log('Sensor updated:', event.data);
 *   });
 *
 *   return () => {
 *     socket.off('sensor-state-change');
 *   };
 * }, [socket]);
 * ```
 */

const SOCKET_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

export interface UseSocketOptions {
  userId?: string;
  role?: "operator" | "supervisor";
  zones?: string[];
  autoConnect?: boolean;
}

export function useSocket(options: UseSocketOptions = {}) {
  const { userId, role, zones = [], autoConnect = true } = options;

  const [, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!autoConnect) return;

    try {
      const newSocket = io(SOCKET_URL, {
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: 5,
        query: {
          user_id: userId,
          role,
          zones: zones.join(","),
        },
      });

      newSocket.on("connect", () => {
        console.log("✅ Socket.IO connected:", newSocket.id);
        setIsConnected(true);
        setError(null);
      });

      newSocket.on("disconnect", () => {
        console.log("📡 Socket.IO disconnected");
        setIsConnected(false);
      });

      newSocket.on("connect_error", (err) => {
        console.error("Socket.IO connection error:", err);
        setError(err.message);
      });

      socketRef.current = newSocket;
      setSocket(newSocket);

      return () => {
        newSocket.disconnect();
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error("Failed to initialize Socket.IO:", message);
      setError(message);
    }
  }, [userId, role, zones, autoConnect]);

  // eslint-disable-next-line react-hooks/refs
  return { socket: socketRef.current, isConnected, error };
}

/**
 * Hook for listening to sensor state changes
 *
 * Usage:
 * ```tsx
 * const { sensors, error } = useSensorUpdates();
 *
 * return (
 *   <div>
 *     {sensors.map(sensor => (
 *       <SensorCard key={sensor.sensor_id} sensor={sensor} />
 *     ))}
 *   </div>
 * );
 * ```
 */

export interface SensorStateEvent {
  sensor_id: string;
  zone_id: string;
  name: string;
  state: "healthy" | "warning" | "critical" | "silent";
  timestamp: string;
  severity?: string;
}

export function useSensorUpdates() {
  const { socket, isConnected } = useSocket();
  const [sensors, setSensors] = useState<SensorStateEvent[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!socket || !isConnected) return;

    socket.on("sensor-state-change", (event: any) => {
      try {
        const data = event.data as SensorStateEvent;
        setSensors((prev) => {
          // Update or add sensor
          const existing = prev.find((s) => s.sensor_id === data.sensor_id);
          if (existing) {
            return prev.map((s) => (s.sensor_id === data.sensor_id ? data : s));
          }
          return [...prev, data];
        });
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "Failed to process sensor update";
        console.error(message, err);
        setError(message);
      }
    });

    return () => {
      socket.off("sensor-state-change");
    };
  }, [socket, isConnected]);

  return { sensors, error, isConnected };
}

/**
 * Hook for listening to alert events
 *
 * Usage:
 * ```tsx
 * const { alerts, error } = useAlertUpdates();
 *
 * return (
 *   <AlertPanel alerts={alerts} />
 * );
 * ```
 */

export interface AlertEvent {
  alert_id: string;
  sensor_id: string;
  zone_id: string;
  type: "created" | "acknowledged" | "resolved" | "escalated";
  severity: "warning" | "critical";
  sensor_name: string;
  assigned_to?: string;
  status: string;
  timestamp: string;
}

export function useAlertUpdates() {
  const { socket, isConnected } = useSocket();
  const [alerts, setAlerts] = useState<AlertEvent[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!socket || !isConnected) return;

    socket.on("alert-event", (event: any) => {
      try {
        const data = event.data as AlertEvent;
        setAlerts((prev) => {
          // Keep only last 50 alerts
          const updated = [data, ...prev];
          return updated.slice(0, 50);
        });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to process alert";
        console.error(message, err);
        setError(message);
      }
    });

    return () => {
      socket.off("alert-event");
    };
  }, [socket, isConnected]);

  return { alerts, error, isConnected };
}

/**
 * Hook for listening to suppression events
 */

export interface SuppressionEvent {
  suppression_id: string;
  sensor_id: string;
  zone_id: string;
  sensor_name: string;
  start_time: string;
  end_time: string;
  reason: string;
}

export function useSuppressionUpdates() {
  const { socket, isConnected } = useSocket();
  const [suppressions, setSuppressions] = useState<SuppressionEvent[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!socket || !isConnected) return;

    socket.on("suppression-event", (event: any) => {
      try {
        const data = event.data as SuppressionEvent;
        setSuppressions((prev) => [data, ...prev]);
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "Failed to process suppression event";
        console.error(message, err);
        setError(message);
      }
    });

    return () => {
      socket.off("suppression-event");
    };
  }, [socket, isConnected]);

  return { suppressions, error, isConnected };
}

/**
 * Hook for custom event listening
 *
 * Usage:
 * ```tsx
 * useSocketEvent('my-custom-event', (data) => {
 *   console.log('Received:', data);
 * });
 * ```
 */

export function useSocketEvent<T = any>(
  event: string,
  handler: (data: T) => void,
): void {
  const { socket, isConnected } = useSocket();

  useEffect(() => {
    if (!socket || !isConnected) return;

    socket.on(event, handler);

    return () => {
      socket.off(event, handler);
    };
  }, [socket, isConnected, event, handler]);
}
