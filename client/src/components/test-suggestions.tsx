import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Textarea } from './ui/textarea';
import { Button } from './ui/button';
import { AISuggestions } from './ai-suggestions';

export function TestSuggestions() {
  const [message, setMessage] = useState('');
  const [selectedSuggestion, setSelectedSuggestion] = useState<string | null>(null);

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Test AI Suggestions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">
              Enter a message to test
            </label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type a message here..."
              className="min-h-[100px]"
            />
          </div>
          
          {message && (
            <AISuggestions
              message={message}
              contactInfo={{
                name: "Test User",
                company: "Test Company",
                jobTitle: "Test Position"
              }}
              onSelectSuggestion={(suggestion) => setSelectedSuggestion(suggestion)}
            />
          )}

          {selectedSuggestion && (
            <div className="mt-4">
              <h3 className="text-sm font-medium mb-2">Selected Response:</h3>
              <div className="p-3 bg-muted rounded-md">
                {selectedSuggestion}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
