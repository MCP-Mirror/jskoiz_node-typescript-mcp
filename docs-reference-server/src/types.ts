export interface SearchResult {
  title: string;
  url: string;
  description: string;
  context?: string;
  category?: string;
}

export interface TypeScriptSearchArgs {
  query: string;
  category?: 'handbook' | 'reference' | 'release-notes' | 'declaration-files' | 'javascript';
}

export interface NodeDocsSearchArgs {
  query: string;
  version?: string;
}

export interface NoResultsResponse {
  message: string;
  suggestion: string;
}

// Match MCP SDK's response format
export interface McpToolResponse {
  _meta?: Record<string, unknown>;
  content: Array<{
    type: string;
    text: string;
  }>;
  isError?: boolean;
}
