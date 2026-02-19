export interface SearchResult {
  title: string;
  url: string;
  description: string;
  source: 'google';
  status: 'pending_instagram';
  extractedAt: string;
  query: string;
  page: number;
}

export interface SearchOutput {
  query: string;
  totalPages: number;
  totalResults: number;
  extractedAt: string;
  results: SearchResult[];
}

export interface GoogleSearchConfig {
  query: string;
  maxPages?: number;
  outputFile?: string;
}

export const DEFAULT_CONFIG: Required<Omit<GoogleSearchConfig, 'query'>> = {
  maxPages: 3,
  outputFile: ''
};

export interface ExtractedResult {
  title: string;
  url: string;
  description: string;
}
