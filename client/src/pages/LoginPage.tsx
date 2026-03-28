/**
 * Login Page
 * Provides form to authenticate with email
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth";

export function LoginPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const testEmails = [
    "op_north@gridwatch.local",
    "op_south@gridwatch.local",
    "supervisor@gridwatch.local",
  ];

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await login(email);
      navigate("/");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Login failed. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = async (testEmail: string) => {
    setEmail(testEmail);
    setLoading(true);
    setError("");

    try {
      await login(testEmail);
      navigate("/");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Login failed. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-linear-to-b from-background to-muted flex items-center justify-center px-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader>
          <div className="flex items-center gap-3 mb-4">
            <span className="text-4xl">🔌</span>
            <div>
              <CardTitle className="text-2xl">GridWatch</CardTitle>
              <CardDescription>
                Sensor Monitoring & Alert Dashboard
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Login Form */}
          <form
            onSubmit={handleLogin}
            className="space-y-4"
          >
            <div>
              <label
                htmlFor="email"
                className="text-sm font-medium mb-2 block"
              >
                Email
              </label>
              <Input
                id="email"
                type="email"
                placeholder="operator@gridwatch.local"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
                className="w-full"
              />
            </div>

            {error && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={loading || !email}
            >
              {loading ? "Signing in..." : "Sign In"}
            </Button>
          </form>

          {/* Demo Users */}
          <div className="space-y-3">
            <div className="text-sm font-medium text-muted-foreground">
              Demo Users (Click to Login)
            </div>
            <div className="space-y-2">
              {testEmails.map((testEmail) => (
                <button
                  key={testEmail}
                  onClick={() => handleQuickLogin(testEmail)}
                  disabled={loading}
                  className="w-full flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted transition-colors disabled:opacity-50"
                >
                  <span className="text-sm font-mono">{testEmail}</span>
                  <Badge
                    variant={
                      testEmail.includes("supervisor")
                        ? "destructive"
                        : "secondary"
                    }
                  >
                    {testEmail.includes("supervisor")
                      ? "Supervisor"
                      : "Operator"}
                  </Badge>
                </button>
              ))}
            </div>
          </div>

          {/* Info Text */}
          <div className="text-xs text-muted-foreground space-y-2 rounded-lg bg-muted p-3">
            <p>
              <strong>Demo Mode:</strong> No password required. Email-based auth
              for demo purposes.
            </p>
            <p>
              <strong>Note:</strong> Run seed script to populate test users in
              database.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
