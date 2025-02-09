import { useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { BotIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

const telegramAuthSchema = z.object({
  phoneNumber: z.string().min(1, "Phone number is required"),
  code: z.string().optional(),
});

type TelegramAuthForm = z.infer<typeof telegramAuthSchema>;

export default function TelegramLogin() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [awaitingCode, setAwaitingCode] = useState(false);

  const form = useForm<TelegramAuthForm>({
    resolver: zodResolver(telegramAuthSchema),
  });

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
      } else {
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

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="flex items-center gap-2">
            <BotIcon className="h-6 w-6 text-primary" />
            <CardTitle className="text-2xl">Connect Telegram Account</CardTitle>
          </div>
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

              {awaitingCode && (
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

              <Button type="submit" className="w-full">
                {awaitingCode ? "Verify Code" : "Send Code"}
              </Button>
            </form>
          </Form>

          <p className="text-sm text-muted-foreground mt-4 text-center">
            You'll need to provide your Telegram account's phone number to enable userbot features
          </p>
        </CardContent>
      </Card>
    </div>
  );
}