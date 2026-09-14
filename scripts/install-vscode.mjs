import { access } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';

const candidates = process.env.VSCODE_CLI ? [process.env.VSCODE_CLI] : [
  '/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code',
  `${homedir()}/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code`,
];
let cli = process.platform === 'win32' ? 'code.cmd' : 'code';
for (const candidate of candidates) {
  if (await access(candidate).then(() => true, () => false)) {
    cli = candidate;
    break;
  }
}
const config = {
  name: 'tyreju-komanda',
  type: 'stdio',
  command: process.execPath,
  args: [fileURLToPath(new URL('../src/server.mjs', import.meta.url))],
};
try {
  const { stdout, stderr } = await promisify(execFile)(cli, ['--add-mcp', JSON.stringify(config)]);
  if (stdout.trim()) console.log(stdout.trim());
  if (stderr.trim()) console.error(stderr.trim());
  console.log('tyreju-komanda užregistruota VS Code vartotojo profilyje. Atverk MCP: List Servers.');
} catch (error) {
  console.error(`VS Code registracija nepavyko: ${error.message}`);
  console.error('Nurodyk VS Code CLI kelią per VSCODE_CLI ir pakartok npm run vscode:install.');
  process.exitCode = 1;
}
