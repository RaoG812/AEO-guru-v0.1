// lib/crawler.ts
import { parse } from "node-html-parser";

export async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  return res.text();
}

export async function extractTextFromUrl(url: string) {
  const html = await fetchHtml(url);
  const dom = parse(html);
  dom.querySelectorAll("script, style, noscript").forEach((node) => node.remove());
  const title = dom.querySelector("title")?.text.trim() ?? "";
  const h1 = dom.querySelector("h1")?.text.trim() ?? "";
  const bodyText = dom.text.replace(/\s+/g, " ").trim();
  return { title, h1, content: bodyText };
}
