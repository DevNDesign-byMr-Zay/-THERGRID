import { readFile, writeFile } from 'node:fs/promises';
import { hashPassword } from './security/session-runtime.mjs';
const username = process.argv[2];
const role = process.argv[3] || 'Administrator';
if (
  !/^[\w.@-]{1,80}$/.test(username || '') ||
  ['.', '..'].includes(username) ||
  !['Viewer', 'Analyst', 'Administrator'].includes(role)
)
  throw new Error(
    'Usage: node scripts/configure-aethergrid-account.mjs USERNAME [Viewer|Analyst|Administrator]',
  );
const password = process.env.AETHERGRID_SETUP_PASSWORD;
delete process.env.AETHERGRID_SETUP_PASSWORD;
const passwordHash = hashPassword(password);
const path = '.env.aethergrid';
let content = await readFile(path, 'utf8').catch((error) => {
  if (error.code === 'ENOENT') return '';
  throw error;
});
const existing = /^AETHERGRID_AUTH_USERS='(.*)'$/m.exec(content);
const users = existing ? JSON.parse(existing[1]) : [];
const next = [
  ...users.filter((user) => user.username !== username),
  { username, role, passwordHash },
];
content = content.replace(/^AETHERGRID_AUTH_(USERS|REQUIRED)=.*\n?/gm, '');
await writeFile(
  path,
  content + `\nAETHERGRID_AUTH_REQUIRED=1\nAETHERGRID_AUTH_USERS='${JSON.stringify(next)}'\n`,
  { mode: 0o600 },
);
process.stdout.write('Operator account saved. Restart the application to apply.\n');
