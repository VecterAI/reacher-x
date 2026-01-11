/**
 * Open Graph type definitions
 */
export type OpenGraphData = {
  url: string;
  title?: string | null;
  description?: string | null;
  image?: string | null;
  siteName?: string | null;
  type?: string | null;
  locale?: string | null;
  favicon?: string | null;
};

export interface FetchOpenGraphOptions {
  timeout?: number;
  retries?: number;
  retryDelay?: number;
  userAgent?: string;
  cache?: boolean;
}

export interface FetchOpenGraphResult {
  data: OpenGraphData | null;
  error?: string;
  fromCache?: boolean;
}
