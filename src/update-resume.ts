import { chromium, Page, Locator } from 'playwright';
import * as dotenv from 'dotenv';
dotenv.config();

const EMAIL = process.env.FLOWCV_EMAIL!;
const PASSWORD = process.env.FLOWCV_PASSWORD!;

const NEW_SUMMARY = `EdTech professional with 4+ years of experience designing scalable learning experiences, developing curriculum, and training diverse learners across K-12, higher education, and developer communities. Proven ability to translate subject-matter expertise into structured, skill-aligned course content delivered through asynchronous and blended formats. Experienced in leveraging GenAI tools for content scaffolding, instructional design workflows, and assessment creation. Strong cross-functional collaborator with a track record of managing vendor partnerships, production logistics, and data-driven program optimization across global teams.`;

interface ExpUpdate {
  companyMatch: string;
  newBullets: string;
}

const EXPERIENCE_UPDATES: ExpUpdate[] = [
  {
    companyMatch: 'Playhouse Media',
    newBullets:
      `Analyzed user behavior data to identify learning drop-offs and churn patterns, translating insights into actionable product and content recommendations\n` +
      `Built dashboards and reports (Grafana, MongoDB, Python, R) to measure engagement metrics, supporting data-driven decisions on content optimization\n` +
      `Collaborated cross-functionally with marketing, product, engineering, and support teams to align deliverables and unblock production workflows\n` +
      `Reviewed production output and contributed to quality assurance through GitHub code reviews and iterative feedback cycles`,
  },
  {
    companyMatch: 'Thakur School',
    newBullets:
      `Designed and delivered modular, skill-aligned curriculum for Web Development, Robotics, IoT, AI, and Machine Learning across grades 7 through A-Level\n` +
      `Translated complex technical subjects into structured, engaging learning experiences for 200+ students using backward design principles\n` +
      `Developed assessment blueprints including formative quizzes, project-based evaluations, and capstone rubrics aligned to Cambridge International standards\n` +
      `Led hands-on workshops and training sessions on cybersecurity, AI for Teachers, and public speaking for students and faculty\n` +
      `Integrated educational technology tools — coding platforms, LMS, and AR/VR labs — to enhance learning outcomes and accessibility\n` +
      `Organized extracurricular STEM activities (robotics clubs, coding camps) and coached students to national/international competition successes\n` +
      `Collaborated with faculty to embed technology into teaching practices, measurably improving student engagement and academic performance`,
  },
  {
    companyMatch: 'Devfolio',
    newBullets:
      `Led end-to-end production of developer learning events (hackathons), managing vendor sourcing, logistics, budgets, and resource allocation\n` +
      `Partnered with brand teams (Google, Sahamati, ETHIndia) to design and deliver exceptional developer experiences focused on skill-building and collaboration\n` +
      `Created replicable event frameworks and templates that standardized quality across multiple vendor teams and scaled production efficiency\n` +
      `Ensured design fidelity and consistent quality standards under tight deadlines through detailed QA and stakeholder feedback loops`,
  },
];

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function screenshot(page: Page, name: string) {
  await page.screenshot({ path: `data/screenshots/${name}.png`, fullPage: false });
  console.log(`  📸 ${name}`);
}

async function closePanelIfOpen(page: Page) {
  const doneBtn = page.locator('button:has-text("Done")');
  if (await doneBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
    await doneBtn.click();
    await sleep(800);
  }
}

async function main() {
  console.log('=== FlowCV Resume Updater v2 ===\n');
  const browser = await chromium.launch({ headless: false, slowMo: 60 });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  try {
    // ── LOGIN ────────────────────────────────────────
    console.log('[1/3] Logging in...');
    await page.goto('https://app.flowcv.com/login', { waitUntil: 'networkidle' });
    await sleep(2000);

    const emailLoginBtn = page.locator('button:has-text("Login with email"), button:has-text("email")');
    if (await emailLoginBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await emailLoginBtn.click();
      await sleep(1500);
    }

    await page.locator('input[type="email"]').fill(EMAIL);
    await page.locator('input[type="password"]').waitFor({ timeout: 5000 });
    await page.locator('input[type="password"]').fill(PASSWORD);
    await sleep(500);
    await page.locator('button[type="submit"]').click();
    await page.waitForURL('**/resume/**', { timeout: 20000 });
    await sleep(3000);
    console.log('  Logged in. URL:', page.url());

    if (!page.url().includes('/resume/content')) {
      await page.goto('https://app.flowcv.com/resume/content', { waitUntil: 'networkidle' });
      await sleep(2000);
    }
    await screenshot(page, '20-editor-loaded');

    // Close any open panel first
    await closePanelIfOpen(page);
    await sleep(500);

    // ── UPDATE PROFILE SUMMARY ───────────────────────
    console.log('\n[2/3] Updating profile summary...');
    // Click the "Profile" section header in the left sidebar
    const profileHeader = page.locator('.cursor-pointer:has-text("Profile"), div:has-text("Profile") >> nth=0').first();
    // Try using a more specific approach - look for sidebar section items
    const sidebarSections = page.locator('[class*="cursor-pointer"]');
    const sidebarCount = await sidebarSections.count();
    console.log(`  Found ${sidebarCount} clickable sidebar items`);

    // Find and click "Profile" section
    let profileClicked = false;
    for (let i = 0; i < sidebarCount; i++) {
      const text = await sidebarSections.nth(i).innerText().catch(() => '');
      if (text.includes('Profile') && !text.includes('Personal') && text.length < 50) {
        console.log(`  Clicking sidebar item [${i}]: "${text.trim().substring(0, 40)}"`);
        await sidebarSections.nth(i).click({ force: true });
        profileClicked = true;
        await sleep(1500);
        break;
      }
    }

    if (profileClicked) {
      await screenshot(page, '21-profile-opened');
      // Look for contenteditable or textarea for summary
      const editableFields = page.locator('[contenteditable="true"]');
      const editableCount = await editableFields.count();
      console.log(`  Found ${editableCount} contenteditable field(s)`);

      if (editableCount > 0) {
        const summaryField = editableFields.first();
        await summaryField.click();
        await page.keyboard.press('Meta+A');
        await page.keyboard.press('Backspace');
        await sleep(300);
        await summaryField.type(NEW_SUMMARY, { delay: 2 });
        console.log('  ✅ Summary updated');
        await sleep(500);
      } else {
        // Try textarea
        const textareas = page.locator('textarea');
        const taCount = await textareas.count();
        console.log(`  Found ${taCount} textarea(s)`);
        if (taCount > 0) {
          await textareas.first().fill(NEW_SUMMARY);
          console.log('  ✅ Summary updated via textarea');
        }
      }
      await screenshot(page, '22-summary-updated');
      await closePanelIfOpen(page);
    } else {
      console.log('  ⚠ Could not find Profile section');
    }

    // ── UPDATE WORK EXPERIENCE ───────────────────────
    console.log('\n[3/3] Updating work experience descriptions...');
    await sleep(500);

    // Find and click "Work Experience" section header to expand
    let workExpClicked = false;
    for (let i = 0; i < sidebarCount; i++) {
      const text = await sidebarSections.nth(i).innerText().catch(() => '');
      if (text.includes('Work Experience') && text.length < 50) {
        console.log(`  Expanding Work Experience section...`);
        await sidebarSections.nth(i).click({ force: true });
        workExpClicked = true;
        await sleep(1500);
        break;
      }
    }

    if (!workExpClicked) {
      console.log('  ⚠ Could not find Work Experience section, trying text match...');
      await page.locator('text="Work Experience"').first().click({ force: true });
      await sleep(1500);
    }

    await screenshot(page, '23-work-exp-expanded');

    // Now the individual entries should be visible as clickable cards
    // These are the div.flex.cursor-pointer cards within the expanded section
    for (const update of EXPERIENCE_UPDATES) {
      console.log(`\n  --- ${update.companyMatch} ---`);

      // Find the entry card that contains this company name in the LEFT sidebar
      // Use the cursor-pointer divs that contain the company text
      const allClickable = page.locator('.cursor-pointer');
      const clickableCount = await allClickable.count();
      let entryClicked = false;

      for (let i = 0; i < clickableCount; i++) {
        const text = await allClickable.nth(i).innerText().catch(() => '');
        if (text.includes(update.companyMatch)) {
          console.log(`    Found entry card at index ${i}`);
          await allClickable.nth(i).scrollIntoViewIfNeeded();
          await sleep(300);
          await allClickable.nth(i).click({ force: true });
          entryClicked = true;
          await sleep(2000);
          break;
        }
      }

      if (!entryClicked) {
        console.log(`    ⚠ Could not find sidebar card for "${update.companyMatch}"`);
        continue;
      }

      await screenshot(page, `24-editing-${update.companyMatch.toLowerCase().replace(/\s+/g, '-')}`);

      // Now an edit form should be open in the left panel
      // Find the description contenteditable or textarea
      const editableFields = page.locator('[contenteditable="true"]');
      const editableCount = await editableFields.count();
      console.log(`    Found ${editableCount} contenteditable field(s)`);

      const textareas = page.locator('textarea');
      const taCount = await textareas.count();
      console.log(`    Found ${taCount} textarea(s)`);

      // Try contenteditable fields — the description is usually the last/longest one
      let updated = false;
      if (editableCount > 0) {
        // Pick the field with the most text (likely the description)
        let bestField: Locator | null = null;
        let bestLen = 0;
        for (let i = 0; i < editableCount; i++) {
          const text = await editableFields.nth(i).innerText().catch(() => '');
          if (text.length > bestLen) {
            bestLen = text.length;
            bestField = editableFields.nth(i);
          }
        }

        if (bestField && bestLen > 20) {
          console.log(`    Updating contenteditable (${bestLen} chars)...`);
          await bestField.click();
          await page.keyboard.press('Meta+A');
          await page.keyboard.press('Backspace');
          await sleep(300);
          await bestField.type(update.newBullets, { delay: 2 });
          updated = true;
          console.log(`    ✅ Description updated`);
        }
      }

      if (!updated && taCount > 0) {
        // Try the last textarea (usually description)
        const ta = textareas.last();
        console.log('    Trying textarea...');
        await ta.fill(update.newBullets);
        updated = true;
        console.log('    ✅ Description updated via textarea');
      }

      if (!updated) {
        // Log all visible inputs for debugging
        const allInputs = await page.locator('input:visible, textarea:visible, [contenteditable]:visible').count();
        console.log(`    ⚠ Could not find description field (${allInputs} total visible fields)`);
      }

      await sleep(800);
      await screenshot(page, `25-after-${update.companyMatch.toLowerCase().replace(/\s+/g, '-')}`);

      // Close the edit panel
      await closePanelIfOpen(page);
      await sleep(500);
    }

    await screenshot(page, '30-final');
    console.log('\n=== Done! Review the preview. Browser stays open 90s. ===');
    await sleep(90000);

  } catch (err) {
    console.error('Error:', err);
    await screenshot(page, 'error');
  } finally {
    await browser.close();
    console.log('Browser closed.');
  }
}

main();
