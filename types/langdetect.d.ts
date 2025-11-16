declare module "langdetect" {
  export interface DetectionResult {
    lang: string;
    prob: number;
  }

  export function detect(text: string): DetectionResult[];
  export function detectOne(text: string): string;
}
