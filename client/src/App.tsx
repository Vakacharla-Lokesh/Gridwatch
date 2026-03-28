import { BrowserRouter, Routes, Route } from "react-router-dom";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./App.css";
import { Dashboard } from "@/pages/Dashboard";
import { SensorDetailPage } from "@/pages/SensorDetailPage";

function App() {
  return (
    <TooltipProvider>
      <BrowserRouter>
        <div className="min-h-screen bg-background">
          <main className="container mx-auto px-4 py-8">
            <header className="mb-12">
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-4xl font-bold">🔌 GridWatch</h1>
              </div>
              <p className="text-muted-foreground">
                Sensor Monitoring & Alert Management System
              </p>
            </header>

            <Routes>
              <Route
                path="/"
                element={<Dashboard />}
              />
              <Route
                path="/sensors/:sensorId"
                element={<SensorDetailPage />}
              />
            </Routes>
          </main>
        </div>
      </BrowserRouter>
    </TooltipProvider>
  );
}

export default App;
