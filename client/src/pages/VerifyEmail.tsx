import { useEffect, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import rieprechLogo from "@assets/optimized_logo-1_1768739267250.png";

export default function VerifyEmail() {
  const search = useSearch();
  const [, setLocation] = useLocation();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");

  const verifyMutation = useMutation({
    mutationFn: async (token: string) => {
      const res = await fetch(`/api/auth/verify-email?token=${token}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Verifizierung fehlgeschlagen");
      }
      return data;
    },
    onSuccess: (data) => {
      setStatus("success");
      setMessage(data.message);
    },
    onError: (error: Error) => {
      setStatus("error");
      setMessage(error.message);
    },
  });

  useEffect(() => {
    const params = new URLSearchParams(search);
    const token = params.get("token");
    
    if (token) {
      verifyMutation.mutate(token);
    } else {
      setStatus("error");
      setMessage("Kein Verifizierungstoken gefunden");
    }
  }, [search]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex flex-col items-center mb-4">
            <img src={rieprechLogo} alt="Rieprecht Logo" className="w-32 h-auto mb-2" />
          </div>
          <CardTitle className="text-xl">E-Mail-Verifizierung</CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          {status === "loading" && (
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <p className="text-muted-foreground">E-Mail wird verifiziert...</p>
            </div>
          )}
          
          {status === "success" && (
            <div className="flex flex-col items-center gap-4">
              <CheckCircle2 className="h-12 w-12 text-green-500" />
              <Alert className="border-green-500/50 bg-green-500/5">
                <AlertDescription className="text-green-700">
                  {message}
                </AlertDescription>
              </Alert>
              <Button onClick={() => setLocation("/login")} data-testid="button-go-to-login">
                Zur Anmeldung
              </Button>
            </div>
          )}
          
          {status === "error" && (
            <div className="flex flex-col items-center gap-4">
              <XCircle className="h-12 w-12 text-destructive" />
              <Alert variant="destructive">
                <AlertDescription>
                  {message}
                </AlertDescription>
              </Alert>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setLocation("/login")} data-testid="button-go-to-login">
                  Zur Anmeldung
                </Button>
                <Button variant="outline" onClick={() => setLocation("/register")} data-testid="button-go-to-register">
                  Neu registrieren
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
