/**
 * SEOPress Bulk Score Refresh
 * https://github.com/thorsolutions/seopress-bulk-score-refresh
 *
 * Modes:
 *   all        — posts, pages, and all public custom post types
 *   posts      — posts only
 *   pages      — pages only
 *   cpt        — custom post types only (excludes posts and pages)
 *   ids        — specific IDs you provide below
 *
 * Setup:
 *   1. WP Admin → Users → Profile → Application Passwords → create one, copy it
 *   2. Fill in WP_URL, WP_USER, APP_PASSWORD
 *   3. Set MODE to whichever mode you want
 *   4. node run-seopress-api.js
 */

// ─── CONFIG ──────────────────────────────────────────────────────────────────
const WP_URL      = "https://yoursite.com";          // no trailing slash
const WP_USER     = "your_admin_username";
const APP_PASSWORD = "xxxx xxxx xxxx xxxx xxxx xxxx"; // WordPress Application Password

const MODE = "all"; // "all" | "posts" | "pages" | "cpt" | "ids"

// Only used when MODE = "ids"
const SPECIFIC_IDS = [
  // "123", "456", "789"
];

// Only used when MODE = "cpt" or "all" — add/remove CPT slugs as needed.
// Leave empty to auto-discover all public CPTs from the REST API.
const CPT_SLUGS = [
  // "product", "event", "testimonial"
];

const BATCH_SIZE = 5; // concurrent requests per batch
// ─────────────────────────────────────────────────────────────────────────────

const auth = Buffer.from(`${WP_USER}:${APP_PASSWORD}`).toString('base64');
const headers = {
  'Authorization': `Basic ${auth}`,
  'Content-Type': 'application/json'
};

async function wpFetch(path) {
  const resp = await fetch(`${WP_URL}/wp-json${path}`, { headers });
  if (!resp.ok) throw new Error(`${resp.status} on ${path}`);
  return resp.json();
}

/** Fetch all published IDs for a given post type, handling pagination */
async function getIdsForType(type) {
  const ids = [];
  let page = 1;
  while (true) {
    const items = await wpFetch(`/wp/v2/${type}?status=publish&per_page=100&page=${page}&_fields=id`);
    if (!items.length) break;
    ids.push(...items.map(i => String(i.id)));
    if (items.length < 100) break;
    page++;
  }
  return ids;
}

/** Discover all public CPT REST slugs (excludes posts and pages) */
async function discoverCPTs() {
  const types = await wpFetch('/wp/v2/types');
  return Object.values(types)
    .filter(t => t.rest_base && !['posts', 'pages', 'media', 'blocks', 'templates', 'template-parts', 'navigation', 'font-families', 'font-faces', 'global-styles', 'block-directory'].includes(t.rest_base))
    .map(t => t.rest_base);
}

async function collectIds() {
  if (MODE === 'ids') {
    if (!SPECIFIC_IDS.length) throw new Error('MODE is "ids" but SPECIFIC_IDS is empty.');
    return SPECIFIC_IDS.map(String);
  }

  const ids = new Set();

  if (MODE === 'posts' || MODE === 'all') {
    console.log('  Fetching posts...');
    (await getIdsForType('posts')).forEach(id => ids.add(id));
  }

  if (MODE === 'pages' || MODE === 'all') {
    console.log('  Fetching pages...');
    (await getIdsForType('pages')).forEach(id => ids.add(id));
  }

  if (MODE === 'cpt' || MODE === 'all') {
    const slugs = CPT_SLUGS.length ? CPT_SLUGS : await discoverCPTs();
    for (const slug of slugs) {
      console.log(`  Fetching CPT: ${slug}...`);
      try {
        (await getIdsForType(slug)).forEach(id => ids.add(id));
      } catch(e) {
        console.warn(`  ⚠  Skipped CPT "${slug}": ${e.message}`);
      }
    }
  }

  return [...ids];
}

async function analyzePost(id) {
  const resp = await fetch(
    `${WP_URL}/wp-json/seopress/v1/posts/${id}/content-analysis/analyze`,
    { method: 'POST', headers, body: JSON.stringify({}) }
  );
  const data = await resp.json();
  if (!resp.ok) throw new Error(data.message || resp.status);
  return data.score;
}

async function runBatch(ids) {
  return Promise.all(ids.map(async id => {
    try {
      const score = await analyzePost(id);
      console.log(`  ✓ ${id} — score: ${JSON.stringify(score)}`);
      return { id, ok: true };
    } catch(e) {
      console.error(`  ✗ ${id} — ${e.message}`);
      return { id, ok: false };
    }
  }));
}

(async () => {
  console.log(`\nSEOPress Bulk Score Refresh — mode: ${MODE}\n`);

  console.log('Collecting IDs...');
  const ids = await collectIds();
  console.log(`Found ${ids.length} items.\n`);

  if (!ids.length) {
    console.log('Nothing to process.');
    return;
  }

  const failed = [];
  const totalBatches = Math.ceil(ids.length / BATCH_SIZE);

  for (let i = 0; i < ids.length; i += BATCH_SIZE) {
    const batch = ids.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    console.log(`Batch ${batchNum}/${totalBatches}: ${batch.join(', ')}`);
    const results = await runBatch(batch);
    failed.push(...results.filter(r => !r.ok).map(r => r.id));
  }

  console.log('\n─────────────────────────────');
  if (failed.length) {
    console.log(`Done. ${ids.length - failed.length}/${ids.length} succeeded.`);
    console.log(`Failed IDs: ${failed.join(', ')}`);
  } else {
    console.log(`Done. All ${ids.length} scores saved. ✓`);
  }
})();
