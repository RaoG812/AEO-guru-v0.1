export type TextChunk = {
  text: string;
  startParagraph: number;
  endParagraph: number;
};

const DEFAULT_MAX_CHARS = 1200;
const DEFAULT_MIN_CHARS = 320;

export function chunkText(text: string, options?: { maxChars?: number; minChars?: number }): TextChunk[] {
  const maxChars = options?.maxChars ?? DEFAULT_MAX_CHARS;
  const minChars = options?.minChars ?? DEFAULT_MIN_CHARS;
  const paragraphs = text
    .split(/\n{2,}/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  const chunks: TextChunk[] = [];
  let buffer = "";
  let startParagraph = 0;

  paragraphs.forEach((paragraph, index) => {
    const candidate = buffer ? `${buffer}\n\n${paragraph}` : paragraph;
    if (candidate.length > maxChars && buffer.length >= minChars) {
      chunks.push({ text: buffer.trim(), startParagraph, endParagraph: index - 1 });
      buffer = paragraph;
      startParagraph = index;
    } else if (candidate.length > maxChars) {
      const forced = paragraph.slice(0, maxChars);
      chunks.push({ text: forced.trim(), startParagraph: index, endParagraph: index });
      buffer = paragraph.slice(maxChars);
      startParagraph = index;
    } else {
      buffer = candidate;
      if (buffer.length === paragraph.length) {
        startParagraph = index;
      }
    }
  });

  if (buffer.trim()) {
    chunks.push({ text: buffer.trim(), startParagraph, endParagraph: paragraphs.length - 1 });
  }

  return chunks;
}
