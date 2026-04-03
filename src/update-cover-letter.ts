import { chromium, Page, Locator } from 'playwright';
import * as dotenv from 'dotenv';
dotenv.config();

const EMAIL = process.env.FLOWCV_EMAIL!;
const PASSWORD = process.env.FLOWCV_PASSWORD!;

const COVER_LETTER_BODY = `Dear Hiring Manager,

I am writing to express my strong interest in the Learning Designer position within Coursera's Content & Credentials team. With over four years of experience designing curriculum, training learners, and collaborating with cross-functional teams across education and technology, I am excited by the opportunity to help Coursera build scalable, skill-aligned learning experiences that reach millions of learners worldwide.

In my role as an ICT & Computer Science Educator at Thakur School of Global Education, I designed and delivered modular, skill-aligned curriculum for subjects including AI, Machine Learning, Web Development, and Robotics — serving over 200 students across grades 7 through A-Level. I translated complex technical subjects into structured learning journeys using backward design principles, developed assessment blueprints with formative quizzes, project-based evaluations, and capstone rubrics aligned to Cambridge International standards, and integrated educational technology tools including coding platforms, LMS, and AR/VR labs to enhance accessibility and learning outcomes. This experience maps directly to the core responsibilities of this role: leading learning design, producing vendor-ready deliverables, and ensuring quality through clear standards.

At Playhouse Media, I applied data-driven thinking to content optimization — building dashboards and reports in Python, R, Grafana, and MongoDB to measure engagement metrics, identify learner drop-offs, and translate insights into actionable recommendations. I also contributed to quality assurance through systematic production reviews and cross-functional collaboration with product, engineering, and marketing teams. At Devfolio, I led end-to-end production of developer learning events in partnership with brands like Google and ETHIndia, creating replicable event frameworks and templates that standardized quality across multiple vendor teams — experience that directly aligns with Coursera's emphasis on scalable, vendor-managed content production.

I am particularly drawn to this role because of its focus on pedagogical R&D and AI-assisted design tooling. I hold multiple Google Cloud certifications in Generative AI, Foundation Models, and Responsible AI, and I have hands-on experience using GenAI tools for content scaffolding, prompt engineering for course outlines, and AI-assisted assessment generation. I am eager to contribute to prototyping new learning designs and developing AI-powered templates and prompts that increase production efficiency while maintaining quality.

Coursera's mission of universal access to world-class learning resonates deeply with my own commitment to making education accessible — whether through mentoring students at CodePath, coaching hackathon teams at Major League Hacking, or organizing community coding events through CodeDay Mumbai. I would welcome the opportunity to bring my blend of learning design expertise, technical fluency, and vendor collaboration experience to the Teaching & Learning team.

Thank you for considering my application. I look forward to the opportunity to discuss how I can contribute to Coursera's content and learning design goals.

Warm regards,
Mahesh Ravariya`;

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function screenshot(page: Page, name: string) {
  await page.screenshot({ path: `data/screenshots/${name}.png`, fullPage: false });
  console.log(`  📸 ${name}`);
}

async function main() {
  console.log('=== FlowCV Cover Letter Updater ===\n');
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
    await page.waitForURL(/\/(resume|resumes|cover-letter|dashboard)/, { timeout: 20000 });
    await sleep(3000);
    console.log('  Logged in. URL:', page.url());

    // ── NAVIGATE TO COVER LETTER ─────────────────────
    console.log('\n[2/3] Navigating to Cover Letter...');
    // Click "Cover Letter" in the top/side navigation
    const coverLetterNav = page.locator('a:has-text("Cover Letter"), button:has-text("Cover Letter")').first();
    if (await coverLetterNav.isVisible({ timeout: 5000 }).catch(() => false)) {
      await coverLetterNav.click();
      await sleep(3000);
    } else {
      // Try direct URL
      await page.goto('https://app.flowcv.com/cover-letter/content', { waitUntil: 'networkidle' });
      await sleep(3000);
    }
    console.log('  URL:', page.url());
    await screenshot(page, 'cl-01-cover-letter-page');

    // We're on the listing page with cover letter cards
    const pageText = await page.locator('body').innerText();

    if (pageText.includes('My Cover Letters') || page.url().includes('cover-letters')) {
      console.log('  On cover letter listing page. Opening first cover letter...');

      // The "Operations Lead" title is below the card. The card itself is a
      // clickable preview above it. Find the title, go to its parent wrapper,
      // then click the preview area above.
      // Strategy: find the text "Operations Lead" then use locator('..') to get parent
      const titleEl = page.locator('text="Operations Lead"').first();

      if (await titleEl.isVisible({ timeout: 3000 }).catch(() => false)) {
        // The card preview is a sibling above the title wrapper — click via bounding box
        const box = await titleEl.boundingBox();
        if (box) {
          // Click in the center of the card preview ABOVE the title
          const clickX = box.x + box.width / 2;
          const clickY = box.y - 150; // card preview is above the title
          console.log(`  Clicking card preview at (${clickX}, ${clickY})...`);
          await page.mouse.move(clickX, clickY);
          await sleep(500);
          await screenshot(page, 'cl-02-hover');

          // Look for the VIEW COVER LETTER overlay that should appear on hover
          const viewBtn = page.locator('text=/VIEW COVER LETTER/i').first();
          if (await viewBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
            console.log('  Found VIEW COVER LETTER button, clicking...');
            await viewBtn.click();
          } else {
            // Just click the card area
            console.log('  Clicking card area directly...');
            await page.mouse.click(clickX, clickY);
          }
          await sleep(3000);
        }
      } else {
        // Fallback: click the first card by finding the preview area
        console.log('  Title not found, clicking first card area...');
        await page.mouse.click(500, 200);
        await sleep(3000);
      }

      console.log('  URL after click:', page.url());
      await screenshot(page, 'cl-02-after-click');

      // If still on listing, try one more approach
      if (!page.url().includes('content')) {
        // Log all href attributes on the page
        const allLinks = await page.locator('a').evaluateAll(
          (els) => els.map((e) => ({ href: e.getAttribute('href'), text: e.textContent?.trim().substring(0, 40) }))
        );
        console.log('  All links on page:');
        allLinks
          .filter((l) => l.href && (l.href.includes('cover-letter') || l.href.includes('letter')))
          .forEach((l) => console.log(`    ${l.href} — "${l.text}"`));

        // Try double-clicking the card area
        const titleEl2 = page.locator('text="Operations Lead"').first();
        const box2 = await titleEl2.boundingBox();
        if (box2) {
          await page.mouse.dblclick(box2.x + box2.width / 2, box2.y - 150);
          await sleep(3000);
          console.log('  URL after dblclick:', page.url());
        }
      }

      await screenshot(page, 'cl-03-nav-result');
    }

    // ── FIND AND UPDATE BODY ─────────────────────────
    console.log('\n[3/3] Updating cover letter content...');

    // Ensure we're on the content tab
    const contentTab = page.locator('text="Content"').first();
    if (await contentTab.isVisible({ timeout: 2000 }).catch(() => false)) {
      await contentTab.click();
      await sleep(1500);
    }

    await screenshot(page, 'cl-03-content-tab');

    // Log sidebar sections
    const clickables = page.locator('.cursor-pointer');
    const clickCount = await clickables.count();
    console.log(`  Found ${clickCount} clickable elements`);

    // Look for body/letter section to click
    let bodyClicked = false;
    for (let i = 0; i < Math.min(clickCount, 50); i++) {
      const text = await clickables.nth(i).innerText().catch(() => '');
      const trimmed = text.trim().substring(0, 60);
      if (
        trimmed.toLowerCase().includes('body') ||
        trimmed.toLowerCase().includes('letter') ||
        trimmed.toLowerCase().includes('content') ||
        trimmed.toLowerCase().includes('dear')
      ) {
        console.log(`  Clicking [${i}]: "${trimmed}"`);
        await clickables.nth(i).click({ force: true });
        bodyClicked = true;
        await sleep(2000);
        break;
      }
    }

    if (!bodyClicked) {
      // Try clicking the first few to find the body section
      console.log('  No "body" section found. Trying to find editable content directly...');
    }

    await screenshot(page, 'cl-04-body-section');

    // Find contenteditable fields
    const editableFields = page.locator('[contenteditable="true"]');
    const editableCount = await editableFields.count();
    console.log(`  Found ${editableCount} contenteditable field(s)`);

    const textareas = page.locator('textarea');
    const taCount = await textareas.count();
    console.log(`  Found ${taCount} textarea(s)`);

    let updated = false;

    if (editableCount > 0) {
      // Find the longest contenteditable — that's the body
      let bestField: Locator | null = null;
      let bestLen = 0;
      for (let i = 0; i < editableCount; i++) {
        const text = await editableFields.nth(i).innerText().catch(() => '');
        console.log(`    editable[${i}]: ${text.length} chars — "${text.substring(0, 50)}..."`);
        if (text.length > bestLen) {
          bestLen = text.length;
          bestField = editableFields.nth(i);
        }
      }

      if (bestField) {
        console.log(`  Updating contenteditable body (${bestLen} chars)...`);
        await bestField.click();
        await page.keyboard.press('Meta+A');
        await page.keyboard.press('Backspace');
        await sleep(300);
        await bestField.type(COVER_LETTER_BODY, { delay: 1 });
        updated = true;
        console.log('  ✅ Cover letter body updated');
      }
    }

    if (!updated && taCount > 0) {
      // Try longest textarea
      let bestTa: Locator | null = null;
      let bestLen = 0;
      for (let i = 0; i < taCount; i++) {
        const val = await textareas.nth(i).inputValue().catch(() => '');
        if (val.length > bestLen) {
          bestLen = val.length;
          bestTa = textareas.nth(i);
        }
      }
      if (bestTa) {
        await bestTa.fill(COVER_LETTER_BODY);
        updated = true;
        console.log('  ✅ Cover letter body updated via textarea');
      }
    }

    if (!updated) {
      // Try clicking through all sidebar sections to find the body
      console.log('  Attempting to find body by clicking sidebar sections...');
      const sidebarItems = page.locator('.cursor-pointer');
      const sCount = await sidebarItems.count();

      for (let i = 0; i < Math.min(sCount, 30); i++) {
        const text = await sidebarItems.nth(i).innerText().catch(() => '');
        if (text.length > 5 && text.length < 80) {
          await sidebarItems.nth(i).click({ force: true });
          await sleep(1000);

          const ceCount = await editableFields.count();
          if (ceCount > 0) {
            const field = editableFields.first();
            const fieldText = await field.innerText().catch(() => '');
            if (fieldText.length > 50) {
              console.log(`  Found body at sidebar item [${i}]: "${text.trim().substring(0, 40)}"`);
              await field.click();
              await page.keyboard.press('Meta+A');
              await page.keyboard.press('Backspace');
              await sleep(300);
              await field.type(COVER_LETTER_BODY, { delay: 1 });
              updated = true;
              console.log('  ✅ Cover letter body updated');
              break;
            }
          }
        }
      }
    }

    // Close/save
    const doneBtn = page.locator('button:has-text("Done")');
    if (await doneBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await doneBtn.click();
      await sleep(1000);
    }

    await screenshot(page, 'cl-05-final');

    if (updated) {
      console.log('\n=== Cover letter updated! Browser stays open 90s. ===');
    } else {
      console.log('\n=== Could not find body field. Check screenshots. Browser stays open 90s. ===');
    }
    await sleep(90000);

  } catch (err) {
    console.error('Error:', err);
    await screenshot(page, 'cl-error');
  } finally {
    await browser.close();
    console.log('Browser closed.');
  }
}

main();
