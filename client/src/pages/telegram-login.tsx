import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { BotIcon, CheckCircle2, XCircle, Loader2, Timer } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { apiRequest } from "@/lib/queryClient";

const CODE_EXPIRATION_TIME = 300; // 5 minutes in seconds

const telegramAuthSchema = z.object({
  phoneNumber: z.string()
    .min(1, "Phone number is required")
    .regex(/^\+?[1-9]\d{1,14}$/, "Invalid phone number format"),
  code: z.string()
    .optional()
    .transform(val => val === "" ? undefined : val),
  password: z.string()
    .optional()
    .transform(val => val === "" ? undefined : val),
});

type TelegramAuthForm = z.infer<typeof telegramAuthSchema>;

interface ConnectionStatus {
  connected: boolean;
  user?: {
    id: string;
    username: string;
    firstName?: string;
  };
  lastChecked: string;
}

export default function TelegramLogin() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [awaitingCode, setAwaitingCode] = useState(false);
  const [requires2FA, setRequires2FA] = useState(false);
  const [status, setStatus] = useState<ConnectionStatus | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(CODE_EXPIRATION_TIME);
  const timerRef = useRef<NodeJS.Timeout>();

  const form = useForm<TelegramAuthForm>({
    resolver: zodResolver(telegramAuthSchema),
    defaultValues: {
      phoneNumber: "",
      code: "",
      password: "",
    }
  });

  // Handle code expiration timer
  useEffect(() => {
    if (awaitingCode && !requires2FA) {
      setTimeRemaining(CODE_EXPIRATION_TIME);
      timerRef.current = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 1) {
            clearInterval(timerRef.current);
            setAwaitingCode(false);
            toast({
              title: "Code Expired",
              description: "The verification code has expired. Please request a new one.",
              variant: "destructive",
            });
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => {
        if (timerRef.current) {
          clearInterval(timerRef.current);
        }
      };
    }
  }, [awaitingCode, requires2FA, toast]);

  const onSubmit = async (data: TelegramAuthForm) => {
    try {
      setIsSubmitting(true);
      if (!awaitingCode) {
        // Request verification code
        const response = await apiRequest("POST", "/api/telegram-auth/request-code", {
          phoneNumber: data.phoneNumber,
        });

        if (response.ok) {
          const result = await response.json();
          if (result.requires2FA) {
            setRequires2FA(true);
            toast({ 
              title: "2FA Required",
              description: "Please enter your Two-Factor Authentication password"
            });
            return;
          }
          setAwaitingCode(true);
          toast({ 
            title: "Code sent",
            description: result.message || "Please check your Telegram app for the verification code"
          });
          // Clear code field when requesting new code
          form.setValue("code", "");
        } else {
          const error = await response.json();
          if (error.code === "AUTH_RESTART") {
            toast({
              title: "Please try again",
              description: "There was an issue sending the code. Please try again.",
              variant: "destructive",
            });
            // Reset form state
            setAwaitingCode(false);
            setRequires2FA(false);
          } else {
            throw new Error(error.message);
          }
        }
      } else if (requires2FA) {
        // Submit 2FA password
        const response = await apiRequest("POST", "/api/telegram-auth/verify-2fa", {
          password: data.password,
        });
        if (response.ok) {
          toast({ 
            title: "Success",
            description: "Authentication successful"
          });
          window.location.reload();
        } else {
          const error = await response.json();
          throw new Error(error.message);
        }
      } else {
        // Verify code
        const response = await apiRequest("POST", "/api/telegram-auth/verify", {
          code: data.code,
        });

        if (!response.ok) {
          const error = await response.json();
          if (error.code === "SESSION_EXPIRED" || error.code === "PHONE_CODE_EXPIRED") {
            toast({
              title: "Code Expired",
              description: error.message,
              variant: "destructive",
            });
            setAwaitingCode(false);
            form.setValue("code", "");
            return;
          }
          throw new Error(error.message);
        }

        const result = await response.json();
        if (result.requires2FA) {
          setRequires2FA(true);
          toast({ 
            title: "2FA Required",
            description: "Please enter your Two-Factor Authentication password"
          });
          // Clear password field when 2FA is required
          form.setValue("password", "");
        } else {
          toast({ 
            title: "Success",
            description: "Authentication successful"
          });
          window.location.reload();
        }
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    // Check initial status
    fetch('/api/telegram-auth/status')
      .then(res => res.json())
      .then(data => {
        setStatus(data);
        if (data.connected) {
          setAwaitingCode(false);
          setRequires2FA(false);
        }
      })
      .catch(error => {
        console.error("Failed to fetch status:", error);
      });

    // Setup WebSocket connection
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws/status`);

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'status') {
        setStatus(data);
        if (data.connected) {
          setAwaitingCode(false);
          setRequires2FA(false);
        }
      }
    };

    return () => {
      ws.close();
    };
  }, []);

  // If already connected, show status and option to disconnect
  if (status?.connected) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-1">
            <div className="flex items-center gap-2">
              <BotIcon className="h-6 w-6 text-primary" />
              <CardTitle className="text-2xl">Telegram Connection</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <Alert className="mb-4">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <AlertDescription className="ml-2">
                Connected as {status.user?.username || status.user?.firstName || 'Unknown'}
              </AlertDescription>
            </Alert>
            <p className="text-sm text-muted-foreground mb-4">
              Last checked: {new Date(status.lastChecked).toLocaleString()}
            </p>
            <div className="flex gap-2">
              <Button onClick={() => setLocation('/channels')} className="flex-1">
                View Channels
              </Button>
              <Button
                variant="destructive"
                onClick={async () => {
                  await fetch('/api/telegram-auth/logout', { method: 'POST' });
                  window.location.reload();
                }}
              >
                Disconnect
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="flex items-center gap-2">
            <BotIcon className="h-6 w-6 text-primary" />
            <CardTitle className="text-2xl">Connect Telegram Account</CardTitle>
          </div>
          {status && (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertDescription className="ml-2">
                Not connected
              </AlertDescription>
            </Alert>
          )}
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="phoneNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone Number</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="+1234567890"
                        disabled={awaitingCode || isSubmitting}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {awaitingCode && !requires2FA && (
                <>
                  <FormField
                    control={form.control}
                    name="code"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center justify-between">
                          <span>Verification Code</span>
                          <span className="text-sm text-muted-foreground flex items-center gap-1">
                            <Timer className="h-4 w-4" />
                            {Math.floor(timeRemaining / 60)}:{(timeRemaining % 60).toString().padStart(2, '0')}
                          </span>
                        </FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="Enter code from Telegram"
                            disabled={isSubmitting}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <p className="text-sm text-muted-foreground">
                    Code will expire in {Math.floor(timeRemaining / 60)}:{(timeRemaining % 60).toString().padStart(2, '0')}
                  </p>
                </>
              )}

              {requires2FA && (
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>2FA Password</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="password"
                          placeholder="Enter your 2FA password"
                          disabled={isSubmitting}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Please wait...
                  </>
                ) : (
                  !awaitingCode ? "Send Code" : requires2FA ? "Verify 2FA" : "Verify Code"
                )}
              </Button>
            </form>
          </Form>

          <p className="text-sm text-muted-foreground mt-4 text-center">
            {requires2FA
              ? "Enter your Two-Factor Authentication password"
              : awaitingCode
              ? "Enter the code sent to your Telegram app"
              : "You'll need to provide your Telegram account's phone number to enable userbot features"}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}