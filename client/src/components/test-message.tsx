import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Textarea } from './ui/textarea';
import { Button } from './ui/button';
import { apiRequest } from '@/lib/api';

interface TestResponse {
  message: {
    id: number;
    content: string;
    sentiment: string;
  };
  suggestions: string[];
  contact: {
    id: number;
    firstName: string;
    lastName: string;
    jobTitle: string;
  };
}

export function TestMessage() {
  const [message, setMessage] = useState('');
  const [response, setResponse] = useState<TestResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleTest = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await apiRequest<TestResponse>('/api/test/telegram-message', {
        method: 'POST',
        body: { message }
      });
      setResponse(result);
    } catch (err: any) {
      setError(err.message || 'Failed to test message');
      console.error('Test message error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Test Telegram Message Processing</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Test Message</label>
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Enter a test message..."
            className="min-h-[100px]"
          />
        </div>

        <Button 
          onClick={handleTest}
          disabled={!message || loading}
        >
          {loading ? 'Processing...' : 'Test Message'}
        </Button>

        {error && (
          <div className="p-4 bg-destructive/10 text-destructive rounded-md">
            {error}
          </div>
        )}

        {response && (
          <div className="space-y-4">
            <div className="p-4 bg-muted rounded-md">
              <h3 className="font-medium mb-2">Message Details:</h3>
              <p>Content: {response.message.content}</p>
              <p>Sentiment: {response.message.sentiment}</p>
            </div>

            <div className="p-4 bg-muted rounded-md">
              <h3 className="font-medium mb-2">Generated Suggestions:</h3>
              {response.suggestions.length > 0 ? (
                <ul className="list-disc pl-4">
                  {response.suggestions.map((suggestion, i) => (
                    <li key={i} className="mb-2">{suggestion}</li>
                  ))}
                </ul>
              ) : (
                <p>No suggestions generated</p>
              )}
            </div>

            <div className="p-4 bg-muted rounded-md">
              <h3 className="font-medium mb-2">Contact Info:</h3>
              <p>Name: {response.contact.firstName} {response.contact.lastName}</p>
              <p>Job Title: {response.contact.jobTitle}</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
