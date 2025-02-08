import natural from 'natural';

// Function for sentiment analysis
export function analyzeSentiment(text: string): string {
  const analyzer = new natural.SentimentAnalyzer('English', natural.PorterStemmer, 'afinn');
  const sentimentScore = analyzer.getSentiment(text.split(' '));
  return sentimentScore > 0 ? 'positive' : sentimentScore < 0 ? 'negative' : 'neutral';
}

// Function for keyword extraction
export function extractKeywords(text: string): string[] {
  const tokenizer = new natural.WordTokenizer();
  const words = tokenizer.tokenize(text);
  const tfidf = new natural.TfIdf();
  tfidf.addDocument(words);
  const keywords: string[] = [];
  tfidf.listTerms(0).forEach(term => {
    if (term.tfidf > 1) {
      keywords.push(term.term);
    }
  });
  return keywords;
}

// Function for topic modeling (simple example)
export function modelTopics(text: string): string[] {
  // This is a placeholder for a more complex topic modeling implementation
  // For demonstration purposes, we'll just return the keywords as topics
  return extractKeywords(text);
}
