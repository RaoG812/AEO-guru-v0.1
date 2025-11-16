// lib/crawler.ts
import * as cheerio from "cheerio";

export async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  return res.text();
}

export async function extractTextFromUrl(url: string) {
  const html = await fetchHtml(url);
  const $ = cheerio.load(html);
  $("script, style, noscript").remove();
  const title = $("title").first().text().trim();
  const h1 = $("h1").first().text().trim();
  const bodyText = $("body").text().replace(/\s+/g, " ").trim();
  return { title, h1, content: bodyText };
}
