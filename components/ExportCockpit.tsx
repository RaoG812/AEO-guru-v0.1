"use client";

import {
  memo,
  useCallback,
  useState,
  type ChangeEvent,
  type Dispatch,
  type KeyboardEvent as ReactKeyboardEvent,
  type SetStateAction
} from "react";

import {
  POPULAR_USER_AGENTS,
  type ExportArtifactKey,
  type ExportAttributeMap,
  type ExportCockpitState,
  type GeoIntentFocus
} from "@/lib/exportCockpit";

type ExportCockpitProps = {
  state: ExportCockpitState;
  onStateChange: Dispatch<SetStateAction<ExportCockpitState>>;
  clusterLang?: string | null;
  rootUrlPlaceholder?: string;
  sitemapPlaceholder?: string | null;
  exportAttributes: ExportAttributeMap;
};

const ExportCockpitComponent = ({
  state,
  onStateChange,
  clusterLang,
  rootUrlPlaceholder,
  sitemapPlaceholder,
  exportAttributes
}: ExportCockpitProps) => {
  const [activeCard, setActiveCard] = useState<ExportArtifactKey | null>(null);

  const renderCockpitSummary = useCallback(
    (key: ExportArtifactKey, limit = 2) => {
      const config = exportAttributes[key];
      if (!config) return null;
      return (
        <dl className="cockpit-summary">
          {config.attributes.slice(0, limit).map((item) => (
            <div key={`${key}-${item.label}`} className="cockpit-summary-row">
              <dt>{item.label}</dt>
              <dd>{item.value}</dd>
            </div>
          ))}
        </dl>
      );
    },
    [exportAttributes]
  );

  const toggleCockpitCard = useCallback((key: ExportArtifactKey) => {
    setActiveCard((prev) => (prev === key ? null : key));
  }, []);

  const handleCockpitKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>, key: ExportArtifactKey) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        toggleCockpitCard(key);
      }
    },
    [toggleCockpitCard]
  );

  const handleIntentFocusChange = useCallback(
    (event: ChangeEvent<HTMLSelectElement>) => {
      const value = event.target.value as GeoIntentFocus;
      onStateChange((prev) => ({
        ...prev,
        geo: { ...prev.geo, intentFocus: value }
      }));
    },
    [onStateChange]
  );

  const defaultLang = clusterLang ?? "en";

  return (
    <section className="export-cockpit" aria-label="Export control cockpit">
      <div className="cockpit-header">
        <div>
          <p className="eyebrow">Export cockpit</p>
          <h3>Precisely configure each artifact</h3>
        </div>
        <p className="muted">
          Override language, scope, crawler rules, or geo playbooks before downloading YAML, JSON-LD, robots.txt, or
          GEO improvements.
        </p>
      </div>
      <div className="export-cockpit-grid">
        <section
          className="export-cockpit-card"
          aria-label="Semantic core options"
          data-active={activeCard === "semantic" ? "true" : undefined}
        >
          <div
            className="cockpit-card-toggle"
            role="button"
            tabIndex={0}
            aria-expanded={activeCard === "semantic"}
            aria-controls="cockpit-semantic-panel"
            onClick={() => toggleCockpitCard("semantic")}
            onKeyDown={(event) => handleCockpitKeyDown(event, "semantic")}
          >
            <div>
              <h4>Semantic core YAML</h4>
              <p className="muted cockpit-helper">Limit how many annotated clusters are exported.</p>
            </div>
            {renderCockpitSummary("semantic")}
          </div>
          <div id="cockpit-semantic-panel" className="cockpit-card-body" aria-hidden={activeCard !== "semantic"}>
            <label className="field-label">
              Language override
              <input
                className="text-input"
                placeholder={defaultLang}
                value={state.semanticCore.lang}
                onChange={(e) =>
                  onStateChange((prev) => ({
                    ...prev,
                    semanticCore: { ...prev.semanticCore, lang: e.target.value }
                  }))
                }
              />
            </label>
            <label className="field-label">
              Cluster limit (1-25)
              <input
                className="text-input"
                type="number"
                min={1}
                max={25}
                value={state.semanticCore.limit}
                onChange={(e) =>
                  onStateChange((prev) => ({
                    ...prev,
                    semanticCore: { ...prev.semanticCore, limit: e.target.value }
                  }))
                }
              />
            </label>
          </div>
        </section>
        <section
          className="export-cockpit-card"
          aria-label="JSON-LD options"
          data-active={activeCard === "jsonld" ? "true" : undefined}
        >
          <div
            className="cockpit-card-toggle"
            role="button"
            tabIndex={0}
            aria-expanded={activeCard === "jsonld"}
            aria-controls="cockpit-jsonld-panel"
            onClick={() => toggleCockpitCard("jsonld")}
            onKeyDown={(event) => handleCockpitKeyDown(event, "jsonld")}
          >
            <div>
              <h4>JSON-LD bundle</h4>
              <p className="muted cockpit-helper">Control how many representative pages are expanded into schema.</p>
            </div>
            {renderCockpitSummary("jsonld")}
          </div>
          <div id="cockpit-jsonld-panel" className="cockpit-card-body" aria-hidden={activeCard !== "jsonld"}>
            <label className="field-label">
              Language override
              <input
                className="text-input"
                placeholder={defaultLang}
                value={state.jsonld.lang}
                onChange={(e) =>
                  onStateChange((prev) => ({
                    ...prev,
                    jsonld: { ...prev.jsonld, lang: e.target.value }
                  }))
                }
              />
            </label>
            <label className="field-label">
              Representative page limit (1-10)
              <input
                className="text-input"
                type="number"
                min={1}
                max={10}
                value={state.jsonld.limit}
                onChange={(e) =>
                  onStateChange((prev) => ({
                    ...prev,
                    jsonld: { ...prev.jsonld, limit: e.target.value }
                  }))
                }
              />
            </label>
          </div>
        </section>
        <section className="export-cockpit-card" aria-label="GEO options" data-active={activeCard === "geo" ? "true" : undefined}>
          <div
            className="cockpit-card-toggle"
            role="button"
            tabIndex={0}
            aria-expanded={activeCard === "geo"}
            aria-controls="cockpit-geo-panel"
            onClick={() => toggleCockpitCard("geo")}
            onKeyDown={(event) => handleCockpitKeyDown(event, "geo")}
          >
            <div>
              <h4>GEO improvements</h4>
              <p className="muted cockpit-helper">Shape the blueprint for static, cite-ready geo landing pages.</p>
            </div>
            {renderCockpitSummary("geo")}
          </div>
          <div id="cockpit-geo-panel" className="cockpit-card-body" aria-hidden={activeCard !== "geo"}>
            <label className="field-label">
              Language override
              <input
                className="text-input"
                placeholder={defaultLang}
                value={state.geo.lang}
                onChange={(e) =>
                  onStateChange((prev) => ({
                    ...prev,
                    geo: { ...prev.geo, lang: e.target.value }
                  }))
                }
              />
            </label>
            <label className="field-label">
              Location limit (1-12)
              <input
                className="text-input"
                type="number"
                min={1}
                max={12}
                value={state.geo.limit}
                onChange={(e) =>
                  onStateChange((prev) => ({
                    ...prev,
                    geo: { ...prev.geo, limit: e.target.value }
                  }))
                }
              />
            </label>
            <label className="field-label">
              Intent focus
              <select className="select-input" value={state.geo.intentFocus} onChange={handleIntentFocusChange}>
                <option value="local">Local-first</option>
                <option value="all">All intents</option>
              </select>
            </label>
            <label className="field-label">
              Fallback location
              <input
                className="text-input"
                placeholder="Local market"
                value={state.geo.fallbackLocation}
                onChange={(e) =>
                  onStateChange((prev) => ({
                    ...prev,
                    geo: { ...prev.geo, fallbackLocation: e.target.value }
                  }))
                }
              />
            </label>
          </div>
        </section>
        <section
          className="export-cockpit-card"
          aria-label="robots.txt options"
          data-active={activeCard === "robots" ? "true" : undefined}
        >
          <div
            className="cockpit-card-toggle"
            role="button"
            tabIndex={0}
            aria-expanded={activeCard === "robots"}
            aria-controls="cockpit-robots-panel"
            onClick={() => toggleCockpitCard("robots")}
            onKeyDown={(event) => handleCockpitKeyDown(event, "robots")}
          >
            <div>
              <h4>robots.txt</h4>
              <p className="muted cockpit-helper">
                Target popular crawlers with bespoke rules and include sitemaps before shipping.
              </p>
            </div>
            {renderCockpitSummary("robots", 3)}
          </div>
          <div id="cockpit-robots-panel" className="cockpit-card-body" aria-hidden={activeCard !== "robots"}>
            <label className="field-label">
              Root URL
              <input
                className="text-input"
                value={state.robots.rootUrl}
                placeholder={rootUrlPlaceholder ?? "https://example.com"}
                onChange={(e) =>
                  onStateChange((prev) => ({
                    ...prev,
                    robots: { ...prev.robots, rootUrl: e.target.value }
                  }))
                }
              />
            </label>
            <label className="field-label">
              Language preference
              <input
                className="text-input"
                placeholder={defaultLang}
                value={state.robots.lang}
                onChange={(e) =>
                  onStateChange((prev) => ({
                    ...prev,
                    robots: { ...prev.robots, lang: e.target.value }
                  }))
                }
              />
            </label>
            <label className="field-label">
              Crawl-delay seconds (1-60)
              <input
                className="text-input"
                type="number"
                min={1}
                max={60}
                value={state.robots.crawlDelay}
                onChange={(e) =>
                  onStateChange((prev) => ({
                    ...prev,
                    robots: { ...prev.robots, crawlDelay: e.target.value }
                  }))
                }
              />
            </label>
            <label className="field-label">
              Sitemap URLs (one per line)
              <textarea
                className="text-area"
                rows={3}
                placeholder={sitemapPlaceholder ?? "https://example.com/sitemap.xml"}
                value={state.robots.sitemapUrls}
                onChange={(e) =>
                  onStateChange((prev) => ({
                    ...prev,
                    robots: { ...prev.robots, sitemapUrls: e.target.value }
                  }))
                }
              />
            </label>
            <div className="field-label">
              <span>Popular user-agents</span>
              <div className="checkbox-grid">
                {POPULAR_USER_AGENTS.map((agent) => (
                  <label key={agent} className="cockpit-checkbox">
                    <input
                      type="checkbox"
                      checked={state.robots.agents[agent]}
                      onChange={() =>
                        onStateChange((prev) => ({
                          ...prev,
                          robots: {
                            ...prev.robots,
                            agents: {
                              ...prev.robots.agents,
                              [agent]: !prev.robots.agents[agent]
                            }
                          }
                        }))
                      }
                    />
                    <span>{agent}</span>
                  </label>
                ))}
              </div>
            </div>
            <label className="field-label">
              Additional user-agents (comma or newline separated)
              <textarea
                className="text-area"
                rows={2}
                value={state.robots.additionalAgents}
                onChange={(e) =>
                  onStateChange((prev) => ({
                    ...prev,
                    robots: { ...prev.robots, additionalAgents: e.target.value }
                  }))
                }
              />
            </label>
            <label className="field-label">
              Forbidden paths (one per line)
              <textarea
                className="text-area"
                rows={3}
                placeholder="/private"
                value={state.robots.forbiddenPaths}
                onChange={(e) =>
                  onStateChange((prev) => ({
                    ...prev,
                    robots: { ...prev.robots, forbiddenPaths: e.target.value }
                  }))
                }
              />
            </label>
          </div>
        </section>
      </div>
    </section>
  );
};

export const ExportCockpit = memo(ExportCockpitComponent);
