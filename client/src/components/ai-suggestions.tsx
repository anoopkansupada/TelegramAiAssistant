import { useEffect, useState } from 'react';
import { Lightbulb, Loader2 } from 'lucide-react';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { apiRequest } from '@/lib/api';

interface AISuggestionsProps {
  message: string;
  contactInfo?: {
    name?: string;
    company?: string;
    jobTitle?: string;
  };
  previousMessages?: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>;
  onSelectSuggestion: (suggestion: string) => void;
}

interface SuggestionsResponse {
  suggestions: string[];
}

export function AISuggestions({ 
  message, 
  contactInfo, 
  previousMessages = [],
  onSelectSuggestion 
}: AISuggestionsProps) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchSuggestions() {
      setLoading(true);
      setError(null);
      try {
        const response = await apiRequest<SuggestionsResponse>('/api/suggestions', {
          method: 'POST',
          body: {
            message,
            context: {
              contactInfo,
              previousMessages,
            },
          },
        });
        setSuggestions(response.suggestions);
      } catch (err) {
        setError('Failed to load suggestions');
        console.error('Error fetching suggestions:', err);
      } finally {
        setLoading(false);
      }
    }

    if (message) {
      fetchSuggestions();
    }
  }, [message, contactInfo]);

  if (!message) return null;

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Lightbulb className="h-4 w-4 text-primary" />
          <span className="font-medium">AI Suggestions</span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="ml-2 text-sm text-muted-foreground">
              Generating suggestions...
            </span>
          </div>
        ) : error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : suggestions.length > 0 ? (
          <div className="space-y-2">
            {suggestions.map((suggestion, index) => (
              <Button
                key={index}
                variant="outline"
                className="w-full justify-start h-auto p-3 text-left whitespace-normal"
                onClick={() => onSelectSuggestion(suggestion)}
              >
                {suggestion}
              </Button>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No suggestions available
          </p>
        )}
      </CardContent>
    </Card>
  );
}