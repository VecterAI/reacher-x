import { apolloAdapter } from "./treg/apollo";
import type { ToolId } from "./catalog";
import { clayAdapter } from "./direct/clay";
import { contextAdapter } from "./direct/context";
import { crustdataAdapter } from "./treg/crustdata";
import { exaAdapter } from "./direct/exa";
import { firecrawlAdapter } from "./direct/firecrawl";
import { lushaAdapter } from "./treg/lusha";
import { tregAdapter } from "./treg/treg";
import type { SearchAdapter } from "./types";

/** One adapter per competitor (proposal 5.2). ReacherX itself runs through the Convex driver. */
export const searchAdapters = {
  exa: exaAdapter,
  apollo: apolloAdapter,
  lusha: lushaAdapter,
  treg: tregAdapter,
  crustdata: crustdataAdapter,
  clay: clayAdapter,
  context: contextAdapter,
  firecrawl: firecrawlAdapter,
} as const satisfies Record<Exclude<ToolId, "reacherx">, SearchAdapter>;
