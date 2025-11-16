import { promises as fs } from "fs";
import path from "path";

export type ProjectRecord = {
  id: string;
  name?: string;
  rootUrl: string;
  sitemapUrl?: string | null;
  createdAt: string;
};

const STORE_PATH = path.join(process.cwd(), "data", "projects.json");

async function ensureStoreFile() {
  await fs.mkdir(path.dirname(STORE_PATH), { recursive: true });

  try {
    await fs.access(STORE_PATH);
  } catch {
    await fs.writeFile(STORE_PATH, "[]", "utf-8");
  }
}

async function readStore(): Promise<ProjectRecord[]> {
  await ensureStoreFile();
  const file = await fs.readFile(STORE_PATH, "utf-8");
  try {
    const data = JSON.parse(file);
    if (Array.isArray(data)) {
      return data as ProjectRecord[];
    }
    return [];
  } catch {
    return [];
  }
}

async function writeStore(projects: ProjectRecord[]) {
  await fs.writeFile(STORE_PATH, JSON.stringify(projects, null, 2), "utf-8");
}

export async function listProjects(): Promise<ProjectRecord[]> {
  return readStore();
}

export type CreateProjectInput = {
  id: string;
  name?: string;
  rootUrl: string;
  sitemapUrl?: string | null;
};

function normalizeUrl(url: string) {
  const parsed = new URL(url);
  parsed.hash = "";
  return parsed.toString();
}

export async function addProject(input: CreateProjectInput): Promise<ProjectRecord> {
  const projects = await readStore();

  if (projects.some((project) => project.id === input.id)) {
    throw new Error("PROJECT_ALREADY_EXISTS");
  }

  const normalizedRootUrl = normalizeUrl(input.rootUrl);
  const normalizedSitemap = input.sitemapUrl ? normalizeUrl(input.sitemapUrl) : null;

  const record: ProjectRecord = {
    id: input.id,
    name: input.name,
    rootUrl: normalizedRootUrl,
    sitemapUrl: normalizedSitemap,
    createdAt: new Date().toISOString()
  };

  projects.push(record);
  await writeStore(projects);

  return record;
}
