# Deploying to Cloudflare Pages

Two supported paths. Use **A** for the long term (every push to `main` deploys, every PR gets a preview URL). Use **B** to get a live URL in two minutes without touching the dashboard.

Both produce a URL of the form `https://online-games.pages.dev` (plus `https://<hash>.online-games.pages.dev` per deployment).

---

## A. Git-connected project (recommended)

1. Open <https://dash.cloudflare.com/> → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**.
2. Authorize GitHub if prompted and select the `online-games` repository.
3. Build settings:

   | Setting | Value |
   |---|---|
   | Production branch | `main` |
   | Framework preset | Astro |
   | Build command | `npm run build` |
   | Build output directory | `dist` |
   | Root directory | `/` |

4. **Environment variables** (Production and Preview):

   | Name | Value |
   |---|---|
   | `SITE_URL` | `https://online-games.pages.dev` (change to the custom domain once attached) |
   | `NODE_VERSION` | `22` |

5. Click **Save and Deploy**. First build takes about a minute. Subsequent pushes to `main` deploy automatically; pull requests get preview URLs posted as GitHub checks.

6. After the first deploy, verify:
   - `https://online-games.pages.dev/mahjong/turtle/` plays.
   - `https://online-games.pages.dev/sitemap-index.xml` lists the pages with the right origin.
   - `https://online-games.pages.dev/robots.txt` points at that sitemap (edit `public/robots.txt` if the origin differs).
   - Response headers include `Cache-Control: public, max-age=31536000, immutable` on `/_astro/*` (from `public/_headers`).

### Custom domain

**Custom domains** tab → **Set up a custom domain** → enter the domain. If DNS is on Cloudflare the CNAME is added automatically. Then update `SITE_URL` to the custom origin and redeploy so canonical URLs and the sitemap use it.

---

## B. Direct upload from your machine (fastest first test)

Requires a Cloudflare account; the first run opens a browser to authorize Wrangler.

```bash
npx wrangler login
```

```bash
npx wrangler pages project create online-games --production-branch main
```

```bash
SITE_URL=https://online-games.pages.dev npm run deploy:pages
```

`deploy:pages` builds `dist/` and uploads it. Wrangler prints the live URL at the end. Re-run the last command to redeploy. On PowerShell set the variable first:

```powershell
$env:SITE_URL = "https://online-games.pages.dev"; npm run deploy:pages
```

A project created this way can later be connected to Git from the dashboard (**Settings** → **Builds & deployments**).

---

## C. Deploy from GitHub Actions (optional, replaces A's build step)

If you prefer builds to run in GitHub rather than Cloudflare, add two repository secrets, `CLOUDFLARE_API_TOKEN` (Pages: Edit permission) and `CLOUDFLARE_ACCOUNT_ID`, then append this job to `.github/workflows/ci.yml`:

```yaml
  deploy:
    needs: test-build
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    permissions:
      contents: read
      deployments: write
    steps:
      - uses: actions/download-artifact@v4
        with:
          name: dist
          path: dist
      - uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          command: pages deploy dist --project-name=online-games --branch=main
```

---

## Post-deploy checklist

- [ ] `SITE_URL` set in the Pages project (canonical, OG and sitemap depend on it).
- [ ] `public/robots.txt` sitemap line matches the live origin.
- [ ] Contact email in `src/pages/contact.astro` replaced.
- [ ] Run Lighthouse (mobile) on `/mahjong/turtle/`; target Performance 95+, Accessibility 100, SEO 100.
- [ ] Submit `sitemap-index.xml` in Google Search Console and Bing Webmaster Tools.
- [ ] Enable **Web Analytics** in the Pages project (cookieless, free).
