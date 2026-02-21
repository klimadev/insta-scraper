export type InstagramResultStatus = 
  | 'not_instagram'
  | 'instagram_ok'
  | 'instagram_failed'
  | 'duplicate_instagram'
  | 'instagram_skipped_limit';

export interface SearchResult {
  title: string;
  url: string;
  description: string;
  source: 'google';
  status: InstagramResultStatus;
  extractedAt: string;
  query: string;
  page: number;
  instagramUsername?: string;
  instagramName?: string;
  instagramPublicacoes?: number;
  instagramSeguidores?: number;
  instagramSeguindo?: number;
  instagramBio?: string;
  instagramLink?: string;
  instagramExtractedAt?: string;
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
