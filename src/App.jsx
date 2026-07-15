import React, { useState, useMemo, useRef } from "react";

/* ============================================================
   ピックルイキタイ MVP v7 — ワンページ版
   ヒーロー → とは？ → 空き枠 → コート一覧 → イベント → コート登録
   ナビはアンカースクロール。全部1ページで完結。レスポンシブ。
   ============================================================ */

const T = {
  bg: "#F4F7F2",
  ink: "#0E2A2B",
  court: "#166E73",
  courtDeep: "#0C4A4E",
  hero1: "#0A3E44",
  hero2: "#12666E",
  ball: "#D7F438",
  ballInk: "#3A4A00",
  line: "#E2E9E0",
  full: "#C6CFC9",
  warn: "#E4572E",
  white: "#FFFFFF",
};
const FONT = `-apple-system, BlinkMacSystemFont, "Hiragino Sans", "Noto Sans JP", sans-serif`;

const HOME = { lat: 35.6506, lng: 139.6852 };
const dist = (a, b) => {
  const R = 6371, dLat = ((b.lat - a.lat) * Math.PI) / 180, dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
};
const gmaps = (name) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name)}`;

const DOW = ["日", "月", "火", "水", "木", "金", "土"];
const HORIZON = 90;
const ALL_DAYS = (() => {
  const arr = [];
  const base = new Date();
  base.setHours(0, 0, 0, 0);
  for (let i = 0; i < HORIZON; i++) {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    const m = d.getMonth() + 1, dd = d.getDate(), w = d.getDay();
    arr.push({ idx: i, key: `${d.getFullYear()}${String(m).padStart(2, "0")}${String(dd).padStart(2, "0")}`, month: m, label: String(dd), dow: DOW[w], isSat: w === 6, isSun: w === 0, full: `${m}/${dd}(${DOW[w]})`, offset: i });
  }
  return arr;
})();
const MONTHS = [...new Set(ALL_DAYS.map((d) => d.month))].map((m) => ({ m, firstIdx: ALL_DAYS.find((d) => d.month === m).idx }));

const BANDS = [
  { key: "09", label: "9-11" },
  { key: "11", label: "11-13" },
  { key: "13", label: "13-15" },
  { key: "15", label: "15-17" },
  { key: "18", label: "18-20" },
  { key: "20", label: "20-22" },
];

const SEED_FACILITIES = [
  { id: "pickle9", name: "pickle9 南青山", area: "港区", lat: 35.667, lng: 139.7173, indoor: true, live: true, cat: "dedicated", priceNum: 8800, price: "¥8,800/h〜", rating: "★5.0 (54)", url: "https://www.pickle9.jp/", note: "インドア専用・表参道駅5分・都内最高評価" },
  { id: "one", name: "ピックルボールワン銀座新橋", area: "中央区", lat: 35.6694, lng: 139.7578, indoor: true, live: true, cat: "dedicated", priceNum: 6600, price: "¥6,600/h〜", rating: "★4.8 (104)", url: "https://ginza.pickle-one.com/", note: "都心1.5面・ショップ併設・日曜朝ドロップイン" },
  { id: "pacific", name: "Pacific PICKLE CLUB 有明", area: "江東区", lat: 35.6402, lng: 139.7873, indoor: false, live: true, cat: "dedicated", priceNum: 7700, price: "¥7,700/h〜", rating: "★3.8 (22)", url: "https://pacificpickleclub.com/", note: "有明アーバンスポーツパーク内2面・飲食併設" },
  { id: "sansan", name: "Sansanピックルボール 池袋", area: "豊島区", lat: 35.7282, lng: 139.7189, indoor: true, live: true, cat: "dedicated", priceNum: 6000, price: "¥6,000/h〜", rating: "★5.0 (2)", url: "https://sansan-pickleball.com/", note: "東池袋・サンソウゴビル・新規オープン" },
  { id: "shiomi", name: "SENKO塩見テニスセンター", area: "江東区", lat: 35.6579, lng: 139.8198, indoor: false, live: true, cat: "conv", priceNum: 4400, price: "¥4,400/h〜", rating: "テニス転用", url: "https://reserve.tennisbear.net/", note: "テニスコートにテープで仮設・TennisBear予約" },
  { id: "shibuya-pc", name: "shibuya pickleball club", area: "渋谷区", lat: 35.6632, lng: 139.6991, indoor: true, live: true, cat: "dedicated", priceNum: 5500, price: "¥5,500/h〜", rating: "新規", url: "https://shibuya-rental.space/", note: "宇田川町・レンタルスペース型" },
  { id: "seibu", name: "SEIBU FAST SPORTS FIELD 品川", area: "港区", lat: 35.6276, lng: 139.7367, indoor: true, live: false, cat: "dedicated", priceNum: 7000, price: "要問合せ", rating: "★4.3 (6)", url: gmaps("SEIBU FAST SPORTS FIELD 品川 ピックルボール"), note: "品川プリンスホテル10F・ゴルフ併設のインドアコート" },
  { id: "tebura", name: "手ぶらでピックルボール 有明店", area: "江東区", lat: 35.6351, lng: 139.7847, indoor: true, live: false, cat: "dedicated", priceNum: 3300, price: "低価格帯※", rating: "★4.7 (3)", url: gmaps("手ぶらでピックルボール有明店"), note: "器材レンタル込・平日は当日予約可の声あり", cheap: true },
  { id: "tower", name: "Tokyo Tower Pickleball", area: "港区", lat: 35.6578, lng: 139.7449, indoor: false, live: false, cat: "dedicated", priceNum: 9999, price: "要問合せ", rating: "屋上コート", url: gmaps("Tokyo Tower Pickleball Friendship"), note: "東京タワー真下のルーフトップ・Instagram予約" },
  { id: "ariake-park", name: "有明親水海浜公園コート", area: "江東区", lat: 35.6402, lng: 139.7866, indoor: false, live: false, cat: "public", priceNum: 2000, price: "公園料金※", rating: "公共", url: gmaps("有明親水海浜公園 ピックルボール"), note: "屋外ハード2面・ナイター照明・公園内コート", cheap: true },
  { id: "shibuya-sc", name: "渋谷区スポーツセンター", area: "渋谷区", lat: 35.6756, lng: 139.6813, indoor: true, live: false, cat: "public", priceNum: 300, price: "¥300〜※", rating: "★4.0 (729)", url: gmaps("渋谷区スポーツセンター"), note: "ユーザー報告「渋谷の公共施設でプレーできた」・体育室の個人利用ルールは公式で確認を", cheap: true, unverified: true },
  { id: "cosmic", name: "新宿コズミックセンター", area: "新宿区", lat: 35.705, lng: 139.7081, indoor: true, live: false, cat: "public", priceNum: 400, price: "区施設料金※", rating: "公共体育館", url: gmaps("新宿コズミックセンター"), note: "バドコート転用の可否は公式で確認を（区民優先・抽選あり）", cheap: true, unverified: true },
  { id: "nakano", name: "中野区南部スポーツ・コミュニティプラザ", area: "中野区", lat: 35.6881, lng: 139.6687, indoor: true, live: false, cat: "public", priceNum: 200, price: "¥200/2h〜※", rating: "★4.0 (227)", url: gmaps("中野区南部スポーツコミュニティプラザ"), note: "小学校跡地の格安体育館・ピックル可否は公式で確認を", cheap: true, unverified: true },
  { id: "omori", name: "大森スポーツセンター", area: "大田区", lat: 35.5809, lng: 139.7374, indoor: true, live: false, cat: "public", priceNum: 500, price: "¥500/室※", rating: "★3.9 (115)", url: gmaps("大森スポーツセンター"), note: "22時まで・大部屋貸切の実績あり・ピックル可否は公式で確認を", cheap: true, unverified: true },
  { id: "katsushika", name: "Well Racket Club（葛飾）", area: "葛飾区", lat: 35.7909, lng: 139.8527, indoor: false, live: false, cat: "conv", priceNum: 3500, price: "要問合せ", rating: "★4.1 (37)", url: gmaps("Well Racket Club 葛飾"), note: "テニスクラブ・ピックル体験会/レッスンの口コミ多数" },
  { id: "kawagoe", name: "ピックルボールスクール 川越", area: "埼玉県", lat: 35.9117, lng: 139.3883, indoor: false, live: false, cat: "trip", priceNum: 3000, price: "要問合せ", rating: "★5.0 (1)", url: gmaps("ピックルボールスクール 川越 笠幡"), note: "夜22:30まで・遠征組に人気。車なら関越で1本", cheap: true },
];

const EVENTS = [
  { id: "mainichi", name: "毎日ピックル（調布）", when: "毎週日曜 10:00-12:00", area: "調布市", price: "¥1,500/人", note: "初心者歓迎の交流会。1人参加OK", url: "https://pickle-peak.com/" },
  { id: "one-dropin", name: "ピックルワン銀座 Sunday Drop-in", when: "毎週日曜 6:00-9:00", area: "中央区", price: "¥2,000/人", note: "早朝オープンプレー", url: "https://ginza.pickle-one.com/" },
];

const CATS = [
  { key: "all", label: "すべて" },
  { key: "dedicated", label: "専用コート" },
  { key: "public", label: "公共・格安" },
  { key: "conv", label: "テニス転用" },
  { key: "trip", label: "遠征OK" },
];

const AREA_COORDS = {
  "港区": { lat: 35.658, lng: 139.745 }, "中央区": { lat: 35.67, lng: 139.772 }, "江東区": { lat: 35.65, lng: 139.8 },
  "豊島区": { lat: 35.73, lng: 139.715 }, "渋谷区": { lat: 35.66, lng: 139.7 }, "新宿区": { lat: 35.7, lng: 139.71 },
  "世田谷区": { lat: 35.646, lng: 139.653 }, "目黒区": { lat: 35.63, lng: 139.69 }, "品川区": { lat: 35.61, lng: 139.73 },
  "中野区": { lat: 35.69, lng: 139.66 }, "大田区": { lat: 35.58, lng: 139.72 }, "葛飾区": { lat: 35.75, lng: 139.85 },
  "埼玉県": { lat: 35.9, lng: 139.55 }, "神奈川県": { lat: 35.45, lng: 139.55 }, "千葉県": { lat: 35.6, lng: 140.1 }, "その他": { lat: 35.68, lng: 139.75 },
};

function slotStatusFor(fac, dayKey, bandKey) {
  if (!fac.live) return "portal";
  let h = 0;
  const s = fac.id + dayKey + bandKey;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h % 10 < 4 ? "open" : "full";
}
const freshness = (offset) => (offset <= 7 ? "15分毎更新" : offset <= 30 ? "1時間毎更新" : "1日1回更新");

const Ball = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden style={{ display: "inline-block", verticalAlign: "baseline" }}>
    <circle cx="10" cy="10" r="9" fill={T.ball} stroke={T.ballInk} strokeWidth="1" />
    <circle cx="7" cy="7" r="1.3" fill={T.ballInk} />
    <circle cx="13" cy="7" r="1.3" fill={T.ballInk} />
    <circle cx="10" cy="12" r="1.3" fill={T.ballInk} />
    <circle cx="6" cy="12.5" r="1.1" fill={T.ballInk} />
    <circle cx="14" cy="12.5" r="1.1" fill={T.ballInk} />
  </svg>
);

const BallGuy = ({ size = 46, flip = false, mood = "happy" }) => (
  <svg width={size} height={size * 1.25} viewBox="0 0 40 50" aria-hidden style={{ transform: flip ? "scaleX(-1)" : "none" }}>
    <circle cx="20" cy="20" r="16" fill={T.ball} stroke={T.ballInk} strokeWidth="1.6" />
    <circle cx="13" cy="12" r="2" fill={T.ballInk} opacity="0.35" />
    <circle cx="27" cy="12" r="2" fill={T.ballInk} opacity="0.35" />
    <circle cx="20" cy="8" r="2" fill={T.ballInk} opacity="0.35" />
    <circle cx="14" cy="21" r="2.2" fill={T.ballInk} />
    <circle cx="26" cy="21" r="2.2" fill={T.ballInk} />
    {mood === "happy" ? (
      <path d="M14 27 Q20 32 26 27" stroke={T.ballInk} strokeWidth="2" fill="none" strokeLinecap="round" />
    ) : (
      <circle cx="20" cy="28" r="2.4" fill={T.ballInk} />
    )}
    <line x1="14" y1="37" x2="12" y2="46" stroke={T.ballInk} strokeWidth="2.4" strokeLinecap="round" />
    <line x1="26" y1="37" x2="28" y2="46" stroke={T.ballInk} strokeWidth="2.4" strokeLinecap="round" />
  </svg>
);

const Logo = ({ big = false }) => (
  <div style={{ textAlign: "center", transform: "rotate(-5deg)", userSelect: "none" }}>
    <div className={big ? "logoLineBig" : ""} style={{ fontWeight: 900, color: "#fff", lineHeight: 1.02, fontStyle: "italic", textShadow: "0 3px 0 rgba(0,0,0,0.18)" }}>
      ピックル
    </div>
    <div className={big ? "logoLineBig" : ""} style={{ fontWeight: 900, color: "#fff", lineHeight: 1.02, fontStyle: "italic", textShadow: "0 3px 0 rgba(0,0,0,0.18)", display: "flex", alignItems: "center", justifyContent: "center", gap: big ? 10 : 4 }}>
      イキタイ
      <span style={{ transform: "rotate(12deg)", display: "inline-flex" }}>
        <Ball size={big ? 44 : 18} />
      </span>
    </div>
    {big && (
      <div style={{ color: "#fff", fontWeight: 700, letterSpacing: "0.42em", fontSize: "clamp(10px, 1.6vw, 14px)", marginTop: 14, opacity: 0.9 }}>
        PICKLE IKITAI
      </div>
    )}
  </div>
);

const CourtPattern = () => (
  <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.1 }} preserveAspectRatio="xMidYMid slice" viewBox="0 0 800 600" aria-hidden>
    <g stroke={T.ball} strokeWidth="3" fill="none" transform="rotate(-8 400 300)">
      <rect x="120" y="60" width="560" height="480" rx="4" />
      <line x1="120" y1="300" x2="680" y2="300" />
      <line x1="120" y1="180" x2="680" y2="180" />
      <line x1="120" y1="420" x2="680" y2="420" />
      <line x1="400" y1="60" x2="400" y2="180" />
      <line x1="400" y1="420" x2="400" y2="540" />
    </g>
  </svg>
);

export default function PickleIkitai() {
  const [winStart, setWinStart] = useState(0);
  const [dayIdx, setDayIdx] = useState(0);
  const [areaFilter, setAreaFilter] = useState("all");
  const [catFilter, setCatFilter] = useState("all");
  const [sortKey, setSortKey] = useState("dist");
  const [sheet, setSheet] = useState(null);
  const [detail, setDetail] = useState(null);
  const [toast, setToast] = useState(null);
  const [clicks, setClicks] = useState(0);
  const [userFacs, setUserFacs] = useState([]);
  const [query, setQuery] = useState("");
  const [form, setForm] = useState({ name: "", area: "港区", cat: "public", indoor: "indoor", price: "", note: "", url: "" });
  const timers = useRef([]);
  const idRef = useRef(1);

  // セクション参照（アンカースクロール用）
  const refAbout = useRef(null);
  const refSlots = useRef(null);
  const refList = useRef(null);
  const refEvents = useRef(null);
  const refAdd = useRef(null);
  const scrollTo = (r) => r.current?.scrollIntoView({ behavior: "smooth", block: "start" });

  const ALL_FACS = useMemo(() => [...SEED_FACILITIES, ...userFacs], [userFacs]);
  const areas = ["all", ...new Set(ALL_FACS.filter((f) => f.cat !== "trip").map((f) => f.area))];
  const visibleFacs = ALL_FACS.filter((f) => areaFilter === "all" || f.area === areaFilter);

  const windowDays = ALL_DAYS.slice(winStart, winStart + 3);
  const selDay = ALL_DAYS[dayIdx] || ALL_DAYS[0];
  const curMonth = windowDays[0]?.month;

  const moveWindow = (dir) => {
    const next = Math.min(Math.max(winStart + dir * 3, 0), HORIZON - 3);
    setWinStart(next);
    setDayIdx(next);
  };
  const jumpTo = (idx) => {
    const start = Math.min(Math.max(idx, 0), HORIZON - 3);
    setWinStart(start);
    setDayIdx(start);
  };

  const grid = useMemo(() => {
    const g = {};
    for (const b of BANDS) {
      let open = 0, portal = 0;
      for (const f of visibleFacs) {
        const st = slotStatusFor(f, selDay.key, b.key);
        if (st === "open") open++;
        if (st === "portal") portal++;
      }
      g[b.key] = { open, portal };
    }
    return g;
  }, [areaFilter, userFacs, dayIdx]);

  const listFacs = useMemo(() => {
    let arr = ALL_FACS.filter((f) => catFilter === "all" || f.cat === catFilter).map((f) => ({ ...f, km: dist(HOME, f) }));
    arr.sort((a, b) => (sortKey === "price" ? a.priceNum - b.priceNum : a.km - b.km));
    return arr;
  }, [catFilter, sortKey, userFacs]);

  const showToast = (msg) => {
    setToast(msg);
    timers.current.push(setTimeout(() => setToast(null), 3200));
  };

  const outbound = (fac) => {
    setClicks((c) => c + 1);
    if (fac.url) window.open(fac.url, "_blank");
  };

  const doSearch = () => {
    const q = query.trim();
    const matchedArea = Object.keys(AREA_COORDS).find((a) => q && a.includes(q.replace(/区|県/g, "")) && q.length >= 2);
    if (matchedArea && areas.includes(matchedArea)) setAreaFilter(matchedArea);
    scrollTo(refSlots);
  };

  const submitCourt = () => {
    if (!form.name.trim()) {
      showToast("コート名を入力してください");
      return;
    }
    const coords = AREA_COORDS[form.area] || AREA_COORDS["その他"];
    const priceNum = parseInt(form.price.replace(/[^0-9]/g, ""), 10);
    const newFac = {
      id: "user" + idRef.current++,
      name: form.name.trim(),
      area: form.area,
      lat: coords.lat, lng: coords.lng,
      indoor: form.indoor === "indoor",
      live: false,
      cat: form.cat,
      priceNum: isNaN(priceNum) ? 9998 : priceNum,
      price: form.price.trim() ? form.price.trim() + "※" : "要問合せ",
      rating: "ユーザー投稿",
      note: form.note.trim() || "みんなの投稿情報",
      url: form.url.trim() || gmaps(form.name.trim() + " ピックルボール"),
      userSubmitted: true,
      cheap: !isNaN(priceNum) && priceNum <= 3000,
    };
    setUserFacs((u) => [newFac, ...u]);
    setForm({ name: "", area: "港区", cat: "public", indoor: "indoor", price: "", note: "", url: "" });
    setCatFilter("all");
    showToast(`「${newFac.name}」を追加しました！`);
    scrollTo(refList);
  };

  const S = {
    chip: (on) => ({ flexShrink: 0, padding: "7px 14px", borderRadius: 999, fontSize: 13, fontWeight: 700, border: `1.5px solid ${on ? T.court : T.line}`, background: on ? T.court : T.white, color: on ? T.white : T.ink }),
    monthChip: (on) => ({ flexShrink: 0, padding: "6px 14px", borderRadius: 999, fontSize: 12, fontWeight: 800, border: "none", background: on ? T.ink : "#E8EDE7", color: on ? T.white : "#5E716C" }),
    navBtn: (disabled) => ({ width: 44, padding: "12px 0", borderRadius: 14, border: "none", background: T.white, color: disabled ? "#C9D3CE" : T.ink, fontWeight: 900, fontSize: 16, boxShadow: `inset 0 0 0 1.5px ${T.line}` }),
    dayBtn: (on, d) => ({ flex: 1, padding: "9px 0", borderRadius: 14, border: "none", background: on ? T.ball : T.white, color: on ? T.ballInk : d.isSun ? "#C0392B" : d.isSat ? "#2E6BA8" : T.ink, fontWeight: 800, fontSize: 15, boxShadow: on ? "none" : `inset 0 0 0 1.5px ${T.line}` }),
    row: { display: "flex", borderTop: `1px solid ${T.line}` },
    bandLabel: { width: 64, padding: "16px 0", textAlign: "center", fontSize: 13, fontWeight: 800, color: T.court, background: "#EFF5EE" },
    cell: { flex: 1, padding: "12px 6px", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, border: "none", background: "transparent", cursor: "pointer" },
    openBadge: { display: "flex", alignItems: "center", gap: 5, fontWeight: 900, fontSize: 16 },
    portalBadge: { fontSize: 11, fontWeight: 700, color: "#5E716C", border: `1.5px dashed #B8C4BF`, borderRadius: 8, padding: "1px 7px" },
    fullTxt: { fontSize: 13, color: T.full, fontWeight: 700 },
    sheetBack: { position: "fixed", inset: 0, background: "rgba(14,42,43,0.45)", zIndex: 40 },
    sheet: { position: "fixed", left: 0, right: 0, bottom: 0, maxWidth: 520, margin: "0 auto", background: T.white, borderRadius: "22px 22px 0 0", zIndex: 50, padding: "10px 16px 28px", maxHeight: "78vh", overflowY: "auto" },
    facCard: { border: `1.5px solid ${T.line}`, borderRadius: 16, padding: 14, background: T.white, textAlign: "left" },
    btn: (primary) => ({ width: "100%", marginTop: 10, padding: "12px 0", borderRadius: 12, border: "none", fontWeight: 800, fontSize: 14, background: primary ? T.court : "#EFF2EF", color: primary ? T.white : T.ink, cursor: "pointer" }),
    toast: { position: "fixed", top: 12, left: 12, right: 12, maxWidth: 456, margin: "0 auto", zIndex: 100, borderRadius: 14, padding: "12px 14px", fontSize: 13, fontWeight: 600, boxShadow: "0 6px 20px rgba(0,0,0,0.25)", color: "#fff", background: T.courtDeep },
    sortBtn: (on) => ({ flex: 1, padding: "9px 0", borderRadius: 10, border: "none", fontWeight: 800, fontSize: 13, background: on ? T.ink : T.white, color: on ? T.white : T.ink, boxShadow: on ? "none" : `inset 0 0 0 1.5px ${T.line}` }),
    input: { width: "100%", boxSizing: "border-box", padding: "11px 12px", borderRadius: 10, border: `1.5px solid ${T.line}`, fontSize: 14, fontFamily: FONT, marginTop: 6, background: "#FAFCFA" },
    label: { fontSize: 12, fontWeight: 800, color: "#5E716C", marginTop: 14, display: "block" },
    segRow: { display: "flex", gap: 8, marginTop: 6 },
    seg: (on) => ({ flex: 1, padding: "9px 0", borderRadius: 10, border: "none", fontWeight: 800, fontSize: 13, background: on ? T.court : "#EFF2EF", color: on ? T.white : T.ink }),
    secTitle: { textAlign: "center", marginBottom: 8 },
    secKicker: { display: "inline-block", fontSize: 12, fontWeight: 900, letterSpacing: "0.25em", color: T.court, marginBottom: 8 },
    secH: { fontSize: "clamp(24px, 4.5vw, 34px)", fontWeight: 900, fontStyle: "italic", transform: "rotate(-1.5deg)", display: "inline-flex", alignItems: "center", gap: 8 },
  };

  const UserBadge = () => (
    <span style={{ fontSize: 10, fontWeight: 800, color: "#fff", background: "#8A6FD1", borderRadius: 6, padding: "2px 6px" }}>投稿</span>
  );
  const CatBadge = ({ cat }) => {
    const m = { dedicated: ["専用", T.court, "#E7F2F1"], public: ["公共", "#7A5C00", "#FBF3D5"], conv: ["転用", "#5B5B8A", "#ECECF7"], trip: ["遠征", "#8A4B2D", "#F9EBE2"] };
    const [label, color, bg] = m[cat] || m.dedicated;
    return <span style={{ fontSize: 10, fontWeight: 800, color, background: bg, borderRadius: 6, padding: "2px 6px" }}>{label}</span>;
  };

  const SectionHead = ({ kicker, title }) => (
    <div style={S.secTitle}>
      <div style={S.secKicker}>{kicker}</div>
      <div>
        <span style={S.secH}>{title} <Ball size={20} /></span>
      </div>
    </div>
  );

  return (
    <div style={{ fontFamily: FONT, color: T.ink, background: T.bg }}>
      <style>{`
        html { scroll-behavior: smooth; }
        .logoLineBig { font-size: clamp(60px, 14vw, 140px); }
        .lpNav a { color: #fff; text-decoration: none; font-weight: 800; font-size: 14px; cursor: pointer; }
        .lpNavLinks { display: flex; gap: 24px; }
        .lpTagline { font-size: clamp(14px, 2.4vw, 20px); }
        .lpSearchWrap { width: min(680px, calc(100% - 40px)); }
        .lpTabs button { flex: 1; padding: 13px 0; font-weight: 800; font-size: clamp(12px, 1.8vw, 15px); border: 1.5px solid rgba(255,255,255,0.85); background: transparent; color: #fff; cursor: pointer; }
        .lpTabs button.on { background: #fff; color: ${T.courtDeep}; }
        .section { padding: clamp(56px, 9vh, 96px) 20px; scroll-margin-top: 64px; }
        .sectionInner { max-width: 960px; margin: 0 auto; }
        .narrowInner { max-width: 560px; margin: 0 auto; }
        .cardGrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 12px; margin-top: 16px; }
        .aboutGrid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px; margin-top: 28px; }
        .chipScroll { display: flex; gap: 8px; overflow-x: auto; padding: 4px 0; -webkit-overflow-scrolling: touch; }
        .stickyNav { position: sticky; top: 0; z-index: 30; }
        @media (max-width: 680px) {
          .lpNavLinks { gap: 14px; }
          .lpNav a { font-size: 12px; }
          .hideMobile { display: none; }
        }
      `}</style>

      {toast && <div style={S.toast}>📣 {toast}</div>}

      {/* ==================== ナビ（sticky） ==================== */}
      <div className="lpNav stickyNav" style={{ background: T.hero1, display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px clamp(14px, 4vw, 40px)", gap: 10 }}>
        <div className="lpNavLinks" style={{ overflowX: "auto", whiteSpace: "nowrap" }}>
          <a onClick={() => scrollTo(refAbout)}>とは？</a>
          <a onClick={() => scrollTo(refSlots)}>空き枠</a>
          <a onClick={() => scrollTo(refList)}>コート一覧</a>
          <a onClick={() => scrollTo(refEvents)}>イベント</a>
          <a onClick={() => scrollTo(refAdd)}>コート登録</a>
        </div>
        <span style={{ fontSize: 11, fontWeight: 800, color: "#fff", opacity: 0.85, border: "1.5px solid rgba(255,255,255,0.6)", borderRadius: 999, padding: "3px 11px", flexShrink: 0 }}>β版</span>
      </div>

      {/* ==================== HERO ==================== */}
      <div style={{ background: `linear-gradient(160deg, ${T.hero1} 0%, ${T.hero2} 55%, ${T.hero1} 100%)`, color: "#fff", position: "relative", overflow: "hidden", minHeight: "88vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 20px 56px" }}>
        <CourtPattern />
        <div style={{ position: "relative", zIndex: 2, width: "100%", display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div className="lpTagline" style={{ fontWeight: 800, marginBottom: "clamp(20px, 4vh, 36px)", textAlign: "center", textShadow: "0 1px 4px rgba(0,0,0,0.25)" }}>
            東京のピックルボールコートがぜんぶ見つかる横断検索サイト
          </div>

          <Logo big />

          <div className="lpSearchWrap" style={{ marginTop: "clamp(28px, 5vh, 48px)" }}>
            <div className="lpTabs" style={{ display: "flex", borderRadius: "12px 12px 0 0", overflow: "hidden" }}>
              <button className="on" onClick={doSearch}>エリアから探す</button>
              <button onClick={() => scrollTo(refSlots)}>日付から探す</button>
              <button onClick={() => { setSortKey("price"); setCatFilter("all"); scrollTo(refList); }}>安さで探す</button>
            </div>
            <div style={{ display: "flex", background: "#fff", borderRadius: "0 0 12px 12px", overflow: "hidden", boxShadow: "0 8px 30px rgba(0,0,0,0.25)" }}>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && doSearch()}
                placeholder="エリア・コート名・キーワード"
                style={{ flex: 1, border: "none", outline: "none", padding: "16px 16px", fontSize: 15, fontFamily: FONT, color: T.ink, minWidth: 0 }}
              />
              <button onClick={doSearch} style={{ border: "none", background: T.ball, color: T.ballInk, fontWeight: 900, fontSize: 15, padding: "0 clamp(18px, 4vw, 34px)", whiteSpace: "nowrap", cursor: "pointer" }}>
                検 索
              </button>
            </div>
          </div>

          <div style={{ marginTop: "clamp(30px, 6vh, 52px)", textAlign: "center" }}>
            <div style={{ fontSize: 13, fontWeight: 800, opacity: 0.9, marginBottom: 6 }}>キッチンには入るな</div>
            <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
              <BallGuy mood="happy" />
              <BallGuy flip mood="oops" />
            </div>
            <div style={{ marginTop: 22, fontSize: 12, fontWeight: 800, opacity: 0.75 }}>↓ 下にスクロール</div>
          </div>
        </div>

        {/* news bar */}
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, zIndex: 2, background: "#fff", color: T.ink, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "12px clamp(16px, 4vw, 40px)" }}>
          <div style={{ fontWeight: 800, fontSize: "clamp(11px, 1.6vw, 14px)", display: "flex", gap: 14, alignItems: "center", minWidth: 0 }}>
            <span style={{ color: "#8B9B96", flexShrink: 0 }}>{`${new Date().getFullYear()}.${String(new Date().getMonth() + 1).padStart(2, "0")}.${String(new Date().getDate()).padStart(2, "0")}`}</span>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>掲載{ALL_FACS.length}コートでβ公開！「ここでもできた」情報を募集中です</span>
          </div>
          <div className="hideMobile" style={{ fontSize: 11, color: "#8B9B96", fontWeight: 700, flexShrink: 0 }}>by MUFASA Technology</div>
        </div>
      </div>

      {/* ==================== とは？ ==================== */}
      <section ref={refAbout} className="section" style={{ background: "#fff" }}>
        <div className="sectionInner">
          <SectionHead kicker="ABOUT" title="ピックルイキタイとは？" />
          <p style={{ textAlign: "center", fontSize: 14, lineHeight: 2, color: "#455B57", maxWidth: 640, margin: "10px auto 0" }}>
            「今週末ピックルやりたい」のに、どこでできるか分からない。<br className="hideMobile" />
            公式サイトを5個も6個も見て回って、結局予定が流れる——。<br className="hideMobile" />
            ピックルイキタイは、東京+関東のコートの空き枠をひとつの画面に集めた横断検索ポータルです。予約は各コートの公式サイトで。
          </p>
          <div className="aboutGrid">
            {[
              { icon: "🗓", t: "空き枠を横断チェック", d: "対応コートの空き状況を最大3ヶ月先までまとめて表示。開いてるところにだけ行けばいい。" },
              { icon: "📍", t: "近い・安いで探せる", d: "専用コートから区の体育館、遠征先まで。距離順・料金順でパッと比較。" },
              { icon: "🙌", t: "みんなで育てるコートDB", d: "「ここでもできた」をユーザーが投稿。公民館や体育館の隠れコート情報が集まる。" },
            ].map((x) => (
              <div key={x.t} style={{ ...S.facCard, textAlign: "center", padding: 22 }}>
                <div style={{ fontSize: 30 }}>{x.icon}</div>
                <div style={{ fontWeight: 900, fontSize: 16, marginTop: 8 }}>{x.t}</div>
                <div style={{ fontSize: 13, color: "#5E716C", marginTop: 6, lineHeight: 1.8 }}>{x.d}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ==================== 空き枠 ==================== */}
      <section ref={refSlots} className="section" style={{ background: T.bg }}>
        <div className="narrowInner">
          <SectionHead kicker="AVAILABILITY" title="空き枠をさがす" />

          <div className="chipScroll" style={{ marginTop: 14 }}>
            {areas.map((a) => (
              <button key={a} style={S.chip(areaFilter === a)} onClick={() => setAreaFilter(a)}>
                {a === "all" ? "すべて" : a}
              </button>
            ))}
          </div>

          <div className="chipScroll" style={{ marginTop: 8 }}>
            {MONTHS.map((mo) => (
              <button key={mo.m} style={S.monthChip(curMonth === mo.m)} onClick={() => jumpTo(mo.firstIdx)}>{mo.m}月</button>
            ))}
            {winStart > 0 && (
              <button style={{ ...S.monthChip(false), color: T.court }} onClick={() => jumpTo(0)}>↩ 今日</button>
            )}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
            <button style={S.navBtn(winStart === 0)} disabled={winStart === 0} onClick={() => moveWindow(-1)}>‹</button>
            {windowDays.map((d) => (
              <button key={d.key} style={S.dayBtn(d.idx === dayIdx, d)} onClick={() => setDayIdx(d.idx)}>
                <div style={{ fontSize: 10, fontWeight: 700, opacity: 0.75 }}>{d.month}月</div>
                {d.label}
                <div style={{ fontSize: 10, fontWeight: 700, opacity: 0.75 }}>{d.dow}</div>
              </button>
            ))}
            <button style={S.navBtn(winStart >= HORIZON - 3)} disabled={winStart >= HORIZON - 3} onClick={() => moveWindow(1)}>›</button>
          </div>

          <div style={{ marginTop: 12, background: T.white, borderRadius: 18, overflow: "hidden", boxShadow: "0 1px 4px rgba(14,42,43,0.07)" }}>
            {BANDS.map((b) => {
              const g = grid[b.key];
              return (
                <div key={b.key} style={S.row}>
                  <div style={S.bandLabel}>{b.label}</div>
                  <button style={S.cell} onClick={() => setSheet({ day: selDay, band: b })}>
                    {g.open > 0 ? (
                      <span style={S.openBadge}><Ball size={15} /> {g.open}件 空きあり</span>
                    ) : (
                      <span style={S.fullTxt}>満</span>
                    )}
                    {g.portal > 0 && <span style={S.portalBadge}>ほか{g.portal}件は公式で確認</span>}
                  </button>
                </div>
              );
            })}
          </div>
          <div style={{ textAlign: "center", fontSize: 11, color: "#7E8F8A", marginTop: 10 }}>
            {selDay.full} ・ この日付は{freshness(selDay.offset)} ・ 予約は公式サイトで ・ 📊 送客クリック: {clicks}
          </div>
        </div>
      </section>

      {/* ==================== コート一覧 ==================== */}
      <section ref={refList} className="section" style={{ background: "#fff" }}>
        <div className="sectionInner">
          <SectionHead kicker="COURTS" title="コート一覧" />

          <div className="chipScroll" style={{ marginTop: 14, justifyContent: "center", flexWrap: "wrap" }}>
            {CATS.map((c) => (
              <button key={c.key} style={S.chip(catFilter === c.key)} onClick={() => setCatFilter(c.key)}>{c.label}</button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8, maxWidth: 360, margin: "10px auto 0" }}>
            <button style={S.sortBtn(sortKey === "dist")} onClick={() => setSortKey("dist")}>📍 近い順</button>
            <button style={S.sortBtn(sortKey === "price")} onClick={() => setSortKey("price")}>💰 安い順</button>
          </div>

          <div className="cardGrid">
            {listFacs.map((f) => (
              <button key={f.id} style={{ ...S.facCard, cursor: "pointer", borderColor: f.userSubmitted ? "#C9BBEE" : T.line, display: "block" }} onClick={() => setDetail(f)}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                    <CatBadge cat={f.cat} />
                    {f.userSubmitted && <UserBadge />}
                    {f.cheap && <span style={{ fontSize: 10, fontWeight: 800, color: T.ballInk, background: T.ball, borderRadius: 6, padding: "2px 6px" }}>安い</span>}
                    {f.live && <span style={{ fontSize: 10, fontWeight: 800, color: T.court, border: `1px solid ${T.court}`, borderRadius: 6, padding: "1px 5px" }}>空き枠表示</span>}
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: "#8B9B96", flexShrink: 0 }}>{f.km.toFixed(1)}km</div>
                </div>
                <div style={{ fontWeight: 900, fontSize: 15, marginTop: 6 }}>{f.name}</div>
                <div style={{ fontSize: 12, color: "#5E716C", marginTop: 3 }}>
                  {f.area} ・ {f.indoor ? "屋内" : "屋外"} ・ <span style={{ fontWeight: 800, color: T.court }}>{f.price}</span>
                </div>
                <div style={{ fontSize: 11, color: "#8B9B96", marginTop: 3 }}>{f.note}</div>
              </button>
            ))}
          </div>
          <div style={{ fontSize: 11, color: "#AEBCB7", textAlign: "center", marginTop: 16 }}>
            距離は池尻大橋起点の直線距離 ・ 現在 {ALL_FACS.length} コート掲載中
          </div>
        </div>
      </section>

      {/* ==================== イベント ==================== */}
      <section ref={refEvents} className="section" style={{ background: T.bg }}>
        <div className="sectionInner">
          <SectionHead kicker="EVENTS" title="イベント" />
          <p style={{ textAlign: "center", fontSize: 13, color: "#5E716C", marginTop: 6 }}>1人でも参加できるオープンプレー・交流会</p>
          <div className="cardGrid" style={{ maxWidth: 680, margin: "16px auto 0" }}>
            {EVENTS.map((e) => (
              <div key={e.id} style={S.facCard}>
                <div style={{ fontWeight: 900, fontSize: 15 }}>{e.name}</div>
                <div style={{ fontSize: 13, marginTop: 4, color: T.court, fontWeight: 800 }}>{e.when}</div>
                <div style={{ fontSize: 12, color: "#5E716C", marginTop: 3 }}>{e.area} ・ {e.price} ・ {e.note}</div>
                <button style={S.btn(true)} onClick={() => { setClicks((c) => c + 1); window.open(e.url, "_blank"); }}>詳細を見る</button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ==================== コート登録 ==================== */}
      <section ref={refAdd} className="section" style={{ background: "#fff" }}>
        <div className="narrowInner">
          <SectionHead kicker="ADD COURT" title="コートを登録する" />
          <p style={{ textAlign: "center", fontSize: 13, color: "#5E716C", marginTop: 6, lineHeight: 1.8 }}>
            「ここでピックルできた」を教えてください。30秒で一覧に載ります。<br />
            公民館・体育館の隠れコート情報、大歓迎です。
          </p>

          <div style={{ ...S.facCard, marginTop: 18, padding: 20 }}>
            <label style={{ ...S.label, marginTop: 0 }}>コート名 *</label>
            <input style={S.input} placeholder="例: 渋谷区の公民館 / 世田谷総合運動場" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />

            <label style={S.label}>エリア</label>
            <div className="chipScroll" style={{ marginTop: 6 }}>
              {Object.keys(AREA_COORDS).map((a) => (
                <button key={a} style={{ ...S.chip(form.area === a), fontSize: 12, padding: "6px 11px" }} onClick={() => setForm({ ...form, area: a })}>{a}</button>
              ))}
            </div>

            <label style={S.label}>タイプ</label>
            <div style={S.segRow}>
              <button style={S.seg(form.cat === "public")} onClick={() => setForm({ ...form, cat: "public" })}>公共・格安</button>
              <button style={S.seg(form.cat === "dedicated")} onClick={() => setForm({ ...form, cat: "dedicated" })}>専用/民間</button>
              <button style={S.seg(form.cat === "conv")} onClick={() => setForm({ ...form, cat: "conv" })}>テニス転用</button>
            </div>

            <label style={S.label}>屋内 / 屋外</label>
            <div style={S.segRow}>
              <button style={S.seg(form.indoor === "indoor")} onClick={() => setForm({ ...form, indoor: "indoor" })}>屋内</button>
              <button style={S.seg(form.indoor === "outdoor")} onClick={() => setForm({ ...form, indoor: "outdoor" })}>屋外</button>
            </div>

            <label style={S.label}>予約ページ / 公式URL（任意）</label>
            <input style={S.input} placeholder="例: https://...（空欄ならGoogleマップに繋ぎます）" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} />

            <label style={S.label}>料金の目安（任意）</label>
            <input style={S.input} placeholder="例: ¥800/2h（区民料金）" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />

            <label style={S.label}>ひとことメモ（任意）</label>
            <input style={S.input} placeholder="例: バドコートにテープでOKだった。ネット持参" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />

            <button style={{ ...S.btn(true), marginTop: 18 }} onClick={submitCourt}>この内容で登録する</button>
            <div style={{ fontSize: 10, color: "#AEBCB7", marginTop: 8, textAlign: "center" }}>
              投稿情報は他のユーザーにも表示されます ・ 利用条件は各自公式でご確認ください
            </div>
          </div>
        </div>
      </section>

      {/* ==================== フッター ==================== */}
      <footer style={{ background: T.hero1, color: "#fff", padding: "44px 20px 100px", textAlign: "center", position: "relative", overflow: "hidden" }}>
        <CourtPattern />
        <div style={{ position: "relative", zIndex: 2 }}>
          <Logo />
          <div style={{ display: "flex", gap: 6, justifyContent: "center", marginTop: 18 }}>
            <BallGuy size={34} mood="happy" />
            <BallGuy size={34} flip mood="oops" />
          </div>
          <div style={{ fontSize: 11, opacity: 0.7, marginTop: 16, lineHeight: 1.9 }}>
            掲載情報の正確性は保証されません。予約・利用条件は各施設の公式情報をご確認ください。<br />
            © {new Date().getFullYear()} MUFASA Technology — 世界をかっこよく
          </div>
        </div>
      </footer>

      {/* ==================== オーバーレイ: 空き枠詳細 ==================== */}
      {sheet && (
        <>
          <div style={S.sheetBack} onClick={() => setSheet(null)} />
          <div style={S.sheet}>
            <div style={{ width: 40, height: 4, background: T.line, borderRadius: 2, margin: "0 auto 10px" }} />
            <div style={{ fontWeight: 900, fontSize: 17 }}>{sheet.day.full} {sheet.band.label}時</div>
            <div style={{ fontSize: 11, color: "#8B9B96", marginTop: 2 }}>{freshness(sheet.day.offset)}のデータ</div>
            {[...visibleFacs].sort((a, b) => (slotStatusFor(a, sheet.day.key, sheet.band.key) === "open" ? -1 : 1) - (slotStatusFor(b, sheet.day.key, sheet.band.key) === "open" ? -1 : 1)).map((f) => {
              const st = slotStatusFor(f, sheet.day.key, sheet.band.key);
              return (
                <div key={f.id} style={{ ...S.facCard, marginTop: 10, opacity: st === "full" ? 0.45 : 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                        <CatBadge cat={f.cat} />
                        {f.userSubmitted && <UserBadge />}
                        <div style={{ fontWeight: 900, fontSize: 15 }}>{f.name}</div>
                      </div>
                      <div style={{ fontSize: 12, color: "#5E716C", marginTop: 3 }}>
                        {f.area} ・ {f.indoor ? "屋内" : "屋外"} ・ {f.price}
                      </div>
                    </div>
                    {st === "open" && <Ball size={20} />}
                  </div>
                  {st === "open" && <button style={S.btn(true)} onClick={() => outbound(f)}>公式サイトで予約する →</button>}
                  {st === "portal" && <button style={S.btn(false)} onClick={() => outbound(f)}>空き状況を公式で確認 →</button>}
                  {st === "full" && <div style={{ marginTop: 8, fontSize: 13, fontWeight: 800, color: "#9AA8A3" }}>満枠</div>}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* ==================== オーバーレイ: 施設詳細 ==================== */}
      {detail && (
        <>
          <div style={S.sheetBack} onClick={() => setDetail(null)} />
          <div style={S.sheet}>
            <div style={{ width: 40, height: 4, background: T.line, borderRadius: 2, margin: "0 auto 12px" }} />
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <CatBadge cat={detail.cat} />
              {detail.userSubmitted && <UserBadge />}
              {detail.cheap && <span style={{ fontSize: 10, fontWeight: 800, color: T.ballInk, background: T.ball, borderRadius: 6, padding: "2px 6px" }}>安い</span>}
            </div>
            <div style={{ fontWeight: 900, fontSize: 19, marginTop: 6 }}>{detail.name}</div>
            <div style={{ fontSize: 13, color: "#5E716C", marginTop: 4 }}>
              {detail.area} ・ {detail.indoor ? "屋内" : "屋外"} ・ 池尻大橋から約{dist(HOME, detail).toFixed(1)}km
            </div>
            <div style={{ fontSize: 14, fontWeight: 800, color: T.court, marginTop: 8 }}>{detail.price} <span style={{ fontWeight: 600, color: "#8B9B96", fontSize: 12 }}>{detail.rating}</span></div>
            <div style={{ fontSize: 13, color: "#5E716C", marginTop: 6, lineHeight: 1.6 }}>{detail.note}</div>
            {(detail.unverified || detail.userSubmitted) && (
              <div style={{ fontSize: 12, color: "#7A5C00", background: "#FBF3D5", borderRadius: 10, padding: "8px 10px", marginTop: 10 }}>
                💡 {detail.userSubmitted ? "ユーザー投稿の情報です。利用条件は公式でご確認ください" : "ピックルボール利用の可否・条件は施設の公式情報でご確認ください"}
              </div>
            )}
            <button style={S.btn(true)} onClick={() => outbound(detail)}>
              {detail.live ? "公式サイトで予約する →" : "公式情報を見る →"}
            </button>
            {detail.price.includes("※") && <div style={{ fontSize: 10, color: "#AEBCB7", marginTop: 8 }}>※料金は目安です</div>}
          </div>
        </>
      )}
    </div>
  );
}
