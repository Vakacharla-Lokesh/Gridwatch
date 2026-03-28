import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import {
  fetchSensor,
  fetchSensorHistory,
  fetchSuppressions,
  createSuppression,
  deleteSuppression,
} from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  getSensorStateVariant,
  formatTimestamp,
  getStatusEmoji,
} from "@/lib/ui-helpers";
import type {
  Sensor,
  Suppression,
  HistoryResponse,
  Reading,
} from "@/lib/types";

export function SensorDetail() {
  const { sensorId } = useParams<{ sensorId: string }>();
  const [sensor, setSensor] = useState<Sensor | null>(null);
  const [history, setHistory] = useState<HistoryResponse | null>(null);
  const [suppressions, setSuppressions] = useState<Suppression[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showSuppressionDialog, setShowSuppressionDialog] = useState(false);
  const [suppressionForm, setSuppressionForm] = useState({
    startTime: "",
    endTime: "",
    reason: "",
  });

  useEffect(() => {
    if (!sensorId) return;

    async function loadData() {
      try {
        setLoading(true);
        setError(null);
        const [sensorData, historyData, suppressionData] = await Promise.all([
          fetchSensor(sensorId!),
          fetchSensorHistory(sensorId!),
          fetchSuppressions(sensorId!),
        ]);
        setSensor(sensorData);
        setHistory(historyData);
        setSuppressions(suppressionData);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load sensor");
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [sensorId]);

  if (!sensorId) {
    return <div className="text-red-500">Sensor ID is required</div>;
  }

  const handleCreateSuppression = async () => {
    try {
      setError(null);
      if (!suppressionForm.startTime || !suppressionForm.endTime) {
        setError("Start and end times are required");
        return;
      }

      const newSuppression = await createSuppression(
        sensorId,
        suppressionForm.startTime,
        suppressionForm.endTime,
        suppressionForm.reason || undefined,
      );

      setSuppressions([newSuppression, ...suppressions]);
      setShowSuppressionDialog(false);
      setSuppressionForm({ startTime: "", endTime: "", reason: "" });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to create suppression",
      );
    }
  };

  const handleDeleteSuppression = async (suppressionId: string) => {
    try {
      await deleteSuppression(suppressionId);
      setSuppressions(suppressions.filter((s) => s.id !== suppressionId));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to delete suppression",
      );
    }
  };

  if (loading) {
    return <div className="space-y-4">Loading sensor details...</div>;
  }

  if (!sensor) {
    return (
      <div className="rounded-lg border border-destructive p-4 text-destructive">
        Sensor not found
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Sensor Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl">{sensor.name}</CardTitle>
              <p className="text-sm text-muted-foreground">
                {sensor.zone_name}
              </p>
            </div>
            <Badge variant={getSensorStateVariant(sensor.current_state)}>
              {getStatusEmoji(sensor.current_state)} {sensor.current_state}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-sm text-muted-foreground">Sensor ID</div>
              <div className="font-mono text-xs">{sensor.id}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Last Reading</div>
              <div className="text-sm">
                {sensor.last_reading_at
                  ? formatTimestamp(sensor.last_reading_at)
                  : "Never"}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-sm text-muted-foreground">
                Total Readings
              </div>
              <div className="text-lg font-semibold">
                {sensor.reading_count}
              </div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Open Alerts</div>
              <div className="text-lg font-semibold">{sensor.open_alerts}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Suppressions */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>Suppression Windows</CardTitle>
          <Button
            onClick={() => setShowSuppressionDialog(true)}
            size="sm"
          >
            Add Suppression
          </Button>
        </CardHeader>

        <CardContent>
          {suppressions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No suppression windows configured
            </p>
          ) : (
            <div className="space-y-2">
              {suppressions.map((suppression: Suppression) => (
                <div
                  key={suppression.id}
                  className="flex items-center justify-between p-3 rounded border"
                >
                  <div className="text-sm">
                    <div className="font-semibold">
                      {new Date(suppression.start_time).toLocaleTimeString()} -{" "}
                      {new Date(suppression.end_time).toLocaleTimeString()}
                    </div>
                    {suppression.reason && (
                      <p className="text-xs text-muted-foreground">
                        {suppression.reason}
                      </p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteSuppression(suppression.id)}
                  >
                    Delete
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Reading History */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Readings</CardTitle>
        </CardHeader>

        <CardContent>
          {error && (
            <div className="mb-4 rounded-lg border border-destructive p-2 text-sm text-destructive">
              {error}
            </div>
          )}

          {history && history.data.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Voltage</TableHead>
                    <TableHead>Current</TableHead>
                    <TableHead>Temp</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.data.map((reading: Reading) => (
                    <TableRow key={reading.id}>
                      <TableCell className="font-mono text-xs">
                        {formatTimestamp(reading.timestamp)}
                      </TableCell>
                      <TableCell>{reading.voltage.toFixed(2)}V</TableCell>
                      <TableCell>{reading.current.toFixed(2)}A</TableCell>
                      <TableCell>{reading.temperature.toFixed(1)}°C</TableCell>
                      <TableCell>
                        {reading.has_anomaly ? (
                          <Badge variant="secondary">⚠ Anomaly</Badge>
                        ) : (
                          <Badge variant="default">OK</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {history.pagination.pages > 1 && (
                <div className="mt-4 flex justify-center gap-2">
                  <Button
                    variant="outline"
                    disabled
                  >
                    Previous
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Page {history.pagination.page} of {history.pagination.pages}
                  </span>
                  <Button
                    variant="outline"
                    disabled
                  >
                    Next
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No reading history available
            </p>
          )}
        </CardContent>
      </Card>

      {/* Suppression Dialog */}
      <Dialog
        open={showSuppressionDialog}
        onOpenChange={setShowSuppressionDialog}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Suppression Window</DialogTitle>
            <DialogDescription>
              Suppress alerts for this sensor during a specific time window.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Start Time</label>
              <Input
                type="datetime-local"
                value={suppressionForm.startTime}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setSuppressionForm({
                    ...suppressionForm,
                    startTime: e.target.value,
                  })
                }
              />
            </div>

            <div>
              <label className="text-sm font-medium">End Time</label>
              <Input
                type="datetime-local"
                value={suppressionForm.endTime}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setSuppressionForm({
                    ...suppressionForm,
                    endTime: e.target.value,
                  })
                }
              />
            </div>

            <div>
              <label className="text-sm font-medium">Reason (Optional)</label>
              <Input
                placeholder="e.g., Scheduled maintenance"
                value={suppressionForm.reason}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setSuppressionForm({
                    ...suppressionForm,
                    reason: e.target.value,
                  })
                }
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowSuppressionDialog(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleCreateSuppression}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
