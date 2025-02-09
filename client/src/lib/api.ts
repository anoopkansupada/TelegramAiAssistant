export interface APIResponse<T = any> {
  data: T;
  error?: string;
}

export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const headers: Record<string, string> = {
    ...options.headers
  };

  // Handle request body based on content type
  if (options.body) {
    // If content-type is not set and we have a body, default to JSON
    if (!headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
      // Only stringify if the body isn't already a string
      if (typeof options.body !== 'string') {
        options.body = JSON.stringify(options.body);
      }
    }
  }

  const response = await fetch(endpoint, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'An error occurred' }));
    throw new Error(error.message || 'Request failed');
  }

  return response.json();
}