import { z } from "zod";

export const jobDescriptionSchema = z.object({
  position_id: z.string().uuid("Choose a position."),
  job_description: z.string().trim().min(1, "Job description is required."),
  tags: z.array(z.string().trim().min(1)),
});

export function parseJobTags(value: string): string[] {
  return [...new Map(value.split(/[,،\n]/).map(tag => tag.trim()).filter(Boolean).map(tag => [tag.toLowerCase(), tag])).values()];
}