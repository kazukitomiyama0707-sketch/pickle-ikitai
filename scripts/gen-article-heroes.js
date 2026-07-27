/**
 * 記事のヒーロー画像を自動生成する。
 * 実在施設の写真は使えない（権利・正確性の両面でリスク）ため、
 * トップページのCourtPatternと同系統の抽象的なコート柄SVGを
 * slugごとに色味・配置を変えて量産する。
 *
 * 使い方: node scripts/gen-article-heroes.js
 * ARTICLES(articles/data.js) を読み、public/article-heroes/<slug>.svg を書き出す。
 */
import { ARTICLES } from "../articles/data.js";
import fs from "node:fs";
import path from "node:path";

const OUT_DIR = path.join(process.cwd(), "public", "article-heroes");
fs.mkdirSync(OUT_DIR, { recursive: true });

// slugから決定的な疑似乱数を作る（毎回同じ画像になるように）
function seedFrom(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const hsl = (h, s, l) => `hsl(${Math.round(h)}, ${Math.round(s)}%, ${Math.round(l)}%)`;

function buildSvg(slug) {
  const rand = mulberry32(seedFrom(slug));
  const baseHue = Math.floor(rand() * 360);
  const accentHue = (baseHue + 130 + Math.floor(rand() * 60)) % 360;
  const dark = hsl(baseHue, 42, 22);
  const mid = hsl(baseHue, 46, 34);
  const light = hsl(baseHue, 40, 46);
  const accent = hsl(accentHue, 70, 62);
  const W = 1200, H = 630;
  const angle = Math.floor(rand() * 40) - 20;
  const lineCount = 5 + Math.floor(rand() * 4);
  let lines = "";
  for (let i = 0; i < lineCount; i++) {
    const x = (i / lineCount) * W * 1.4 - W * 0.2;
    lines += `<line x1="${x}" y1="0" x2="${x + 220}" y2="${H}" stroke="rgba(255,255,255,0.10)" stroke-width="26" />`;
  }
  const cx = W * (0.2 + rand() * 0.6);
  const cy = H * (0.2 + rand() * 0.6);
  const r = 60 + rand() * 90;
  const ballX = W * (0.1 + rand() * 0.8);
  const ballY = H * (0.15 + rand() * 0.7);
  const ballR = 26 + rand() * 22;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${mid}" />
      <stop offset="100%" stop-color="${dark}" />
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#g)" />
  <g transform="rotate(${angle} ${W / 2} ${H / 2})">${lines}</g>
  <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${light}" stroke-width="10" opacity="0.55" />
  <circle cx="${ballX}" cy="${ballY}" r="${ballR}" fill="${accent}" opacity="0.92" />
  <circle cx="${ballX - ballR * 0.28}" cy="${ballY - ballR * 0.3}" r="${ballR * 0.11}" fill="rgba(0,0,0,0.28)" />
  <circle cx="${ballX + ballR * 0.3}" cy="${ballY - ballR * 0.25}" r="${ballR * 0.11}" fill="rgba(0,0,0,0.28)" />
  <circle cx="${ballX}" cy="${ballY + ballR * 0.35}" r="${ballR * 0.11}" fill="rgba(0,0,0,0.28)" />
</svg>`;
}

let count = 0;
for (const a of ARTICLES) {
  const outPath = path.join(OUT_DIR, `${a.slug}.svg`);
  if (fs.existsSync(outPath)) continue; // 既存記事の画像は上書きしない（差分を最小化）
  fs.writeFileSync(outPath, buildSvg(a.slug));
  count++;
}
console.log(`✅ article heroes generated: ${count} new / ${ARTICLES.length} total`);
