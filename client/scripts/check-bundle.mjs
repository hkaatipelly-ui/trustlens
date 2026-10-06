import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const directory = fileURLToPath(new URL('../dist/', import.meta.url));
const forbidden = [
  { name: 'server Gemini configuration', pattern: /GEMINI/ },
  { name: 'server-only environment configuration', pattern: /JWT_SECRET|MONGODB_URI|@google\/genai/ },
  { name: 'Google API key', pattern: /AIza[\w-]{35}/ },
  { name: 'MongoDB credentials', pattern: /mongodb(?:\+srv)?:\/\/[^\s"'<>]+/ },
  { name: 'private key', pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
];

async function check(dir) {
  let checked = 0;
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const filename = path.join(dir, entry.name);
    if (entry.isDirectory()) { checked += await check(filename); continue; }
    if (!/\.(?:js|css|html|json|map)$/i.test(entry.name)) continue;
    const content = await readFile(filename, 'utf8');
    for (const rule of forbidden) {
      if (rule.pattern.test(content)) throw new Error(`${rule.name} found in ${path.relative(directory, filename)}. Matched values are intentionally not printed.`);
    }
    checked++;
  }
  return checked;
}

try {
  const files = await check(directory);
  console.log(`Client bundle check passed: ${files} assets scanned; no GEMINI configuration, database/JWT secrets, SDK, or recognized key material.`);
} catch (error) {
  console.error(error.code === 'ENOENT' ? 'Build the client before running check:bundle.' : error.message);
  process.exitCode = 1;
}
