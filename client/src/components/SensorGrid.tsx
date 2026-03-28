import { useEffect, useState } from "react";
import { fetchSensors } from "@/lib/api";
import { useSensorUpdates, type SensorStateEvent } from "@/hooks/useSocket";
import { SensorCard } from "./SensorCard";
import type { Sensor } from "@/lib/types";

export function SensorGrid() {
  const [sensors, setSensors] = useState<Sensor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { sensors: updatedSensors } = useSensorUpdates();

  useEffect(() => {
    async function loadSensors() {
      try {
        setLoading(true);
        setError(null);
        const data = await fetchSensors();
        setSensors(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load sensors");
      } finally {
        setLoading(false);
      }
    }

    loadSensors();
  }, []);

  // Update sensors in real-time
  useEffect(() => {
    if (updatedSensors.length > 0) {
      setSensors((prevSensors) =>
        prevSensors.map((sensor) => {
          const updated = updatedSensors.find(
            (u: SensorStateEvent) => u.sensor_id === sensor.id,
          );
          if (updated) {
            return {
              ...sensor,
              current_state: updated.state,
              last_reading_at: updated.timestamp,
            };
          }
          return sensor;
        }),
      );
    }
  }, [updatedSensors]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="h-48 bg-muted rounded-lg animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive p-4 text-destructive">
        <h3 className="font-semibold">Error Loading Sensors</h3>
        <p className="text-sm">{error}</p>
      </div>
    );
  }

  if (sensors.length === 0) {
    return (
      <div className="rounded-lg border p-4 text-center text-muted-foreground">
        No sensors configured. Add sensors to a zone to get started.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {sensors.map((sensor) => (
        <SensorCard
          key={sensor.id}
          sensor={sensor}
        />
      ))}
    </div>
  );
}
