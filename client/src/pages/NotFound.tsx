import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle, Home } from "lucide-react";
import { useLocation } from "wouter";

export default function NotFound() {
  const [, setLocation] = useLocation();

  const handleGoHome = () => {
    setLocation("/");
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background px-4 py-12">
      <Card className="w-full max-w-md rounded-3xl border border-border bg-card p-2 shadow-xl dark:border-white/10 dark:bg-[#141517]">
        <CardContent className="pt-8 pb-8 text-center">
          <div className="flex justify-center mb-5">
            <div className="grid h-16 w-16 place-items-center rounded-2xl bg-destructive/10 text-destructive border border-destructive/20">
              <AlertCircle className="h-8 w-8" />
            </div>
          </div>

          <span className="font-mono text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Error 404
          </span>

          <h1 className="mt-1 text-2xl font-black tracking-tight text-foreground sm:text-3xl">
            Page Not Found
          </h1>

          <p className="mt-3 text-xs sm:text-sm text-muted-foreground leading-relaxed max-w-sm mx-auto">
            The emergency portal route you are attempting to access does not exist or may have been repositioned.
          </p>

          <div
            id="not-found-button-group"
            className="mt-6 flex flex-col sm:flex-row gap-2.5 justify-center"
          >
            <Button
              onClick={handleGoHome}
              className="bg-[#0f766e] hover:bg-[#0d655e] text-white px-5 py-2.5 rounded-xl text-xs font-bold transition shadow-sm"
            >
              <Home className="w-4 h-4 mr-2" />
              Go Home
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
