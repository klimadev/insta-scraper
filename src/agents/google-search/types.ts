export type InstagramResultStatus = 
  | 'not_instagram'
  | 'instagram_ok'
  | 'instagram_failed'
  | 'duplicate_instagram'
  | 'instagram_skipped_limit';

export interface InstagramPhoneDetail {
  phonePtBr: string;
  phoneE164: string;
  confidence: 'low' | 'medium' | 'high';
  sources: string[];
}

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
  instagramPhonesPtBr?: string[];
  instagramPhonesE164?: string[];
  instagramPhonesDetails?: InstagramPhoneDetail[];
  instagramPrimaryPhonePtBr?: string;
  instagramPrimaryPhoneE164?: string;
  instagramPrimaryPhoneConfidence?: 'low' | 'medium' | 'high';
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
  onlyWithPhones?: boolean;
}

export const DEFAULT_CONFIG: Required<Omit<GoogleSearchConfig, 'query'>> = {
  maxPages: 3,
  outputFile: '',
  onlyWithPhones: false
};

export interface ExtractedResult {
  title: string;
  url: string;
  description: string;
}
