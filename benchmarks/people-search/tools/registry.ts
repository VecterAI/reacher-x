import { apolloAdapter } from "./apollo";
import type { ToolId } from "./catalog";
import { clayAdapter } from "./clay";
import { contextAdapter } from "./context";
import { crustdataAdapter } from "./crustdata";
import { exaAdapter } from "./exa";
import { firecrawlAdapter } from "./firecrawl";
import { lushaAdapter } from "./lusha";
import { tregAdapter } from "./treg";
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
