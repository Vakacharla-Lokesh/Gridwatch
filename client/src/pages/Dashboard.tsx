import { SensorGrid } from '@/components/SensorGrid';
import { AlertPanel } from '@/components/AlertPanel';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';

export function Dashboard() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Monitor your sensors and manage alerts in real-time
        </p>
      </div>

      <Tabs defaultValue="sensors">
        <TabsList>
          <TabsTrigger value="sensors">Sensors</TabsTrigger>
          <TabsTrigger value="alerts">Alerts</TabsTrigger>
        </TabsList>

        <TabsContent value="sensors" className="space-y-6">
          <div>
            <h2 className="text-xl font-semibold mb-4">Active Sensors</h2>
            <SensorGrid />
          </div>
        </TabsContent>

        <TabsContent value="alerts" className="space-y-6">
          <div>
            <h2 className="text-xl font-semibold mb-4">Alert Management</h2>
            <AlertPanel />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
