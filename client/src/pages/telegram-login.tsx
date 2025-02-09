import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { BotIcon, CheckCircle2, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Alert, AlertDescription } from "@/components/ui/alert";

const telegramAuthSchema = z.object({
  phoneNumber: z.string().min(1, "Phone number is required"),
  code: z.string().optional(),
  password: z.string().optional(),
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

  const form = useForm<TelegramAuthForm>({
    resolver: zodResolver(telegramAuthSchema),
  });

  // WebSocket connection for real-time status updates
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

    ws.onclose = () => {
      console.log('WebSocket connection closed');
    };

    return () => {
      ws.close();
    };
  }, []);

  const onSubmit = async (data: TelegramAuthForm) => {
    try {
      if (!awaitingCode) {
        // First step: Send phone number
        const response = await fetch("/api/telegram-auth/request-code", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ phoneNumber: data.phoneNumber }),
        });

        if (!response.ok) {
          throw new Error("Failed to send verification code");
        }

        setAwaitingCode(true);
        toast({
          title: "Verification code sent",
          description: "Please check your Telegram messages for the code",
        });
      } else if (!requires2FA) {
        // Second step: Verify code
        const response = await fetch("/api/telegram-auth/verify", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            phoneNumber: data.phoneNumber,
            code: data.code,
          }),
        });

        if (!response.ok) {
          throw new Error("Invalid verification code");
        }

        const result = await response.json();

        if (result.requires2FA) {
          setRequires2FA(true);
          toast({
            title: "2FA Required",
            description: "Please enter your 2FA password",
          });
          return;
        }

        toast({
          title: "Successfully authenticated",
          description: "Your Telegram account is now connected!",
        });

        setLocation("/channels");
      } else {
        // Third step: Verify 2FA
        const response = await fetch("/api/telegram-auth/verify-2fa", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            password: data.password,
          }),
        });

        if (!response.ok) {
          throw new Error("Invalid 2FA password");
        }

        toast({
          title: "Successfully authenticated",
          description: "Your Telegram account is now connected!",
        });

        setLocation("/channels");
      }
    } catch (error) {
      toast({
        title: "Authentication failed",
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive",
      });
    }
  };

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
            <Alert>
              <XCircle className="h-4 w-4 text-destructive" />
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
                        disabled={awaitingCode}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {awaitingCode && !requires2FA && (
                <FormField
                  control={form.control}
                  name="code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Verification Code</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          placeholder="Enter code from Telegram"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
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
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <Button type="submit" className="w-full">
                {!awaitingCode ? "Send Code" : requires2FA ? "Verify 2FA" : "Verify Code"}
              </Button>
            </form>
          </Form>

          <p className="text-sm text-muted-foreground mt-4 text-center">
            {requires2FA 
              ? "Enter your Two-Factor Authentication password"
              : "You'll need to provide your Telegram account's phone number to enable userbot features"}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}