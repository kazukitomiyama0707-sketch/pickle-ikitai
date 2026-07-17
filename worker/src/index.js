/**
 * ピックルイキタイ API (Cloudflare Workers)
 *
 * - LINEログイン (OAuth 2.0 / OIDC)
 * - ピク活の投稿・取得・いいね (D1)
 * - 写真アップロード (R2)
 * - コート登録時の公式サイト画像取得 (サーバー側fetchでCORS回避)
 *
 * Secrets: LINE_CHANNEL_ID, LINE_CHANNEL_SECRET, JWT_SECRET
 * Bindings: DB (D1), PHOTOS (R2)
 */

const ALLOW_ORIGINS = ["https://pickleikitai.com", "https://www.pickleikitai.com", "http://localhost:4173", "http://127.0.0.1:4173"];

const cors = (origin) => ({
  "Access-Control-Allow-Origin": ALLOW_ORIGINS.includes(origin) ? origin : ALLOW_ORIGINS[0],
  "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type,Authorization",
  "Access-Control-Allow-Credentials": "true",
});

const json = (data, init = {}, origin = "") =>
  new Response(JSON.stringify(data), {
    ...init,
    headers: { "Content-Type": "application/json", ...cors(origin), ...(init.headers || {}) },
  });

const uuid = () => crypto.randomUUID();
const nowISO = () => new Date().toISOString();

// ラスター画像のみ許可（SVGはスクリプトを埋め込めるためStored XSSになる）
const SAFE_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const safeImageType = (t) => (SAFE_IMAGE_TYPES.has(String(t).split(";")[0].trim().toLowerCase()) ? String(t).split(";")[0].trim().toLowerCase() : null);

/**
 * ログイン後の戻り先URLを許可オリジンに限定する。
 * 未検証だと ?return=https://evil.example に飛ばされ、
 * URLフラグメントのJWTを盗まれてアカウントを乗っ取られる。
 */
function safeReturnUrl(raw) {
  if (!raw) return ALLOW_ORIGINS[0];
  try {
    const u = new URL(raw);
    if (!ALLOW_ORIGINS.includes(u.origin)) return null;
    return u.origin + u.pathname; // クエリ・フラグメントは捨てる
  } catch {
    return null;
  }
}

/**
 * ユーザー入力URLの取得先を検証する（SSRF対策）。
 * https限定＋内部アドレス（loopback/private/link-local/メタデータ）を拒否。
 */
// IPアドレス（文字列）が内部レンジかを判定。IPv4は10進正規化も行う。
function isPrivateIPv4(a, b) {
  if (a === 127 || a === 0 || a === 10) return true;               // loopback / this / private
  if (a === 172 && b >= 16 && b <= 31) return true;                 // private
  if (a === 192 && b === 168) return true;                          // private
  if (a === 169 && b === 254) return true;                          // link-local (169.254.169.254 等)
  if (a === 100 && b >= 64 && b <= 127) return true;                // CGNAT
  if (a >= 224) return true;                                        // multicast / reserved
  return false;
}
function ipv4FromInt(n) {
  return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
}
// 数値/8進/16進エンコードのIPv4も10進に正規化して判定
function classifyIPv4(host) {
  const dotted = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (dotted) return isPrivateIPv4(Number(dotted[1]), Number(dotted[2]));
  // 2130706433 や 0x7f000001 のような単一数値表記
  if (/^(0x[0-9a-f]+|0[0-7]*|\d+)$/i.test(host)) {
    let n;
    if (/^0x/i.test(host)) n = parseInt(host, 16);
    else if (/^0[0-7]+$/.test(host)) n = parseInt(host, 8);
    else n = Number(host);
    if (Number.isFinite(n) && n >= 0 && n <= 0xffffffff) {
      const [a, b] = ipv4FromInt(n);
      return isPrivateIPv4(a, b);
    }
    return true; // 解釈不能な数値ホストは拒否
  }
  return null; // IPv4ではない
}
function isBlockedIPv6(h) {
  const s = h.replace(/^\[|\]$/g, "").toLowerCase();
  if (s === "::1" || s === "::") return true;                       // loopback / unspecified
  if (/^(fc|fd|fe80|ff)/.test(s)) return true;                      // ULA / link-local / multicast
  // IPv4-mapped ( ::ffff:127.0.0.1 等 ) は末尾のv4を判定
  const mapped = /(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/.exec(s);
  if (mapped) return classifyIPv4(mapped[1]) === true;
  return false;
}
const PRIVATE_HOST = /^(localhost|.*\.local|.*\.internal|.*\.localhost)$/i;
// リテラルIPホスト名だけを見て内部判定（DNS解決前の一次フィルタ）
function literalHostBlocked(hostname) {
  const h = hostname.toLowerCase();
  if (PRIVATE_HOST.test(h)) return true;
  if (h.includes(":")) return isBlockedIPv6(h);
  const v4 = classifyIPv4(h);
  if (v4 !== null) return v4;
  return false; // ドメイン名 → DNS解決側で判定
}
// DNS-over-HTTPSで解決し、全A/AAAAが公開レンジであることを確認（DNS rebinding対策）
async function dnsResolvedSafe(hostname) {
  const h = hostname.toLowerCase();
  if (literalHostBlocked(h)) return false;
  if (h.includes(":") || classifyIPv4(h) !== null) return true; // リテラルIPは通過済み
  for (const type of ["A", "AAAA"]) {
    try {
      const r = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(h)}&type=${type}`, {
        headers: { Accept: "application/dns-json" },
      });
      if (!r.ok) continue;
      const data = await r.json();
      for (const ans of data.Answer || []) {
        if (ans.type === 1 && classifyIPv4(ans.data) === true) return false;   // A
        if (ans.type === 28 && isBlockedIPv6(ans.data)) return false;          // AAAA
      }
    } catch {
      return false; // 解決不能は安全側に倒す
    }
  }
  return true;
}
async function safeFetchImageOrPage(target) {
  let u;
  try { u = new URL(target); } catch { return null; }
  if (u.protocol !== "https:") return null;               // httpsのみ
  if (!(await dnsResolvedSafe(u.hostname))) return null;   // 解決先IPが内部なら拒否
  // リダイレクトは手動で追い、各ホップを同じ基準で（再解決して）検証する
  let current = u.toString();
  for (let i = 0; i < 3; i++) {
    const res = await fetch(current, {
      redirect: "manual",
      headers: { "User-Agent": "Mozilla/5.0 (compatible; PickleIkitaiBot/1.0)" },
    });
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("Location");
      if (!loc) return null;
      const next = new URL(loc, current);
      if (next.protocol !== "https:" || !(await dnsResolvedSafe(next.hostname))) return null;
      current = next.toString();
      continue;
    }
    return res.ok ? res : null;
  }
  return null;
}

/* ---------------- JWT (HS256) ---------------- */
const b64url = (buf) =>
  btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const b64urlDecode = (s) => {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  return atob(s + "=".repeat((4 - (s.length % 4)) % 4));
};

async function signJWT(payload, secret) {
  const header = { alg: "HS256", typ: "JWT" };
  const enc = new TextEncoder();
  const body = `${b64url(enc.encode(JSON.stringify(header)))}.${b64url(enc.encode(JSON.stringify(payload)))}`;
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(body));
  return `${body}.${b64url(sig)}`;
}

async function verifyJWT(token, secret) {
  try {
    const [h, p, s] = token.split(".");
    if (!h || !p || !s) return null;
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
    const sigBytes = Uint8Array.from(b64urlDecode(s), (c) => c.charCodeAt(0));
    const ok = await crypto.subtle.verify("HMAC", key, sigBytes, enc.encode(`${h}.${p}`));
    if (!ok) return null;
    const payload = JSON.parse(b64urlDecode(p));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

async function currentUser(request, env) {
  const auth = request.headers.get("Authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return null;
  const payload = await verifyJWT(token, env.JWT_SECRET);
  if (!payload?.sub) return null;
  return await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(payload.sub).first();
}

// ユーザー行 → クライアントに返すプロフィール
function profileOf(u, origin) {
  return {
    id: u.id,
    name: u.name,
    bio: u.bio || "",
    avatar: u.avatar_key ? `${origin}/photos/${u.avatar_key}` : (u.avatar_url || null),
    links: { x: u.link_x || "", instagram: u.link_instagram || "", tiktok: u.link_tiktok || "", web: u.link_web || "" },
  };
}

/* ---------------- 入力ガード ---------------- */
const sanitize = (s = "", max = 140) => String(s).replace(/[<>]/g, "").slice(0, max);
const hasNG = (s = "") => /(https?:\/\/|www\.)/i.test(s) || /\d{2,4}-\d{2,4}-\d{3,4}/.test(s) || /\d{10,11}/.test(s);

/* ---------------- ルーティング ---------------- */
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";
    const path = url.pathname;

    if (request.method === "OPTIONS") return new Response(null, { headers: cors(origin) });

    try {
      /* --- LINEログイン開始 --- */
      if (path === "/auth/line/start") {
        const state = uuid();
        const redirect = `${url.origin}/auth/line/callback`;
        const authUrl = new URL("https://access.line.me/oauth2/v2.1/authorize");
        authUrl.searchParams.set("response_type", "code");
        authUrl.searchParams.set("client_id", env.LINE_CHANNEL_ID);
        authUrl.searchParams.set("redirect_uri", redirect);
        authUrl.searchParams.set("state", state);
        authUrl.searchParams.set("scope", "profile openid");
        // 戻り先はオリジンを許可リストで検証する。
        // 未検証のURLに飛ばすとJWTが#token=で第三者に渡り、アカウント乗っ取りになる。
        const back = safeReturnUrl(url.searchParams.get("return"));
        if (!back) return new Response("戻り先URLが不正です", { status: 400 });
        return new Response(null, {
          status: 302,
          headers: {
            Location: authUrl.toString(),
            "Set-Cookie": `line_state=${state}|${encodeURIComponent(back)}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=600`,
          },
        });
      }

      /* --- LINEログイン コールバック --- */
      if (path === "/auth/line/callback") {
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        const cookie = request.headers.get("Cookie") || "";
        const saved = /line_state=([^;]+)/.exec(cookie)?.[1] || "";
        const [savedState, backEnc] = saved.split("|");
        if (!code || !state || state !== savedState) return new Response("認証に失敗しました（state不一致）", { status: 400 });
        // Cookieが差し替えられた場合に備え、戻り先はここでも検証する
        const back = safeReturnUrl(backEnc ? decodeURIComponent(backEnc) : null);
        if (!back) return new Response("戻り先URLが不正です", { status: 400 });

        const tokenRes = await fetch("https://api.line.me/oauth2/v2.1/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            grant_type: "authorization_code",
            code,
            redirect_uri: `${url.origin}/auth/line/callback`,
            client_id: env.LINE_CHANNEL_ID,
            client_secret: env.LINE_CHANNEL_SECRET,
          }),
        });
        if (!tokenRes.ok) return new Response("LINEトークン取得に失敗しました", { status: 502 });
        const tok = await tokenRes.json();

        const profRes = await fetch("https://api.line.me/v2/profile", {
          headers: { Authorization: `Bearer ${tok.access_token}` },
        });
        if (!profRes.ok) return new Response("LINEプロフィール取得に失敗しました", { status: 502 });
        const prof = await profRes.json();

        let user = await env.DB.prepare("SELECT * FROM users WHERE line_user_id = ?").bind(prof.userId).first();
        if (!user) {
          const id = uuid();
          await env.DB.prepare("INSERT INTO users (id, line_user_id, name, avatar_url, created_at) VALUES (?, ?, ?, ?, ?)")
            .bind(id, prof.userId, sanitize(prof.displayName || "ピックラー", 20), prof.pictureUrl || null, nowISO())
            .run();
          user = { id, name: prof.displayName, avatar_url: prof.pictureUrl };
        }

        const jwt = await signJWT({ sub: user.id, exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 90 }, env.JWT_SECRET);
        const dest = new URL(back);
        dest.hash = `token=${jwt}`;
        return new Response(null, {
          status: 302,
          headers: { Location: dest.toString(), "Set-Cookie": "line_state=; Max-Age=0; Path=/" },
        });
      }

      /* --- 自分の情報 --- */
      if (path === "/api/me") {
        const user = await currentUser(request, env);
        if (!user) return json({ user: null }, {}, origin);
        return json({ user: profileOf(user, url.origin) }, {}, origin);
      }

      /* --- プロフィール更新（名前・自己紹介・SNSリンク・アバター） --- */
      if (path === "/api/profile" && request.method === "POST") {
        const user = await currentUser(request, env);
        if (!user) return json({ error: "ログインが必要です" }, { status: 401 }, origin);
        const form = await request.formData();
        const name = sanitize(form.get("name") || user.name, 20).trim() || user.name;
        const bio = sanitize(form.get("bio") || "", 160);
        const norm = (v) => { const s = sanitize(v || "", 200).trim(); return s && /^https?:\/\//i.test(s) ? s : (s ? "https://" + s.replace(/^\/+/, "") : ""); };
        const link_x = norm(form.get("link_x"));
        const link_instagram = norm(form.get("link_instagram"));
        const link_tiktok = norm(form.get("link_tiktok"));
        const link_web = norm(form.get("link_web"));

        let avatarKey = user.avatar_key || null;
        const avatar = form.get("avatar");
        if (env.PHOTOS && avatar && typeof avatar !== "string" && avatar.size > 0) {
          if (avatar.size > 6 * 1024 * 1024) return json({ error: "画像は6MBまでです" }, { status: 400 }, origin);
          const ct = safeImageType(avatar.type);
          if (!ct) return json({ error: "対応形式はJPEG/PNG/WebP/GIFです" }, { status: 400 }, origin);
          avatarKey = `avatar/${uuid()}`;
          await env.PHOTOS.put(avatarKey, avatar.stream(), { httpMetadata: { contentType: ct } });
        }

        await env.DB.prepare(
          `UPDATE users SET name=?, bio=?, link_x=?, link_instagram=?, link_tiktok=?, link_web=?, avatar_key=? WHERE id=?`
        ).bind(name, bio, link_x, link_instagram, link_tiktok, link_web, avatarKey, user.id).run();
        const fresh = await env.DB.prepare("SELECT * FROM users WHERE id=?").bind(user.id).first();
        return json({ user: profileOf(fresh, url.origin) }, {}, origin);
      }

      /* --- ピク活一覧 --- */
      if (path === "/api/pikkatsu" && request.method === "GET") {
        const facilityId = url.searchParams.get("facilityId");
        const limit = Math.min(parseInt(url.searchParams.get("limit") || "50", 10), 100);
        const q = facilityId
          ? env.DB.prepare(
              `SELECT p.*, u.name AS nickname, u.avatar_url FROM pikkatsu p JOIN users u ON u.id = p.user_id
               WHERE p.facility_id = ? ORDER BY p.played_at DESC, p.created_at DESC LIMIT ?`
            ).bind(facilityId, limit)
          : env.DB.prepare(
              `SELECT p.*, u.name AS nickname, u.avatar_url FROM pikkatsu p JOIN users u ON u.id = p.user_id
               ORDER BY p.played_at DESC, p.created_at DESC LIMIT ?`
            ).bind(limit);
        const { results } = await q.all();
        const items = results.map((r) => ({
          id: r.id,
          facilityId: r.facility_id,
          playedAt: r.played_at,
          timeBand: r.time_band,
          partySize: r.party_size,
          crowd: r.crowd,
          courtCondition: r.court_condition || "",
          comment: r.comment || "",
          nickname: r.nickname,
          photo: r.photo_key ? `${url.origin}/photos/${r.photo_key}` : "",
          likes: r.likes,
        }));
        return json({ items }, {}, origin);
      }

      /* --- ピク活投稿（要ログイン） --- */
      if (path === "/api/pikkatsu" && request.method === "POST") {
        const user = await currentUser(request, env);
        if (!user) return json({ error: "ログインが必要です" }, { status: 401 }, origin);

        const form = await request.formData();
        const facilityId = String(form.get("facilityId") || "");
        const playedAt = String(form.get("playedAt") || "");
        const timeBand = String(form.get("timeBand") || "");
        if (!facilityId || !playedAt || !timeBand) return json({ error: "日付と時間帯は必須です" }, { status: 400 }, origin);

        const comment = sanitize(form.get("comment") || "");
        if (comment && hasNG(comment)) return json({ error: "コメントに電話番号・URLは含められません" }, { status: 400 }, origin);

        // 1日3件までの連投制限
        const { count } = await env.DB.prepare(
          "SELECT COUNT(*) AS count FROM pikkatsu WHERE user_id = ? AND facility_id = ? AND date(created_at) = date('now')"
        ).bind(user.id, facilityId).first();
        if (count >= 3) return json({ error: "同じコートへの投稿は1日3件までです" }, { status: 429 }, origin);

        // 写真をR2へ
        let photoKey = null;
        const photo = form.get("photo");
        if (env.PHOTOS && photo && typeof photo !== "string" && photo.size > 0) {
          if (photo.size > 8 * 1024 * 1024) return json({ error: "画像は8MBまでです" }, { status: 400 }, origin);
          const ct = safeImageType(photo.type);
          if (!ct) return json({ error: "対応形式はJPEG/PNG/WebP/GIFです" }, { status: 400 }, origin);
          photoKey = `pik/${uuid()}`;
          await env.PHOTOS.put(photoKey, photo.stream(), { httpMetadata: { contentType: ct } });
        }

        const id = uuid();
        await env.DB.prepare(
          `INSERT INTO pikkatsu (id, user_id, facility_id, played_at, time_band, party_size, crowd, court_condition, comment, photo_key, likes, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`
        ).bind(
          id, user.id, facilityId, playedAt, timeBand,
          parseInt(form.get("partySize") || "4", 10),
          parseInt(form.get("crowd") || "2", 10),
          sanitize(form.get("courtCondition") || "", 30),
          comment, photoKey, nowISO()
        ).run();

        return json({
          item: {
            id, facilityId, playedAt, timeBand,
            partySize: parseInt(form.get("partySize") || "4", 10),
            crowd: parseInt(form.get("crowd") || "2", 10),
            courtCondition: sanitize(form.get("courtCondition") || "", 30),
            comment, nickname: user.name,
            photo: photoKey ? `${url.origin}/photos/${photoKey}` : "",
            likes: 0,
          },
        }, {}, origin);
      }

      /* --- いいね（1ユーザー1回） --- */
      if (path.startsWith("/api/pikkatsu/") && path.endsWith("/like") && request.method === "POST") {
        const user = await currentUser(request, env);
        if (!user) return json({ error: "ログインが必要です" }, { status: 401 }, origin);
        const pid = path.split("/")[3];
        const dup = await env.DB.prepare("SELECT 1 FROM likes WHERE pikkatsu_id = ? AND user_id = ?").bind(pid, user.id).first();
        if (dup) return json({ error: "すでに応援済みです" }, { status: 409 }, origin);
        await env.DB.batch([
          env.DB.prepare("INSERT INTO likes (pikkatsu_id, user_id, created_at) VALUES (?, ?, ?)").bind(pid, user.id, nowISO()),
          env.DB.prepare("UPDATE pikkatsu SET likes = likes + 1 WHERE id = ?").bind(pid),
        ]);
        const row = await env.DB.prepare("SELECT likes FROM pikkatsu WHERE id = ?").bind(pid).first();
        return json({ likes: row?.likes ?? 0 }, {}, origin);
      }

      /* --- 写真配信 --- */
      if (path.startsWith("/photos/")) {
        if (!env.PHOTOS) return new Response("Not found", { status: 404 });
        const key = path.slice("/photos/".length);
        const obj = await env.PHOTOS.get(key);
        if (!obj) return new Response("Not found", { status: 404 });
        // 保存済みタイプがallowlistに無ければ octet-stream に落とす。スクリプト実行を防ぐガードを付与。
        const stored = safeImageType(obj.httpMetadata?.contentType || "") || "application/octet-stream";
        return new Response(obj.body, {
          headers: {
            "Content-Type": stored,
            "X-Content-Type-Options": "nosniff",
            "Content-Security-Policy": "default-src 'none'; sandbox",
            "Cache-Control": "public, max-age=31536000, immutable",
            ...cors(origin),
          },
        });
      }

      /* --- コート登録: 公式サイトのog:imageを取得（CORS回避はサーバー側で） --- */
      if (path === "/api/fetch-og-image" && request.method === "POST") {
        const user = await currentUser(request, env);
        if (!user) return json({ error: "ログインが必要です" }, { status: 401 }, origin);
        if (!env.PHOTOS) return json({ photo: null }, {}, origin); // 写真保存はR2有効化後
        const { url: target } = await request.json();
        // https限定＋内部アドレス拒否＋リダイレクト再検証（SSRF対策）
        const res = await safeFetchImageOrPage(target);
        if (!res) return json({ error: "このURLからは取得できません" }, { status: 400 }, origin);
        const html = await res.text();
        const og = /<meta[^>]+property=["']og:image["'][^>]*content=["']([^"']+)["']/i.exec(html)
          || /<meta[^>]+content=["']([^"']+)["'][^>]*property=["']og:image["']/i.exec(html);
        if (!og) return json({ photo: null }, {}, origin);

        // 画像URLも同じ基準で再検証してから取得する
        const imgUrl = new URL(og[1], res.url || target).toString();
        const imgRes = await safeFetchImageOrPage(imgUrl);
        const ctype = imgRes && safeImageType(imgRes.headers.get("content-type") || "");
        if (!imgRes || !ctype) return json({ photo: null }, {}, origin);
        // レスポンスサイズを上限で打ち切る（10MB）
        const buf = await imgRes.arrayBuffer();
        if (buf.byteLength > 10 * 1024 * 1024) return json({ error: "画像が大きすぎます" }, { status: 400 }, origin);
        const key = `court/${uuid()}`;
        await env.PHOTOS.put(key, buf, { httpMetadata: { contentType: ctype } });
        return json({ photo: `${url.origin}/photos/${key}` }, {}, origin);
      }

      return json({ error: "Not found" }, { status: 404 }, origin);
    } catch (err) {
      console.error(err);
      return json({ error: "サーバーエラーが発生しました" }, { status: 500 }, origin);
    }
  },
};
