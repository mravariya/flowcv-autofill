import * as dotenv from 'dotenv';
import * as path from 'path';
import { parseResumeFile } from './parser';
import { FlowCVAutomator } from './automator';

dotenv.config();

// ── CLI ─────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const debug = args.includes('--debug');
  const headless = args.includes('--headless');
  const resumePath = args.find((a) => !a.startsWith('--')) ?? 'data/resume.json';

  const email = process.env.FLOWCV_EMAIL;
  const password = process.env.FLOWCV_PASSWORD;

  if (!email || !password) {
    console.error('Missing FLOWCV_EMAIL or FLOWCV_PASSWORD in .env');
    process.exit(1);
  }

  console.log('┌──────────────────────────────────────┐');
  console.log('│      FlowCV Autofill                 │');
  console.log('├──────────────────────────────────────┤');
  console.log(`│  Resume : ${resumePath}`);
  console.log(`│  Debug  : ${debug}`);
  console.log(`│  Headless: ${headless}`);
  console.log('└──────────────────────────────────────┘');

  const resume = parseResumeFile(path.resolve(resumePath));
  console.log(`Parsed ${resume.education.length} education, ${resume.experience.length} experience, ${resume.skills.length} skills`);

  const automator = new FlowCVAutomator({
    email,
    password,
    debug,
    headless,
  });

  try {
    await automator.launch();
    await automator.login();
    await automator.fillResume(resume);
    console.log('\n✅ All done! Review the result in the browser.');

    if (debug) {
      console.log('Debug mode — browser stays open. Press Ctrl+C to exit.');
      await new Promise(() => {}); // keep alive
    }
  } catch (err) {
    console.error('Fatal error:', err);
    process.exit(1);
  } finally {
    if (!debug) {
      await automator.close();
    }
  }
}

main();
