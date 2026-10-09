// Engine-slice wording on pull requests (Dom via Strategy and Lead, 2026-10-09). A PR that touches src/fight/ or origins/combat/ moves ONE engine
// forward; its title and body must not describe the work as copying, porting or rebuilding the Pit, or as something the Pit owns. The words are
// the hooks repo's list (DomLynch/Codex-Hooks#110, claude/hooks/lib/banned_words.py), carried here because CI cannot import it.
// WARN on the first hit (a PR comment with a marker starts the clock); FAIL once that comment is 24 h old and a hit is still there.
// Code spans and fenced blocks are not prose (`npm run build` in a receipt is not a claim), so they are removed before matching.
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export const ENGINE_PATH_RE = /^(src\/fight\/|origins\/combat\/)/;
const ALLOWED_RE = /the Pit client|Pit-only|the Pit[’']s live circle/gi;
// Code leaving the Pit for the engine is the direction Dom wants: "moving the Pit's gore and finisher code into src/fight" (#2014's title) is a fact
// about where the code was, not a claim that the Pit owns it. Only that shape is allowed: a move verb, then "the Pit's …", then into/to src/fight.
const MOVE_RE = /\bmov(?:e|es|ed|ing)\b[^.\n]*?\bthe Pit[’']s\b[^.\n]*?\b(?:into|to)\s+`?src\/fight\b/gi;
const BANNED_RE = /\b(cop(?:y|ies|ied|ying)|port(?:ed|ing)?(?!\s*\d)|build(?:s|ing)?|built|rebuil\w*|implement\w*)\b|the Pit[’']s\b|Pit-side feature/gi;
export const MARKER = '<!-- pr-wording -->';
const DAY_MS = 24 * 3600 * 1000;

/** The banned words in a PR's prose, in order. */
export function scan(text) {
  const prose = String(text).replace(ALLOWED_RE, ' ').replace(MOVE_RE, ' ').replace(/```[\s\S]*?```/g, ' ').replace(/`[^`\n]*`/g, ' ');   // the move allowance first: its destination may be in backticks
  return [...prose.matchAll(BANNED_RE)].map((m) => m[0]);
}

/** ok: nothing to say; warn: hits, still inside the 24 h (or the clock starts now); fail: hits and the first warning is 24 h old. */
export function judge(hits, firstWarnedAt, now) {
  if (!hits.length) return 'ok';
  return firstWarnedAt !== null && now - firstWarnedAt >= DAY_MS ? 'fail' : 'warn';
}

const gh = (...args) => execFileSync('gh', args, { encoding: 'utf8', timeout: 60_000, killSignal: 'SIGKILL' });

function main() {
  const pr = process.env.PR_NUMBER, repo = process.env.GITHUB_REPOSITORY;
  if (!pr || !repo) { console.error('pr-wording: PR_NUMBER and GITHUB_REPOSITORY are required'); process.exit(2); }
  const files = gh('api', '--paginate', `repos/${repo}/pulls/${pr}/files`, '--jq', '.[].filename').split('\n').filter(Boolean);
  if (!files.some((f) => ENGINE_PATH_RE.test(f))) { console.log('pr-wording: no src/fight/ or origins/combat/ file, nothing to check'); return; }
  const view = JSON.parse(gh('pr', 'view', pr, '-R', repo, '--json', 'title,body,comments'));
  const hits = scan(`${view.title}\n${view.body ?? ''}`);
  const warned = view.comments.filter((c) => c.body.startsWith(MARKER)).map((c) => Date.parse(c.createdAt)).sort((a, b) => a - b)[0] ?? null;
  const verdict = judge(hits, warned, Date.now());
  if (verdict === 'ok') { console.log('pr-wording: clean'); return; }
  const list = [...new Set(hits.map((h) => h.toLowerCase()))].map((h) => `"${h}"`).join(', ');
  if (verdict === 'fail') { console.log(`::error::engine-slice wording still in the title/body 24 h after the warning: ${list}`); process.exit(1); }
  if (warned === null) {
    gh('pr', 'comment', pr, '-R', repo, '--body', `${MARKER}\n**Engine wording check:** this PR touches src/fight/ or origins/combat/, and its title/body says ${list}. One engine moves forward here: describe the change as moving or extending the engine, not as copying, porting or rebuilding the Pit, nor as something the Pit owns ("the Pit client", "Pit-only" and "the Pit's live circle" are fine). This check fails 24 h after this comment if the words are still there. Text in backticks is ignored.`);
  }
  console.log(`::warning::engine-slice wording in the title/body: ${list} (fails 24 h after the first warning)`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
