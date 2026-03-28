import { useEffect, useState } from "react";
import { fetchAlerts } from "@/lib/api";
import { useAlertUpdates, type AlertEvent } from "@/hooks/useSocket";
import { AlertCard } from "./AlertCard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Alert } from "@/lib/types";

export function AlertPanel() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<Alert["status"] | "open">("open");
  const { alerts: realtimeAlerts } = useAlertUpdates();

  useEffect(() => {
    async function loadAlerts() {
      try {
        setLoading(true);
        setError(null);
        const data = await fetchAlerts(status);
        setAlerts(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load alerts");
      } finally {
        setLoading(false);
      }
    }

    loadAlerts();
  }, [status]);

  // Update alerts from real-time events
  useEffect(() => {
    if (realtimeAlerts.length > 0) {
      setAlerts((prevAlerts) => {
        // Merge real-time alerts with existing ones
        const alertMap = new Map(prevAlerts.map((a) => [a.id, a]));

        realtimeAlerts.forEach((rtAlert: AlertEvent) => {
          if (alertMap.has(rtAlert.alert_id)) {
            const existing = alertMap.get(rtAlert.alert_id)!;
            alertMap.set(rtAlert.alert_id, {
              ...existing,
              status: rtAlert.status as Alert["status"],
            });
          } else {
            // New alert - could add it to the list
            alertMap.set(rtAlert.alert_id, {
              id: rtAlert.alert_id,
              anomaly_id: "",
              sensor_id: rtAlert.sensor_id,
              sensor_name: rtAlert.sensor_name,
              zone_id: rtAlert.zone_id,
              severity: rtAlert.severity,
              status: rtAlert.status as Alert["status"],
              created_at: rtAlert.timestamp,
              escalated: rtAlert.type === "escalated",
              suppressed: false,
              assigned_to: rtAlert.assigned_to || null,
              assigned_to_email: null,
              rule_type: "",
              rule_config: {},
              audit_count: 0,
              zone_name: "",
            });
          }
        });

        return Array.from(alertMap.values());
      });
    }
  }, [realtimeAlerts]);

  const getAlertCount = (s: string) => {
    switch (s) {
      case "open":
        return alerts.filter((a) => a.status === "open").length;
      case "acknowledged":
        return alerts.filter((a) => a.status === "acknowledged").length;
      case "resolved":
        return alerts.filter((a) => a.status === "resolved").length;
      default:
        return 0;
    }
  };

  const getFilteredAlerts = () => {
    return alerts.filter((a) => a.status === status);
  };

  if (error) {
    return (
      <div className="rounded-lg border border-destructive p-4 text-destructive">
        <h3 className="font-semibold">Error Loading Alerts</h3>
        <p className="text-sm">{error}</p>
      </div>
    );
  }

  const filteredAlerts = getFilteredAlerts();

  return (
    <div className="space-y-4">
      <Tabs
        value={status}
        onValueChange={(v: string) => setStatus(v as Alert["status"])}
      >
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="open">
            Open {getAlertCount("open") > 0 && `(${getAlertCount("open")})`}
          </TabsTrigger>
          <TabsTrigger value="acknowledged">
            Acknowledged{" "}
            {getAlertCount("acknowledged") > 0 &&
              `(${getAlertCount("acknowledged")})`}
          </TabsTrigger>
          <TabsTrigger value="resolved">
            Resolved{" "}
            {getAlertCount("resolved") > 0 && `(${getAlertCount("resolved")})`}
          </TabsTrigger>
        </TabsList>

        <TabsContent
          value="open"
          className="space-y-3"
        >
          {loading && (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div
                  key={i}
                  className="h-24 bg-muted rounded-lg animate-pulse"
                />
              ))}
            </div>
          )}

          {!loading &&
            (filteredAlerts.length === 0 ? (
              <div className="rounded-lg border p-4 text-center text-muted-foreground">
                No open alerts. All systems operational!
              </div>
            ) : (
              filteredAlerts.map((alert) => (
                <AlertCard
                  key={alert.id}
                  alert={alert}
                />
              ))
            ))}
        </TabsContent>

        <TabsContent
          value="acknowledged"
          className="space-y-3"
        >
          {filteredAlerts.length === 0 ? (
            <div className="rounded-lg border p-4 text-center text-muted-foreground">
              No acknowledged alerts
            </div>
          ) : (
            filteredAlerts.map((alert) => (
              <AlertCard
                key={alert.id}
                alert={alert}
              />
            ))
          )}
        </TabsContent>

        <TabsContent
          value="resolved"
          className="space-y-3"
        >
          {filteredAlerts.length === 0 ? (
            <div className="rounded-lg border p-4 text-center text-muted-foreground">
              No resolved alerts
            </div>
          ) : (
            filteredAlerts.map((alert) => (
              <AlertCard
                key={alert.id}
                alert={alert}
              />
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
