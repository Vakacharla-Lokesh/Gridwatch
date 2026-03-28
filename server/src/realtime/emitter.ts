import { getIO } from './io.js';

/**
 * Real-time event emitter
 *
 * Central service for broadcasting events to connected clients.
 * All events are zone-scoped automatically.
 */

export interface SensorStateChange {
  sensor_id: string;
  zone_id: string;
  name: string;
  state: 'healthy' | 'warning' | 'critical' | 'silent';
  timestamp: string;
  severity?: string;
}

export interface AlertEvent {
  alert_id: string;
  sensor_id: string;
  zone_id: string;
  type: 'created' | 'acknowledged' | 'resolved' | 'escalated';
  severity: 'warning' | 'critical';
  sensor_name: string;
  assigned_to?: string;
  status: string;
  timestamp: string;
}

export interface SuppressionEvent {
  suppression_id: string;
  sensor_id: string;
  zone_id: string;
  sensor_name: string;
  start_time: string;
  end_time: string;
  reason: string;
}

/**
 * Broadcast sensor state change to zone + supervisors
 * Used when sensor state updates due to anomaly/alert
 */
export function emitSensorStateChange(change: SensorStateChange): void {
  try {
    const io = getIO();
    const payload = {
      type: 'sensor-state-change',
      data: change,
      timestamp: new Date().toISOString(),
    };

    // Emit to operators in the zone
    io.to(`zone:${change.zone_id}`).emit('sensor-state-change', payload);

    // Emit to supervisors (they see all zones)
    io.to('supervisor').emit('sensor-state-change', payload);

    console.log(
      `📡 [Realtime] Sensor ${change.sensor_id} state → ${change.state} (zone: ${change.zone_id})`
    );
  } catch (error) {
    console.error('[Realtime] Error emitting sensor state change:', error);
  }
}

/**
 * Broadcast alert event to zone + supervisors
 * Used when alert is created, transitioned, or escalated
 */
export function emitAlertEvent(event: AlertEvent): void {
  try {
    const io = getIO();
    const payload = {
      type: 'alert-event',
      data: event,
      timestamp: new Date().toISOString(),
    };

    // Emit to operators in the zone
    io.to(`zone:${event.zone_id}`).emit('alert-event', payload);

    // Emit to supervisors (they see all zones)
    io.to('supervisor').emit('alert-event', payload);

    console.log(
      `📡 [Realtime] Alert ${event.alert_id} [${event.type}] (zone: ${event.zone_id})`
    );
  } catch (error) {
    console.error('[Realtime] Error emitting alert event:', error);
  }
}

/**
 * Broadcast suppression window update
 * Used when suppression created/updated/resolved
 */
export function emitSuppressionEvent(event: SuppressionEvent): void {
  try {
    const io = getIO();
    const payload = {
      type: 'suppression-event',
      data: event,
      timestamp: new Date().toISOString(),
    };

    // Emit to operators in the zone
    io.to(`zone:${event.zone_id}`).emit('suppression-event', payload);

    // Emit to supervisors
    io.to('supervisor').emit('suppression-event', payload);

    console.log(
      `📡 [Realtime] Suppression created for ${event.sensor_id} (zone: ${event.zone_id})`
    );
  } catch (error) {
    console.error('[Realtime] Error emitting suppression event:', error);
  }
}

/**
 * Broadcast to a specific zone + supervisors
 * For generic messages or batch updates
 */
export function broadcastToZone(zoneId: string, event: string, data: any): void {
  try {
    const io = getIO();
    const payload = {
      type: event,
      data,
      timestamp: new Date().toISOString(),
    };

    io.to(`zone:${zoneId}`).emit(event, payload);
    io.to('supervisor').emit(event, payload);

    console.log(`📡 [Realtime] Broadcast ${event} to zone ${zoneId}`);
  } catch (error) {
    console.error('[Realtime] Error broadcasting to zone:', error);
  }
}

/**
 * Broadcast to all connected clients (use sparingly)
 */
export function broadcastToAll(event: string, data: any): void {
  try {
    const io = getIO();
    const payload = {
      type: event,
      data,
      timestamp: new Date().toISOString(),
    };

    io.emit(event, payload);
    console.log(`📡 [Realtime] Broadcast ${event} to all clients`);
  } catch (error) {
    console.error('[Realtime] Error broadcasting to all:', error);
  }
}

/**
 * Get current connection stats (for debugging)
 */
export function getConnectionStats(): { connectedClients: number; rooms: Record<string, number> } {
  try {
    const io = getIO();
    const sockets = io.sockets.sockets;
    const rooms = io.sockets.adapter.rooms;

    const roomStats: Record<string, number> = {};
    rooms.forEach((value, key) => {
      if (!key.startsWith('/')) {
        // Skip default namespace rooms
        roomStats[key] = value.size;
      }
    });

    return {
      connectedClients: sockets.size,
      rooms: roomStats,
    };
  } catch (error) {
    console.error('[Realtime] Error getting connection stats:', error);
    return { connectedClients: 0, rooms: {} };
  }
}
