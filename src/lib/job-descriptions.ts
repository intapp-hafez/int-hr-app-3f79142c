import { z } from "zod";

/** Splits a comma / newline separated string into unique trimmed tags */
export function parseJobTags(value: string): string[] {
  return [
    ...new Map(
      value
        .split(/[,،\n]/)
        .map((tag) => tag.trim())
        .filter(Boolean)
        .map((tag) => [tag.toLowerCase(), tag])
    ).values(),
  ];
}

/** Splits newline-separated bullet items into a string array */
export function parseBulletList(value: string): string[] {
  return value
    .split(/\n/)
    .map((line) => line.replace(/^[-→•*]\s*/, "").trim())
    .filter(Boolean);
}

/** Joins a string array into newline-separated display text */
export function joinBulletList(items: string[]): string {
  return items.join("\n");
}

export const JOB_CATEGORIES = ["Non-managerial", "Managerial"] as const;
export const POSITION_TYPES = ["Full-time", "Part-time", "Contract"] as const;
export const LOCATION_TYPES = ["On-site", "Remote", "Hybrid"] as const;

export type JobCategory = (typeof JOB_CATEGORIES)[number];
export type PositionType = (typeof POSITION_TYPES)[number];
export type LocationType = (typeof LOCATION_TYPES)[number];

/**
 * Full structured job description schema matching the company JD template.
 * Covers Sections 1–9 from the official Integrated Technics JD format.
 */
export const jobDescriptionSchema = z.object({
  position_id: z.string().uuid("Choose a position."),

  // § 1 Job Identification
  job_code:      z.string().trim().default(""),
  job_category:  z.enum(JOB_CATEGORIES).default("Non-managerial"),
  position_type: z.enum(POSITION_TYPES).default("Full-time"),
  location_type: z.enum(LOCATION_TYPES).default("On-site"),
  job_grade:     z.string().trim().default(""),

  // § 2 Job Summary
  job_summary: z.string().trim().min(1, "Job summary is required."),

  // § 3 Responsibilities
  responsibilities: z.array(z.string().trim().min(1)).min(1, "Add at least one responsibility."),

  // § 4 Qualifications & Competencies
  qualifications:          z.string().trim().default(""),
  technical_competencies:  z.array(z.string().trim().min(1)).default([]),
  behavioral_competencies: z.array(z.string().trim().min(1)).default([]),

  // § 6 Relationships
  internal_relations: z.string().trim().default(""),
  external_relations: z.string().trim().default(""),

  // § 7 Authority
  authority: z.array(z.string().trim().min(1)).default([]),

  // § 8 Career Path
  career_path: z.array(z.string().trim().min(1)).default([]),

  // § 9 Document Control
  doc_version: z.string().trim().default("v1.0"),
  reviewed_by: z.string().trim().default(""),
  approved_by: z.string().trim().default(""),

  // Search tags
  tags: z.array(z.string().trim().min(1)).default([]),
});

export type JobDescriptionFormValues = z.infer<typeof jobDescriptionSchema>;

/** Shape returned from the DB for read/display */
export type SavedJobDescription = JobDescriptionFormValues & {
  id: string;
  created_at: string;
  updated_at: string;
};

/** DB columns to SELECT when fetching a job description */
export const JD_SELECT_COLUMNS = [
  "id", "position_id",
  "job_code", "job_category", "position_type", "location_type", "job_grade",
  "job_summary", "responsibilities",
  "qualifications", "technical_competencies", "behavioral_competencies",
  "internal_relations", "external_relations",
  "authority", "career_path",
  "doc_version", "reviewed_by", "approved_by",
  "tags", "created_at", "updated_at",
].join(",");
