import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CATALOG } from '../../src/data/catalog';

const PROD = 'https://freeplayclassic.com';

describe('brand and production domain', () => {
  it('astro.config and the env example default to the production origin', () => {
    expect(readFileSync('astro.config.mjs', 'utf8')).toContain(`process.env.SITE_URL ?? '${PROD}'`);
    expect(readFileSync('.env.example', 'utf8')).toMatch(new RegExp(`^SITE_URL=${PROD}$`, 'm'));
  });

  it('the web app manifest carries the brand and the current game count', () => {
    const m = JSON.parse(readFileSync('public/manifest.webmanifest', 'utf8'));
    expect(m.name).toBe('Free Play Classic');
    expect(m.description).toMatch(new RegExp(`^${CATALOG.length} classic browser games`));
  });

  it('no tracked file mentions a staging or placeholder host', () => {
    // Research docs may name other domains; deployable code and config may not.
    const files = execSync('git ls-files src public scripts tests astro.config.mjs .env.example README.md .claude', { encoding: 'utf8' })
      .split('\n')
      .filter((f) => /\.(ts|tsx|astro|mjs|js|json|md|webmanifest|txt|css|svg|example)$|^public\/_/.test(f))
      // The two guards themselves name the patterns; the word lists are just dictionary words.
      .filter((f) => !['tests/unit/brand.test.ts', 'scripts/audit-seo.mjs'].includes(f) && !f.startsWith('public/words/'));
    const bad = /[\w-]+\.pages\.dev|[\w-]+\.workers\.dev|example\.(com|org)|mahjong-classic/i;
    for (const f of files) expect(bad.exec(readFileSync(f, 'utf8'))?.[0], f).toBeUndefined();
  });
});
