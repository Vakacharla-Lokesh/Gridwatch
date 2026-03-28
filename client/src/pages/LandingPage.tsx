/**
 * Landing Page
 * Home page with product overview and CTA to login
 */
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function LandingPage() {
  const navigate = useNavigate();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && user) {
      navigate("/dashboard", { replace: true });
    }
  }, [user, isLoading, navigate]);

  const features = [
    {
      icon: "📊",
      title: "Real-Time Monitoring",
      description: "Live sensor data updates via WebSocket without polling",
    },
    {
      icon: "🚨",
      title: "Intelligent Alerts",
      description: "3 anomaly detection rules with automatic escalation",
    },
    {
      icon: "🔒",
      title: "Zone-Scoped Access",
      description: "Multi-tenant security with operator and supervisor roles",
    },
    {
      icon: "🔇",
      title: "Alert Suppression",
      description: "Suppress alerts during maintenance windows",
    },
    {
      icon: "📈",
      title: "History & Analysis",
      description: "Historical readings and anomaly tracking",
    },
    {
      icon: "⚡",
      title: "Scalable Architecture",
      description: "Redis-backed queue and Socket.IO adapter",
    },
  ];

  return (
    <div className="min-h-screen bg-linear-to-b from-background via-background to-muted">
      {/* Header */}
      <header className="border-b border-border/40 sticky top-0 z-50 bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🔌</span>
            <h1 className="text-xl font-bold">GridWatch</h1>
          </div>
          <Button onClick={() => navigate("/login")}>Sign In</Button>
        </div>
      </header>

      {/* Hero */}
      <section className="container mx-auto px-4 py-20 text-center space-y-6">
        <div className="space-y-4">
          <h2 className="text-5xl font-bold tracking-tight">
            Sensor Monitoring & Alert Management
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Enterprise-grade platform for real-time sensor monitoring with
            intelligent anomaly detection, automated alerting, and multi-tenant
            zone management.
          </p>
        </div>

        <div className="flex gap-4 justify-center">
          <Button
            size="lg"
            onClick={() => navigate("/login")}
          >
            Get Started
          </Button>
          <Button
            size="lg"
            variant="outline"
          >
            View Docs
          </Button>
        </div>

        {/* Status Badges */}
        <div className="flex gap-2 justify-center flex-wrap">
          <Badge variant="secondary">✓ Fully Functional</Badge>
          <Badge variant="secondary">Real-Time WebSocket</Badge>
          <Badge variant="secondary">Zone-Scoped Security</Badge>
        </div>
      </section>

      {/* Features Grid */}
      <section className="container mx-auto px-4 py-20">
        <div className="text-center mb-12">
          <h3 className="text-3xl font-bold mb-2">Key Features</h3>
          <p className="text-muted-foreground">
            Everything you need to monitor sensors at scale
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, idx) => (
            <Card
              key={idx}
              className="hover:shadow-md transition-shadow"
            >
              <CardHeader>
                <div className="text-4xl mb-3">{feature.icon}</div>
                <CardTitle className="text-lg">{feature.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>{feature.description}</CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Tech Stack */}
      <section className="container mx-auto px-4 py-20 text-center space-y-8">
        <div>
          <h3 className="text-3xl font-bold mb-2">Built With Modern Tech</h3>
          <p className="text-muted-foreground mb-8">
            Production-ready architecture
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-2xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Backend</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>• Node.js + Express</p>
              <p>• PostgreSQL</p>
              <p>• Socket.IO</p>
              <p>• Upstash Redis</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Frontend</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>• React 19</p>
              <p>• TypeScript</p>
              <p>• Tailwind CSS</p>
              <p>• shadcn/ui</p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* CTA */}
      <section className="container mx-auto px-4 py-20 text-center">
        <Card className="bg-primary text-primary-foreground border-0">
          <CardHeader>
            <CardTitle>Ready to Get Started?</CardTitle>
            <CardDescription className="text-primary-foreground/80">
              Sign in with your account to access the dashboard
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              size="lg"
              variant="secondary"
              onClick={() => navigate("/login")}
            >
              Sign In Now
            </Button>
          </CardContent>
        </Card>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/40 py-8 text-center text-sm text-muted-foreground">
        <p>GridWatch © 2026 — Full-Stack Sensor Monitoring Platform</p>
      </footer>
    </div>
  );
}
