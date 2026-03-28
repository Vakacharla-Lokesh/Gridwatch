import type { Sensor, Alert, HistoryResponse, Suppression } from "./types";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

function getAuthToken(): string {
  return localStorage.getItem("auth_token") || "test-token";
}

/**
 * Fetch all sensors in user's zones
 */
export async function fetchSensors(): Promise<Sensor[]> {
  const response = await fetch(`${API_URL}/api/sensors`, {
    headers: {
      Authorization: `Bearer ${getAuthToken()}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch sensors: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Fetch a single sensor with details
 */
export async function fetchSensor(sensorId: string): Promise<Sensor> {
  const response = await fetch(`${API_URL}/api/sensors/${sensorId}`, {
    headers: {
      Authorization: `Bearer ${getAuthToken()}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch sensor: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Fetch sensor reading history
 */
export async function fetchSensorHistory(
  sensorId: string,
  page = 1,
  limit = 50,
  from?: string,
  to?: string,
): Promise<HistoryResponse> {
  const params = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
  });

  if (from) params.append("from", from);
  if (to) params.append("to", to);

  const response = await fetch(
    `${API_URL}/api/sensors/${sensorId}/history?${params}`,
    {
      headers: {
        Authorization: `Bearer ${getAuthToken()}`,
      },
    },
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch history: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Fetch all alerts
 */
export async function fetchAlerts(status = "open"): Promise<Alert[]> {
  const response = await fetch(`${API_URL}/api/alerts?status=${status}`, {
    headers: {
      Authorization: `Bearer ${getAuthToken()}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch alerts: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Fetch a single alert
 */
export async function fetchAlert(alertId: string): Promise<Alert> {
  const response = await fetch(`${API_URL}/api/alerts/${alertId}`, {
    headers: {
      Authorization: `Bearer ${getAuthToken()}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch alert: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Acknowledge an alert
 */
export async function acknowledgeAlert(alertId: string): Promise<void> {
  const response = await fetch(`${API_URL}/api/alerts/${alertId}/acknowledge`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${getAuthToken()}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to acknowledge alert: ${response.statusText}`);
  }
}

/**
 * Resolve an alert
 */
export async function resolveAlert(alertId: string): Promise<void> {
  const response = await fetch(`${API_URL}/api/alerts/${alertId}/resolve`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${getAuthToken()}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to resolve alert: ${response.statusText}`);
  }
}

/**
 * Fetch suppression windows for a sensor
 */
export async function fetchSuppressions(
  sensorId: string,
  activeOnly = false,
): Promise<Suppression[]> {
  const params = new URLSearchParams();
  if (activeOnly) params.append("active_only", "true");

  const response = await fetch(
    `${API_URL}/api/sensors/${sensorId}/suppressions?${params}`,
    {
      headers: {
        Authorization: `Bearer ${getAuthToken()}`,
      },
    },
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch suppressions: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Create a suppression window
 */
export async function createSuppression(
  sensorId: string,
  startTime: string,
  endTime: string,
  reason?: string,
): Promise<Suppression> {
  const response = await fetch(`${API_URL}/api/suppressions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getAuthToken()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      sensor_id: sensorId,
      start_time: startTime,
      end_time: endTime,
      reason,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to create suppression: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Delete a suppression
 */
export async function deleteSuppression(suppressionId: string): Promise<void> {
  const response = await fetch(`${API_URL}/api/suppressions/${suppressionId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${getAuthToken()}`,
    },
  });

  if (!response.ok && response.status !== 204) {
    throw new Error(`Failed to delete suppression: ${response.statusText}`);
  }
}
