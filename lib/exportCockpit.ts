export type GeoIntentFocus = "local" | "all";

export const POPULAR_USER_AGENTS = [
  "Googlebot",
  "Googlebot-Image",
  "Bingbot",
  "Bingbot-Mobile",
  "Slurp",
  "DuckDuckBot",
  "Baiduspider",
  "YandexBot"
] as const;

export type PopularAgent = (typeof POPULAR_USER_AGENTS)[number];

export type ExportCockpitState = {
  semanticCore: {
    limit: string;
    lang: string;
  };
  jsonld: {
    limit: string;
    lang: string;
  };
  robots: {
    lang: string;
    rootUrl: string;
    crawlDelay: string;
    sitemapUrls: string;
    additionalAgents: string;
    agents: Record<PopularAgent, boolean>;
    forbiddenPaths: string;
  };
  geo: {
    lang: string;
    limit: string;
    intentFocus: GeoIntentFocus;
    fallbackLocation: string;
  };
};

export type ExportArtifactKey = "semantic" | "jsonld" | "robots" | "geo";

export type ExportAttributeConfig = {
  title: string;
  attributes: { label: string; value: string }[];
};

export type ExportAttributeMap = Record<ExportArtifactKey, ExportAttributeConfig>;
