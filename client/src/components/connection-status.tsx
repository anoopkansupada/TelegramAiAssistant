import { useEffect, useState } from 'react';
import { Card } from './ui/card';
import { Bot, Loader2 } from 'lucide-react';

interface StatusUpdate {
  type: 'status';
  connected: boolean;
  user?: {
    id: string;
    username: string;
    firstName?: string;
  };
  lastChecked: string;
}

export function ConnectionStatus() {
  const [status, setStatus] = useState<StatusUpdate | null>(null);
  const [socket, setSocket] = useState<WebSocket | null>(null);

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/status`;
    const ws = new WebSocket(wsUrl);

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'status') {
        setStatus(data);
      }
    };

    ws.onclose = () => {
      console.log('WebSocket disconnected');
      setStatus(null);
      // Attempt to reconnect after 5 seconds
      setTimeout(() => {
        setSocket(null);
      }, 5000);
    };

    setSocket(ws);

    return () => {
      ws.close();
    };
  }, []);

  if (!status) {
    return (
      <Card className="p-4 flex items-center gap-2 bg-muted">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm">Connecting to Telegram...</span>
      </Card>
    );
  }

  return (
    <Card className={`p-4 flex items-center gap-2 ${
      status.connected ? 'bg-green-50' : 'bg-yellow-50'
    }`}>
      <Bot className={`h-4 w-4 ${
        status.connected ? 'text-green-600' : 'text-yellow-600'
      }`} />
      <div className="flex-1">
        <p className="text-sm font-medium">
          {status.connected ? 'Connected to Telegram' : 'Not connected'}
        </p>
        {status.user && (
          <p className="text-xs text-muted-foreground">
            Logged in as {status.user.firstName || status.user.username}
          </p>
        )}
      </div>
      <span className="text-xs text-muted-foreground">
        Last checked: {new Date(status.lastChecked).toLocaleTimeString()}
      </span>
    </Card>
  );
}
