import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TelegramChannel } from "@shared/schema";
import { MessageSquare } from "lucide-react";

export default function ChannelsPage() {
  const { data: channels } = useQuery<TelegramChannel[]>({
    queryKey: ["/api/telegram-channels"],
  });

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center gap-2 mb-6">
        <MessageSquare className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">Telegram Channels</h1>
      </div>

      <div className="grid gap-4">
        {channels?.map((channel) => (
          <Card key={channel.id}>
            <CardHeader>
              <CardTitle className="text-lg font-medium">{channel.name}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2">
                <div className="text-sm text-muted-foreground">
                  Type: {channel.type}
                </div>
                <div className="text-sm text-muted-foreground">
                  Created: {new Date(channel.createdAt).toLocaleDateString()}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {channels?.length === 0 && (
          <Card>
            <CardContent className="py-8">
              <p className="text-center text-muted-foreground">
                No channels found. Add the bot to a Telegram channel or group to see it here.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
