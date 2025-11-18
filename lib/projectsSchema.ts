import { z } from "zod";

export const createProjectSchema = z.object({
  id: z
    .string()
    .min(1, "Project id is required")
    .regex(/^[a-zA-Z0-9-_]+$/, "Project id can only include letters, numbers, dashes and underscores"),
  name: z.string().min(1).optional(),
  rootUrl: z.string().url(),
  sitemapUrl: z.string().url().nullish()
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;

export const updateProjectSchema = z.object({
  name: z.string().min(1).optional(),
  rootUrl: z.string().url(),
  sitemapUrl: z.string().url().nullish()
});

export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
