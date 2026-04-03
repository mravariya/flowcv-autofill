import { chromium, Browser, BrowserContext, Page, Locator } from 'playwright';
import {
  AUTH, PERSONAL, EDUCATION, EXPERIENCE, SKILLS,
  LANGUAGES, PROJECTS, CERTIFICATIONS, LINKS, SHARED, URLS,
} from './selectors';
import {
  ResumeData, PersonalDetails, Education, Experience,
  Skill, Language, Project, Certification, Link,
} from './parser';

// ── Config ──────────────────────────────────────────────────

export interface AutomatorConfig {
  email: string;
  password: string;
  headless?: boolean;
  debug?: boolean;
  slowMo?: number;
}

// ── FlowCV Automator ───────────────────────────────────────

export class FlowCVAutomator {
  private browser!: Browser;
  private context!: BrowserContext;
  private page!: Page;
  private config: Required<AutomatorConfig>;

  constructor(config: AutomatorConfig) {
    this.config = {
      headless: false,
      debug: false,
      slowMo: 50,
      ...config,
    };
  }

  // ── Lifecycle ───────────────────────────────────────────

  async launch(): Promise<void> {
    this.browser = await chromium.launch({
      headless: this.config.headless,
      slowMo: this.config.slowMo,
    });
    this.context = await this.browser.newContext({
      viewport: { width: 1440, height: 900 },
    });
    this.page = await this.context.newPage();
    this.log('Browser launched');
  }

  async close(): Promise<void> {
    await this.context?.close();
    await this.browser?.close();
    this.log('Browser closed');
  }

  // ── Auth ────────────────────────────────────────────────

  async login(): Promise<void> {
    this.log('Navigating to login page…');
    await this.page.goto(URLS.login, { waitUntil: 'networkidle' });
    await this.debugPause('Before login');

    await this.safeFill(AUTH.emailInput, this.config.email);
    await this.safeFill(AUTH.passwordInput, this.config.password);
    await this.page.locator(AUTH.loginButton).click();

    await this.page.waitForURL('**/dashboard**', { timeout: 30_000 }).catch(() => {
      // Some accounts redirect to editor directly
      this.log('Did not land on dashboard — checking for editor…');
    });

    this.log('Logged in successfully');
    await this.debugPause('After login');
  }

  // ── Resume filling orchestrator ─────────────────────────

  async fillResume(data: ResumeData): Promise<void> {
    this.log('Starting resume fill…');

    await this.navigateToEditor();

    if (Object.keys(data.personalDetails).length > 0) {
      await this.fillPersonalDetails(data.personalDetails);
    }

    for (const edu of data.education) {
      await this.fillEducation(edu);
    }

    for (const exp of data.experience) {
      await this.fillExperience(exp);
    }

    for (const skill of data.skills) {
      await this.fillSkill(skill);
    }

    for (const lang of data.languages) {
      await this.fillLanguage(lang);
    }

    for (const project of data.projects) {
      await this.fillProject(project);
    }

    for (const cert of data.certifications) {
      await this.fillCertification(cert);
    }

    for (const link of data.links) {
      await this.fillLink(link);
    }

    this.log('Resume fill complete');
    await this.debugPause('Resume fill complete');
  }

  // ── Section fillers ─────────────────────────────────────

  private async navigateToEditor(): Promise<void> {
    const currentUrl = this.page.url();
    if (!currentUrl.includes('/editor')) {
      this.log('Navigating to editor…');
      await this.page.goto(URLS.editor, { waitUntil: 'networkidle' });
    }
    await this.page.waitForTimeout(1500);
    this.log('Editor loaded');
  }

  private async fillPersonalDetails(details: PersonalDetails): Promise<void> {
    this.log('Filling personal details…');
    await this.clickSectionIfNeeded('Personal');
    await this.debugPause('Personal details section');

    if (details.firstName) await this.safeFill(PERSONAL.firstName, details.firstName);
    if (details.lastName) await this.safeFill(PERSONAL.lastName, details.lastName);
    if (details.email) await this.safeFill(PERSONAL.email, details.email);
    if (details.phone) await this.safeFill(PERSONAL.phone, details.phone);
    if (details.jobTitle) await this.safeFill(PERSONAL.jobTitle, details.jobTitle);
    if (details.address) await this.safeFill(PERSONAL.address, details.address);
    if (details.city) await this.safeFill(PERSONAL.city, details.city);
    if (details.country) await this.safeFill(PERSONAL.country, details.country);
    if (details.summary) await this.safeFillRichText(PERSONAL.summary, details.summary);

    await this.trySave();
    this.log('Personal details filled');
  }

  private async fillEducation(edu: Education): Promise<void> {
    this.log(`Filling education: ${edu.school ?? 'entry'}…`);
    await this.clickSectionIfNeeded('Education');
    await this.tryClick(EDUCATION.addButton);
    await this.debugPause('Education entry');

    if (edu.school) await this.safeFill(EDUCATION.school, edu.school);
    if (edu.degree) await this.safeFill(EDUCATION.degree, edu.degree);
    if (edu.field) await this.safeFill(EDUCATION.field, edu.field);
    if (edu.startDate) await this.safeFill(EDUCATION.startDate, edu.startDate);
    if (edu.endDate) await this.safeFill(EDUCATION.endDate, edu.endDate);
    if (edu.description) await this.safeFillRichText(EDUCATION.description, edu.description);

    await this.trySave();
  }

  private async fillExperience(exp: Experience): Promise<void> {
    this.log(`Filling experience: ${exp.company ?? 'entry'}…`);
    await this.clickSectionIfNeeded('Experience');
    await this.tryClick(EXPERIENCE.addButton);
    await this.debugPause('Experience entry');

    if (exp.company) await this.safeFill(EXPERIENCE.company, exp.company);
    if (exp.position) await this.safeFill(EXPERIENCE.position, exp.position);
    if (exp.location) await this.safeFill(EXPERIENCE.location, exp.location);
    if (exp.startDate) await this.safeFill(EXPERIENCE.startDate, exp.startDate);
    if (exp.endDate && !exp.current) await this.safeFill(EXPERIENCE.endDate, exp.endDate);

    if (exp.current) {
      const checkbox = this.page.locator(EXPERIENCE.currentCheckbox).first();
      if (await checkbox.isVisible()) {
        const checked = await checkbox.isChecked();
        if (!checked) await checkbox.check();
      }
    }

    if (exp.description) await this.safeFillRichText(EXPERIENCE.description, exp.description);

    await this.trySave();
  }

  private async fillSkill(skill: Skill): Promise<void> {
    this.log(`Filling skill: ${skill.name}…`);
    await this.clickSectionIfNeeded('Skills');
    await this.tryClick(SKILLS.addButton);

    await this.safeFill(SKILLS.name, skill.name);
    if (skill.level) {
      await this.trySelectOrFill(SKILLS.level, skill.level);
    }

    await this.trySave();
  }

  private async fillLanguage(lang: Language): Promise<void> {
    this.log(`Filling language: ${lang.name}…`);
    await this.clickSectionIfNeeded('Languages');
    await this.tryClick(LANGUAGES.addButton);

    await this.safeFill(LANGUAGES.name, lang.name);
    if (lang.proficiency) {
      await this.trySelectOrFill(LANGUAGES.proficiency, lang.proficiency);
    }

    await this.trySave();
  }

  private async fillProject(project: Project): Promise<void> {
    this.log(`Filling project: ${project.name}…`);
    await this.clickSectionIfNeeded('Projects');
    await this.tryClick(PROJECTS.addButton);

    await this.safeFill(PROJECTS.name, project.name);
    if (project.description) await this.safeFillRichText(PROJECTS.description, project.description);
    if (project.url) await this.safeFill(PROJECTS.url, project.url);

    await this.trySave();
  }

  private async fillCertification(cert: Certification): Promise<void> {
    this.log(`Filling certification: ${cert.name}…`);
    await this.clickSectionIfNeeded('Certifications');
    await this.tryClick(CERTIFICATIONS.addButton);

    await this.safeFill(CERTIFICATIONS.name, cert.name);
    if (cert.issuer) await this.safeFill(CERTIFICATIONS.issuer, cert.issuer);
    if (cert.date) await this.safeFill(CERTIFICATIONS.date, cert.date);
    if (cert.url) await this.safeFill(CERTIFICATIONS.url, cert.url);

    await this.trySave();
  }

  private async fillLink(link: Link): Promise<void> {
    this.log(`Filling link: ${link.label || link.url}…`);
    await this.clickSectionIfNeeded('Links');
    await this.tryClick(LINKS.addButton);

    if (link.label) await this.safeFill(LINKS.label, link.label);
    await this.safeFill(LINKS.url, link.url);

    await this.trySave();
  }

  // ── Low-level helpers ───────────────────────────────────

  /**
   * Tries multiple comma-separated selectors until one is visible, then fills it.
   */
  private async safeFill(selectorGroup: string, value: string): Promise<void> {
    const locator = await this.resolveFirst(selectorGroup);
    if (!locator) {
      this.log(`  ⚠ No visible element for: ${selectorGroup}`);
      return;
    }
    await locator.scrollIntoViewIfNeeded();
    await locator.click();
    await locator.fill(value);
  }

  /**
   * For contenteditable / rich-text fields: click then type character-by-character.
   */
  private async safeFillRichText(selectorGroup: string, value: string): Promise<void> {
    const locator = await this.resolveFirst(selectorGroup);
    if (!locator) {
      this.log(`  ⚠ No visible rich-text element for: ${selectorGroup}`);
      return;
    }
    await locator.scrollIntoViewIfNeeded();
    await locator.click();
    // Clear existing content
    await this.page.keyboard.press('Meta+A');
    await this.page.keyboard.press('Backspace');
    await locator.type(value, { delay: 10 });
  }

  /**
   * Tries to use a <select> dropdown; falls back to text input.
   */
  private async trySelectOrFill(selectorGroup: string, value: string): Promise<void> {
    const locator = await this.resolveFirst(selectorGroup);
    if (!locator) return;

    const tag = await locator.evaluate((el) => el.tagName.toLowerCase());
    if (tag === 'select') {
      await locator.selectOption({ label: value }).catch(() =>
        locator.selectOption({ value }).catch(() =>
          this.log(`  ⚠ Could not select "${value}" from dropdown`)
        )
      );
    } else {
      await locator.fill(value);
    }
  }

  /**
   * Given a comma-separated selector string, returns the first visible locator.
   */
  private async resolveFirst(selectorGroup: string): Promise<Locator | null> {
    const selectors = selectorGroup.split(',').map((s) => s.trim());
    for (const sel of selectors) {
      const loc = this.page.locator(sel).first();
      try {
        if (await loc.isVisible({ timeout: 2000 })) {
          return loc;
        }
      } catch {
        // not visible, try next
      }
    }
    return null;
  }

  private async tryClick(selectorGroup: string): Promise<void> {
    const locator = await this.resolveFirst(selectorGroup);
    if (locator) {
      await locator.click();
      await this.page.waitForTimeout(500);
    }
  }

  private async trySave(): Promise<void> {
    const saveBtn = await this.resolveFirst(SHARED.saveButton);
    if (saveBtn) {
      await saveBtn.click();
      await this.page.waitForTimeout(1000);
    }
  }

  private async clickSectionIfNeeded(sectionName: string): Promise<void> {
    try {
      const sectionLink = this.page.locator(`text="${sectionName}"`).first();
      if (await sectionLink.isVisible({ timeout: 2000 })) {
        await sectionLink.click();
        await this.page.waitForTimeout(800);
      }
    } catch {
      // Section may already be active
    }
  }

  // ── Debug & logging ─────────────────────────────────────

  private async debugPause(label: string): Promise<void> {
    if (!this.config.debug) return;
    this.log(`🔍 DEBUG PAUSE: ${label}`);
    await this.page.pause();
  }

  private log(message: string): void {
    const ts = new Date().toLocaleTimeString();
    console.log(`[${ts}] ${message}`);
  }
}
