// features/search/types.ts
export interface FilterState {
  verified?: boolean;
  unverified?: boolean;
  from?: string;
  to?: string;
  mention?: string;
  list?: string;
}

// You can add more search-related types here in the future
export interface SearchQuery {
  query: string;
  filters: FilterState;
}
