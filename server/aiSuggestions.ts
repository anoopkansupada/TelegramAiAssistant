import OpenAI from "openai";

if (!process.env.OPENAI_API_KEY) {
  throw new Error("OPENAI_API_KEY environment variable is required");
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface MessageContext {
  previousMessages: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>;
  contactInfo?: {
    name?: string;
    company?: string;
    jobTitle?: string;
  };
}

export async function generateResponseSuggestions(
  latestMessage: string,
  context: MessageContext
): Promise<string[]> {
  try {
    const systemPrompt = `You are an AI assistant helping generate professional response suggestions for a CRM platform.
    Keep responses concise, professional, and contextually appropriate.
    Consider the contact's information and conversation history when generating suggestions.`;

    const messages = [
      { role: "system", content: systemPrompt },
      ...context.previousMessages,
      { role: "user", content: `Generate 3 different professional responses to this message: "${latestMessage}"
        ${context.contactInfo ? `\nContact Info: ${JSON.stringify(context.contactInfo)}` : ''}
        \nFormat responses as a numbered list.` }
    ] as OpenAI.Chat.ChatCompletionMessageParam[];

    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages,
      temperature: 0.7,
      max_tokens: 150,
      n: 1,
    });

    const suggestions = response.choices[0].message?.content
      ?.split('\n')
      .filter(line => line.trim().match(/^\d+\./))
      .map(line => line.replace(/^\d+\.\s*/, '').trim()) || [];

    return suggestions;
  } catch (error) {
    console.error('Error generating suggestions:', error);
    return [];
  }
}