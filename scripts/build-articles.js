/**
 * 記事データ(articles/data.js)から静的HTMLを dist/articles/<slug>/index.html に生成する。
 * さらに記事一覧ページ dist/articles/index.html と sitemap.xml, robots.txt を出力。
 * vite build の後に実行する（package.json の build スクリプトで連結）。
 */
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { ARTICLES, SITE } from "../articles/data.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST = join(__dirname, "..", "dist");

const esc = (s = "") =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// 簡易マークアップ → HTML
function renderBody(md) {
  const lines = md.trim().split("\n");
  const out = [];
  let para = [];
  let list = [];
  const flushPara = () => { if (para.length) { out.push(`<p>${inline(para.join(" "))}</p>`); para = []; } };
  const flushList = () => { if (list.length) { out.push(`<ul>${list.map((li) => `<li>${inline(li)}</li>`).join("")}</ul>`); list = []; } };
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) { flushPara(); flushList(); continue; }
    if (line.startsWith("## ")) { flushPara(); flushList(); out.push(`<h2>${inline(line.slice(3))}</h2>`); continue; }
    if (line.startsWith("> ")) { flushPara(); flushList(); out.push(`<blockquote>${inline(line.slice(2))}</blockquote>`); continue; }
    if (line.startsWith("- ")) { flushPara(); list.push(line.slice(2)); continue; }
    para.push(line);
  }
  flushPara(); flushList();
  return out.join("\n");
}
// インライン: リンク・強調
function inline(s) {
  return esc(s)
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, t, u) => `<a href="${u}">${t}</a>`)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
}

const CSS = `
:root{--bg:#F2FBF4;--surface:#fff;--ink:#123536;--muted:#5E716C;--line:#DCEEE6;--teal:#12A594;--tealDeep:#0C7C74;--ball:#D7F438;--ballInk:#33430A}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font-family:"Hiragino Sans","Hiragino Kaku Gothic ProN",system-ui,-apple-system,"Noto Sans JP",sans-serif;line-height:1.9;font-size:16px;-webkit-font-smoothing:antialiased}
a{color:var(--tealDeep)}
.nav{position:sticky;top:0;z-index:10;background:var(--tealDeep);padding:14px clamp(16px,4vw,40px);display:flex;align-items:center;justify-content:space-between}
.nav a{color:#fff;text-decoration:none;font-weight:900;font-style:italic;font-size:16px}
.nav .cta{background:var(--ball);color:var(--ballInk);border-radius:999px;padding:6px 14px;font-size:12px;font-style:normal}
.hero{position:relative;overflow:hidden}
.hero img{width:100%;height:clamp(180px,32vw,300px);object-fit:cover;display:block;filter:saturate(1.05)}
.hero .cap{position:absolute;left:0;right:0;bottom:0;padding:40px 20px 16px;background:linear-gradient(transparent,rgba(8,36,38,.72))}
.wrap{max-width:720px;margin:0 auto;padding:0 20px}
article h1{font-size:clamp(24px,4.6vw,34px);font-weight:900;line-height:1.35;margin:26px 0 8px;text-wrap:balance}
.meta{color:var(--muted);font-size:13px;margin-bottom:20px}
article h2{font-size:clamp(19px,3.4vw,24px);font-weight:900;margin:34px 0 10px;padding-left:12px;border-left:5px solid var(--ball)}
article p{margin:14px 0}
article ul{margin:14px 0;padding-left:1.2em}
article li{margin:7px 0}
article blockquote{margin:16px 0;padding:12px 16px;background:#EFF5EE;border-left:4px solid var(--teal);border-radius:0 12px 12px 0;color:#33504b}
.share{display:flex;gap:8px;flex-wrap:wrap;margin:28px 0}
.share a{flex:1;min-width:120px;text-align:center;text-decoration:none;font-weight:800;font-size:13px;padding:11px 0;border-radius:12px}
.share .x{background:#111;color:#fff}
.share .line{background:#06C755;color:#fff}
.share .cp{background:#EFF2EF;color:var(--ink)}
.backcta{display:block;text-align:center;margin:30px 0 10px;background:var(--teal);color:#fff;text-decoration:none;font-weight:900;padding:15px 0;border-radius:14px}
.related{margin:30px 0}
.related h3{font-size:14px;color:var(--muted);font-weight:900;letter-spacing:.06em}
.related a{display:block;padding:12px 14px;background:#fff;border:1.5px solid var(--line);border-radius:12px;margin-top:8px;text-decoration:none;color:var(--ink);font-weight:800;font-size:14px}
footer{background:var(--tealDeep);color:#fff;text-align:center;padding:30px 20px 50px;margin-top:40px;font-size:12px;opacity:.95}
footer a{color:#fff}
`;

function page({ title, description, canonical, ogImage, bodyHtml, jsonld }) {
  return `<!doctype html>
<html lang="ja"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${canonical}">
<link rel="icon" href="/favicon.ico"><link rel="apple-touch-icon" href="/apple-touch-icon.png">
<meta property="og:type" content="article"><meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}"><meta property="og:url" content="${canonical}">
<meta property="og:image" content="${SITE.origin}${ogImage}">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}"><meta name="twitter:image" content="${SITE.origin}${ogImage}">
<meta name="theme-color" content="#0C7C74">
${jsonld ? `<script type="application/ld+json">${JSON.stringify(jsonld)}</script>` : ""}
<style>${CSS}</style></head>
<body>
<div class="nav"><a href="/">ピックルイキタイ</a><a class="cta" href="/#courts">コートを探す</a></div>
${bodyHtml}
<footer>掲載情報の正確性は保証されません。予約・利用条件は各施設の公式情報をご確認ください。<br>© 2026 MUFASA Technology ・ <a href="/">ピックルイキタイ</a></footer>
</body></html>`;
}

function articlePage(a) {
  const url = `${SITE.origin}/articles/${a.slug}/`;
  const ogImage = a.hero || SITE.ogpDefault;
  const related = ARTICLES.filter((x) => x.slug !== a.slug).slice(0, 3);
  const shareText = encodeURIComponent(a.title);
  const body = `
<div class="hero"><img src="${a.hero || SITE.ogpDefault}" alt="${esc(a.title)}" loading="lazy"><div class="cap"></div></div>
<div class="wrap">
<article>
<h1>${esc(a.title)}</h1>
<div class="meta">${a.region ? esc(a.region) + " ・ " : ""}更新: ${esc(a.updated)}</div>
${renderBody(a.body)}
<div class="share">
<a class="x" href="https://twitter.com/intent/tweet?text=${shareText}&url=${encodeURIComponent(url)}" target="_blank" rel="noopener">Xでシェア</a>
<a class="line" href="https://line.me/R/msg/text/?${shareText}%0A${encodeURIComponent(url)}" target="_blank" rel="noopener">LINEで送る</a>
<a class="cp" href="${url}" onclick="navigator.clipboard&&navigator.clipboard.writeText('${url}');this.textContent='コピーしました';return false;">リンクをコピー</a>
</div>
<a class="backcta" href="/#courts">🎾 コートの一覧・空き枠を見る</a>
${related.length ? `<div class="related"><h3>関連記事</h3>${related.map((r) => `<a href="/articles/${r.slug}/">${esc(r.title)}</a>`).join("")}</div>` : ""}
</article>
</div>`;
  const jsonld = {
    "@context": "https://schema.org", "@type": "Article",
    headline: a.title, description: a.description,
    datePublished: a.updated, dateModified: a.updated,
    image: `${SITE.origin}${ogImage}`,
    author: { "@type": "Organization", name: "MUFASA Technology" },
    publisher: { "@type": "Organization", name: SITE.name },
    mainEntityOfPage: url,
  };
  return page({ title: `${a.title} | ${SITE.name}`, description: a.description, canonical: url, ogImage, bodyHtml: body, jsonld });
}

function indexPage() {
  const url = `${SITE.origin}/articles/`;
  const body = `
<div class="wrap">
<article>
<h1>ピックルボールの記事・エリアガイド</h1>
<div class="meta">全国のコート情報・始め方・エリアごとの探し方</div>
<div class="related">${ARTICLES.map((a) => `<a href="/articles/${a.slug}/">${esc(a.title)}</a>`).join("")}</div>
<a class="backcta" href="/#courts">🎾 コートの一覧・空き枠を見る</a>
</article>
</div>`;
  return page({ title: `記事・エリアガイド | ${SITE.name}`, description: "全国のピックルボールコート情報とエリアガイド。始め方から地域別の探し方まで。", canonical: url, ogImage: SITE.ogpDefault, bodyHtml: body });
}

// --- 出力 ---
let count = 0;
for (const a of ARTICLES) {
  const dir = join(DIST, "articles", a.slug);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "index.html"), articlePage(a));
  count++;
}
mkdirSync(join(DIST, "articles"), { recursive: true });
writeFileSync(join(DIST, "articles", "index.html"), indexPage());

// sitemap.xml
const urls = ["/", "/articles/", ...ARTICLES.map((a) => `/articles/${a.slug}/`)];
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `<url><loc>${SITE.origin}${u}</loc><changefreq>weekly</changefreq></url>`).join("\n")}
</urlset>`;
writeFileSync(join(DIST, "sitemap.xml"), sitemap);
writeFileSync(join(DIST, "robots.txt"), `User-agent: *\nAllow: /\nSitemap: ${SITE.origin}/sitemap.xml\n`);

console.log(`✅ articles built: ${count} + index, sitemap(${urls.length} urls), robots.txt`);
