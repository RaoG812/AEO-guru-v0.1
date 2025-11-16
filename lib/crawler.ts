import { parse, type HTMLElement } from "node-html-parser";
import { XMLParser } from "fast-xml-parser";

import { detectLanguage } from "./language";

export type ExtractedPage = {
  url: string;
  title: string;
  h1: string;
  content: string;
  lang: string;
};

const FORBIDDEN_TAGS = [
  "script",
  "style",
  "noscript",
  "svg",
  "iframe",
  "canvas",
  "form"
];

function sanitizeDom(dom: HTMLElement) {
  dom.querySelectorAll(FORBIDDEN_TAGS.join(",")).forEach((node) => node.remove());
  dom.querySelectorAll("header,footer,nav,aside").forEach((node) => node.remove());
}

function buildContentFromDom(dom: HTMLElement) {
  const main = dom.querySelector("main") ?? dom.querySelector("article") ?? dom;
  const blocks = main
    .querySelectorAll("h1,h2,h3,h4,h5,h6,p,li")
    .map((node) => node.text.trim())
    .filter(Boolean);
  return blocks.join("\n\n");
}

function extractLinks(dom: HTMLElement, baseUrl: string): string[] {
  const base = new URL(baseUrl);
  const origin = base.origin;
  const seen = new Set<string>();
  dom.querySelectorAll("a[href]").forEach((anchor) => {
    const href = anchor.getAttribute("href");
    if (!href) return;
    try {
      const resolved = new URL(href, base);
      if (!resolved.href.startsWith(origin)) return;
      resolved.hash = "";
      const finalHref = resolved.toString();
      if (!seen.has(finalHref)) {
        seen.add(finalHref);
      }
    } catch {
      // ignore invalid URLs
    }
  });
  return Array.from(seen);
}

function extractPageDetails(html: string, url: string) {
  const dom = parse(html);
  sanitizeDom(dom);
  const title = dom.querySelector("title")?.text.trim() ?? "";
  const h1 = dom.querySelector("h1")?.text.trim() ?? "";
  const content = buildContentFromDom(dom)
    .split(/\n+/)
    .map((segment) => segment.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n\n");
  const lang = detectLanguage(content);
  const links = extractLinks(dom, url);
  return { title, h1, content, lang, links };
}

export async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  return res.text();
}

export async function extractTextFromUrl(url: string): Promise<ExtractedPage> {
  const html = await fetchHtml(url);
  const details = extractPageDetails(html, url);
  return { url, title: details.title, h1: details.h1, content: details.content, lang: details.lang };
}

type CrawlOptions = {
  limit?: number;
  delayMs?: number;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function crawlSite(rootUrl: string, options: CrawlOptions = {}): Promise<ExtractedPage[]> {
  const limit = options.limit ?? 20;
  const delayMs = options.delayMs ?? 350;
  const queue: string[] = [rootUrl];
  const visited = new Set<string>();
  const pages: ExtractedPage[] = [];
  const origin = new URL(rootUrl).origin;

  while (queue.length && pages.length < limit) {
    const current = queue.shift()!;
    if (visited.has(current)) continue;
    visited.add(current);
    try {
      const html = await fetchHtml(current);
      const { title, h1, content, lang, links } = extractPageDetails(html, current);
      if (content.trim().length > 0) {
        pages.push({ url: current, title, h1, content, lang });
      }
      links
        .filter((link) => link.startsWith(origin))
        .forEach((link) => {
          if (!visited.has(link) && queue.length + pages.length < limit * 2) {
            queue.push(link);
          }
        });
      if (delayMs) {
        await sleep(delayMs);
      }
    } catch (error) {
      console.warn("crawl error", current, error);
    }
  }

  return pages;
}

export async function collectSitemapUrls(sitemapUrl: string, limit = 50): Promise<string[]> {
  try {
    const res = await fetch(sitemapUrl);
    if (!res.ok) return [];
    const xml = await res.text();
    const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "" });
    const parsed = parser.parse(xml);
    const urls: string[] = [];

    function walk(node: any) {
      if (!node) return;
      if (typeof node === "object" && node.loc && typeof node.loc === "string") {
        urls.push(node.loc.trim());
      }
      if (Array.isArray(node)) {
        node.forEach(walk);
        return;
      }
      if (typeof node === "object") {
        Object.values(node).forEach(walk);
      }
    }

    walk(parsed.urlset ?? parsed.sitemapindex ?? parsed);
    return Array.from(new Set(urls)).slice(0, limit);
  } catch (error) {
    console.warn("Failed to parse sitemap", error);
    return [];
  }
}
