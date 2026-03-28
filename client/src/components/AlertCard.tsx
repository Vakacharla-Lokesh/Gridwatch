import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  getAlertSeverityVariant,
  getAlertStatusVariant,
  hoursAgo,
} from "@/lib/ui-helpers";
import { acknowledgeAlert, resolveAlert } from "@/lib/api";
import type { Alert } from "@/lib/types";

interface AlertCardProps {
  alert: Alert;
  onStatusChange?: (alertId: string, newStatus: Alert["status"]) => void;
}

export function AlertCard({ alert, onStatusChange }: AlertCardProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentStatus, setCurrentStatus] = useState(alert.status);

  const handleAcknowledge = async () => {
    setLoading(true);
    setError(null);
    try {
      await acknowledgeAlert(alert.id);
      setCurrentStatus("acknowledged");
      onStatusChange?.(alert.id, "acknowledged");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to acknowledge");
    } finally {
      setLoading(false);
    }
  };

  const handleResolve = async () => {
    setLoading(true);
    setError(null);
    try {
      await resolveAlert(alert.id);
      setCurrentStatus("resolved");
      onStatusChange?.(alert.id, "resolved");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to resolve");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className={currentStatus === "open" ? "border-destructive" : ""}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <CardTitle className="text-base">{alert.sensor_name}</CardTitle>
            <p className="text-sm text-muted-foreground">
              {alert.rule_type} • {alert.zone_name}
            </p>
          </div>
          <div className="flex gap-2">
            <Badge variant={getAlertSeverityVariant(alert.severity)}>
              {alert.severity}
            </Badge>
            <Badge variant={getAlertStatusVariant(currentStatus)}>
              {currentStatus}
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <div className="text-muted-foreground text-xs">Created</div>
            <div className="font-mono text-xs">
              {hoursAgo(alert.created_at)}
            </div>
          </div>
          <div>
            <div className="text-muted-foreground text-xs">Assigned To</div>
            <div className="font-mono text-xs">
              {alert.assigned_to_email || "Unassigned"}
            </div>
          </div>
        </div>

        {alert.escalated && (
          <div className="bg-destructive/10 p-2 rounded text-sm">
            ⚡ Escalated to supervisor
          </div>
        )}

        {alert.suppressed && (
          <div className="bg-muted p-2 rounded text-sm">
            🔇 Suppressed during suppression window
          </div>
        )}

        {error && (
          <div className="bg-destructive/10 p-2 rounded text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="flex gap-2">
          {currentStatus === "open" && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handleAcknowledge}
                disabled={loading}
                className="flex-1"
              >
                Acknowledge
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleResolve}
                disabled={loading}
                className="flex-1"
              >
                Resolve
              </Button>
            </>
          )}

          {currentStatus === "acknowledged" && (
            <Button
              variant="destructive"
              size="sm"
              onClick={handleResolve}
              disabled={loading}
              className="w-full"
            >
              Resolve
            </Button>
          )}

          {currentStatus === "resolved" && (
            <div className="text-sm text-muted-foreground w-full text-center py-2">
              ✓ Alert resolved
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
