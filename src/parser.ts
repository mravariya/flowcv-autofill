import * as fs from 'fs';
import * as path from 'path';

// ── Types ───────────────────────────────────────────────────

export interface PersonalDetails {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  jobTitle?: string;
  address?: string;
  city?: string;
  country?: string;
  summary?: string;
}

export interface Education {
  school?: string;
  degree?: string;
  field?: string;
  startDate?: string;
  endDate?: string;
  description?: string;
}

export interface Experience {
  company?: string;
  position?: string;
  location?: string;
  startDate?: string;
  endDate?: string;
  current?: boolean;
  description?: string;
}

export interface Skill {
  name: string;
  level?: string;
}

export interface Language {
  name: string;
  proficiency?: string;
}

export interface Project {
  name: string;
  description?: string;
  url?: string;
}

export interface Certification {
  name: string;
  issuer?: string;
  date?: string;
  url?: string;
}

export interface Link {
  label: string;
  url: string;
}

export interface ResumeData {
  personalDetails: PersonalDetails;
  education: Education[];
  experience: Experience[];
  skills: Skill[];
  languages: Language[];
  projects: Project[];
  certifications: Certification[];
  links: Link[];
}

// ── Parser ──────────────────────────────────────────────────

/**
 * Loads resume JSON from disk and returns a validated ResumeData object.
 * Strips empty strings so the automator only fills fields with actual content.
 */
export function parseResumeFile(filePath: string): ResumeData {
  const abs = path.resolve(filePath);
  if (!fs.existsSync(abs)) {
    throw new Error(`Resume file not found: ${abs}`);
  }

  const raw = fs.readFileSync(abs, 'utf-8');
  let json: unknown;

  try {
    json = JSON.parse(raw);
  } catch {
    throw new Error(`Invalid JSON in resume file: ${abs}`);
  }

  return normalise(json as Record<string, unknown>);
}

// ── Internal helpers ────────────────────────────────────────

function stripEmpty(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== '' && v !== null && v !== undefined) {
      out[k] = v;
    }
  }
  return out;
}

function hasContent(obj: Record<string, unknown>): boolean {
  return Object.values(obj).some((v) => v !== undefined && v !== '');
}

function normalise(raw: Record<string, unknown>): ResumeData {
  const personal = (raw.personalDetails ?? {}) as Record<string, unknown>;
  const education = (raw.education ?? []) as Record<string, unknown>[];
  const experience = (raw.experience ?? []) as Record<string, unknown>[];
  const skills = (raw.skills ?? []) as Record<string, unknown>[];
  const languages = (raw.languages ?? []) as Record<string, unknown>[];
  const projects = (raw.projects ?? []) as Record<string, unknown>[];
  const certifications = (raw.certifications ?? []) as Record<string, unknown>[];
  const links = (raw.links ?? []) as Record<string, unknown>[];

  return {
    personalDetails: stripEmpty(personal) as unknown as PersonalDetails,
    education: education.map((e) => stripEmpty(e)).filter(hasContent) as unknown as Education[],
    experience: experience.map((e) => stripEmpty(e)).filter(hasContent) as unknown as Experience[],
    skills: skills.map((s) => stripEmpty(s)).filter((s) => s.name) as unknown as Skill[],
    languages: languages.map((l) => stripEmpty(l)).filter((l) => l.name) as unknown as Language[],
    projects: projects.map((p) => stripEmpty(p)).filter((p) => p.name) as unknown as Project[],
    certifications: certifications.map((c) => stripEmpty(c)).filter((c) => c.name) as unknown as Certification[],
    links: links.map((l) => stripEmpty(l)).filter((l) => l.url) as unknown as Link[],
  };
}
