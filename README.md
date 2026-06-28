# seopress-bulk-score-refresh

Bulk force-refresh SEOPress content analysis scores via the REST API. No browser automation, no Puppeteer, no manual ID collection.

Built for sites that migrated from Yoast, Rank Math, or another SEO plugin and ended up with blank score columns in the All Posts dashboard.

> **SEOPress Free only.** If you have SEOPress Pro, the built-in Site Audit tool handles this automatically.

---

## The problem

After migrating to SEOPress, your All Posts score columns are blank. Re-saving posts via WP-CLI doesn't fix it — SEOPress calculates content analysis scores entirely in the **browser via JavaScript**. The PHP backend has no scoring engine, so WP-CLI never triggers it.

## The solution

SEOPress registers a REST API endpoint that runs the analysis and saves the score to the database in a single call:

```
POST /wp-json/seopress/v1/posts/{id}/content-analysis/analyze
```

This script calls it automatically across all your content using a WordPress Application Password.

---

## Modes

Set `MODE` at the top of the script:

| Mode | What it processes |
|------|-------------------|
| `all` | Posts, pages, and all public custom post types |
| `posts` | Posts only |
| `pages` | Pages only |
| `cpt` | Custom post types only (auto-discovered, or specify in `CPT_SLUGS`) |
| `ids` | Specific IDs you provide in `SPECIFIC_IDS` |

---

## Requirements

- Node.js 18+ (built-in `fetch` — no packages needed)
- WordPress admin account
- SEOPress Free or Pro installed

---

## Setup

**1. Create a WordPress Application Password**

- Go to **WP Admin → Users → Your Profile**
- Scroll to **Application Passwords**
- Enter a name (e.g. `SEOPress Fix`) → click **Add New Application Password**
- Copy the generated password (format: `xxxx xxxx xxxx xxxx xxxx xxxx`)

**2. Configure the script**

Open `run-seopress-api.js` and fill in the constants at the top:

```js
const WP_URL       = "https://yoursite.com";
const WP_USER      = "your_admin_username";
const APP_PASSWORD = "xxxx xxxx xxxx xxxx xxxx xxxx";
const MODE         = "all"; // "all" | "posts" | "pages" | "cpt" | "ids"
```

**3. Run it**

```bash
node run-seopress-api.js
```

Refresh your All Posts page — the score columns will be populated.

---

## Example output

```
SEOPress Bulk Score Refresh — mode: all

Collecting IDs...
  Fetching posts...
  Fetching pages...
  Fetching CPT: product...
Found 87 items.

Batch 1/18: 4241, 4223, 292, 361, 313
  ✓ 4241 — score: {"0":"good","1":"low","3":"medium"}
  ✓ 4223 — score: {"0":"good","2":"medium"}
  ✓ 292  — score: {"0":"good","3":"medium","9":"high"}
  ✓ 361  — score: {"1":"low","3":"medium"}
  ✓ 313  — score: {"0":"good"}
...

─────────────────────────────
Done. All 87 scores saved. ✓
```

---

## Notes

- **Focus keywords required** for a meaningful score. If you migrated from another plugin, run the SEOPress migration tool first: **SEO → Tools → Plugins → Migrate Now**. This imports your existing focus keywords.
- **Node.js < 18:** install `node-fetch` and add `import fetch from 'node-fetch'` at the top.
- **Batch size:** defaults to 5 concurrent requests. Adjust `BATCH_SIZE` if your host is slow.

---

## Feedback

Found a bug or want a feature? Open an issue at [github.com/thorsolutions/seopress-bulk-score-refresh](https://github.com/thorsolutions/seopress-bulk-score-refresh/issues).

---

## License

MIT
