import { useState } from "react";
import { Button } from "@/components/ui/button";

interface TestingResult {
  success: boolean;
  message: string;
  timestamp: string;
}

const COOLDOWN_DURATION = 30; // seconds

export function TestingPanel() {
  const [ingestLoading, setIngestLoading] = useState(false);
  const [anomaliesLoading, setAnomaliesLoading] = useState(false);
  const [ingestCooldown, setIngestCooldown] = useState(0);
  const [anomaliesCooldown, setAnomaliesCooldown] = useState(0);
  const [result, setResult] = useState<TestingResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Handle cooldown timer
  const startCooldown = (setCooldownFn: (val: (prev: number) => number) => void) => {
    setCooldownFn(() => COOLDOWN_DURATION);
    const interval = setInterval(() => {
      setCooldownFn((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const runTestIngest = async () => {
    if (ingestCooldown > 0) return;

    setIngestLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/testing/run-ingest", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const data = (await response.json()) as TestingResult;

      if (!response.ok) {
        setError(data.message || "Failed to run test");
      } else {
        setResult(data);
        startCooldown(setIngestCooldown);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIngestLoading(false);
    }
  };

  const runTestAnomalies = async () => {
    if (anomaliesCooldown > 0) return;

    setAnomaliesLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/testing/run-anomalies", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const data = (await response.json()) as TestingResult;

      if (!response.ok) {
        setError(data.message || "Failed to run test");
      } else {
        setResult(data);
        startCooldown(setAnomaliesCooldown);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setAnomaliesLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
        <h3 className="font-semibold text-yellow-800">Testing Panel</h3>
        <p className="text-sm text-yellow-700">
          Run test scripts to simulate sensor data and anomaly detection
        </p>
      </div>

      <div className="flex gap-4">
        <Button
          onClick={runTestIngest}
          disabled={ingestLoading || ingestCooldown > 0}
          variant="outline"
          className="flex-1"
        >
          {ingestLoading ? (
            "Running..."
          ) : ingestCooldown > 0 ? (
            <>
              Test Ingest ({ingestCooldown}s)
            </>
          ) : (
            "Test Ingest"
          )}
        </Button>

        <Button
          onClick={runTestAnomalies}
          disabled={anomaliesLoading || anomaliesCooldown > 0}
          variant="outline"
          className="flex-1"
        >
          {anomaliesLoading ? (
            "Running..."
          ) : anomaliesCooldown > 0 ? (
            <>
              Test Anomalies ({anomaliesCooldown}s)
            </>
          ) : (
            "Test Anomalies"
          )}
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-medium text-red-900">{error}</p>
          <button
            onClick={() => setError(null)}
            className="text-sm text-red-700 hover:text-red-900 mt-2 underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {result && !error && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4">
          <p className="text-sm font-medium text-green-900">{result.message}</p>
          <p className="text-xs text-green-700 mt-1">
            {new Date(result.timestamp).toLocaleTimeString()}
          </p>
          <button
            onClick={() => setResult(null)}
            className="text-sm text-green-700 hover:text-green-900 mt-2 underline"
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}
