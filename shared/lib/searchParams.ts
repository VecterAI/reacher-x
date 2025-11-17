import {
  createSearchParamsCache,
  parseAsString,
  parseAsBoolean,
} from "nuqs/server";

export const searchParsers = {
  q: parseAsString.withDefault(""),
  exact: parseAsBoolean.withDefault(false),
  keywordId: parseAsString,
};

export const searchParamsCache = createSearchParamsCache(searchParsers);
