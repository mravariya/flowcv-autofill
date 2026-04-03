/**
 * FlowCV UI selectors — centralised so a single UI change
 * only needs one update here.
 *
 * FlowCV is a React SPA that renders contenteditable divs
 * for rich-text fields and standard <input>/<select> elsewhere.
 */

// ── Auth ────────────────────────────────────────────────────
export const AUTH = {
  emailInput: 'input[type="email"]',
  passwordInput: 'input[type="password"]',
  loginButton: 'button[type="submit"]',
  googleLogin: 'button:has-text("Google")',
} as const;

// ── Navigation / Sidebar ────────────────────────────────────
export const NAV = {
  sidebarItem: (label: string) => `nav >> text="${label}"`,
  addSectionButton: 'button:has-text("Add section")',
  sectionMenu: (label: string) => `button:has-text("${label}")`,
} as const;

// ── Personal Details ────────────────────────────────────────
export const PERSONAL = {
  firstName: 'input[name="firstName"], input[placeholder*="First"]',
  lastName: 'input[name="lastName"], input[placeholder*="Last"]',
  email: 'input[name="email"], input[type="email"]',
  phone: 'input[name="phone"], input[type="tel"]',
  jobTitle: 'input[name="title"], input[placeholder*="Job"], input[placeholder*="Title"]',
  address: 'input[name="address"], input[placeholder*="Address"]',
  city: 'input[name="city"], input[placeholder*="City"]',
  country: 'input[name="country"], input[placeholder*="Country"]',
  summary: '[contenteditable="true"], textarea[name="summary"]',
} as const;

// ── Education ───────────────────────────────────────────────
export const EDUCATION = {
  addButton: 'button:has-text("Add education"), button:has-text("Add")',
  school: 'input[name="school"], input[placeholder*="School"], input[placeholder*="University"]',
  degree: 'input[name="degree"], input[placeholder*="Degree"]',
  field: 'input[name="field"], input[placeholder*="Field"], input[placeholder*="Study"]',
  startDate: 'input[name="startDate"], input[placeholder*="Start"]',
  endDate: 'input[name="endDate"], input[placeholder*="End"]',
  description: '[contenteditable="true"], textarea[name="description"]',
} as const;

// ── Experience ──────────────────────────────────────────────
export const EXPERIENCE = {
  addButton: 'button:has-text("Add experience"), button:has-text("Add")',
  company: 'input[name="company"], input[placeholder*="Company"]',
  position: 'input[name="position"], input[placeholder*="Position"], input[placeholder*="Title"]',
  location: 'input[name="location"], input[placeholder*="Location"]',
  startDate: 'input[name="startDate"], input[placeholder*="Start"]',
  endDate: 'input[name="endDate"], input[placeholder*="End"]',
  currentCheckbox: 'input[type="checkbox"]',
  description: '[contenteditable="true"], textarea[name="description"]',
} as const;

// ── Skills ──────────────────────────────────────────────────
export const SKILLS = {
  addButton: 'button:has-text("Add skill"), button:has-text("Add")',
  name: 'input[name="skill"], input[placeholder*="Skill"]',
  level: 'select, input[placeholder*="Level"]',
} as const;

// ── Languages ───────────────────────────────────────────────
export const LANGUAGES = {
  addButton: 'button:has-text("Add language"), button:has-text("Add")',
  name: 'input[name="language"], input[placeholder*="Language"]',
  proficiency: 'select, input[placeholder*="Proficiency"]',
} as const;

// ── Projects ────────────────────────────────────────────────
export const PROJECTS = {
  addButton: 'button:has-text("Add project"), button:has-text("Add")',
  name: 'input[name="name"], input[placeholder*="Project"]',
  description: '[contenteditable="true"], textarea[name="description"]',
  url: 'input[name="url"], input[placeholder*="URL"], input[type="url"]',
} as const;

// ── Certifications ──────────────────────────────────────────
export const CERTIFICATIONS = {
  addButton: 'button:has-text("Add certification"), button:has-text("Add")',
  name: 'input[name="name"], input[placeholder*="Certification"]',
  issuer: 'input[name="issuer"], input[placeholder*="Issuer"]',
  date: 'input[name="date"], input[placeholder*="Date"]',
  url: 'input[name="url"], input[placeholder*="URL"], input[type="url"]',
} as const;

// ── Links / Websites ────────────────────────────────────────
export const LINKS = {
  addButton: 'button:has-text("Add link"), button:has-text("Add website"), button:has-text("Add")',
  label: 'input[name="label"], input[placeholder*="Label"]',
  url: 'input[name="url"], input[placeholder*="URL"], input[type="url"]',
} as const;

// ── Shared / Generic ────────────────────────────────────────
export const SHARED = {
  saveButton: 'button:has-text("Save"), button[type="submit"]',
  deleteButton: 'button:has-text("Delete"), button:has-text("Remove")',
  cancelButton: 'button:has-text("Cancel")',
  modal: '[role="dialog"], .modal',
  toast: '[role="alert"], .toast',
  loader: '.spinner, [class*="loading"], [class*="loader"]',
} as const;

export const URLS = {
  base: 'https://app.flowcv.com',
  login: 'https://app.flowcv.com/login',
  dashboard: 'https://app.flowcv.com/dashboard',
  editor: 'https://app.flowcv.com/editor',
} as const;
