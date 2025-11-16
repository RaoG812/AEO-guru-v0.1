import { franc } from "franc-min";

const ISO3_TO_2: Record<string, string> = {
  eng: "en",
  spa: "es",
  fra: "fr",
  deu: "de",
  por: "pt",
  ita: "it",
  nld: "nl",
  jpn: "ja",
  kor: "ko",
  zho: "zh",
  rus: "ru"
};

export function detectLanguage(text: string, fallback = "en"): string {
  if (!text || text.trim().length < 20) return fallback;
  const iso3 = franc(text, { minLength: 20 });
  if (!iso3 || iso3 === "und") {
    return fallback;
  }
  return ISO3_TO_2[iso3] ?? fallback;
}
