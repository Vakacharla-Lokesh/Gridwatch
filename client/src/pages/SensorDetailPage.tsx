import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { SensorDetail } from "@/components/SensorDetail";

export function SensorDetailPage() {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          onClick={() => navigate("/")}
          className="mb-2"
        >
          ← Back to Dashboard
        </Button>
      </div>

      <SensorDetail />
    </div>
  );
}
