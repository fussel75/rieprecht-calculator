import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link, useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Eye, EyeOff, LogIn, Mail, RefreshCw } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import rieprechLogo from "@assets/optimized_logo-1_1768739267250.png";

const loginSchema = z.object({
  identifier: z.string().min(1, "Benutzername oder E-Mail erforderlich"),
  password: z.string().min(1, "Passwort erforderlich"),
  rememberMe: z.boolean().optional().default(false),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function Login() {
  const [showPassword, setShowPassword] = useState(false);
  const [verificationNeeded, setVerificationNeeded] = useState<{ show: boolean; email: string }>({ show: false, email: "" });
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const form = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      identifier: "",
      password: "",
      rememberMe: false,
    },
  });

  const loginMutation = useMutation({
    mutationFn: async (data: LoginForm) => {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      const result = await res.json();
      if (!res.ok) {
        if (result.requiresVerification) {
          setVerificationNeeded({ show: true, email: result.email });
          throw new Error("verification_needed");
        }
        throw new Error(result.message || "Anmeldung fehlgeschlagen");
      }
      return result;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["/api/auth/me"], data);
      toast({
        title: "Erfolgreich angemeldet",
        description: "Willkommen zurück!",
      });
      setLocation("/");
    },
    onError: (error: Error) => {
      if (error.message !== "verification_needed") {
        toast({
          title: "Anmeldung fehlgeschlagen",
          description: error.message || "Ungültige Anmeldedaten",
          variant: "destructive",
        });
      }
    },
  });

  const resendMutation = useMutation({
    mutationFn: async (email: string) => {
      const res = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "E-Mail gesendet",
        description: "Bitte überprüfen Sie Ihr Postfach.",
      });
    },
    onError: () => {
      toast({
        title: "Fehler",
        description: "E-Mail konnte nicht gesendet werden.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: LoginForm) => {
    loginMutation.mutate(data);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex flex-col items-center mb-4">
            <img src={rieprechLogo} alt="Rieprecht Logo" className="w-32 h-auto mb-2" />
          </div>
          <CardTitle className="text-xl">Anmelden</CardTitle>
        </CardHeader>
        <CardContent>
          {verificationNeeded.show && (
            <Alert className="mb-4 border-amber-500/50 bg-amber-500/5">
              <Mail className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-700">
                <p className="font-medium">E-Mail-Adresse noch nicht bestätigt</p>
                <p className="text-sm mt-1">Bitte überprüfen Sie Ihr Postfach und klicken Sie auf den Bestätigungslink.</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={() => resendMutation.mutate(verificationNeeded.email)}
                  disabled={resendMutation.isPending}
                  data-testid="button-resend-verification"
                >
                  {resendMutation.isPending ? (
                    <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3 w-3 mr-1" />
                  )}
                  Erneut senden
                </Button>
              </AlertDescription>
            </Alert>
          )}
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="identifier"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Benutzername oder E-Mail</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Benutzername oder E-Mail"
                        data-testid="input-identifier"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Passwort</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          type={showPassword ? "text" : "password"}
                          placeholder="Ihr Passwort"
                          data-testid="input-password"
                          {...field}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                          onClick={() => setShowPassword(!showPassword)}
                          data-testid="button-toggle-password"
                        >
                          {showPassword ? (
                            <EyeOff className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <Eye className="h-4 w-4 text-muted-foreground" />
                          )}
                        </Button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex items-center justify-between">
                <FormField
                  control={form.control}
                  name="rememberMe"
                  render={({ field }) => (
                    <FormItem className="flex items-center space-x-2 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="checkbox-remember-me"
                        />
                      </FormControl>
                      <FormLabel className="text-sm font-normal cursor-pointer">
                        Angemeldet bleiben
                      </FormLabel>
                    </FormItem>
                  )}
                />
                <Link href="/forgot-password" className="text-sm text-primary hover:underline" data-testid="link-forgot-password">
                  Passwort vergessen?
                </Link>
              </div>
              <Button 
                type="submit" 
                className="w-full" 
                disabled={loginMutation.isPending}
                data-testid="button-login"
              >
                {loginMutation.isPending ? (
                  "Wird angemeldet..."
                ) : (
                  <>
                    <LogIn className="mr-2 h-4 w-4" />
                    Anmelden
                  </>
                )}
              </Button>
            </form>
          </Form>
          <div className="mt-6 text-center text-sm">
            <span className="text-muted-foreground">Noch kein Konto? </span>
            <Link href="/register" className="text-primary hover:underline font-medium" data-testid="link-register">
              Registrieren
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
