import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  getSensorStateVariant,
  formatTimestamp,
  hoursAgo,
  getStatusEmoji,
} from "@/lib/ui-helpers";
import type { Sensor } from "@/lib/types";

interface SensorCardProps {
  sensor: Sensor;
}

export function SensorCard({ sensor }: SensorCardProps) {
  const displayState = sensor.current_state;
  const lastUpdate = sensor.last_reading_at;

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg">{sensor.name}</CardTitle>
            <p className="text-sm text-muted-foreground">{sensor.zone_name}</p>
          </div>
          <Badge variant={getSensorStateVariant(displayState)}>
            {getStatusEmoji(displayState)} {displayState}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Last Reading:</span>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="cursor-help">
                {lastUpdate ? hoursAgo(lastUpdate) : "Never"}
              </span>
            </TooltipTrigger>
            <TooltipContent>
              {lastUpdate ? formatTimestamp(lastUpdate) : "No readings yet"}
            </TooltipContent>
          </Tooltip>
        </div>

        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="bg-muted p-2 rounded">
            <div className="text-muted-foreground text-xs">Readings</div>
            <div className="font-semibold">{sensor.reading_count}</div>
          </div>
          <div className="bg-muted p-2 rounded">
            <div className="text-muted-foreground text-xs">Open Alerts</div>
            <div className="font-semibold">{sensor.open_alerts}</div>
          </div>
        </div>

        <Link
          to={`/sensors/${sensor.id}`}
          className="block w-full"
        >
          <Button
            variant="outline"
            className="w-full"
          >
            View Details
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}
