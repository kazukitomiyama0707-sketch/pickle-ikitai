import React, { useState, useMemo, useRef, useEffect } from "react";

/* ============================================================
   ピックルイキタイ MVP v8 — ワンページ版（コート写真つき）
   ヒーロー → とは？ → 空き枠 → コート一覧 → イベント → コート登録
   ナビはアンカースクロール。全部1ページで完結。レスポンシブ。
   ============================================================ */

const T = {
  bg: "#F2FBF4",
  ink: "#123536",
  court: "#0E9E86",
  courtDeep: "#0C7C74",
  hero1: "#12A594",
  hero2: "#2EC9A0",
  ball: "#D7F438",
  ballInk: "#33430A",
  line: "#DCEEE6",
  full: "#C6CFC9",
  warn: "#F2683C",
  white: "#FFFFFF",
};
const FONT = `-apple-system, BlinkMacSystemFont, "Hiragino Sans", "Noto Sans JP", sans-serif`;

const HOME = { lat: 35.658, lng: 139.7016 }; // 渋谷駅（現在地未取得時の基準）
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

// 7:00〜24:00 を2時間刻みで連続表示（隙間なし）
const BANDS = [
  { key: "07", label: "7-9" },
  { key: "09", label: "9-11" },
  { key: "11", label: "11-13" },
  { key: "13", label: "13-15" },
  { key: "15", label: "15-17" },
  { key: "17", label: "17-19" },
  { key: "19", label: "19-21" },
  { key: "21", label: "21-23" },
  { key: "23", label: "23-24" },
];

/* コート貸切1件だけの施設を機械的にplans化するヘルパー（label=元の表示文字列を保持） */
const courtPlan = (fid, price, label) => ({ id: fid + "-c", name: "コート貸切", kind: "court", price, unit: "1h", capacity: null, label });

const SEED_FACILITIES = [
  { id: "pickle9", name: "pickle9 南青山", area: "港区", lat: 35.667, lng: 139.7173, indoor: true, live: true, cat: "dedicated", photo: "/photos/pickle9.jpg", plans: [courtPlan("pickle9", 8800, "¥8,800/h〜")], rating: "★5.0 (54)", url: "https://www.pickle9.jp/", note: "インドア専用・表参道駅5分・都内最高評価" },
  { id: "one", name: "ピックルボールワン銀座新橋", area: "中央区", lat: 35.6694, lng: 139.7578, indoor: true, live: true, cat: "dedicated", plans: [
      { id: "one-court-one", name: "ONEコート", kind: "court", price: 7000, unit: "1h", capacity: null },
      { id: "one-court-fun", name: "FUNコート", kind: "court", price: 5000, unit: "1h", capacity: null },
      { id: "one-taiken", name: "初心者体験会", kind: "event", price: 3300, unit: "回", capacity: 6 },
      { id: "one-lesson", name: "実践ゲームレッスン", kind: "lesson", price: 5500, unit: "回", capacity: 8 },
    ], rating: "★4.8 (104)", url: "https://ginza.pickle-one.com/", note: "都心1.5面・ショップ併設・コート貸切と体験会/レッスンを併催（RESERVA予約）" },
  { id: "pacific", name: "Pacific PICKLE CLUB 有明", area: "江東区", lat: 35.6402, lng: 139.7873, indoor: false, live: true, cat: "dedicated", photo: "/photos/pacific.jpg", plans: [courtPlan("pacific", 7700, "¥7,700/h〜")], rating: "★3.8 (22)", url: "https://pacificpickleclub.com/", note: "有明アーバンスポーツパーク内2面・飲食併設" },
  { id: "sansan", name: "Sansanピックルボール 池袋", area: "豊島区", lat: 35.7282, lng: 139.7189, indoor: true, live: true, cat: "dedicated", photo: "/photos/sansan.jpg", plans: [courtPlan("sansan", 6000, "¥6,000/h〜")], rating: "★5.0 (2)", url: "https://sansan-pickleball.com/", note: "東池袋・サンソウゴビル・新規オープン" },
  { id: "shiomi", name: "SENKO塩見テニスセンター", area: "江東区", lat: 35.6579, lng: 139.8198, indoor: false, live: true, cat: "conv", plans: [courtPlan("shiomi", 4400, "¥4,400/h〜")], rating: "テニス転用", url: "https://reserve.tennisbear.net/", note: "テニスコートにテープで仮設・TennisBear予約" },
  { id: "shibuya-pc", name: "SHIBUYA PICKLEBALL CLUB", area: "渋谷区", lat: 35.6632, lng: 139.6991, indoor: true, live: false, cat: "dedicated", plans: [courtPlan("shibuya-pc", 5500, "¥5,500/h〜")], rating: "新規オープン", url: "https://shibuya-rental.space/", note: "宇田川町・レンタルスペース型", upcoming: true, openDate: "2026.08.01" },
  { id: "seibu", name: "SEIBU FAST SPORTS FIELD 品川", area: "港区", lat: 35.6276, lng: 139.7367, indoor: true, live: false, cat: "dedicated", plans: [courtPlan("seibu", 7000, "要問合せ")], rating: "★4.3 (6)", url: gmaps("SEIBU FAST SPORTS FIELD 品川 ピックルボール"), note: "品川プリンスホテル10F・ゴルフ併設のインドアコート" },
  { id: "tebura", name: "手ぶらでピックルボール 有明店", area: "江東区", lat: 35.6351, lng: 139.7847, indoor: true, live: false, cat: "dedicated", plans: [courtPlan("tebura", 3300, "低価格帯※")], rating: "★4.7 (3)", url: gmaps("手ぶらでピックルボール有明店"), note: "器材レンタル込・平日は当日予約可の声あり", cheap: true },
  { id: "tower", name: "Tokyo Tower Pickleball", area: "港区", lat: 35.6578, lng: 139.7449, indoor: false, live: false, cat: "dedicated", plans: [courtPlan("tower", 9999, "要問合せ")], rating: "屋上コート", url: gmaps("Tokyo Tower Pickleball Friendship"), note: "東京タワー真下のルーフトップ・Instagram予約" },
  { id: "ariake-park", name: "有明親水海浜公園コート", area: "江東区", lat: 35.6402, lng: 139.7866, indoor: false, live: false, cat: "public", plans: [courtPlan("ariake-park", 2000, "公園料金※")], rating: "公共", url: gmaps("有明親水海浜公園 ピックルボール"), note: "屋外ハード2面・ナイター照明・公園内コート", cheap: true },
  { id: "shibuya-sc", name: "渋谷区スポーツセンター", area: "渋谷区", lat: 35.6756, lng: 139.6813, indoor: true, live: false, cat: "public", plans: [courtPlan("shibuya-sc", 300, "¥300〜※")], rating: "★4.0 (729)", url: gmaps("渋谷区スポーツセンター"), note: "ユーザー報告「渋谷の公共施設でプレーできた」・体育室の個人利用ルールは公式で確認を", cheap: true, unverified: true },
  { id: "cosmic", name: "新宿コズミックセンター", area: "新宿区", lat: 35.705, lng: 139.7081, indoor: true, live: false, cat: "public", plans: [courtPlan("cosmic", 400, "区施設料金※")], rating: "公共体育館", url: gmaps("新宿コズミックセンター"), note: "バドコート転用の可否は公式で確認を（区民優先・抽選あり）", cheap: true, unverified: true },
  { id: "nakano", name: "中野区南部スポーツ・コミュニティプラザ", area: "中野区", lat: 35.6881, lng: 139.6687, indoor: true, live: false, cat: "public", plans: [courtPlan("nakano", 200, "¥200/2h〜※")], rating: "★4.0 (227)", url: gmaps("中野区南部スポーツコミュニティプラザ"), note: "小学校跡地の格安体育館・ピックル可否は公式で確認を", cheap: true, unverified: true },
  { id: "omori", name: "大森スポーツセンター", area: "大田区", lat: 35.5809, lng: 139.7374, indoor: true, live: false, cat: "public", plans: [courtPlan("omori", 500, "¥500/室※")], rating: "★3.9 (115)", url: gmaps("大森スポーツセンター"), note: "22時まで・大部屋貸切の実績あり・ピックル可否は公式で確認を", cheap: true, unverified: true },
  { id: "katsushika", name: "WELL PICKLE CLUB（葛飾）", area: "葛飾区", lat: 35.7909, lng: 139.8527, indoor: false, live: false, cat: "dedicated", plans: [
      { id: "katsushika-wd", name: "コート貸切（平日）", kind: "court", price: 4000, unit: "1h", capacity: null },
      { id: "katsushika-we", name: "コート貸切（土日祝）", kind: "court", price: 6000, unit: "1h", capacity: null },
    ], rating: "★4.1 (37)", url: "https://pickleclub.well-k.jp/", note: "西水元・屋外4面のピックル専用コート" },
  { id: "kawagoe", name: "ピックルボールスクール 川越", area: "埼玉県", lat: 35.9117, lng: 139.3883, indoor: false, live: false, cat: "trip", plans: [courtPlan("kawagoe", 3000, "要問合せ")], rating: "★5.0 (1)", url: gmaps("ピックルボールスクール 川越 笠幡"), note: "夜22:30まで・遠征組に人気。車なら関越で1本", cheap: true },

  /* ---- 2026-07 追加調査で判明した施設 ---- */
  { id: "vip-toyocho", name: "VIPインドアピックルボールクラブ 東陽町", area: "江東区", lat: 35.6706, lng: 139.8171, indoor: true, live: false, cat: "dedicated", plans: [
      { id: "vip-court", name: "コートレンタル", kind: "court", price: 4400, unit: "50分", capacity: null, label: "¥4,400〜6,600/50-75分" },
      { id: "vip-school", name: "スクール（月額）", kind: "lesson", price: 12540, unit: "月", capacity: null, label: "¥12,540〜13,585/月" },
    ], rating: "2025年4月オープン", url: "https://viptop.jp/toyocho-pickleball/", note: "南砂・インドア3面・スクール併設" },
  { id: "meiji-park", name: "MEIJI PARK PICKLEBALL COURT", area: "新宿区", lat: 35.6784, lng: 139.7161, indoor: false, live: false, cat: "dedicated", plans: [
      { id: "meiji-court", name: "コートレンタル", kind: "court", price: 6600, unit: "1h", capacity: null, label: "¥6,600〜11,000/h" },
      { id: "meiji-taiken", name: "初心者体験（20分）", kind: "event", price: 700, unit: "回", capacity: null },
      { id: "meiji-lesson", name: "レッスン", kind: "lesson", price: 5500, unit: "1h", capacity: null },
    ], rating: "都立明治公園内", url: "https://www.tennisbear.net/place/3621/info", note: "明治公園みち広場・屋外2面・TennisBear予約" },
  { id: "hilton", name: "ヒルトン東京 ピックルボールコート", area: "新宿区", lat: 35.6938, lng: 139.6924, indoor: false, live: false, cat: "conv", plans: [
      { id: "hilton-wd", name: "コート貸切（平日）", kind: "court", price: 6000, unit: "1h", capacity: null, label: "¥6,000〜8,000/h" },
      { id: "hilton-we", name: "コート貸切（土日祝）", kind: "court", price: 8000, unit: "1h", capacity: null, label: "¥8,000〜10,000/h" },
      { id: "hilton-lesson", name: "グループレッスン（80分）", kind: "lesson", price: 5000, unit: "回", capacity: null },
    ], rating: "ホテル併設", url: "https://tokyo.hiltonjapan.co.jp/facilities/lp/fitness-center", note: "西新宿・屋外2面・宿泊者割引あり・ラケットレンタル¥800" },
  { id: "cesame", name: "セサミテニススクール東久留米", area: "東京都下", lat: 35.7583, lng: 139.5294, indoor: false, live: false, cat: "conv", plans: [
      { id: "cesame-member", name: "スクール会員（60分）", kind: "court", price: 1650, unit: "60分", capacity: null },
      { id: "cesame-visitor", name: "ビジター（60分）", kind: "court", price: 3300, unit: "60分", capacity: null },
    ], rating: "屋外4面", url: "https://www.cesame.co.jp/", note: "東久留米・アウトドア4面は都下最大級", cheap: true },
  { id: "tip-shibuya", name: "ティップ.クロス TOKYO 渋谷", area: "渋谷区", lat: 35.6595, lng: 139.7005, indoor: true, live: false, cat: "conv", plans: [
      { id: "tip-rental", name: "施設貸出（Aスタジオ）", kind: "court", price: 9900, unit: "回", capacity: null },
    ], rating: "渋谷駅3分", url: "https://tip.tipness.co.jp/shop_info/SHP001/", note: "スタジオ貸出でピックル可・パドルレンタル¥550/本", memberOnly: true },
  { id: "chuo-sports", name: "中央区立総合スポーツセンター", area: "中央区", lat: 35.6863, lng: 139.7889, indoor: true, live: false, cat: "public", plans: [courtPlan("chuo-sports", 500, "区施設料金※")], rating: "公共体育館", url: "https://www.chuo-sports.jp/personal/", note: "日本橋浜町・2026年1月からピックル教室開講・バドコート転用", cheap: true, unverified: true },
  { id: "picklr-toyosu", name: "PICKLR TOKYO 豊洲", area: "江東区", lat: 35.6533, lng: 139.7897, indoor: true, live: false, cat: "dedicated", plans: [
      { id: "picklr-play", name: "PLAY会員（月額）", kind: "court", price: 19800, unit: "月", capacity: null, label: "入会¥16,500＋¥19,800/月" },
      { id: "picklr-unlimited", name: "UNLIMITED会員（月額）", kind: "court", price: 29700, unit: "月", capacity: null, label: "入会¥27,500＋¥29,700/月" },
    ], rating: "国内最大級・屋内7面", url: "https://www.picklr.jp/locations/tokyo-toyosu", note: "塩浜・屋内7面の国内最大級・米PICKLR日本初上陸", upcoming: true, openDate: "2026年秋" },

  /* ==== 全国のコート（2026-07 調査で確認・確度高い専用/リゾート） ==== */
  // --- 関東（東京以外） ---
  { id: "ocean-tsurumi", name: "OCEAN PICKLE CLUB 鶴見", area: "神奈川県", lat: 35.51, lng: 139.68, indoor: false, live: false, cat: "dedicated", plans: [courtPlan("ocean-tsurumi", 4000, "¥4,000/h〜")], rating: "屋外ハード2面", url: "https://www.oceangp.com/about/sports/", note: "横浜市鶴見・デコターフ2面・用具レンタル可" },
  { id: "raym-kawaguchi", name: "レイムテニスセンター", area: "埼玉県", lat: 35.83, lng: 139.72, indoor: false, live: false, cat: "conv", plans: [courtPlan("raym-kawaguchi", 4400, "¥4,400/h〜")], rating: "屋外2面", url: "https://raym.tsjpn.com/pickleball/", note: "川口市・ハードコート2面・毎週金曜講習会" },
  { id: "bellwood-matsudo", name: "ベルウッドテニスガーデン", area: "千葉県", lat: 35.79, lng: 139.94, indoor: false, live: false, cat: "dedicated", plans: [courtPlan("bellwood-matsudo", 2200, "¥2,200〜")], rating: "屋外専用2面", url: "https://pickle-one.com/court/chiba/matsudo/bell-wood/", note: "松戸市・2025年専用コート完成・東松戸駅" },
  { id: "impact-tsukuba", name: "IMPACTつくばピックルボールクラブ", area: "茨城県", lat: 36.08, lng: 140.11, indoor: false, live: false, cat: "dedicated", plans: [courtPlan("impact-tsukuba", 1650, "平日¥1,650〜")], rating: "屋外4面", url: "https://impact-tsukubapickleball-club.square.site/", note: "つくば市・県内初の本格専用4面・2025年6月オープン", cheap: true },
  { id: "maebashi-pc", name: "前橋ピックルボールセンター", area: "群馬県", lat: 36.32, lng: 139.00, indoor: true, live: false, cat: "dedicated", plans: [courtPlan("maebashi-pc", 3300, "平日¥3,300〜")], rating: "屋内3面", url: "https://goldsgym.jp/news/27874", note: "高崎市・県内初の専用3面・2024年8月オープン" },
  { id: "prex-tochigi", name: "P-REX（ピーレックス）", area: "栃木県", lat: 36.68, lng: 139.96, indoor: false, live: false, cat: "dedicated", plans: [courtPlan("prex-tochigi", 2200, "要問合せ")], rating: "屋外専用", url: "https://prex-tk.com/", note: "さくら市・日本初の専用屋外コート（2021年）・スクール運営" },

  // --- 関西 ---
  { id: "dpc-kobe", name: "DIADEM PICKLEBALL KOBE", area: "兵庫県", lat: 34.65, lng: 135.14, indoor: true, live: false, cat: "dedicated", plans: [courtPlan("dpc-kobe", 4400, "¥4,400/h")], rating: "屋内5面", url: "https://dpckobe.jp/", note: "神戸市長田・日本最大級5面・米DIADEM提携・新長田駅近" },
  { id: "pb-base-osaka", name: "Pickleball Base Osaka", area: "大阪府", lat: 34.58, lng: 135.44, indoor: false, live: false, cat: "dedicated", plans: [courtPlan("pb-base-osaka", 3000, "平日¥3,000〜")], rating: "屋外6面", url: "https://www.pickleballosaka.online/", note: "堺市・西日本最多6面・国際基準・南海堺駅直結" },
  { id: "pb-one-osaka", name: "ピックルボールワン大阪", area: "大阪府", lat: 34.75, lng: 135.55, indoor: true, live: false, cat: "dedicated", plans: [courtPlan("pb-one-osaka", 1000, "¥1,000/h")], rating: "屋内", url: "https://pickle-one.com/court/osaka/", note: "大阪市東淀川・平日半額キャンペーンあり", cheap: true },
  { id: "kyoto-ptc", name: "京都ピックルボールトレーニングセンター", area: "京都府", lat: 34.93, lng: 135.72, indoor: true, live: false, cat: "dedicated", plans: [courtPlan("kyoto-ptc", 2750, "会員¥2,750〜")], rating: "屋内4面", url: "https://navi.play-pickleball.jp/", note: "京都市伏見・4面DECOターフ・会員は用具無料レンタル" },

  // --- 中部 ---
  { id: "sasashima", name: "SASASHIMA PICKLEBALL CLUB", area: "愛知県", lat: 35.16, lng: 136.88, indoor: false, live: false, cat: "dedicated", plans: [courtPlan("sasashima", 3000, "要問合せ")], rating: "名古屋初の屋外専用", url: "https://pickle-one.com/court/aichi/", note: "名古屋市中川・名古屋初の屋外専用コート・2026年6月オープン" },
  { id: "nagoya-pb-base", name: "Nagoya Pickleball Base", area: "愛知県", lat: 35.17, lng: 136.90, indoor: true, live: false, cat: "dedicated", plans: [courtPlan("nagoya-pb-base", 3000, "要問合せ")], rating: "屋内専用", url: "https://navi.play-pickleball.jp/", note: "名古屋の専用インドアコート" },
  { id: "marin-handa", name: "マリンピックルボールクラブ", area: "愛知県", lat: 34.89, lng: 136.93, indoor: false, live: false, cat: "dedicated", plans: [courtPlan("marin-handa", 3000, "要問合せ")], rating: "愛知県初の屋外専用", url: "https://prtimes.jp/main/html/rd/p/000000004.000179964.html", note: "半田市・愛知県初の専用アウトドア・2026年6月オープン" },

  // --- 中国・四国・九州 ---
  { id: "pivole-fukuoka", name: "ピヴォーレ福岡", area: "福岡県", lat: 33.65, lng: 130.44, indoor: true, live: false, cat: "dedicated", plans: [courtPlan("pivole-fukuoka", 3000, "要問合せ")], rating: "九州初の屋内専用4面", url: "https://www.pivole.com/", note: "福岡市東・九州初の屋内専用・ソフトコート最大4面・シャワー完備" },
  { id: "tagawa-tc", name: "田川テニスクラブ ピックルボール専用コート", area: "福岡県", lat: 33.67, lng: 130.86, indoor: false, live: false, cat: "dedicated", plans: [courtPlan("tagawa-tc", 2200, "¥2,200/h")], rating: "九州初の屋外専用4面", url: "https://navi.play-pickleball.jp/", note: "田川郡香春・ハードコート4面常設・2025年" },
  { id: "pb-kumamoto", name: "ピックルボールくまもと", area: "熊本県", lat: 32.66, lng: 130.68, indoor: true, live: false, cat: "dedicated", plans: [courtPlan("pb-kumamoto", 500, "¥500/h")], rating: "屋内1面・喫茶併設", url: "https://reserva.be/pickleball55kumamoto", note: "宇城市・県内初の専用レンタルコート", cheap: true },
  { id: "nfl-tokushima", name: "NFL末広体育館", area: "徳島県", lat: 34.07, lng: 134.57, indoor: true, live: false, cat: "dedicated", plans: [courtPlan("nfl-tokushima", 2200, "1面¥2,200/h")], rating: "屋内4面", url: "https://nfl.works/pickleball/", note: "徳島市・徳島初の専用4面・2026年4月本開業・初回無料体験" },
  { id: "jiyu-marugame", name: "自遊空間 丸亀川西店", area: "香川県", lat: 34.30, lng: 133.80, indoor: true, live: false, cat: "dedicated", plans: [courtPlan("jiyu-marugame", 1120, "パック料金")], rating: "屋内常設", url: "https://jiqoo.jp/shop/9931650/", note: "丸亀市・ネットカフェ内の常設コート・2024年5月", cheap: true },

  // --- 北海道 ---
  { id: "neo-sapporo", name: "PLACE OF SPORTS NEO", area: "北海道", lat: 43.05, lng: 141.42, indoor: true, live: false, cat: "conv", plans: [courtPlan("neo-sapporo", 2000, "時間帯変動")], rating: "屋内6-8面・24時間", url: "https://neo-spo.com/", note: "札幌市白石・24時間利用可・通年・教室/大会あり" },

  // --- 旅先・リゾート（ホテル/温泉/リゾート併設） ---
  { id: "tokyu-hamanako", name: "東急リゾートタウン浜名湖", area: "静岡県", lat: 34.76, lng: 137.55, indoor: false, live: false, cat: "trip", plans: [courtPlan("tokyu-hamanako", 2200, "¥2,200/h")], rating: "USA公認4面", url: "https://www.tokyu-resort.co.jp/", note: "浜松市・USA Pickleball公認4面・リゾート内", resort: true },
  { id: "tokyu-tateshina", name: "東急リゾートタウン蓼科", area: "長野県", lat: 36.10, lng: 138.30, indoor: false, live: false, cat: "trip", plans: [courtPlan("tokyu-tateshina", 4000, "¥4,000/h")], rating: "USA公認2面", url: "https://www.tokyu-resort.co.jp/", note: "茅野市・甲信越初のUSA Pickleball公認2面", resort: true },
  { id: "pica-fujiyama", name: "PICA Fujiyama", area: "山梨県", lat: 35.48, lng: 138.77, indoor: false, live: false, cat: "trip", plans: [courtPlan("pica-fujiyama", 3000, "要問合せ")], rating: "全天候型", url: "https://www.pica-resort.jp/", note: "富士河口湖・東日本初の全天候型コート・2025年8月オープン", resort: true },
  { id: "nemu-resort", name: "NEMU RESORT", area: "三重県", lat: 34.30, lng: 136.79, indoor: false, live: false, cat: "trip", plans: [courtPlan("nemu-resort", 3000, "要問合せ")], rating: "リゾート内", url: "https://www.nemuresort.com/", note: "志摩市・伊勢志摩国立公園内・2026年4月オープン", resort: true },
  { id: "rusutsu", name: "ルスツリゾート ピックルボールコート", area: "北海道", lat: 42.74, lng: 140.90, indoor: false, live: false, cat: "trip", plans: [courtPlan("rusutsu", 3000, "¥3,000/h")], rating: "PJF公認8面", url: "https://rusutsu.com/summer-activities/pickleball/", note: "留寿都村・道内初の専用8面・観覧席あり（夏季営業）", resort: true },
  { id: "asarigawa", name: "朝里川温泉ホテル ピックルボールコート", area: "北海道", lat: 43.13, lng: 141.05, indoor: false, live: false, cat: "trip", plans: [courtPlan("asarigawa", 3000, "¥3,000/h（宿泊者無料）")], rating: "ホテル併設1面", url: "https://asarigawaonsenhotel.com/", note: "小樽市・温泉ホテル併設・宿泊者は1h無料・完全予約制", resort: true },
  { id: "halekulani-okinawa", name: "ハレクラニ沖縄", area: "沖縄県", lat: 26.43, lng: 127.80, indoor: false, live: false, cat: "trip", plans: [courtPlan("halekulani-okinawa", 5100, "¥5,100/h")], rating: "宿泊者限定", url: "https://www.okinawa.halekulani.com/activity/100/", note: "恩納村・ラグジュアリーリゾート・宿泊者限定・2024年6月", resort: true },
  { id: "nagasaki-stadium", name: "長崎スタジアムシティ ピックルボールコート", area: "長崎県", lat: 32.76, lng: 129.86, indoor: false, live: false, cat: "trip", plans: [courtPlan("nagasaki-stadium", 500, "平日¥500〜")], rating: "屋外5面・屋上", url: "https://www.nagasakistadiumcity.com/activity/pickleball/", note: "長崎市・HAPPINESS ARENA屋上5面・年中無休・アプリ予約", resort: true, cheap: true },
  { id: "kpi-park", name: "KPI PARK", area: "横浜市戸塚区", lat: 35.3916, lng: 139.5306, indoor: false, live: false, cat: "dedicated", plans: [courtPlan("kpi-park", 3000, "要問合せ")], url: "https://pickle-one.com/court/kanagawa/yokohama/kpi-park/", note: "屋外ハードコート、2024年11月グランドオープンの神奈川県最大級ピックルボール専用施設（開業時10面、2026年5月時点で14面）" },
  { id: "konami-omiya", name: "コナミスポーツ テニススクール大宮", area: "さいたま市大宮区桜木町", lat: 35.9063, lng: 139.6238, indoor: false, live: false, cat: "conv", plans: [courtPlan("konami-omiya", 3000, "要問合せ")], url: "https://prtimes.jp/main/html/rd/p/000000111.000056940.html", note: "DOMショッピングセンター屋上に屋外ピックルボールコート2面、2024年8月に導入開始" },
  { id: "tennis-club-f", name: "テニスクラブF", area: "上尾市堤崎", lat: 35.9756, lng: 139.5926, indoor: false, live: false, cat: "conv", plans: [courtPlan("tennis-club-f", 3000, "要問合せ")], url: "https://pickle-one.com/court/saitama/ageo/ftennis/", note: "ハードコート・ナイター照明ありの屋外コートでピックルボール利用可" },
  { id: "tipness-kawaguchi", name: "ティップネス川口", area: "川口市", lat: 35.8078, lng: 139.7241, indoor: true, live: false, cat: "conv", plans: [courtPlan("tipness-kawaguchi", 3000, "要問合せ")], url: "https://pickle-one.com/court/saitama/kawaguchi/tipness_kawaguchi/", note: "フィットネスクラブのスタジオでピックルボールプログラムを実施" },
  { id: "pickle-bang-theory", name: "THE PICKLE BANG THEORY", area: "市川市", lat: 35.7217, lng: 139.9186, indoor: true, live: false, cat: "dedicated", plans: [courtPlan("pickle-bang-theory", 3000, "要問合せ")], url: "https://prtimes.jp/main/html/rd/p/000000003.000179043.html", note: "JR本八幡駅徒歩1分の都市型インドア施設、2026年春オープン" },
  { id: "ttc-yoshida", name: "TTC吉田記念テニス研修センター", area: "柏市花野井", lat: 35.8676, lng: 139.9709, indoor: true, live: false, cat: "conv", plans: [courtPlan("ttc-yoshida", 3000, "要問合せ")], url: "https://www.tennisbear.net/event/857874/info", note: "インドアコートでピックルボール練習会（初心者体験枠）を開催" },
  { id: "godai-kameido", name: "GODAI亀戸", area: "江東区亀戸", lat: 35.6975, lng: 139.8256, indoor: true, live: false, cat: "dedicated", plans: [courtPlan("godai-kameido", 13200, "月謝13,200円")], url: "https://www.godai.gr.jp/kameido/news/archives/2024103593/", note: "テニス・ゴルフスクール内で2024年11月にピックルボールクラスを開講" },
  { id: "shinagawa-prince", name: "品川プリンスホテル ピックルボールコート", area: "港区高輪", lat: 35.6284, lng: 139.7375, indoor: true, live: false, cat: "dedicated", plans: [courtPlan("shinagawa-prince", 8000, "平日8,000〜11,000円/50分")], url: "https://prtimes.jp/main/html/rd/p/000000092.000099545.html", note: "メインタワー10階の宴会場活用、屋内コート1面、2026年3月開始" },
  { id: "round1-itabashi", name: "ラウンドワンスタジアム板橋店", area: "板橋区", lat: 35.7512, lng: 139.7093, indoor: true, live: false, cat: "conv", plans: [courtPlan("round1-itabashi", 3000, "要問合せ")], url: "https://play-pickleball.jp/?p=793", note: "スポッチャ内でピックルボールを体験可能" },
  { id: "round1-diver-city", name: "ラウンドワンスタジアムダイバーシティ東京プラザ店", area: "江東区お台場", lat: 35.6267, lng: 139.7746, indoor: true, live: false, cat: "conv", plans: [courtPlan("round1-diver-city", 3000, "要問合せ")], url: "https://play-pickleball.jp/?p=793", note: "スポッチャ内でピックルボールを体験可能" },
  { id: "round1-kawasaki-daishi", name: "ラウンドワンスタジアム川崎大師店", area: "川崎市川崎区", lat: 35.5308, lng: 139.7029, indoor: true, live: false, cat: "conv", plans: [courtPlan("round1-kawasaki-daishi", 3000, "要問合せ")], url: "https://play-pickleball.jp/?p=793", note: "スポッチャ内でピックルボールを体験可能" },
  { id: "noah-miyamaedaira", name: "テニス&バドミントンスクール・ノア川崎宮前平校", area: "川崎市宮前区土橋", lat: 35.5877, lng: 139.5713, indoor: true, live: false, cat: "conv", plans: [courtPlan("noah-miyamaedaira", 3000, "要問合せ")], url: "https://noah-miyamaedaira.com/pickleball/", note: "空調完備の屋内コートでピックルボール体験会・クラスを開催" },
  { id: "tokyu-todoroki-arena", name: "東急ドレッセとどろきアリーナ", area: "川崎市中原区", lat: 35.5769, lng: 139.6577, indoor: true, live: false, cat: "public", plans: [courtPlan("tokyu-todoroki-arena", 1500, "参加費1,500円")], url: "https://www.tennisbear.net/pickleball/event/1124693/info", note: "オープンプレイピックルボールイベントを開催" },
  { id: "asabara-taiken", name: "浅原体験村", area: "みどり市大間々町浅原", lat: 36.4361, lng: 139.2694, indoor: false, live: false, cat: "dedicated", plans: [courtPlan("asabara-taiken", 3000, "無料")], url: "https://r.goope.jp/asabara/info/5585654", note: "土日祝11:00〜14:30、ネット・道具を無料開放" },
  { id: "shobuzawa-park", name: "菖蒲沢公園ピックルボールコート", area: "さくら市", lat: 36.6539, lng: 139.9847, indoor: false, live: false, cat: "dedicated", plans: [courtPlan("shobuzawa-park", 3000, "要問合せ")], url: "https://www.city.tochigi-sakura.lg.jp/sightseeing/000041/000248/p004842.html", note: "廃止された旧テニスコートを転用、8面整備" },
  { id: "nanko-tennis", name: "南港中央庭球場 ピックルボールコート", area: "大阪市住之江区", lat: 34.6136, lng: 135.4681, indoor: false, live: false, cat: "dedicated", plans: [courtPlan("nanko-tennis", 500, "平日500円/面時間")], url: "https://www.nanko-btb.jp/tennis/pickleball/", note: "南港中央公園内、2024年12月2面設置、2025年4月4面へ増設" },
  { id: "morita-utsubo", name: "モリタテニスセンター靱", area: "大阪市西区靭本町", lat: 34.6813, lng: 135.4869, indoor: false, live: false, cat: "conv", plans: [courtPlan("morita-utsubo", 500, "レンタル500円")], url: "https://prtimes.jp/main/html/rd/p/000000282.000091052.html", note: "靱公園テニスコートでピックルボールレンタル利用開始" },
  { id: "esaka-tennis", name: "江坂テニスセンター", area: "吹田市芳野町", lat: 34.7617, lng: 135.5183, indoor: true, live: false, cat: "conv", plans: [courtPlan("esaka-tennis", 3850, "3,850〜4,950円/h")], url: "https://pickle-one.com/court/osaka/suita/esaka/", note: "屋内4面・屋外2面のピックルコート併設、大会会場実績あり" },
  { id: "tondabayashi-nakano", name: "富田林 中野テニスコート", area: "富田林市中野町", lat: 34.5064, lng: 135.5981, indoor: false, live: false, cat: "conv", plans: [courtPlan("tondabayashi-nakano", 1010, "1,010〜2,020円")], url: "https://pickle-one.com/court/osaka/", note: "屋外1面のテニスコートをピックルボール利用でレンタル可能" },
  { id: "tipness-tennoji-osaka", name: "ティップネス天王寺", area: "大阪市阿倍野区", lat: 34.6392, lng: 135.5136, indoor: true, live: false, cat: "conv", plans: [courtPlan("tipness-tennoji-osaka", 3000, "要問合せ")], url: "https://pickle-one.com/court/osaka/osakacity/tipness_tenoji/", note: "フィットネスクラブ内にピックルボールコート1面" },
  { id: "tipness-takatsuki", name: "ティップネス高槻", area: "高槻市上田辺町", lat: 34.8461, lng: 135.6172, indoor: true, live: false, cat: "conv", plans: [courtPlan("tipness-takatsuki", 3000, "要問合せ")], url: "https://pickle-one.com/court/osaka/takatsuki/tipness_takatsuki/", note: "フィットネスクラブ内にピックルボールコート" },
  { id: "tipness-ishibashi", name: "ティップネス石橋阪大前", area: "池田市井口堂", lat: 34.8181, lng: 135.4283, indoor: true, live: false, cat: "conv", plans: [courtPlan("tipness-ishibashi", 3000, "要問合せ")], url: "https://fitsearch.jp/group/tipness/osaka", note: "フィットネスクラブ内にピックルボールコート" },
  { id: "tipness-kyobashi", name: "ティップネス京橋", area: "大阪市都島区", lat: 34.7017, lng: 135.5228, indoor: true, live: false, cat: "conv", plans: [courtPlan("tipness-kyobashi", 3000, "要問合せ")], url: "https://pickle-one.com/court/osaka/osakacity/tipness_kyobashi/", note: "フィットネスクラブ内にピックルボールコート" },
  { id: "noah-kyuhoji", name: "ノア大阪久宝寺校", area: "八尾市龍華町", lat: 34.6167, lng: 135.6003, indoor: true, live: false, cat: "conv", plans: [courtPlan("noah-kyuhoji", 9350, "月謝9,350円")], url: "https://noah-kyuhoji.com/pickleball/", note: "パドル・シューズ無料貸出のピックルボールクラスを週4回開講" },
  { id: "mizuno-wadamisaki", name: "ミズノスポーツプラザ神戸和田岬", area: "神戸市兵庫区", lat: 34.6828, lng: 135.1758, indoor: true, live: false, cat: "public", plans: [courtPlan("mizuno-wadamisaki", 3000, "要問合せ")], url: "https://shisetsu.mizuno.jp/MSS-7365/news/page/51658", note: "ピックルボール体験会・ゲーム会を定期開催" },
  { id: "mizuno-shioashiya", name: "ミズノスポーツプラザ潮芦屋", area: "芦屋市涼風町", lat: 34.7328, lng: 135.3081, indoor: true, live: false, cat: "public", plans: [courtPlan("mizuno-shioashiya", 2, "2h 4,350〜4,950円")], url: "https://shisetsu.mizuno.jp/mss-7353/news/page/7724", note: "多目的コートでピックルボールレンタルを開始" },
  { id: "noah-myodani", name: "ノア神戸名谷校", area: "神戸市垂水区", lat: 34.6339, lng: 135.0561, indoor: true, live: false, cat: "conv", plans: [courtPlan("noah-myodani", 3000, "要問合せ")], url: "https://noah-myodani.com/pickleball/", note: "初心者向けピックルボールクラス・体験会" },
  { id: "noah-nishinomiya", name: "ノア西宮校（鳴尾浜）", area: "西宮市鳴尾浜", lat: 34.7106, lng: 135.3383, indoor: true, live: false, cat: "conv", plans: [courtPlan("noah-nishinomiya", 9900, "月謝約9,900円")], url: "https://randaall.com/pickleball-hyogo2/", note: "ピックルボール初心者クラス・体験レッスン" },
  { id: "itami-gym", name: "伊丹市立体育館", area: "伊丹市", lat: 34.7833, lng: 135.4, indoor: true, live: false, cat: "public", plans: [courtPlan("itami-gym", 3000, "要問合せ")], url: "https://randaall.com/pickleball-hyogo2/", note: "有志によるピックルボール練習会が定期開催" },
  { id: "showa-kakogawa", name: "SHOWAグループ総合体育館", area: "加古川市", lat: 34.7575, lng: 134.8394, indoor: true, live: false, cat: "public", plans: [courtPlan("showa-kakogawa", 3000, "要問合せ")], url: "https://kakogawa.goguynet.jp/2026/04/19/pickleball/", note: "はりまのくにピックルボール大会の開催実績あり" },
  { id: "yamashina-gym", name: "山科地域体育館", area: "京都市山科区", lat: 34.9819, lng: 135.8256, indoor: true, live: false, cat: "public", plans: [courtPlan("yamashina-gym", 3000, "要問合せ")], url: "https://www.kyoto-taiikukan.com/pickleball", note: "ピックルボール教室を木曜午後に開講" },
  { id: "daigo-gym", name: "醍醐地域体育館", area: "京都市伏見区", lat: 34.9328, lng: 135.7628, indoor: true, live: false, cat: "public", plans: [courtPlan("daigo-gym", 1, "1回1,100円")], url: "https://www.kyoto-taiikukan.com/pickleball", note: "ピックルボール教室を火曜午前・金曜夜に開講" },
  { id: "higashiyama-gym", name: "東山地域体育館", area: "京都市東山区", lat: 35.0011, lng: 135.7789, indoor: true, live: false, cat: "public", plans: [courtPlan("higashiyama-gym", 3000, "要問合せ")], url: "https://www.kyoto-taiikukan.com/pickleball", note: "ピックルボール教室を金曜午前に開講" },
  { id: "ymit-arena", name: "YMITアリーナ", area: "草津市", lat: 35.0175, lng: 135.9628, indoor: true, live: false, cat: "public", plans: [courtPlan("ymit-arena", 3000, "要問合せ")], url: "https://pickle-one.com/circle/", note: "Team Shiga Pickleballが月・金・日夜に活動" },
  { id: "tennis-lounge-meisai", name: "テニスラウンジ名西", area: "名古屋市西区東枇杷島", lat: 35.1789, lng: 136.8886, indoor: true, live: false, cat: "conv", plans: [courtPlan("tennis-lounge-meisai", 3000, "要問合せ")], url: "https://pickle-one.com/court/aichi/nagoya/", note: "屋内2面、高密度人工芝" },
  { id: "tennis-lounge-shinsakae", name: "テニスラウンジ ウェルネススクエア新栄校", area: "名古屋市中区新栄", lat: 35.1656, lng: 136.9083, indoor: false, live: false, cat: "conv", plans: [courtPlan("tennis-lounge-shinsakae", 1, "1h 4,400円")], url: "https://pickle-one.com/court/aichi/nagoya/tennislounge/", note: "ハードコート、屋外2面分のライン設置" },
  { id: "tipness-kamiida", name: "ティップネス上飯田", area: "名古屋市北区", lat: 35.2003, lng: 136.9106, indoor: true, live: false, cat: "conv", plans: [courtPlan("tipness-kamiida", 3000, "要問合せ")], url: "https://pickle-one.com/court/aichi/nagoya/", note: "スタジオ利用の屋内コート1面" },
  { id: "craspo-gamagori", name: "クラスポ スマイルパーク蒲郡", area: "蒲郡市鹿島町", lat: 34.8283, lng: 137.2225, indoor: true, live: false, cat: "dedicated", plans: [courtPlan("craspo-gamagori", 1, "1面1h 2,200円")], url: "https://straightpress.jp/20260612/1634200", note: "東三河初の屋内専用コート、屋内4面、2026年6月オープン" },
  { id: "noah-hyotanyama", name: "ノア名古屋瓢箪山校", area: "名古屋市守山区", lat: 35.2064, lng: 136.9878, indoor: true, live: false, cat: "conv", plans: [courtPlan("noah-hyotanyama", 3000, "要問合せ")], url: "https://noah-hyotanyama.com/pickleball/", note: "ピックルボール初心者レッスン・体験会、道具貸出無料" },
  { id: "nagoya-chikusa-sc", name: "名古屋市千種スポーツセンター", area: "名古屋市千種区", lat: 35.1611, lng: 136.9603, indoor: true, live: false, cat: "public", plans: [courtPlan("nagoya-chikusa-sc", 3000, "要問合せ")], url: "https://local-media.heteml.net/archives/35313", note: "バドコートを使いピックルボール可、予約制" },
  { id: "nagoya-higashi-sc", name: "名古屋市東スポーツセンター", area: "名古屋市東区", lat: 35.1789, lng: 136.9231, indoor: true, live: false, cat: "public", plans: [courtPlan("nagoya-higashi-sc", 3000, "要問合せ")], url: "https://local-media.heteml.net/archives/35313", note: "ピックルボール練習会を定期開催" },
  { id: "olympia-yokkaichi", name: "オリンピアスポーツクラブ", area: "四日市市末永町", lat: 34.9653, lng: 136.6247, indoor: true, live: false, cat: "dedicated", plans: [courtPlan("olympia-yokkaichi", 3000, "要問合せ")], url: "https://www.olympia-sportsclub.com/blog/%E3%83%94%E3%83%83%E3%82%AF%E3%83%AB%E3%83%9C%E3%83%BC%E3%83%AB%E3%81%AF%E3%81%98%E3%82%81%E3%81%BE%E3%81%97%E3%81%9F/", note: "三重県初のJPA公認ピックルボールレンタルコート" },
  { id: "tipness-hamamatsu", name: "ティップネス浜松葵東", area: "浜松市中央区葵東", lat: 34.7191, lng: 137.7444, indoor: true, live: false, cat: "conv", plans: [courtPlan("tipness-hamamatsu", 3000, "要問合せ")], url: "https://pickle-times.com/coart/shizuoka-pickleball-facilities/", note: "フルサイズ屋内コート、パドル・ボール無料貸出" },
  { id: "tipness-fujieda", name: "ティップネス藤枝", area: "藤枝市", lat: 34.8664, lng: 138.2597, indoor: true, live: false, cat: "conv", plans: [courtPlan("tipness-fujieda", 3000, "要問合せ")], url: "https://pickle-times.com/coart/shizuoka-pickleball-facilities/", note: "JR藤枝駅直結、道具・駐車場無料" },
  { id: "megalos-hamamatsu", name: "メガロス浜松市野", area: "浜松市", lat: 34.7108, lng: 137.7269, indoor: true, live: false, cat: "conv", plans: [courtPlan("megalos-hamamatsu", 3000, "要問合せ")], url: "https://megalos.co.jp/contents/event/pickleball/", note: "テニスコートでピックルボール体験会、18歳以上参加可" },
  { id: "ogaki-gym", name: "大垣総合体育館 第二体育館", area: "大垣市加賀野", lat: 35.3606, lng: 136.6108, indoor: true, live: false, cat: "public", plans: [courtPlan("ogaki-gym", 1, "1回500円")], url: "https://www.tennisbear.net/pickleball/event/795348/info", note: "屋内3面を使い体験会・練習会を開催" },
  { id: "yamanouchi-elementary", name: "山ノ内町東小学校体育館", area: "下高井郡山ノ内町", lat: 36.7275, lng: 138.4136, indoor: true, live: false, cat: "public", plans: [courtPlan("yamanouchi-elementary", 3000, "要問合せ")], url: "https://www.town.yamanouchi.nagano.jp/soshiki/sports/gyomu/sports/yamanouchisportsclub/otonasports/3715.html", note: "町主催ピックルボール教室、小学生以上対象" },
  { id: "marine-blue-niigata", name: "マリンブルーテニススクール", area: "新潟市中央区", lat: 37.9161, lng: 139.0364, indoor: true, live: false, cat: "conv", plans: [courtPlan("marine-blue-niigata", 1100, "体験1,100円")], url: "https://marineblue.co.jp/pickleball/", note: "新潟県内初のピックルボールレッスン、全面室内コート" },
  { id: "santas-toyama", name: "sanTasピックルボールクラブ", area: "砺波市東石丸", lat: 36.6486, lng: 136.9611, indoor: true, live: false, cat: "dedicated", plans: [courtPlan("santas-toyama", 3000, "要問合せ")], url: "https://www.santas-n.com/service-category/toyama-pickleball/", note: "富山県唯一の専用室内コート2面、会員制複合施設内" },
  { id: "pickle-beat-komatsu", name: "ピックルビート小松", area: "小松市安宅町", lat: 36.3906, lng: 136.4239, indoor: true, live: false, cat: "dedicated", plans: [courtPlan("pickle-beat-komatsu", 500, "初回無料、以降500円")], url: "https://www.komatsuguide.jp/spot/detail_485.html", note: "石川県内の常設コート、屋内1面＋ハーフコート" },
  { id: "yoshitomi-park", name: "吉富町ピックルボールコート", area: "築上郡吉富町", lat: 33.5619, lng: 131.1836, indoor: false, live: false, cat: "dedicated", plans: [courtPlan("yoshitomi-park", 3000, "要問合せ")], url: "https://www.town.yoshitomi.lg.jp/gyosei/chosei/v995/y209/kyouiku_iinkai/x162/v502/", note: "屋外3面、2025年9月完成、河川敷公園内" },
  { id: "cosmos-kumamoto", name: "熊本県フットボールセンター（COSMOS）", area: "上益城郡嘉島町", lat: 32.7833, lng: 130.7833, indoor: false, live: false, cat: "dedicated", plans: [courtPlan("cosmos-kumamoto", 3000, "要問合せ")], url: "https://prtimes.jp/main/html/rd/p/000000015.000102265.html", note: "ピックルボール専用コート2面を新設" },
  { id: "goldsgym-uki", name: "ゴールドジム宇城熊本", area: "宇城市小川町", lat: 32.6386, lng: 130.6608, indoor: true, live: false, cat: "conv", plans: [courtPlan("goldsgym-uki", 3000, "要問合せ")], url: "https://www.goldsgym.jp/shop/20210628", note: "2024年ピックルボール導入、会員はコート利用可" },
  { id: "round1-kumamoto", name: "ラウンドワンスタジアム熊本店", area: "熊本市西区春日", lat: 32.8, lng: 130.6667, indoor: true, live: false, cat: "conv", plans: [courtPlan("round1-kumamoto", 3000, "要問合せ")], url: "https://www.round1.co.jp/shop/facility/kumamoto-kumamoto.html", note: "スポッチャでピックルボールプレー可能" },
  { id: "chatan-sports-center", name: "北谷スポーツセンター", area: "中頭郡北谷町", lat: 26.3181, lng: 127.7644, indoor: false, live: false, cat: "public", plans: [courtPlan("chatan-sports-center", 30, "30分500円")], url: "https://chatan-spc.com/tennis/", note: "屋外テニスコート3面を開放、ナイター照明・シャワー完備" },
  { id: "effort-tennis-okinawa", name: "エフォートテニスクラブ沖縄", area: "中頭郡北中城村", lat: 26.3319, lng: 127.7975, indoor: false, live: false, cat: "conv", plans: [courtPlan("effort-tennis-okinawa", 1, "1回500円")], url: "https://tennis-okinawa.com/1180/", note: "テニスクラブ内でピックルボールサークル活動" },
  { id: "naha-city-gym", name: "那覇市民体育館", area: "那覇市字識名", lat: 26.2027, lng: 127.6928, indoor: true, live: false, cat: "public", plans: [courtPlan("naha-city-gym", 3000, "要問合せ")], url: "https://www.city.naha.okinawa.jp/shisetsu/sports/1007501/1004884.html", note: "サブアリーナでピックルボール利用可能" },
  { id: "sungreen-kagoshima", name: "サングリーンテニススクール", area: "鹿児島市与次郎", lat: 31.5794, lng: 130.5606, indoor: false, live: false, cat: "conv", plans: [courtPlan("sungreen-kagoshima", 3000, "要問合せ")], url: "http://s-green.jp/school/", note: "ピックルボールレンタルコートを開始、スクール生は半額" },
  { id: "nb-tennis-garden", name: "NBテニスガーデン", area: "広島市西区山田町", lat: 34.3894, lng: 132.4353, indoor: false, live: false, cat: "conv", plans: [courtPlan("nb-tennis-garden", 4400, "ビジター4,400円/h")], url: "https://randaall.com/pickleball-hiroshima2/", note: "屋外テニスコートにピックルボール用ライン" },
  { id: "pickle-fukuyama", name: "ピックル福山（三菱電機福山体育館）", area: "福山市緑町", lat: 34.4858, lng: 133.3625, indoor: true, live: false, cat: "public", plans: [courtPlan("pickle-fukuyama", 3000, "要問合せ")], url: "https://pickleball-fukuyama.com/", note: "福山市初のピックルボールチームが毎週火木夜に練習" },
  { id: "ihi-arena-kure", name: "IHIアリーナ呉", area: "呉市", lat: 34.2492, lng: 132.5656, indoor: true, live: false, cat: "public", plans: [courtPlan("ihi-arena-kure", 3000, "要問合せ")], url: "https://randaall.com/pickleball-hiroshima2/", note: "メインアリーナに臨時コート2面を設営し体験会開催" },
  { id: "setomintan", name: "せとみんとん（岡山市内体育館）", area: "岡山市", lat: 34.6551, lng: 133.9195, indoor: true, live: false, cat: "public", plans: [courtPlan("setomintan", 1, "1回400円")], url: "https://navi.play-pickleball.jp/pickleballsearch/%E3%81%9B%E3%81%A8%E3%81%BF%E3%82%93%E3%81%A8%E3%82%93/", note: "2026年2月始動の新サークル、週2回活動" },
  { id: "pikkurashiki", name: "ぴっくらしき（倉敷市内体育館）", area: "倉敷市", lat: 34.5851, lng: 133.7722, indoor: true, live: false, cat: "public", plans: [courtPlan("pikkurashiki", 1, "1回500円")], url: "https://www.k-sports.or.jp/organization/63246/", note: "会員約150名、小学生〜大人まで参加" },
  { id: "fukui-tennis-club", name: "ふくいテニスクラブ", area: "下関市楠乃", lat: 33.9578, lng: 130.9406, indoor: false, live: false, cat: "conv", plans: [courtPlan("fukui-tennis-club", 3000, "要問合せ")], url: "https://www.fukuitennis.com/", note: "山口県内初の屋外ピックルボール専用コートを手作りで設置" },
  { id: "pickleball-ehime", name: "ピックルボールえひめ", area: "松山市上野町", lat: 33.8206, lng: 132.7719, indoor: true, live: false, cat: "dedicated", plans: [courtPlan("pickleball-ehime", 550, "体験550円")], url: "https://www.tennisbear.net/pickleball/event/683927/info", note: "毎週火曜体験会、2025年えひめオープン開催実績" },
  { id: "pickleball-kochi", name: "ピックルボール高知", area: "高知市", lat: 33.5597, lng: 133.5311, indoor: true, live: false, cat: "dedicated", plans: [courtPlan("pickleball-kochi", 1, "1回200〜400円")], url: "https://randaall.com/pickleball-kouchi2/", note: "火・金曜10-13時に定期練習" },
  { id: "mure-pickleball", name: "むれピックルボール（牟礼中央公園運動センター）", area: "高松市牟礼町", lat: 34.3489, lng: 134.1214, indoor: true, live: false, cat: "public", plans: [courtPlan("mure-pickleball", 1, "1回300円")], url: "https://www.tennisbear.net/pickleball/circle/36791/info", note: "毎週木曜9-12時に活動、飛び入り参加可" },
  { id: "yonago-circle", name: "米子市内体育館ピックルボールサークル", area: "米子市", lat: 35.4281, lng: 133.3308, indoor: true, live: false, cat: "public", plans: [courtPlan("yonago-circle", 1, "1回500円")], url: "https://navi.play-pickleball.jp/pickleballsearch/%E3%83%94%E3%83%83%E3%82%AF%E3%83%AB%E3%83%9C%E3%83%BC%E3%83%AB%E5%A7%8B%E3%82%81%E3%81%BE%E3%81%9B%E3%82%93%E3%81%8B%E2%99%AA%EF%BC%A0%E9%B3%A5%E5%8F%96/", note: "2018年発足、週末昼に約20名が参加" },
  { id: "tennis-arena-garden-tokushima", name: "テニスアリーナガーデン徳島", area: "徳島市住吉", lat: 34.0714, lng: 134.5533, indoor: true, live: false, cat: "public", plans: [courtPlan("tennis-arena-garden-tokushima", 3000, "要問合せ")], url: "https://tagtennis.com/pickleball/", note: "屋内テニススクールでレンタルコート・体験会・大会を開催" },
  { id: "rising-kitano", name: "ライジングテニスクラブ北野校", area: "札幌市清田区", lat: 42.9878, lng: 141.4331, indoor: true, live: false, cat: "conv", plans: [courtPlan("rising-kitano", 3000, "要問合せ")], url: "https://rising2005.com/kitano/", note: "テニススクール内にピックルボール専用コート完備" },
  { id: "play-pickleball-tomakomai", name: "プレイピックルボール苫小牧", area: "苫小牧市", lat: 42.6339, lng: 141.6053, indoor: true, live: false, cat: "dedicated", plans: [courtPlan("play-pickleball-tomakomai", 100, "ドロップイン100円")], url: "https://www.tennisbear.net/pickleball/circle/92034/info", note: "若草小学校で月曜練習、月1回体験会" },
  { id: "sunbow-akita", name: "indoor sports park SUNBOW", area: "大仙市高梨", lat: 39.4508, lng: 140.4711, indoor: true, live: false, cat: "dedicated", plans: [courtPlan("sunbow-akita", 3000, "要問合せ")], url: "https://navi.play-pickleball.jp/pickleballsearch/indoor-sports-park-sunbow/", note: "秋田県内唯一のピックルボール専用コート、空調完備" },
  { id: "pickleball-branch-sendai", name: "PICKLEBALL BRANCHせんだい", area: "仙台市", lat: 38.2682, lng: 140.8694, indoor: true, live: false, cat: "dedicated", plans: [courtPlan("pickleball-branch-sendai", 3000, "要問合せ")], url: "https://navi.play-pickleball.jp/pickleballsearch/pickleball-branch-%E3%81%9B%E3%82%93%E3%81%A0%E3%81%84/", note: "20〜30代社会人向けサークル、JPA認定コーディネーター在籍" },
  { id: "sendai-pickleball-kiko", name: "仙台ピックルボール機構", area: "仙台市青葉区", lat: 38.2682, lng: 140.8583, indoor: true, live: false, cat: "dedicated", plans: [courtPlan("sendai-pickleball-kiko", 3000, "要問合せ")], url: "https://pickleball-s.net/", note: "パドル無料貸出、ピックルボール運動会を定期開催" },
  { id: "morioka-circle", name: "もりおかピックルボールサークル", area: "盛岡市", lat: 39.7036, lng: 141.1527, indoor: true, live: false, cat: "dedicated", plans: [courtPlan("morioka-circle", 300, "300円/回")], url: "https://jmty.jp/iwate/com-spo/article-1cyuhq", note: "18歳以上・経験不問、毎週日曜開催" },
  { id: "round1-fukushima", name: "ラウンドワンスタジアム福島店", area: "福島市太田町", lat: 37.7608, lng: 140.4747, indoor: true, live: false, cat: "conv", plans: [courtPlan("round1-fukushima", 3000, "要問合せ")], url: "https://www.round1.co.jp/shop/facility/fukushima-fukushima.html", note: "スポッチャでピックルボールが稼働" },
];

/* 施設の詳細情報（分かっているものだけ）。access=最寄駅, hours=営業時間, amenities=設備 */
const FAC_META = {
  pickle9:      { access: "表参道駅 徒歩5分", hours: "9:00–22:00", amenities: ["indoor", "rental", "shower", "shop"] },
  one:          { access: "新橋駅 徒歩5分 / 銀座駅 徒歩7分", hours: "6:00–23:00", amenities: ["indoor", "rental", "shop", "lesson"] },
  pacific:      { access: "有明テニスの森駅 徒歩8分", hours: "9:00–22:00", amenities: ["outdoor", "rental", "food"] },
  sansan:       { access: "東池袋駅 徒歩3分", hours: "9:00–23:00", amenities: ["indoor", "rental", "lesson"] },
  "shibuya-pc": { access: "渋谷駅 徒歩7分（宇田川町）", hours: "10:00–22:00", amenities: ["indoor", "rental"] },
  shiomi:       { access: "潮見駅 徒歩10分", hours: "7:00–23:00", amenities: ["outdoor", "rental"] },
  seibu:        { access: "品川駅 徒歩3分（プリンスホテル10F）", hours: "要問合せ", amenities: ["indoor", "rental", "shower"] },
  tebura:       { access: "国際展示場駅 徒歩8分", hours: "10:00–22:00", amenities: ["indoor", "rental", "lesson"] },
  tower:        { access: "赤羽橋駅 徒歩5分", hours: "要問合せ", amenities: ["outdoor", "rental"] },
  "ariake-park":{ access: "有明テニスの森駅 徒歩7分", hours: "9:00–21:00（ナイター可）", amenities: ["outdoor", "parking"] },
  "shibuya-sc": { access: "渋谷駅 徒歩15分", hours: "9:00–22:00", amenities: ["indoor", "parking"] },
  cosmic:       { access: "飯田橋駅 徒歩8分", hours: "9:00–21:30", amenities: ["indoor"] },
  nakano:       { access: "鷺ノ宮駅 徒歩10分", hours: "9:00–22:00", amenities: ["indoor", "parking"] },
  omori:        { access: "大森駅 徒歩12分", hours: "9:00–22:00", amenities: ["indoor", "shower", "parking"] },
  katsushika:   { access: "金町駅 バス", hours: "要問合せ", amenities: ["outdoor", "rental", "parking"] },
  kawagoe:      { access: "笠幡駅 徒歩 / 関越自動車道", hours: "–22:30", amenities: ["outdoor", "parking"] },
  "vip-toyocho":{ access: "東陽町駅 徒歩5分", hours: "9:00–23:00", amenities: ["indoor", "rental", "lesson"] },
  "meiji-park": { access: "国立競技場駅 徒歩3分", hours: "9:00–21:00", amenities: ["outdoor", "rental", "lesson"] },
  hilton:       { access: "西新宿駅 徒歩3分 / 新宿駅 徒歩10分", hours: "平日 –22:00", amenities: ["outdoor", "rental", "shower", "lesson"] },
  cesame:       { access: "東久留米駅 徒歩 / 駐車場あり", hours: "要問合せ", amenities: ["outdoor", "rental", "parking", "lesson"] },
  "tip-shibuya":{ access: "渋谷駅 徒歩3分", hours: "施設営業時間内", amenities: ["indoor", "rental", "shower"] },
  "chuo-sports":{ access: "浜町駅 徒歩5分", hours: "9:00–22:00", amenities: ["indoor", "shower", "parking"] },
  "picklr-toyosu":{ access: "豊洲駅 徒歩8分（塩浜）", hours: "開業前", amenities: ["indoor", "rental", "shower", "lesson"] },
};
const AMENITY = {
  indoor:  { icon: "🏠", label: "屋内" },
  outdoor: { icon: "☀️", label: "屋外" },
  rental:  { icon: "🎾", label: "用具レンタル" },
  shower:  { icon: "🚿", label: "シャワー" },
  shop:    { icon: "🛍", label: "ショップ" },
  food:    { icon: "🍽", label: "飲食" },
  lesson:  { icon: "📖", label: "レッスン" },
  parking: { icon: "🅿️", label: "駐車場" },
};

const CATS = [
  { key: "all", label: "すべて" },
  { key: "dedicated", label: "専用コート" },
  { key: "public", label: "公共・格安" },
  { key: "conv", label: "テニス転用" },
  { key: "trip", label: "🏝 旅先・リゾート" },
];

const AREA_COORDS = {
  "港区": { lat: 35.658, lng: 139.745 }, "中央区": { lat: 35.67, lng: 139.772 }, "江東区": { lat: 35.65, lng: 139.8 },
  "豊島区": { lat: 35.73, lng: 139.715 }, "渋谷区": { lat: 35.66, lng: 139.7 }, "新宿区": { lat: 35.7, lng: 139.71 },
  "世田谷区": { lat: 35.646, lng: 139.653 }, "目黒区": { lat: 35.63, lng: 139.69 }, "品川区": { lat: 35.61, lng: 139.73 },
  "中野区": { lat: 35.69, lng: 139.66 }, "大田区": { lat: 35.58, lng: 139.72 }, "葛飾区": { lat: 35.75, lng: 139.85 },
  "東京都下": { lat: 35.7, lng: 139.5 },
  "埼玉県": { lat: 35.9, lng: 139.55 }, "神奈川県": { lat: 35.45, lng: 139.55 }, "千葉県": { lat: 35.6, lng: 140.1 }, "その他": { lat: 35.68, lng: 139.75 },
};

/* 空き状況はプラン単位でモック（fac.id + plan.id でハッシュ） */
function slotStatusFor(fac, plan, dayKey, bandKey) {
  if (!fac.live) return "portal";
  let h = 0;
  const s = fac.id + plan.id + dayKey + bandKey;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h % 10 < 4 ? "open" : "full";
}
const freshness = (offset) => (offset <= 7 ? "15分毎更新" : offset <= 30 ? "1時間毎更新" : "1日1回更新");

/* プラン種別バッジ定義 */
const KIND = {
  court: { label: "コート貸切", icon: "🎾", color: T.courtDeep, bg: "#E7F2F1" },
  event: { label: "体験会", icon: "🎪", color: "#8A4B2D", bg: "#F9EBE2" },
  lesson: { label: "レッスン", icon: "📖", color: "#5B5B8A", bg: "#ECECF7" },
};
const courtPlansOf = (fac) => (fac.plans || []).filter((p) => p.kind === "court");
const hasCourt = (fac) => courtPlansOf(fac).length > 0;
const minCourtPrice = (fac) => {
  const c = courtPlansOf(fac);
  return c.length ? Math.min(...c.map((p) => p.price)) : Infinity;
};
const unitLabel = (u) => (u === "1h" ? "h" : u);
const planPrice = (p) => p.label || `¥${p.price.toLocaleString()}/${unitLabel(p.unit)}`;
/* 一覧カード用: コート貸切の最安値（labelがあればそのまま、無ければ「¥N/h〜」） */
const cardPrice = (fac) => {
  const c = courtPlansOf(fac);
  if (!c.length) return null;
  const m = c.reduce((a, b) => (a.price <= b.price ? a : b));
  return m.label || `¥${m.price.toLocaleString()}/${unitLabel(m.unit)}〜`;
};

/* ============================================================
   ピク活（プレー記録）— サ活のピックル版。
   ★評価の口コミではなく「自分のプレー記録」。副産物として
   混雑・コート状態・できた実績が溜まる。投稿はメモリ内state。
   （本実装ではCloudflare D1に永続化する想定）
   ============================================================ */
const CROWD = {
  1: { icon: "🟢", label: "空いてた", color: "#0E9E86", bg: "#E3F5EE" },
  2: { icon: "🟡", label: "ちょうどいい", color: "#A6790C", bg: "#FBF3D9" },
  3: { icon: "🔴", label: "混んでた", color: "#D6461F", bg: "#FCE7E0" },
};
const NONAME = "名無しピックラー";

// XSS対策: タグ文字を除去しプレーンテキスト化（表示側もReactが自動エスケープ）
const sanitizeText = (s = "") => String(s).replace(/[<>]/g, "").slice(0, 140);
// NGフィルタ: 電話番号・URLはコメント不可
const hasNG = (s = "") => /(https?:\/\/|www\.)/i.test(s) || /\d{2,4}-\d{2,4}-\d{3,4}/.test(s) || /\d{10,11}/.test(s);

const isoOf = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const todayISO = () => isoOf(new Date());
const shiftISO = (days) => { const d = new Date(); d.setDate(d.getDate() + days); return isoOf(d); };

// 混雑傾向サマリー（データ3件未満はnull）: timeBand×crowdを集計し1行生成
const crowdTrend = (list) => {
  if (!list || list.length < 3) return null;
  const byBand = {};
  for (const p of list) { if (!p.timeBand) continue; (byBand[p.timeBand] = byBand[p.timeBand] || []).push(p.crowd); }
  let worst = null;
  for (const band of Object.keys(byBand)) {
    const arr = byBand[band];
    if (arr.length < 2) continue;
    const avg = arr.reduce((a, b) => a + b, 0) / arr.length;
    if (!worst || avg > worst.avg) worst = { band, avg };
  }
  if (!worst) return null;
  if (worst.avg >= 2.4) return `${worst.band}時は混みがち🔴`;
  if (worst.avg <= 1.6) return `${worst.band}時は空いてる傾向🟢`;
  return `${worst.band}時はちょうどいい🟡`;
};

// 空き枠シート用: 該当時間帯に「混みがち」の報告があるか（全ピク活横断・3件以上）
const crowdWarn = (list, bandLabel) => {
  const arr = (list || []).filter((p) => p.timeBand === bandLabel).map((p) => p.crowd);
  if (arr.length < 3) return null;
  const avg = arr.reduce((a, b) => a + b, 0) / arr.length;
  return avg >= 2.4 ? "混みがちの報告あり🔴" : null;
};

let _pid = 1;
const pk = (facilityId, playedAt, timeBand, partySize, crowd, comment, nickname = "", likes = 0, courtCondition = "") =>
  ({ id: "pk" + _pid++, facilityId, playedAt, timeBand, partySize, crowd, courtCondition, comment, nickname, likes });

const SEED_PIKKATSU = [
  pk("pickle9", "2026-07-14", "19-21", 4, 3, "仕事帰りに4人で2h。夜はやっぱ混む、コート待ちしばらくあった", "レブンレイク", 12, "床コンディション◎"),
  pk("pickle9", "2026-07-12", "11-13", 2, 2, "平日昼は取りやすい。2人でラリー中心にみっちり", "ダブルボギー", 5),
  pk("pickle9", "2026-07-09", "19-21", 4, 3, "夜7時台は激戦。予約必須です", "", 8),
  pk("one", "2026-07-15", "11-13", 4, 3, "初4人で2h。11時から一気に混み始めた。早めがおすすめ", "銀座ドロップ", 15),
  pk("one", "2026-07-13", "11-13", 6, 3, "体験会あがりでそのままゲーム。人多めで待ちあり", "", 6),
  pk("one", "2026-07-11", "9-11", 3, 1, "朝イチは空いてる。ほぼ貸切状態で最高だった", "モーニング勢", 9),
  pk("one", "2026-07-08", "21-23", 4, 2, "夜遅めはちょうどいい人数感。ショップも見れた", "", 3),
  pk("pacific", "2026-07-13", "15-17", 4, 2, "有明の屋外2面。風が抜けて気持ちいい", "ベイサイド", 7, "風やや強め"),
  pk("pacific", "2026-07-10", "13-15", 2, 1, "昼下がりガラガラ。日差し強いので帽子推奨", "", 4),
  pk("pacific", "2026-07-06", "15-17", 4, 3, "週末夕方は満員。飲食併設で待ち時間つぶせる", "", 5),
  pk("sansan", "2026-07-12", "19-21", 4, 2, "池袋近くて便利。新しくて綺麗だった", "イケブクロ", 6),
  pk("sansan", "2026-07-07", "21-23", 4, 1, "夜遅め空いてた。仕事帰りに丁度いい", "", 2),
  pk("shiomi", "2026-07-14", "9-11", 4, 2, "テニスコートにテープ。ネットは自前で調整した", "テープ職人", 4, "ラインわかりにくい"),
  pk("shiomi", "2026-07-11", "9-11", 2, 1, "朝は空いてる。TennisBearで前日予約した", "", 3),
  pk("shiomi", "2026-07-05", "15-17", 4, 3, "週末午後は埋まりがち", "", 5),
  pk("shibuya-pc", "2026-07-15", "13-15", 4, 2, "宇田川の貸しスペース。こじんまりだが清潔", "ウダガワ", 8),
  pk("shibuya-pc", "2026-07-10", "13-15", 2, 2, "2人で軽く。渋谷駅近が神", "", 4),
  pk("shibuya-pc", "2026-07-04", "19-21", 4, 3, "夜は人気で埋まる。早め予約を", "", 6),
  pk("seibu", "2026-07-09", "15-17", 4, 2, "品川プリンス10F。ゴルフ併設で雰囲気良い", "シナガワ", 5),
  pk("seibu", "2026-07-03", "13-15", 2, 1, "平日昼は空き。要問合せだが電話で取れた", "", 2),
  pk("tebura", "2026-07-13", "11-13", 4, 1, "器材レンタル込で手ぶらOK。初心者に優しい", "テブラー", 7),
  pk("tebura", "2026-07-08", "15-17", 4, 2, "有明。平日当日でも入れた", "", 3),
  pk("tower", "2026-07-12", "15-17", 4, 2, "東京タワー真下の屋上。景色やばい", "タワーラバー", 20, "風強い日は注意"),
  pk("tower", "2026-07-06", "13-15", 2, 3, "インスタ予約。週末は撮影勢も多く賑やか", "", 9),
  pk("ariake-park", "2026-07-11", "9-11", 4, 1, "公園コート。朝は誰もいなくて貸切だった", "コウエン", 3, "ナイター照明あり"),
  pk("ariake-park", "2026-07-05", "19-21", 4, 2, "ナイターで涼しくプレー", "", 4),
  pk("shibuya-sc", "2026-07-10", "13-15", 4, 2, "体育室の個人利用枠でできた。ネット持参必須", "シブヤ民", 5),
  pk("shibuya-sc", "2026-07-02", "9-11", 2, 1, "午前は取りやすい。区の施設で安い", "", 2),
  pk("cosmic", "2026-07-09", "11-13", 4, 2, "バドコート枠。区民優先で抽選あり", "シンジュク", 3),
  pk("cosmic", "2026-07-03", "19-21", 4, 3, "夜は抽選外れがち", "", 2),
  pk("nakano", "2026-07-14", "19-21", 4, 3, "小学校跡地の体育館。夜は地元勢で満員", "ナカノ", 6),
  pk("nakano", "2026-07-12", "19-21", 6, 3, "格安すぎて人気。2h前から並ぶ感じ", "", 4),
  pk("nakano", "2026-07-07", "9-11", 2, 1, "朝は空き。200円台は神コスパ", "", 5, "床すべりやすい"),
  pk("omori", "2026-07-08", "21-23", 4, 2, "22時までやれる。大部屋貸切の実績あり", "オオモリ", 3),
  pk("omori", "2026-07-02", "15-17", 2, 1, "昼間は空いてた", "", 1),
  pk("katsushika", "2026-07-06", "13-15", 4, 2, "テニスクラブの体験会。レッスン充実", "カツシカ", 4),
  pk("katsushika", "2026-07-01", "11-13", 2, 2, "口コミ多いだけあって丁寧だった", "", 2),
  pk("kawagoe", "2026-07-05", "21-23", 4, 2, "遠征。夜22:30までやれるの助かる", "エンセイ", 6, "車必須"),
  pk("kawagoe", "2026-06-28", "19-21", 4, 1, "関越で1本。空いててのびのびできた", "", 3),
  pk("hilton", "2026-07-20", "9-11", 2, 1, "ヒルトン東京の屋外コート。朝は静かでゆったり打てた", "", 3),
  pk("meiji-park", "2026-07-22", "13-15", 4, 2, "新宿のど真ん中に専用コート。都会にいる感がすごい", "シンジュク民", 11),
  pk("meiji-park", "2026-07-15", "19-21", 2, 2, "20分体験からそのままゲームに。手ぶらで来れて助かった", "", 4),
  pk("cesame", "2026-07-18", "15-17", 4, 1, "テニススクール併設。コーチが丁寧に教えてくれた", "", 2),
  pk("tip-shibuya", "2026-07-21", "19-21", 4, 3, "渋谷の貸しスタジオ利用。仕事帰りに寄れる立地が最高", "シブヤ勢", 7),
  pk("chuo-sports", "2026-07-17", "11-13", 4, 1, "区施設のバドコート転用。日本橋浜町でこの値段は破格", "", 5, "ライン薄め"),
  pk("picklr-toyosu", "2026-07-24", "19-21", 4, 3, "月額会員で豊洲の専用コート通い放題。雨でも安心", "トヨス住み", 14),
  pk("picklr-toyosu", "2026-07-11", "9-11", 2, 1, "朝会員利用。空いてて球出し練習しやすい", "", 4),
  pk("vip-toyocho", "2026-07-19", "21-23", 4, 2, "東陽町の屋内。夜遅くまでやれて仕事終わりに丁度いい", "", 3),
  pk("katsushika", "2026-07-23", "9-11", 4, 1, "平日貸切枠。朝から気持ちよく体動かせた", "", 2),
  pk("ocean-tsurumi", "2026-07-16", "13-15", 4, 2, "鶴見のデコターフ屋外2面。用具レンタルで手ぶら参加できた", "ツルミン", 6),
  pk("raym-kawaguchi", "2026-07-10", "15-17", 4, 2, "川口のテニスセンター。金曜講習会もやってて雰囲気良い", "", 3),
  pk("bellwood-matsudo", "2026-07-13", "11-13", 2, 1, "松戸の専用屋外2面。できたばかりで綺麗だった", "マツド", 5),
  pk("impact-tsukuba", "2026-07-25", "9-11", 4, 1, "つくば初の本格専用4面。平日料金が安くて助かる", "", 4, "朝露で滑りやすい"),
  pk("maebashi-pc", "2026-07-14", "19-21", 4, 2, "高崎の屋内3面。群馬県内で専用コートあるの貴重", "グンマー", 8),
  pk("prex-tochigi", "2026-07-09", "15-17", 2, 1, "さくら市の老舗屋外コート。スクール生も多く活気ある", "", 3),
  pk("dpc-kobe", "2026-07-26", "19-21", 4, 3, "新長田の屋内5面、日本最大級というだけあって広い", "コウベ勢", 19),
  pk("dpc-kobe", "2026-07-12", "13-15", 2, 2, "米ブランド提携のコートで雰囲気が本格的", "", 7),
  pk("pb-base-osaka", "2026-07-20", "9-11", 4, 1, "堺の屋外6面、西日本最多だけあって朝から賑わってた", "サカイ", 9),
  pk("pb-one-osaka", "2026-07-06", "21-23", 2, 1, "東淀川、平日半額キャンペーンで気軽に行けた", "", 4),
  pk("kyoto-ptc", "2026-07-17", "13-15", 4, 2, "伏見の屋内4面。会員は用具レンタル無料が地味に嬉しい", "キョウト", 5),
  pk("sasashima", "2026-06-29", "15-17", 4, 2, "名古屋初の屋外専用。オープン直後で真新しかった", "", 3),
  pk("nagoya-pb-base", "2026-07-08", "19-21", 2, 1, "名古屋の屋内専用。夜でも明るくて安心して打てた", "", 2),
  pk("marin-handa", "2026-07-19", "11-13", 4, 2, "半田の愛知県初アウトドア。海が近くて気持ちいい", "ハンダ", 6),
  pk("pivole-fukuoka", "2026-07-22", "15-17", 4, 2, "九州初の屋内4面。シャワー完備でそのまま外出できた", "フクオカ", 10),
  pk("tagawa-tc", "2026-07-05", "9-11", 2, 1, "田川の屋外専用4面。ハードコート常設で雨上がりも安心", "", 3),
  pk("pb-kumamoto", "2026-07-11", "19-21", 2, 1, "宇城の県内初コート。喫茶併設で試合後にひと休みできた", "クマモト", 4),
  pk("nfl-tokushima", "2026-07-24", "13-15", 4, 2, "徳島初の屋内4面。本開業で初回無料体験に参加した", "", 5),
  pk("jiyu-marugame", "2026-07-14", "21-23", 2, 1, "ネットカフェ内の常設コート。深夜まで使えるのが便利", "", 2),
  pk("neo-sapporo", "2026-07-21", "9-11", 4, 2, "白石区、24時間営業でシフト明けに朝活できた", "サッポロ", 8),
  pk("rusutsu", "2026-07-25", "13-15", 6, 3, "道内初の専用8面、観覧席もあって夏の大会気分", "ルスツ勢", 13),
  pk("asarigawa", "2026-07-15", "15-17", 4, 1, "小樽の温泉ホテル併設。宿泊者は1h無料で得した気分", "オタル", 4),
  pk("tokyu-hamanako", "2026-07-18", "11-13", 4, 2, "浜名湖リゾート、USA公認コートで旅行がてら満喫", "ハマナコ", 7),
  pk("tokyu-tateshina", "2026-06-30", "13-15", 2, 1, "蓼科の高原リゾート。甲信越初の公認コートで涼しかった", "", 3),
  pk("pica-fujiyama", "2026-07-16", "15-17", 4, 2, "河口湖の全天候型。富士山を見ながらプレーできた", "フジ", 9),
  pk("nemu-resort", "2026-07-09", "9-11", 4, 1, "伊勢志摩国立公園内。朝の澄んだ空気の中でプレー", "", 3),
  pk("halekulani-okinawa", "2026-07-23", "15-17", 2, 1, "恩納村のラグジュアリーリゾート。宿泊者限定で贅沢な1面", "オキナワ", 15),
  pk("nagasaki-stadium", "2026-07-13", "19-21", 4, 2, "屋上5面、アプリ予約で年中無休なのが便利", "ナガサキ", 6),

  /* ---- 2026-07 追記: 全国ロングテール施設のピク活バックフィル ---- */
  pk("kpi-park", "2026-07-20", "9-11", 4, 1, "戸塚の専用コート。何面あるのか数えきれないくらい広くて驚いた", "トツカ", 11),
  pk("kpi-park", "2026-06-20", "15-17", 6, 2, "屋外ハードで面数がどんどん増えてる。県内で一番賑わってる感じ", "", 6),
  pk("konami-omiya", "2026-07-05", "13-15", 4, 2, "大宮のショッピングセンター屋上コート。買い物ついでに寄れて便利", "オオミヤ", 4),
  pk("tennis-club-f", "2026-06-22", "19-21", 4, 2, "上尾のテニスコート、ナイター照明ついてて夜でも問題なくプレーできた", "", 3),
  pk("tipness-kawaguchi", "2026-07-02", "11-13", 2, 1, "フィットネスクラブのスタジオでプログラム参加。会員なら気軽に始められる", "カワグチ", 3),
  pk("pickle-bang-theory", "2026-07-25", "19-21", 4, 3, "本八幡駅から徒歩1分、都市型インドアで仕事帰りに寄りやすい。オープンしたてで綺麗", "イチカワ", 9),
  pk("pickle-bang-theory", "2026-07-10", "13-15", 2, 2, "屋内で天気関係なく遊べるのがいい。駅近すぎて通いやすい", "", 4),
  pk("ttc-yoshida", "2026-06-18", "13-15", 4, 1, "柏の屋内コートで初心者体験枠に参加。練習会は雰囲気ゆるめで良かった", "", 3),
  pk("godai-kameido", "2026-07-08", "19-21", 4, 2, "亀戸のテニス・ゴルフスクール内クラス。月謝制で定期的に通いやすい", "カメイド", 5),
  pk("shinagawa-prince", "2026-07-27", "15-17", 2, 2, "品川プリンスのメインタワー10階、宴会場を活用したコート。ホテルらしい非日常感があった", "シナガワ", 10),
  pk("shinagawa-prince", "2026-07-14", "9-11", 4, 1, "屋内1面で天候の心配なし。始まったばかりで床もきれい", "", 5),
  pk("round1-itabashi", "2026-06-28", "21-23", 4, 2, "板橋のスポッチャでピックル。ボウリングのついでに気軽に遊べた", "", 4),
  pk("round1-diver-city", "2026-07-06", "15-17", 6, 3, "お台場のスポッチャ、週末は家族連れも多くて賑やか", "ダイバー", 6),
  pk("round1-kawasaki-daishi", "2026-06-24", "13-15", 4, 2, "川崎大師のスポッチャでピックル。子どもと一緒に軽くできて良かった", "", 3),
  pk("noah-miyamaedaira", "2026-07-12", "11-13", 2, 1, "宮前平のスクール、空調完備で夏でも快適に打てた", "ミヤマエ", 4),
  pk("tokyu-todoroki-arena", "2026-07-01", "19-21", 4, 2, "とどろきアリーナのオープンプレイイベント。参加費だけで気軽に混ざれた", "", 5),
  pk("asabara-taiken", "2026-07-19", "11-13", 4, 1, "大間々の体験村、土日祝は無料開放。ネットも道具も貸してくれて助かった", "アサバラ", 7),
  pk("shobuzawa-park", "2026-06-21", "9-11", 4, 1, "さくら市の公園コート。廃テニスコートを転用したそうで8面もあって広々", "", 5),
  pk("nanko-tennis", "2026-07-09", "13-15", 4, 2, "南港中央公園の屋外コート。安いのに面数増えて使いやすくなった", "ナンコウ", 6),
  pk("morita-utsubo", "2026-06-26", "15-17", 2, 1, "靱公園のテニスコートをレンタル利用。街中で気軽にできるのが良い", "", 3),
  pk("esaka-tennis", "2026-07-17", "19-21", 4, 3, "江坂の屋内4面・屋外2面併設コート。大会会場になるだけあって設備が整ってる", "エサカ", 8),
  pk("esaka-tennis", "2026-07-01", "9-11", 2, 1, "朝イチの屋内コート、空いてて球出し練習にちょうど良かった", "", 3),
  pk("tondabayashi-nakano", "2026-06-19", "13-15", 4, 2, "富田林のテニスコートを借りてプレー。安くて気軽なのがありがたい", "", 2),
  pk("tipness-tennoji-osaka", "2026-07-04", "11-13", 2, 1, "天王寺のフィットネスクラブ内コート。会員は移動なしで打てて便利", "テンノウジ", 4),
  pk("tipness-takatsuki", "2026-06-30", "15-17", 4, 2, "高槻のフィットネスクラブでピックル。仕事帰りに寄れる立地が良い", "", 3),
  pk("tipness-ishibashi", "2026-07-11", "19-21", 2, 2, "池田のクラブでプレー。阪大前で学生も混ざってて活気あった", "", 3),
  pk("tipness-kyobashi", "2026-06-23", "13-15", 4, 2, "京橋のフィットネスクラブ内コート。天候関係なく遊べて助かる", "キョウバシ", 4),
  pk("noah-kyuhoji", "2026-07-15", "11-13", 2, 1, "久宝寺のスクール、週4回開講で通いやすい。月謝制なのも安心", "", 3),
  pk("mizuno-wadamisaki", "2026-06-27", "15-17", 4, 2, "和田岬のミズノスポーツプラザ、体験会に参加。初めてでも丁寧に教えてもらえた", "ワダミサキ", 5),
  pk("mizuno-shioashiya", "2026-07-07", "13-15", 2, 1, "潮芦屋の多目的コートでレンタル利用。屋内で快適だった", "", 2),
  pk("noah-myodani", "2026-06-29", "9-11", 4, 1, "名谷校の初心者クラス。丁寧な説明で未経験でも安心してできた", "", 3),
  pk("noah-nishinomiya", "2026-07-13", "19-21", 4, 2, "鳴尾浜のスクールで体験レッスン。月謝制で続けやすそうだった", "ニシノミヤ", 5),
  pk("itami-gym", "2026-06-25", "13-15", 4, 2, "伊丹市立体育館、有志の練習会にお邪魔した。地元コミュニティが温かい", "", 3),
  pk("showa-kakogawa", "2026-07-16", "15-17", 6, 3, "加古川の総合体育館、大会も開かれるだけあって設備が本格的", "カコガワ", 7),
  pk("yamashina-gym", "2026-06-17", "13-15", 4, 2, "山科の地域体育館、木曜午後の教室に参加。地元の方が多く和やかだった", "", 3),
  pk("daigo-gym", "2026-07-03", "19-21", 4, 1, "醍醐の体育館、金曜夜の教室に参加。仕事帰りでも間に合う時間帯", "ダイゴ", 4),
  pk("higashiyama-gym", "2026-06-16", "9-11", 2, 1, "東山地域体育館、金曜午前の教室。観光地の近くとは思えない静かな環境", "", 2),
  pk("ymit-arena", "2026-07-21", "19-21", 4, 2, "草津のYMITアリーナ、Team Shigaの活動日にお邪魔した。夜でも人数集まって楽しい", "クサツ", 6),
  pk("tennis-lounge-meisai", "2026-06-20", "11-13", 4, 1, "名西の屋内2面、人工芝が高密度で球の転がりが良かった", "", 3),
  pk("tennis-lounge-shinsakae", "2026-07-18", "15-17", 2, 2, "新栄のハードコート、屋外2面分のラインが引かれてて分かりやすかった", "シンサカエ", 5),
  pk("tipness-kamiida", "2026-06-24", "13-15", 4, 2, "上飯田のスタジオコート。1面だけだけど清潔で気持ちよくプレーできた", "", 3),
  pk("craspo-gamagori", "2026-07-24", "19-21", 4, 3, "蒲郡の屋内4面、東三河初の専用コートというだけあって週末は賑わってた", "ガマゴオリ", 9),
  pk("craspo-gamagori", "2026-07-09", "11-13", 2, 1, "オープンしたばかりで床も綺麗。1面1hの価格も手頃", "", 4),
  pk("noah-hyotanyama", "2026-06-21", "9-11", 4, 1, "瓢箪山校の初心者レッスン。道具貸出無料で手ぶらで行けた", "", 3),
  pk("nagoya-chikusa-sc", "2026-07-05", "13-15", 4, 2, "千種スポーツセンターのバドコート枠。予約制だけど取れれば快適", "チクサ", 4),
  pk("nagoya-higashi-sc", "2026-06-28", "19-21", 4, 2, "東スポーツセンターの練習会。定期開催で常連さんが多かった", "", 3),
  pk("olympia-yokkaichi", "2026-07-22", "15-17", 4, 2, "四日市のJPA公認レンタルコート、三重県初というだけあって本格的な設備", "ヨッカイチ", 8),
  pk("olympia-yokkaichi", "2026-07-02", "9-11", 2, 1, "朝の時間帯は空いてて練習に集中できた", "", 3),
  pk("tipness-hamamatsu", "2026-06-19", "13-15", 4, 2, "浜松葵東のフルサイズ屋内コート。パドル・ボール無料で手ぶらでOK", "ハママツ", 5),
  pk("tipness-fujieda", "2026-07-10", "19-21", 2, 1, "藤枝駅直結でアクセス抜群。道具も駐車場も無料でありがたい", "", 4),
  pk("megalos-hamamatsu", "2026-06-26", "11-13", 4, 2, "浜松市野のテニスコートで体験会。18歳以上限定だけど大人がじっくり打てる", "", 3),
  pk("ogaki-gym", "2026-07-14", "15-17", 4, 2, "大垣総合体育館、屋内3面使った練習会。安くてしっかり体動かせた", "オオガキ", 5),
  pk("yamanouchi-elementary", "2026-06-22", "9-11", 4, 1, "山ノ内町の小学校体育館、町主催の教室に参加。小学生から大人まで一緒に楽しめた", "", 3),
  pk("marine-blue-niigata", "2026-07-08", "13-15", 2, 1, "新潟県内初のレッスンとのことで参加。全面室内で天候気にせず打てた", "ニイガタ", 6),
  pk("santas-toyama", "2026-07-23", "19-21", 4, 2, "砺波の会員制複合施設内、富山県唯一の専用室内2面。設備がしっかりしてる", "トナミ", 7),
  pk("santas-toyama", "2026-07-06", "9-11", 2, 1, "朝の時間帯は貸切状態で伸び伸び練習できた", "", 3),
  pk("pickle-beat-komatsu", "2026-06-20", "15-17", 4, 1, "小松の常設コート、屋内1面とハーフコートで初回無料だった", "コマツ", 4),
  pk("yoshitomi-park", "2026-07-11", "9-11", 4, 2, "吉富町の河川敷公園コート、屋外3面で朝は風が気持ちよかった", "", 4),
  pk("cosmos-kumamoto", "2026-06-27", "13-15", 4, 2, "嘉島町のフットボールセンター、新設のピックル専用2面で綺麗だった", "カシマ", 4),
  pk("goldsgym-uki", "2026-07-16", "19-21", 2, 2, "宇城のゴールドジム、会員利用でコート使えて便利だった", "", 3),
  pk("round1-kumamoto", "2026-06-24", "15-17", 4, 2, "熊本のスポッチャでピックル。他のアクティビティとセットで遊べて楽しい", "", 3),
  pk("chatan-sports-center", "2026-07-19", "15-17", 6, 3, "北谷のテニスコート開放、ナイターとシャワー完備で夕方から気持ちよく打てた", "チャタン", 8),
  pk("effort-tennis-okinawa", "2026-06-30", "9-11", 4, 1, "北中城のテニスクラブでサークル活動に参加。朝から沖縄らしい陽気の中プレー", "", 4),
  pk("naha-city-gym", "2026-07-13", "13-15", 4, 2, "那覇市民体育館のサブアリーナ。市の施設なので利用しやすい", "ナハ", 5),
  pk("sungreen-kagoshima", "2026-06-18", "15-17", 2, 1, "与次郎のテニススクール、レンタルコートで手軽に遊べた", "", 3),
  pk("nb-tennis-garden", "2026-07-25", "9-11", 4, 2, "広島市西区の屋外コート、ラインが引かれてて分かりやすかった", "ヒロシマ", 5),
  pk("pickle-fukuyama", "2026-06-29", "19-21", 4, 3, "福山の体育館、地元チームの火木練習にお邪魔した。夜は結構賑わってた", "フクヤマ", 6),
  pk("ihi-arena-kure", "2026-07-04", "13-15", 4, 2, "呉のIHIアリーナ、臨時コート2面での体験会。アリーナが広くて開放的", "", 4),
  pk("setomintan", "2026-07-15", "11-13", 2, 1, "岡山の新サークル、始まったばかりでアットホームな雰囲気だった", "オカヤマ", 4),
  pk("pikkurashiki", "2026-06-23", "9-11", 4, 1, "倉敷の体育館サークル、会員が多くて小学生から大人まで賑やかだった", "", 3),
  pk("fukui-tennis-club", "2026-07-20", "15-17", 2, 1, "下関の手作り専用コート、山口県内初というだけあって愛着感じた", "シモノセキ", 5),
  pk("pickleball-ehime", "2026-06-25", "19-21", 4, 2, "松山の体験会、毎週火曜開催で常連さんが優しく教えてくれた", "", 3),
  pk("pickleball-kochi", "2026-07-12", "11-13", 2, 1, "高知市の定期練習、火金の午前中で参加しやすかった", "コウチ", 4),
  pk("mure-pickleball", "2026-06-28", "9-11", 4, 1, "牟礼中央公園の運動センター、木曜の飛び入り参加OKで気軽だった", "", 3),
  pk("yonago-circle", "2026-07-17", "13-15", 6, 2, "米子の体育館サークル、2018年発足の老舗で週末は20人くらい集まってた", "ヨナゴ", 5),
  pk("tennis-arena-garden-tokushima", "2026-06-21", "15-17", 4, 2, "徳島市住吉の屋内スクール、レンタルコートで気軽に始められた", "", 3),
  pk("rising-kitano", "2026-07-09", "19-21", 4, 2, "札幌清田区のテニススクール内、専用コート完備で本格的に打てた", "キヨタ", 5),
  pk("play-pickleball-tomakomai", "2026-06-26", "13-15", 2, 1, "苫小牧の若草小学校、月曜練習にドロップインで参加。100円で気軽すぎる", "", 3),
  pk("sunbow-akita", "2026-07-06", "15-17", 4, 2, "大仙市の秋田県内唯一の専用コート、空調完備で夏でも快適だった", "アキタ", 5),
  pk("pickleball-branch-sendai", "2026-07-14", "19-21", 4, 2, "仙台の社会人サークル、JPA認定コーチがいて教え方が丁寧だった", "センダイ", 5),
  pk("sendai-pickleball-kiko", "2026-06-20", "13-15", 2, 1, "青葉区の機構主催、パドル無料貸出で手ぶらで参加できた", "", 3),
  pk("morioka-circle", "2026-07-11", "9-11", 4, 1, "盛岡の日曜サークル、18歳以上で経験不問。初めてでも温かく迎えてもらえた", "モリオカ", 4),
  pk("round1-fukushima", "2026-06-27", "21-23", 4, 2, "福島のスポッチャ、夜遅めでも稼働してて仕事帰りに寄れた", "", 3),
];

const PikCard = ({ k, onLike, facName, onFac }) => {
  const c = CROWD[k.crowd] || CROWD[2];
  return (
    <div style={{ border: `1px solid ${T.line}`, borderLeft: `3px solid ${c.color}`, borderRadius: 12, padding: "11px 13px", marginTop: 8, background: "#fff", boxShadow: "0 1px 3px rgba(14,42,43,0.06)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 800 }}>{k.nickname || NONAME}</div>
        <div style={{ fontSize: 11, color: "#8B9B96" }}>{k.playedAt} ・ {k.timeBand}時</div>
      </div>
      {facName && (
        <button onClick={onFac} style={{ marginTop: 4, padding: 0, border: "none", background: "none", color: T.courtDeep, fontWeight: 800, fontSize: 12, cursor: "pointer", textAlign: "left" }}>📍 {facName}</button>
      )}
      <div style={{ marginTop: 6, display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: c.bg, color: c.color, fontWeight: 800, fontSize: 11, borderRadius: 999, padding: "3px 10px" }}>{c.icon} {c.label}</span>
        <span style={{ fontSize: 12, color: "#5E716C" }}>👥 {k.partySize}人</span>
        {k.courtCondition ? <span style={{ fontSize: 12, color: "#5E716C" }}>📝 {k.courtCondition}</span> : null}
      </div>
      {k.comment ? <div style={{ fontSize: 13, marginTop: 7, lineHeight: 1.6, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{k.comment}</div> : null}
      {k.photo ? <img src={k.photo} alt="" loading="lazy" style={{ width: "100%", maxHeight: 220, objectFit: "cover", borderRadius: 10, marginTop: 8, display: "block" }} /> : null}
      <button onClick={onLike} style={{ marginTop: 9, padding: "5px 12px", borderRadius: 999, border: "none", background: T.ball, fontWeight: 900, fontSize: 12, cursor: "pointer", color: T.ballInk }}>⚡ {k.likes}</button>
    </div>
  );
};

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

/* ------------------------------------------------------------
   コート写真: 施設の公式サイト画像（fac.photo）があればそれを使い、
   無ければ 屋内/屋外 の代表写真にフォールバック。
   さらに読み込み失敗時はブランド調SVGへ自動フォールバック。
   → どのコートも必ず1枚は絵が出る。
   ------------------------------------------------------------ */
function photoFor(fac) {
  if (fac.photo) return fac.photo;
  return fac.indoor ? "/court-indoor.jpg" : "/court-outdoor.jpg";
}

const CourtScene = ({ indoor, style }) => (
  <svg viewBox="0 0 400 240" preserveAspectRatio="xMidYMid slice" style={style} aria-hidden>
    <defs>
      <linearGradient id="courtSky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={indoor ? "#12666E" : "#1E86AE"} />
        <stop offset="1" stopColor={indoor ? "#0A3E44" : "#0C4A4E"} />
      </linearGradient>
    </defs>
    <rect width="400" height="240" fill="url(#courtSky)" />
    <g stroke={T.ball} strokeWidth="2.5" fill="none" opacity="0.9" transform="translate(0,18)">
      <polygon points="66,182 334,182 302,58 98,58" />
      <line x1="82" y1="120" x2="318" y2="120" />
      <line x1="200" y1="58" x2="200" y2="182" />
    </g>
    <line x1="112" y1="96" x2="288" y2="96" stroke="#fff" strokeWidth="2" opacity="0.65" strokeDasharray="5 5" />
    <g transform="translate(298,62)">
      <circle r="13" fill={T.ball} stroke={T.ballInk} strokeWidth="1.5" />
      <circle cx="-4" cy="-4" r="1.6" fill={T.ballInk} />
      <circle cx="4" cy="-4" r="1.6" fill={T.ballInk} />
      <circle cx="0" cy="4" r="1.6" fill={T.ballInk} />
    </g>
  </svg>
);

/* 屋内 / 屋外 マーク（ブランド調SVG） */
const IndoorMark = ({ size = 14, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden style={{ display: "inline-block", verticalAlign: "-2px", flexShrink: 0 }}>
    {/* 屋根 */}
    <path d="M2.5 8.6 L10 2.6 L17.5 8.6" fill="none" stroke={color} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    {/* 建物と床のコートライン */}
    <path d="M4.4 9.6 V16.4 H15.6 V9.6" fill="none" stroke={color} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    <line x1="4.4" y1="13.4" x2="15.6" y2="13.4" stroke={color} strokeWidth="1.4" strokeLinecap="round" />
    <line x1="10" y1="9.6" x2="10" y2="16.4" stroke={color} strokeWidth="1.4" strokeLinecap="round" />
  </svg>
);
const OutdoorMark = ({ size = 14, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden style={{ display: "inline-block", verticalAlign: "-2px", flexShrink: 0 }}>
    {/* 太陽 */}
    <circle cx="10" cy="6.1" r="3.1" fill="none" stroke={color} strokeWidth="1.8" />
    <g stroke={color} strokeWidth="1.5" strokeLinecap="round">
      <line x1="10" y1="0.9" x2="10" y2="2" />
      <line x1="4.5" y1="6.1" x2="3.4" y2="6.1" />
      <line x1="16.6" y1="6.1" x2="15.5" y2="6.1" />
      <line x1="6.1" y1="2.2" x2="5.3" y2="1.4" />
      <line x1="13.9" y1="2.2" x2="14.7" y2="1.4" />
    </g>
    {/* コート（遠近） */}
    <path d="M6.2 12.2 H13.8 L16.6 17.6 H3.4 Z" fill="none" stroke={color} strokeWidth="1.8" strokeLinejoin="round" />
    <line x1="4.9" y1="14.9" x2="15.1" y2="14.9" stroke={color} strokeWidth="1.3" strokeLinecap="round" />
    <line x1="10" y1="12.2" x2="10" y2="17.6" stroke={color} strokeWidth="1.3" strokeLinecap="round" />
  </svg>
);
const VenueMark = ({ indoor, size = 14, color = "currentColor" }) => (indoor ? <IndoorMark size={size} color={color} /> : <OutdoorMark size={size} color={color} />);
/* 「屋内 / 屋外」テキスト + マーク */
const VenueTag = ({ indoor, size = 13, color = "currentColor" }) => (
  <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color }}>
    <VenueMark indoor={indoor} size={size} color={color} />
    {indoor ? "屋内" : "屋外"}
  </span>
);

/* コート位置の地図（Googleマップ埋め込み・APIキー不要）＋経路リンク */
const CourtMap = ({ fac }) => {
  const src = `https://maps.google.com/maps?q=${fac.lat},${fac.lng}&z=15&output=embed`;
  const dir = `https://www.google.com/maps/dir/?api=1&destination=${fac.lat},${fac.lng}`;
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ position: "relative", borderRadius: 14, overflow: "hidden", border: `1.5px solid ${T.line}` }}>
        <iframe title={`${fac.name}の地図`} src={src} loading="lazy" style={{ width: "100%", height: 170, border: "none", display: "block" }} />
      </div>
      <a href={dir} target="_blank" rel="noopener noreferrer"
        style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 8, padding: "11px 0", borderRadius: 12, background: "#EFF2EF", color: T.ink, fontWeight: 800, fontSize: 13, textDecoration: "none" }}>
        🧭 ここへの経路を見る（Googleマップ）
      </a>
    </div>
  );
};

const CourtImage = ({ fac, height, rounded = 14, showBadge = false }) => {
  const [err, setErr] = useState(false);
  return (
    <div style={{ position: "relative", width: "100%", height, borderRadius: rounded, overflow: "hidden", background: "#0A3E44" }}>
      <CourtScene indoor={fac.indoor} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />
      {!err && (
        <img
          src={photoFor(fac)}
          alt={fac.name}
          loading="lazy"
          onError={() => setErr(true)}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
      )}
      <div style={{ position: "absolute", top: 6, right: 6, fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.82)", background: "rgba(8,28,30,0.42)", padding: "2px 6px", borderRadius: 6, letterSpacing: "0.04em" }}>イメージ</div>
      {fac.upcoming && (
        <div style={{ position: "absolute", inset: 0, background: "rgba(8,28,30,0.5)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3 }}>
          <span style={{ fontSize: 11, fontWeight: 900, letterSpacing: "0.18em", color: T.ball }}>🚧 OPEN予定</span>
          {fac.openDate && <span style={{ fontSize: height > 100 ? 15 : 12, fontWeight: 900, color: "#fff", textShadow: "0 1px 3px rgba(0,0,0,0.5)" }}>{fac.openDate}</span>}
        </div>
      )}
      {showBadge && (
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: "24px 12px 9px", background: "linear-gradient(transparent, rgba(8,36,38,0.82))" }}>
          <span style={{ fontSize: 12, fontWeight: 800, color: "#fff", textShadow: "0 1px 3px rgba(0,0,0,0.4)" }}>
            <VenueTag indoor={fac.indoor} size={13} color="#fff" /> ・ {fac.area}
          </span>
        </div>
      )}
    </div>
  );
};

const OPERATOR = "MUFASA Technology";
const CONTACT_EMAIL = "pickleikitai@gmail.com";
const LINE_URL = "https://lin.ee/OWBC5Kw"; // 公式LINE（伸びしろ報告の送信先）
const API_BASE = "https://pickleikitai-api.kazukitomiyama0707.workers.dev";
const startLineLogin = () => { window.location.href = `${API_BASE}/auth/line/start?return=${encodeURIComponent(window.location.origin + "/")}`; };
const TERMS = [
  ["第1条（サービス内容）", "「ピックルイキタイ」（以下、本サービス）は、東京および関東圏のピックルボールコート・イベント情報を横断的に紹介する情報ポータルです。コートの予約・利用契約は利用者と各施設との間で直接成立し、本サービスはその当事者となりません。"],
  ["第2条（情報の正確性）", "本サービスは掲載情報の正確性・完全性・最新性を保証しません。料金・空き状況・ピックルボール利用の可否等は、必ず各施設の公式情報をご確認ください。空き枠表示は参考情報であり、実際の予約可否を保証するものではありません。"],
  ["第3条（ユーザー投稿）", "利用者はコート情報およびプレー記録（ピク活）を投稿できます。虚偽の情報、第三者の権利を侵害する内容、施設の営業を妨害する内容、電話番号・URL等の連絡先や個人を特定する情報を投稿してはなりません。"],
  ["第4条（投稿の取扱い）", "投稿された内容は本サービス上での表示および品質向上のために利用されます。運営者は不適切と判断した投稿を予告なく削除できます。"],
  ["第5条（免責）", "本サービスの利用または利用不能により生じたいかなる損害についても、運営者は責任を負いません。外部リンク先の内容についても同様とします。"],
  ["第6条（規約の変更）", "運営者は必要に応じて本規約を変更できます。変更後の規約は本ページに掲載した時点で効力を生じます。"],
];
const PRIVACY = [
  ["取得する情報", "本サービスは、ユーザー投稿（ニックネーム・コメント・プレー記録等、いずれも任意入力）、およびお問い合わせ時にご入力いただくお名前・メールアドレス・内容を取得します。氏名・住所・電話番号等の入力は求めていません。"],
  ["利用目的", "取得した情報は、投稿の表示、サービスの改善、およびお問い合わせへの回答のために利用します。"],
  ["第三者提供", "法令に基づく場合を除き、取得した情報を本人の同意なく第三者に提供することはありません。"],
  ["外部リンク・アクセス解析", "本サービスには各施設の公式サイト等への外部リンクが含まれます。遷移先での個人情報の取扱いは各サイトのポリシーに従います。利用状況の把握のためアクセス解析を用いる場合があります。"],
  ["開示・訂正・削除", "投稿やお問い合わせ内容の開示・訂正・削除をご希望の場合は、下記の問い合わせ先までご連絡ください。"],
  ["改定", "本ポリシーは必要に応じて改定されます。改定後は本ページに掲載した時点で効力を生じます。"],
];

export default function PickleIkitai() {
  const [winStart, setWinStart] = useState(0);
  const [dayIdx, setDayIdx] = useState(0);
  const [areaFilter, setAreaFilter] = useState("all");
  const [catFilter, setCatFilter] = useState("all");
  const [sortKey, setSortKey] = useState("dist");
  // イキタイ（行きたい保存）— サービス名そのものの核機能
  const [ikitai, setIkitai] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem("pk_ikitai") || "[]")); } catch { return new Set(); }
  });
  const [onlyIkitai, setOnlyIkitai] = useState(false);
  const [venueFilter, setVenueFilter] = useState("all"); // all | indoor | outdoor
  const [listLimit, setListLimit] = useState(24); // コート一覧の表示件数（続きを見るで拡張）
  // 「ホーム画面に追加」誘導（一度閉じたら二度と出さない・スクロール後に控えめに）
  const [a2hs, setA2hs] = useState(false);
  const [pwaGuide, setPwaGuide] = useState(false); // アプリ追加の手順モーダル
  const [sheet, setSheet] = useState(null);
  const [detail, setDetail] = useState(null);
  const [toast, setToast] = useState(null);
  const [clicks, setClicks] = useState(0);
  const [userFacs, setUserFacs] = useState([]);
  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  // 現在地（未取得なら渋谷を基準にする）
  const [origin, setOrigin] = useState(HOME);
  const [geoState, setGeoState] = useState("idle"); // idle | loading | granted | denied
  const [form, setForm] = useState({ name: "", area: "港区", cat: "public", indoor: "indoor", price: "", note: "", url: "" });
  const [pikkatsu, setPikkatsu] = useState(SEED_PIKKATSU);
  const [pikForm, setPikForm] = useState(null);
  const [pikPicker, setPikPicker] = useState(false); // 施設を選んでピク活投稿
  const [pikPickerQ, setPikPickerQ] = useState("");
  const [profileEdit, setProfileEdit] = useState(null); // プロフ編集フォーム（開いてる時オブジェクト）
  const [savingProfile, setSavingProfile] = useState(false);
  const [detailPikLimit, setDetailPikLimit] = useState(3);
  const [legalView, setLegalView] = useState(null);
  // 認証: 現状はブラウザ内の暫定アカウント。LINEログイン(OAuth)+D1が通ったら差し替える
  const [user, setUser] = useState(() => {
    try {
      const u = JSON.parse(localStorage.getItem("pk_user") || "null");
      // LINE未経由の旧ローカル専用アカウントは無効化（DBに存在しない偽ログイン状態を防ぐ）
      if (u && !u.line) { localStorage.removeItem("pk_user"); localStorage.removeItem("pk_jwt"); return null; }
      return u;
    } catch { return null; }
  });
  const [authView, setAuthView] = useState(null);
  const [emailForm, setEmailForm] = useState({ email: "", password: "", name: "" });
  const [emailSubmitting, setEmailSubmitting] = useState(false);
  const [addLineGuide, setAddLineGuide] = useState(false); // 新規登録直後の公式LINE追加誘導
  const [contact, setContact] = useState({ name: "", email: "", message: "", sent: false });
  const timers = useRef([]);
  const idRef = useRef(1);
  const pikIdRef = useRef(1);
  const postCount = useRef({});

  // セクション参照（アンカースクロール用）
  const refAbout = useRef(null);
  const refSlots = useRef(null);
  const refList = useRef(null);
  const refRank = useRef(null);
  const refEvents = useRef(null);
  const refPik = useRef(null);
  const refAdd = useRef(null);
  const refContact = useRef(null);
  const refSearch = useRef(null);
  const scrollTo = (r) => r.current?.scrollIntoView({ behavior: "smooth", block: "start" });

  const ALL_FACS = useMemo(() => [...SEED_FACILITIES, ...userFacs], [userFacs]);
  // 空き枠グリッドはリアルタイムデータのある稼働コート（＝東京）に限定
  const areas = ["all", ...new Set(ALL_FACS.filter((f) => f.live).map((f) => f.area))];
  // 開業前(upcoming)の施設は空き枠グリッドの集計対象から除外（誤情報防止）
  // 空き枠は稼働コート（live）のみ。開業前・全国の未連携コートは対象外
  const visibleFacs = ALL_FACS.filter((f) => f.live && (areaFilter === "all" || f.area === areaFilter) && (venueFilter === "all" || (venueFilter === "indoor" ? f.indoor : !f.indoor)));

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

  // グリッドの「空きあり」件数は kind==="court" のプランのみ集計（鉄則）
  const grid = useMemo(() => {
    const g = {};
    for (const b of BANDS) {
      let open = 0, portal = 0, event = 0;
      for (const f of visibleFacs) {
        for (const p of f.plans || []) {
          const st = slotStatusFor(f, p, selDay.key, b.key);
          if (p.kind === "court") {
            if (st === "open") open++;
            else if (st === "portal") portal++;
          } else if (st === "open") {
            event++;
          }
        }
      }
      g[b.key] = { open, portal, event };
    }
    return g;
  }, [areaFilter, userFacs, dayIdx, venueFilter]);

  const listFacs = useMemo(() => {
    let arr = ALL_FACS
      .filter((f) => catFilter === "all" || f.cat === catFilter)
      .filter((f) => venueFilter === "all" || (venueFilter === "indoor" ? f.indoor : !f.indoor))
      .filter((f) => !onlyIkitai || ikitai.has(f.id))
      .map((f) => ({ ...f, km: dist(origin, f) }));
    arr.sort((a, b) => (sortKey === "price" ? minCourtPrice(a) - minCourtPrice(b) : a.km - b.km));
    return arr;
  }, [catFilter, sortKey, userFacs, origin, onlyIkitai, ikitai, venueFilter]);

  // 絞り込み条件が変わったら表示件数をリセット
  useEffect(() => { setListLimit(24); }, [catFilter, sortKey, onlyIkitai, venueFilter]);

  // イベント/レッスンは全施設のplansから自動集計
  const eventPlans = useMemo(() => {
    const out = [];
    for (const f of ALL_FACS) for (const p of f.plans || []) if (p.kind !== "court") out.push({ f, p });
    return out;
  }, [userFacs]);

  const showToast = (msg) => {
    setToast(msg);
    timers.current.push(setTimeout(() => setToast(null), 3200));
  };

  const outbound = (fac) => {
    setClicks((c) => c + 1);
    if (fac.url) window.open(fac.url, "_blank");
  };

  // ---- ピク活 ----
  const pikSort = (a, b) => (a.playedAt < b.playedAt ? 1 : a.playedAt > b.playedAt ? -1 : a.id < b.id ? 1 : -1);
  const pikOf = (facId) => pikkatsu.filter((p) => p.facilityId === facId).sort(pikSort);
  const pikCount = (facId) => pikkatsu.reduce((n, p) => n + (p.facilityId === facId ? 1 : 0), 0);
  const facById = (id) => ALL_FACS.find((f) => f.id === id);
  const openDetail = (f) => { setDetail(f); setDetailPikLimit(3); };
  const likePik = (id) => {
    setPikkatsu((list) => list.map((p) => (p.id === id ? { ...p, likes: p.likes + 1 } : p)));
    const token = authToken();
    if (!token || !String(id).match(/^[0-9a-f-]{36}$/)) return; // ローカル投稿(シード)はAPI対象外
    fetch(`${API_BASE}/api/pikkatsu/${id}/like`, { method: "POST", headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => { if (typeof d.likes === "number") setPikkatsu((list) => list.map((p) => (p.id === id ? { ...p, likes: d.likes } : p))); })
      .catch(() => {});
  };
  // 写真は端末内で長辺1000pxに圧縮してdataURL化（本実装ではCloudflare R2にアップロードする）
  const pickPhoto = (file) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) { showToast("画像ファイルを選んでください"); return; }
    if (file.size > 12 * 1024 * 1024) { showToast("画像が大きすぎます（12MBまで）"); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const max = 1000;
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const cv = document.createElement("canvas");
        cv.width = Math.round(img.width * scale);
        cv.height = Math.round(img.height * scale);
        cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height);
        setPikForm((f) => (f ? { ...f, photo: cv.toDataURL("image/jpeg", 0.82) } : f));
      };
      img.onerror = () => showToast("画像を読み込めませんでした");
      img.src = reader.result;
    };
    reader.onerror = () => showToast("画像を読み込めませんでした");
    reader.readAsDataURL(file);
  };

  const toggleIkitai = (fac, e) => {
    e && e.stopPropagation();
    setIkitai((prev) => {
      const next = new Set(prev);
      if (next.has(fac.id)) { next.delete(fac.id); showToast("イキタイから外しました"); }
      else { next.add(fac.id); showToast(`「${fac.name}」をイキタイに追加⚡`); }
      localStorage.setItem("pk_ikitai", JSON.stringify([...next]));
      return next;
    });
  };
  const ikitaiCount = ikitai.size;

  // ホーム画面追加バナー: 既にPWA起動 or 過去に閉じた場合は出さない。少しスクロールしたら1回だけ
  useEffect(() => {
    if (localStorage.getItem("pk_a2hs_dismissed")) return;
    const standalone = window.matchMedia?.("(display-mode: standalone)")?.matches || window.navigator.standalone;
    if (standalone) return;
    const onScroll = () => {
      if (window.scrollY > 700) { setA2hs(true); window.removeEventListener("scroll", onScroll); }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  const dismissA2hs = () => { setA2hs(false); localStorage.setItem("pk_a2hs_dismissed", "1"); };

  // LINEログインのコールバック(#token=...)を受け取り、APIでユーザーを取得
  useEffect(() => {
    const m = /[#&]token=([^&]+)/.exec(window.location.hash);
    const saved = localStorage.getItem("pk_jwt");
    const token = m ? decodeURIComponent(m[1]) : saved;
    if (m) { localStorage.setItem("pk_jwt", token); history.replaceState(null, "", window.location.pathname + window.location.search); }
    if (!token) return;
    fetch(`${API_BASE}/api/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => {
        if (d.user) {
          const u = { name: d.user.name, id: d.user.id, line: true };
          setUser(u);
          localStorage.setItem("pk_user", JSON.stringify(u));
          if (m) showToast(`ようこそ、${d.user.name}さん⚡`);
        } else { localStorage.removeItem("pk_jwt"); }
      })
      .catch(() => {});
  }, []);

  // ピク活を共有DB(D1)から取得。API側に投稿があればシードと統合して表示
  useEffect(() => {
    fetch(`${API_BASE}/api/pikkatsu?limit=100`)
      .then((r) => r.json())
      .then((d) => {
        if (d.items && d.items.length) {
          setPikkatsu((seed) => {
            const ids = new Set(d.items.map((x) => x.id));
            // API投稿を先頭に、既存シードで重複しないものを後ろに
            return [...d.items, ...seed.filter((s) => !ids.has(s.id))];
          });
        }
      })
      .catch(() => {});
  }, []);

  // 招待リンク(?ref=userId)を開いたら、新規登録時に送れるよう保存しておく
  useEffect(() => {
    const ref = new URLSearchParams(window.location.search).get("ref");
    if (ref) localStorage.setItem("pk_ref", ref);
  }, []);

  // シェアされたURL(?court=id)を開いたら、該当コートの詳細シートを自動で開く
  useEffect(() => {
    const courtId = new URLSearchParams(window.location.search).get("court");
    if (!courtId) return;
    const f = ALL_FACS.find((x) => x.id === courtId);
    if (f) { setDetail(f); setDetailPikLimit(3); }
  }, []);

  // マーケ流入元の計測（Cookie不使用。パス・リファラのホスト名・utm_sourceのみ送信）
  useEffect(() => {
    try {
      const utm = new URLSearchParams(window.location.search).get("utm_source") || "";
      let refHost = "";
      try { refHost = document.referrer ? new URL(document.referrer).hostname : ""; } catch { refHost = ""; }
      const body = JSON.stringify({ path: window.location.pathname, ref: refHost, utm_source: utm });
      if (navigator.sendBeacon) {
        navigator.sendBeacon(`${API_BASE}/api/track`, new Blob([body], { type: "application/json" }));
      } else {
        fetch(`${API_BASE}/api/track`, { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => {});
      }
    } catch {}
  }, []);

  const authToken = () => localStorage.getItem("pk_jwt");

  const openProfileEdit = () => setProfileEdit({
    name: user?.name || "", bio: user?.bio || "", avatar: user?.avatar || "", avatarFile: null,
    x: user?.links?.x || "", instagram: user?.links?.instagram || "", tiktok: user?.links?.tiktok || "", web: user?.links?.web || "",
  });
  const saveProfile = async () => {
    const token = authToken();
    if (!token) { showToast("ログインが必要です"); return; }
    const p = profileEdit;
    if (!p.name.trim()) { showToast("名前を入力してください"); return; }
    setSavingProfile(true);
    const fd = new FormData();
    fd.append("name", p.name); fd.append("bio", p.bio);
    fd.append("link_x", p.x); fd.append("link_instagram", p.instagram); fd.append("link_tiktok", p.tiktok); fd.append("link_web", p.web);
    if (p.avatarFile) fd.append("avatar", p.avatarFile);
    try {
      const res = await fetch(`${API_BASE}/api/profile`, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: fd });
      const d = await res.json();
      if (!res.ok) { showToast(d.error || "保存に失敗しました"); setSavingProfile(false); return; }
      const u = { ...d.user, line: true };
      setUser(u); localStorage.setItem("pk_user", JSON.stringify(u));
      setProfileEdit(null); showToast("プロフィールを更新しました");
    } catch { showToast("通信に失敗しました"); }
    setSavingProfile(false);
  };

  // メール+パスワードでの登録・ログイン（LINEと並行の第二の入口）
  const submitEmailAuth = async () => {
    const { email, password, name } = emailForm;
    if (!email.trim() || !password) { showToast("メールアドレスとパスワードを入力してください"); return; }
    const isSignup = authView === "signup";
    if (isSignup && password.length < 8) { showToast("パスワードは8文字以上にしてください"); return; }
    setEmailSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/${isSignup ? "signup" : "login"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password, name: name.trim() || undefined, ref: isSignup ? (localStorage.getItem("pk_ref") || undefined) : undefined }),
      });
      const d = await res.json();
      if (!res.ok) { showToast(d.error || "処理に失敗しました"); setEmailSubmitting(false); return; }
      localStorage.setItem("pk_jwt", d.token);
      const u = { ...d.user, line: true };
      setUser(u); localStorage.setItem("pk_user", JSON.stringify(u));
      setAuthView(null);
      setEmailForm({ email: "", password: "", name: "" });
      showToast(`ようこそ、${d.user.name}さん⚡`);
      if (isSignup) setAddLineGuide(true);
    } catch { showToast("通信に失敗しました。時間をおいて再度お試しください"); }
    setEmailSubmitting(false);
  };

  // ピク活投稿はログイン必須
  const openPikForm = (fac) => {
    // まず書ける。保存時にログイン/登録を促す（投稿ハードルを下げる）
    setPikForm({ facilityId: fac.id, facilityName: fac.name, dateChoice: "today", playedAt: todayISO(), timeBand: "", partySize: 4, crowd: 2, comment: "", nickname: user?.name || "", courtCondition: "", photo: "" });
  };
  // どこからでも呼べるピク活投稿の入口（右下FAB・ナビ・マイページ共通）
  const openPikGlobal = () => {
    if (!user) { setAuthView("signup"); showToast("ピク活の投稿には登録が必要です"); return; }
    setPikPicker(true);
  };
  const timeline = useMemo(() => [...pikkatsu].sort(pikSort).slice(0, 10), [pikkatsu]);

  // 人気ランキング: ピク活件数（同数はイキタイ数→新しさで）でTOP5
  const ranking = useMemo(() => {
    const count = {};
    for (const p of pikkatsu) count[p.facilityId] = (count[p.facilityId] || 0) + 1;
    return ALL_FACS
      .filter((f) => !f.upcoming)
      .map((f) => ({ f, pik: count[f.id] || 0, saved: ikitai.has(f.id) ? 1 : 0 }))
      .filter((x) => x.pik > 0)
      .sort((a, b) => b.pik - a.pik || b.saved - a.saved)
      .slice(0, 5);
  }, [pikkatsu, userFacs, ikitai]);
  const submitContact = (e) => {
    e.preventDefault();
    if (!contact.name.trim() || !contact.email.trim() || !contact.message.trim()) { showToast("お名前・メール・内容を入力してください"); return; }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(contact.email.trim())) { showToast("メールアドレスの形式をご確認ください"); return; }
    const body = new URLSearchParams({ "form-name": "contact", name: contact.name, email: contact.email, message: contact.message }).toString();
    fetch("/", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body })
      .then(() => { setContact({ name: "", email: "", message: "", sent: true }); showToast("お問い合わせを送信しました"); })
      .catch(() => showToast("送信に失敗しました。時間をおいて再度お試しください"));
  };

  const submitPik = async () => {
    const pf = pikForm;
    if (!pf) return;
    if (!pf.playedAt || !pf.timeBand) { showToast("日付と時間帯を選んでください"); return; }
    const comment = sanitizeText(pf.comment);
    if (comment && hasNG(comment)) { showToast("コメントに電話番号・URLは含められません"); return; }
    const token = authToken();
    // ログイン済みなら共有DB(D1)へ投稿。未ログインはローカル保存にフォールバック
    if (token) {
      const fd = new FormData();
      fd.append("facilityId", pf.facilityId);
      fd.append("playedAt", pf.playedAt);
      fd.append("timeBand", pf.timeBand);
      fd.append("partySize", String(pf.partySize));
      fd.append("crowd", String(pf.crowd));
      fd.append("courtCondition", sanitizeText(pf.courtCondition));
      fd.append("comment", comment);
      if (pf.photo && pf.photo.startsWith("data:")) {
        try { const blob = await (await fetch(pf.photo)).blob(); fd.append("photo", blob, "pik.jpg"); } catch {}
      }
      setPikForm(null);
      try {
        const res = await fetch(`${API_BASE}/api/pikkatsu`, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: fd });
        const d = await res.json();
        if (!res.ok) { showToast(d.error || "投稿に失敗しました"); return; }
        setPikkatsu((list) => [d.item, ...list]);
        showToast("ナイスピク活⚡");
      } catch { showToast("通信に失敗しました。時間をおいて再度お試しください"); }
      return;
    }
    // 未ログイン（フォールバック）
    const used = postCount.current[pf.facilityId] || 0;
    if (used >= 3) { showToast("同じコートへの投稿は1日3件までです"); return; }
    const rec = {
      id: "upk" + pikIdRef.current++, facilityId: pf.facilityId, playedAt: pf.playedAt, timeBand: pf.timeBand,
      partySize: pf.partySize, crowd: pf.crowd, courtCondition: sanitizeText(pf.courtCondition),
      comment, nickname: sanitizeText(pf.nickname).slice(0, 20), photo: pf.photo || "", likes: 0,
    };
    postCount.current[pf.facilityId] = used + 1;
    setPikkatsu((list) => [rec, ...list]);
    setPikForm(null);
    showToast("ナイスピク活⚡");
  };

  // コート名・エリア・メモ・プラン名を横断検索（部分一致・大文字小文字/全角半角を無視）
  const normalize = (s = "") =>
    String(s).toLowerCase().replace(/[Ａ-Ｚａ-ｚ０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0)).replace(/\s+/g, "");
  const searchFacs = useMemo(() => {
    const q = normalize(submittedQuery);
    if (!q) return [];
    return ALL_FACS.filter((f) => {
      const hay = normalize([f.name, f.area, f.note, f.rating, ...(f.plans || []).map((p) => p.name)].join(" "));
      return hay.includes(q);
    }).map((f) => ({ ...f, km: dist(origin, f) })).sort((a, b) => a.km - b.km);
  }, [submittedQuery, userFacs, origin]);

  // 現在地を取得して基準点にする（失敗時は渋谷のまま）
  const requestLocation = (onDone) => {
    if (!navigator.geolocation) { setGeoState("denied"); showToast("この端末は位置情報に対応していません"); return; }
    setGeoState("loading");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setOrigin({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGeoState("granted");
        showToast("現在地から近い順に並べました📍");
        onDone && onDone();
      },
      () => { setGeoState("denied"); showToast("位置情報が取得できませんでした（設定でご確認ください）"); },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
    );
  };
  // 「近い順」タップ: 現在地が未取得なら取得してから並べる
  const sortByDistance = () => {
    setSortKey("dist");
    if (geoState !== "granted") requestLocation();
  };

  const doSearch = () => {
    const q = query.trim();
    setSubmittedQuery(q);
    if (!q) { scrollTo(refSlots); return; }
    // 区名に完全マッチするなら空き枠のエリアフィルタも連動させる
    const matchedArea = Object.keys(AREA_COORDS).find((a) => normalize(a) === normalize(q) || normalize(a) === normalize(q) + "区");
    if (matchedArea && areas.includes(matchedArea)) setAreaFilter(matchedArea);
    setTimeout(() => scrollTo(refSearch), 60);
  };

  const submitCourt = () => {
    if (!form.name.trim()) {
      showToast("コート名を入力してください");
      return;
    }
    const coords = AREA_COORDS[form.area] || AREA_COORDS["その他"];
    const fid = "user" + idRef.current++;
    const priceNum = parseInt(form.price.replace(/[^0-9]/g, ""), 10);
    const newFac = {
      id: fid,
      name: form.name.trim(),
      area: form.area,
      lat: coords.lat, lng: coords.lng,
      indoor: form.indoor === "indoor",
      live: false,
      cat: form.cat,
      plans: [{ id: fid + "-c", name: "コート貸切", kind: "court", price: isNaN(priceNum) ? 9998 : priceNum, unit: "1h", capacity: null, label: form.price.trim() ? form.price.trim() + "※" : "要問合せ" }],
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
    bandLabel: { width: 64, padding: "16px 0", textAlign: "center", fontSize: 13, fontWeight: 800, color: T.courtDeep, background: "#EFF5EE" },
    cell: { flex: 1, padding: "12px 6px", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, border: "none", background: "transparent", cursor: "pointer" },
    openBadge: { display: "flex", alignItems: "center", gap: 5, fontWeight: 900, fontSize: 16 },
    portalBadge: { fontSize: 11, fontWeight: 700, color: "#5E716C", border: `1.5px dashed #B8C4BF`, borderRadius: 8, padding: "1px 7px" },
    eventBadge: { fontSize: 11, fontWeight: 800, color: "#8A4B2D", background: "#F9EBE2", borderRadius: 8, padding: "2px 8px", marginTop: 2 },
    footLink: { border: "none", background: "none", color: "#fff", opacity: 0.9, fontWeight: 800, fontSize: 12, cursor: "pointer", textDecoration: "underline", padding: 0, fontFamily: FONT },
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
    secKicker: { display: "inline-block", fontSize: 12, fontWeight: 900, letterSpacing: "0.25em", color: T.courtDeep, marginBottom: 8 },
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

  // イキタイ保存ボタン（サービス名の核。カード上に浮かせる）
  const IkitaiBtn = ({ fac, floating = false }) => {
    const on = ikitai.has(fac.id);
    const base = floating
      ? { position: "absolute", top: 8, left: 8, zIndex: 3, padding: "5px 11px 5px 8px" }
      : { padding: "8px 14px 8px 11px" };
    return (
      <button
        onClick={(e) => toggleIkitai(fac, e)}
        aria-pressed={on}
        title={on ? "イキタイ済み" : "イキタイに追加"}
        style={{
          ...base,
          display: "inline-flex", alignItems: "center", gap: 5, cursor: "pointer",
          border: on ? "none" : `1.5px solid ${floating ? "rgba(255,255,255,0.9)" : T.line}`,
          borderRadius: 999, fontFamily: FONT, fontWeight: 900, fontSize: 12, whiteSpace: "nowrap",
          background: on ? T.ball : floating ? "rgba(8,28,30,0.55)" : "#fff",
          color: on ? T.ballInk : floating ? "#fff" : T.ink,
          boxShadow: on ? "0 2px 8px rgba(215,244,56,0.5)" : "none",
          backdropFilter: floating && !on ? "blur(2px)" : "none",
          transition: "transform 0.12s ease",
        }}
      >
        <span style={{ fontSize: 13, transform: on ? "scale(1.15)" : "none", transition: "transform 0.12s ease" }}>{on ? "⚡" : "＋"}</span>
        {on ? "イキタイ済み" : "イキタイ"}
      </button>
    );
  };

  const ShareButtons = ({ fac }) => {
    const [open, setOpen] = useState(false);
    const shareUrl = `https://pickleikitai.com/?court=${fac.id}&utm_source=share`;
    const shareText = `${fac.name}｜ピックルイキタイ`;
    const items = [
      { label: "X", icon: "𝕏", onClick: () => window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(`https://pickleikitai.com/?court=${fac.id}&utm_source=share_x`)}`, "_blank") },
      { label: "LINE", icon: "💬", onClick: () => window.open(`https://line.me/R/msg/text/?${encodeURIComponent(shareText + "\n" + `https://pickleikitai.com/?court=${fac.id}&utm_source=share_line`)}`, "_blank") },
      { label: "リンクをコピー", icon: "🔗", onClick: () => { navigator.clipboard?.writeText(shareUrl); showToast("リンクをコピーしました"); setOpen(false); } },
    ];
    return (
      <div style={{ position: "relative", flexShrink: 0 }}>
        <button
          onClick={() => {
            if (navigator.share) {
              navigator.share({ title: shareText, url: shareUrl }).catch(() => {});
            } else {
              setOpen((v) => !v);
            }
          }}
          title="シェア"
          style={{ width: 34, height: 34, borderRadius: 999, border: `1.5px solid ${T.line}`, background: "#fff", display: "grid", placeItems: "center", cursor: "pointer", fontSize: 15 }}
        >
          🔗
        </button>
        {open && (
          <>
            <div style={{ position: "fixed", inset: 0, zIndex: 40 }} onClick={() => setOpen(false)} />
            <div style={{ position: "absolute", right: 0, top: 40, zIndex: 41, background: "#fff", border: `1.5px solid ${T.line}`, borderRadius: 14, boxShadow: "0 8px 24px rgba(14,42,43,0.18)", padding: 6, minWidth: 160 }}>
              {items.map((it) => (
                <button key={it.label} onClick={it.onClick} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "9px 10px", border: "none", background: "none", borderRadius: 9, cursor: "pointer", fontFamily: FONT, fontWeight: 800, fontSize: 13, color: T.ink, textAlign: "left" }}>
                  <span style={{ width: 18, textAlign: "center" }}>{it.icon}</span>{it.label}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    );
  };

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

      {/* ホーム画面に追加の控えめな誘導（下部・1回のみ・閉じたら二度と出ない） */}
      {pwaGuide && (() => {
        const ua = navigator.userAgent;
        const isIOS = /iPhone|iPad|iPod/.test(ua);
        const isAndroid = /Android/.test(ua);
        const steps = isIOS
          ? ["Safari下部の共有ボタン（□に↑）をタップ", "「ホーム画面に追加」を選ぶ", "右上の「追加」をタップして完了"]
          : isAndroid
          ? ["ブラウザ右上のメニュー（⋮）を開く", "「アプリをインストール」または「ホーム画面に追加」を選ぶ", "「追加」で完了"]
          : ["ブラウザのアドレスバー右のインストールアイコン、またはメニューを開く", "「アプリをインストール」を選ぶ", "追加して完了"];
        return (
          <>
            <div style={{ ...S.sheetBack, zIndex: 100 }} onClick={() => setPwaGuide(false)} />
            <div style={{ ...S.sheet, zIndex: 110, maxWidth: 420 }}>
              <div style={{ width: 40, height: 4, background: T.line, borderRadius: 2, margin: "0 auto 14px" }} />
              <div style={{ textAlign: "center" }}>
                <div style={{ width: 64, height: 64, borderRadius: 16, margin: "0 auto", background: T.hero1, display: "grid", placeItems: "center" }}><Ball size={34} /></div>
                <div style={{ fontWeight: 900, fontSize: 18, marginTop: 12 }}>アプリとして追加する</div>
                <div style={{ fontSize: 13, color: "#5E716C", marginTop: 6, lineHeight: 1.7 }}>ホーム画面に追加すると、アイコンから一発で開けて、アプリのように全画面で使えます。</div>
              </div>
              <div style={{ marginTop: 18 }}>
                {steps.map((s, i) => (
                  <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start", marginTop: 12 }}>
                    <span style={{ flexShrink: 0, width: 26, height: 26, borderRadius: 999, background: T.ball, color: T.ballInk, fontWeight: 900, fontSize: 13, display: "grid", placeItems: "center" }}>{i + 1}</span>
                    <span style={{ fontSize: 14, lineHeight: 1.6, paddingTop: 1 }}>{s}</span>
                  </div>
                ))}
              </div>
              <button style={{ ...S.btn(true), marginTop: 20 }} onClick={() => setPwaGuide(false)}>わかった</button>
            </div>
          </>
        );
      })()}

      {/* 新規登録直後: 公式LINE友だち追加の誘導 */}
      {addLineGuide && (
        <>
          <div style={{ ...S.sheetBack, zIndex: 100 }} onClick={() => { setAddLineGuide(false); setPikPicker(true); }} />
          <div style={{ ...S.sheet, zIndex: 110, maxWidth: 420 }}>
            <div style={{ width: 40, height: 4, background: T.line, borderRadius: 2, margin: "0 auto 14px" }} />
            <div style={{ textAlign: "center" }}>
              <div style={{ width: 64, height: 64, borderRadius: 16, margin: "0 auto", background: "#06C755", display: "grid", placeItems: "center", fontSize: 30 }}>💬</div>
              <div style={{ fontWeight: 900, fontSize: 18, marginTop: 12 }}>登録ありがとうございます⚡</div>
              <div style={{ fontSize: 13, color: "#5E716C", marginTop: 6, lineHeight: 1.7 }}>新着コート情報・お得な情報は公式LINEでお届けしています。よければ友だち追加してください。</div>
            </div>
            <button
              onClick={() => { window.open(LINE_URL, "_blank"); setAddLineGuide(false); setPikPicker(true); }}
              style={{ width: "100%", marginTop: 20, padding: "13px 0", borderRadius: 12, border: "none", background: "#06C755", color: "#fff", fontWeight: 900, fontSize: 14, cursor: "pointer", fontFamily: FONT }}>
              公式LINEを友だち追加する
            </button>
            <button style={{ ...S.btn(false), marginTop: 8 }} onClick={() => { setAddLineGuide(false); setPikPicker(true); }}>あとで</button>
          </div>
        </>
      )}

      {a2hs && (
        <div style={{ position: "fixed", left: 12, right: 12, bottom: 14, maxWidth: 460, margin: "0 auto", zIndex: 90, background: "#fff", borderRadius: 16, boxShadow: "0 8px 30px rgba(14,42,43,0.28)", border: `1.5px solid ${T.line}`, padding: "12px 14px", display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, flexShrink: 0, background: T.hero1, display: "grid", placeItems: "center" }}>
            <Ball size={22} />
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontWeight: 900, fontSize: 13 }}>ホーム画面に追加すると快適</div>
            <div style={{ fontSize: 11, color: "#5E716C", marginTop: 2, lineHeight: 1.5 }}>
              {/iPhone|iPad|iPod/.test(navigator.userAgent)
                ? "共有ボタン → 「ホーム画面に追加」でアプリのように使えます"
                : "ブラウザのメニュー →「ホーム画面に追加」でアプリのように使えます"}
            </div>
          </div>
          <button onClick={dismissA2hs} style={{ flexShrink: 0, border: "none", background: "#EFF2EF", color: T.ink, borderRadius: 999, width: 28, height: 28, fontWeight: 900, fontSize: 15, cursor: "pointer", fontFamily: FONT }}>×</button>
        </div>
      )}

      {/* ==================== ナビ（sticky） ==================== */}
      <div className="lpNav stickyNav" style={{ background: T.courtDeep, display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px clamp(14px, 4vw, 40px)", gap: 10 }}>
        <div className="lpNavLinks" style={{ overflowX: "auto", whiteSpace: "nowrap" }}>
          <a onClick={() => scrollTo(refAbout)}>ピックルイキタイとは</a>
          <a onClick={() => scrollTo(refRank)}>ランキング</a>
          <a onClick={() => scrollTo(refSlots)}>空き枠</a>
          <a onClick={() => scrollTo(refList)}>コート一覧</a>
          <a href="/articles/">記事</a>
          <a onClick={() => scrollTo(refEvents)}>イベント</a>
          <a onClick={() => scrollTo(refPik)}>ピク活</a>
          <a onClick={() => scrollTo(refAdd)}>コート登録</a>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <button onClick={openPikGlobal} style={{ display: "flex", alignItems: "center", gap: 4, border: "none", borderRadius: 999, padding: "5px 12px", background: T.ball, color: T.ballInk, fontWeight: 900, fontSize: 11, cursor: "pointer", fontFamily: FONT, whiteSpace: "nowrap" }}>
            ⚡ 投稿する
          </button>
          <button onClick={() => setPwaGuide(true)} style={{ display: "flex", alignItems: "center", gap: 4, border: "1.5px solid rgba(255,255,255,0.55)", borderRadius: 999, padding: "5px 11px", background: "transparent", color: "#fff", fontWeight: 900, fontSize: 11, cursor: "pointer", fontFamily: FONT, whiteSpace: "nowrap" }}>
            📱 アプリ
          </button>
          <button onClick={() => window.open(LINE_URL, "_blank")} className="hideMobile" style={{ display: "flex", alignItems: "center", gap: 5, border: "none", borderRadius: 999, padding: "5px 12px", background: T.ball, color: T.ballInk, fontWeight: 900, fontSize: 11, cursor: "pointer", fontFamily: FONT, whiteSpace: "nowrap" }}>
            🌱 伸びしろ報告
          </button>
          {user ? (
            <button onClick={() => setAuthView("account")} style={{ display: "flex", alignItems: "center", gap: 6, border: "1.5px solid rgba(255,255,255,0.5)", borderRadius: 999, padding: "4px 11px 4px 5px", background: "transparent", cursor: "pointer", fontFamily: FONT }}>
              <span style={{ width: 20, height: 20, borderRadius: 999, background: T.ball, color: T.ballInk, fontWeight: 900, fontSize: 11, display: "grid", placeItems: "center" }}>{user.name.slice(0, 1)}</span>
              <span style={{ color: "#fff", fontWeight: 800, fontSize: 11, whiteSpace: "nowrap" }}>{user.name}</span>
            </button>
          ) : (
            <>
              <button onClick={() => setAuthView("login")} style={{ border: "1.5px solid rgba(255,255,255,0.6)", borderRadius: 999, padding: "5px 12px", background: "transparent", color: "#fff", fontWeight: 800, fontSize: 11, cursor: "pointer", fontFamily: FONT, whiteSpace: "nowrap" }}>ログイン</button>
              <button onClick={() => setAuthView("signup")} style={{ border: "none", borderRadius: 999, padding: "6px 13px", background: "#fff", color: T.hero1, fontWeight: 900, fontSize: 11, cursor: "pointer", fontFamily: FONT, whiteSpace: "nowrap" }}>新規登録</button>
            </>
          )}
          <span className="hideMobile" style={{ fontSize: 11, fontWeight: 800, color: "#fff", opacity: 0.85, border: "1.5px solid rgba(255,255,255,0.6)", borderRadius: 999, padding: "3px 11px" }}>β版</span>
        </div>
      </div>

      {/* ==================== HERO ==================== */}
      <div style={{ background: `linear-gradient(155deg, ${T.hero2} 0%, ${T.hero1} 50%, ${T.courtDeep} 100%)`, color: "#fff", position: "relative", overflow: "hidden", minHeight: "88vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 20px 56px" }}>
        <CourtPattern />
        <div style={{ position: "relative", zIndex: 2, width: "100%", display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div className="lpTagline" style={{ fontWeight: 800, marginBottom: "clamp(20px, 4vh, 36px)", textAlign: "center", textShadow: "0 1px 4px rgba(0,0,0,0.25)" }}>
            全国のピックルボールコートがぜんぶ見つかる横断検索サイト
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

      {/* ==================== 検索結果 ==================== */}
      {submittedQuery && (
        <section ref={refSearch} className="section" style={{ background: T.bg, paddingTop: "clamp(40px, 6vh, 64px)" }}>
          <div className="sectionInner">
            <SectionHead kicker="SEARCH" title={`「${submittedQuery}」の検索結果`} />
            <div style={{ textAlign: "center", marginTop: 8 }}>
              <span style={{ fontSize: 14, fontWeight: 800, color: T.courtDeep }}>{searchFacs.length}件</span>
              <button onClick={() => { setSubmittedQuery(""); setQuery(""); }} style={{ marginLeft: 12, border: "none", background: "none", color: "#8B9B96", fontWeight: 800, fontSize: 12, cursor: "pointer", textDecoration: "underline", fontFamily: FONT }}>クリア</button>
            </div>

            {searchFacs.length === 0 ? (
              <div style={{ textAlign: "center", marginTop: 22 }}>
                <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
                  <BallGuy mood="oops" />
                </div>
                <p style={{ fontSize: 14, fontWeight: 800, marginTop: 12 }}>見つかりませんでした</p>
                <p style={{ fontSize: 13, color: "#5E716C", marginTop: 6, lineHeight: 1.9 }}>
                  コート名・エリア・キーワードで探せます（例: 有明 / 渋谷 / 屋外 / 体験会）<br />
                  ここでプレーできた場所を知っていたら、ぜひ教えてください。
                </p>
                <button style={{ ...S.btn(true), maxWidth: 280, margin: "14px auto 0" }} onClick={() => scrollTo(refAdd)}>コートを登録する →</button>
              </div>
            ) : (
              <div className="cardGrid">
                {searchFacs.map((f) => (
                  <button key={f.id} style={{ ...S.facCard, cursor: "pointer", borderColor: f.userSubmitted ? "#C9BBEE" : T.line, display: "block" }} onClick={() => openDetail(f)}>
                    <div style={{ marginBottom: 10, position: "relative" }}>
                      <CourtImage fac={f} height={118} rounded={11} />
                      <IkitaiBtn fac={f} floating />
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                        <CatBadge cat={f.cat} />
                        {f.userSubmitted && <UserBadge />}
                        {!hasCourt(f) && <span style={{ fontSize: 10, fontWeight: 800, color: "#8A4B2D", background: "#F9EBE2", borderRadius: 6, padding: "2px 6px" }}>体験会のみ</span>}
                        {f.upcoming && <span style={{ fontSize: 10, fontWeight: 800, color: "#fff", background: "#E4572E", borderRadius: 6, padding: "2px 6px" }}>🚧 {f.openDate ? f.openDate + "オープン" : "開業前"}</span>}
                        {f.memberOnly && <span style={{ fontSize: 10, fontWeight: 800, color: "#5B5B8A", background: "#ECECF7", borderRadius: 6, padding: "2px 6px" }}>会員限定</span>}
                        {f.cheap && <span style={{ fontSize: 10, fontWeight: 800, color: T.ballInk, background: T.ball, borderRadius: 6, padding: "2px 6px" }}>安い</span>}
                        {pikCount(f.id) > 0 && <span style={{ fontSize: 10, fontWeight: 800, color: T.ballInk, background: "#EEF6C8", borderRadius: 6, padding: "2px 6px" }}>⚡ピク活{pikCount(f.id)}件</span>}
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 800, color: "#8B9B96", flexShrink: 0 }}>{f.km.toFixed(1)}km</div>
                    </div>
                    <div style={{ fontWeight: 900, fontSize: 15, marginTop: 6 }}>{f.name}</div>
                    <div style={{ fontSize: 12, color: "#5E716C", marginTop: 3 }}>
                      {f.area} ・ <VenueTag indoor={f.indoor} size={12} /> ・ {hasCourt(f)
                        ? <span style={{ fontWeight: 800, color: T.courtDeep }}>{cardPrice(f)}</span>
                        : <span style={{ fontWeight: 800, color: "#8A4B2D" }}>体験会のみ</span>}
                    </div>
                    <div style={{ fontSize: 11, color: "#8B9B96", marginTop: 3 }}>{f.note}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* ==================== とは？ ==================== */}
      <section ref={refAbout} className="section" style={{ background: "#fff" }}>
        <div className="sectionInner">
          <SectionHead kicker="ABOUT" title="ピックルイキタイとは？" />
          <p style={{ textAlign: "center", fontSize: 14, lineHeight: 2, color: "#455B57", maxWidth: 640, margin: "10px auto 0" }}>
            「今週末ピックルやりたい」のに、どこでできるか分からない。<br className="hideMobile" />
            公式サイトを5個も6個も見て回って、結局予定が流れる——。<br className="hideMobile" />
            ピックルイキタイは、全国のコートを距離順・料金順でまとめて探せる横断検索ポータルです。予約は各コートの公式サイトで。
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

      {/* ==================== 人気ランキング ==================== */}
      {ranking.length > 0 && (
        <section ref={refRank} className="section" style={{ background: T.bg }}>
          <div className="sectionInner">
            <SectionHead kicker="RANKING" title="いま活発なコート" />
            <p style={{ textAlign: "center", fontSize: 13, color: "#5E716C", marginTop: 6 }}>
              ピク活の記録が多い順。人が集まっている＝行けば誰かいる、の目安に。
            </p>
            <div style={{ maxWidth: 620, margin: "18px auto 0", display: "flex", flexDirection: "column", gap: 10 }}>
              {ranking.map((x, i) => {
                const medal = ["#E8B923", "#AEB7BD", "#C9884E"][i] || T.line;
                return (
                  <button key={x.f.id} onClick={() => openDetail(x.f)}
                    style={{ display: "flex", alignItems: "center", gap: 12, padding: 10, borderRadius: 16, border: `1.5px solid ${i < 3 ? medal : T.line}`, background: "#fff", cursor: "pointer", textAlign: "left", fontFamily: FONT }}>
                    <div style={{ flexShrink: 0, width: 34, textAlign: "center", fontWeight: 900, fontStyle: "italic", fontSize: i < 3 ? 24 : 18, color: i < 3 ? medal : "#AEBCB7" }}>{i + 1}</div>
                    <div style={{ flexShrink: 0, width: 68, height: 52, borderRadius: 10, overflow: "hidden", position: "relative" }}>
                      <CourtImage fac={x.f} height={52} rounded={10} />
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontWeight: 900, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{x.f.name}</div>
                      <div style={{ fontSize: 11, color: "#8B9B96", marginTop: 2 }}>{x.f.area} ・ {x.f.indoor ? "屋内" : "屋外"}</div>
                    </div>
                    <div style={{ flexShrink: 0, textAlign: "right" }}>
                      <div style={{ fontWeight: 900, fontSize: 16, color: T.ballInk }}>⚡{x.pik}</div>
                      <div style={{ fontSize: 10, color: "#AEBCB7" }}>ピク活</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ==================== 空き枠 ==================== */}
      <section ref={refSlots} className="section" style={{ background: "#fff" }}>
        <div className="narrowInner">
          <SectionHead kicker="AVAILABILITY" title="空き枠をさがす" />

          <div className="chipScroll" style={{ marginTop: 14 }}>
            {areas.map((a) => (
              <button key={a} style={S.chip(areaFilter === a)} onClick={() => setAreaFilter(a)}>
                {a === "all" ? "すべて" : a}
              </button>
            ))}
          </div>

          <div style={{ display: "flex", gap: 8, maxWidth: 360, margin: "8px auto 0" }}>
            {[["all", "すべて"], ["indoor", "🏠 屋内"], ["outdoor", "☀️ 屋外"]].map(([k, label]) => (
              <button key={k} style={S.sortBtn(venueFilter === k)} onClick={() => setVenueFilter(k)}>{label}</button>
            ))}
          </div>

          <div className="chipScroll" style={{ marginTop: 8 }}>
            {MONTHS.map((mo) => (
              <button key={mo.m} style={S.monthChip(curMonth === mo.m)} onClick={() => jumpTo(mo.firstIdx)}>{mo.m}月</button>
            ))}
            {winStart > 0 && (
              <button style={{ ...S.monthChip(false), color: T.courtDeep }} onClick={() => jumpTo(0)}>↩ 今日</button>
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
                    {g.event > 0 && <span style={S.eventBadge}>🎪 体験会あり</span>}
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
      <section ref={refList} className="section" style={{ background: T.bg }}>
        <div className="sectionInner">
          <SectionHead kicker="COURTS" title="コート一覧" />

          <div className="chipScroll" style={{ marginTop: 14, justifyContent: "center", flexWrap: "wrap" }}>
            {CATS.map((c) => (
              <button key={c.key} style={S.chip(catFilter === c.key)} onClick={() => setCatFilter(c.key)}>{c.label}</button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8, maxWidth: 360, margin: "10px auto 0" }}>
            <button style={S.sortBtn(sortKey === "dist")} onClick={sortByDistance}>
              📍 近い順{geoState === "loading" ? "…" : ""}
            </button>
            <button style={S.sortBtn(sortKey === "price")} onClick={() => setSortKey("price")}>💰 安い順</button>
          </div>
          <div style={{ display: "flex", gap: 8, maxWidth: 360, margin: "8px auto 0" }}>
            {[["all", "すべて"], ["indoor", "🏠 屋内"], ["outdoor", "☀️ 屋外"]].map(([k, label]) => (
              <button key={k} style={S.sortBtn(venueFilter === k)} onClick={() => setVenueFilter(k)}>{label}</button>
            ))}
          </div>
          <div style={{ textAlign: "center", fontSize: 11, color: "#8B9B96", marginTop: 8 }}>
            {geoState === "granted"
              ? <>📍 現在地から近い順で表示中 ・ <button onClick={() => { setOrigin(HOME); setGeoState("idle"); }} style={{ border: "none", background: "none", color: T.courtDeep, fontWeight: 800, fontSize: 11, cursor: "pointer", textDecoration: "underline", fontFamily: FONT }}>解除</button></>
              : geoState === "denied"
              ? "位置情報が取れないため、渋谷を基準に表示しています"
              : "いまは渋谷が基準。「近い順」をタップすると現在地から並べ替えます"}
          </div>

          {ikitaiCount > 0 && (
            <div style={{ display: "flex", justifyContent: "center", marginTop: 12 }}>
              <button
                onClick={() => setOnlyIkitai((v) => !v)}
                style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 999, cursor: "pointer", fontFamily: FONT, fontWeight: 900, fontSize: 13, border: onlyIkitai ? "none" : `1.5px solid ${T.line}`, background: onlyIkitai ? T.ball : "#fff", color: onlyIkitai ? T.ballInk : T.ink }}>
                ⚡ イキタイ済み {ikitaiCount}
              </button>
            </div>
          )}

          {onlyIkitai && listFacs.length === 0 ? (
            <div style={{ textAlign: "center", padding: "36px 0" }}>
              <BallGuy mood="oops" />
              <p style={{ fontSize: 14, fontWeight: 800, marginTop: 12 }}>このカテゴリのイキタイはまだありません</p>
              <button style={{ ...S.btn(false), maxWidth: 240, margin: "12px auto 0" }} onClick={() => setOnlyIkitai(false)}>すべてのコートを見る</button>
            </div>
          ) : (
          <div className="cardGrid">
            {listFacs.slice(0, listLimit).map((f) => (
              <button key={f.id} style={{ ...S.facCard, cursor: "pointer", borderColor: f.userSubmitted ? "#C9BBEE" : T.line, display: "block" }} onClick={() => openDetail(f)}>
                <div style={{ marginBottom: 10, position: "relative" }}>
                  <CourtImage fac={f} height={118} rounded={11} />
                  <IkitaiBtn fac={f} floating />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                    <CatBadge cat={f.cat} />
                    {f.userSubmitted && <UserBadge />}
                    {!hasCourt(f) && <span style={{ fontSize: 10, fontWeight: 800, color: "#8A4B2D", background: "#F9EBE2", borderRadius: 6, padding: "2px 6px" }}>体験会のみ</span>}
                    {f.upcoming && <span style={{ fontSize: 10, fontWeight: 800, color: "#fff", background: "#E4572E", borderRadius: 6, padding: "2px 6px" }}>🚧 {f.openDate ? f.openDate + "オープン" : "開業前"}</span>}
                        {f.memberOnly && <span style={{ fontSize: 10, fontWeight: 800, color: "#5B5B8A", background: "#ECECF7", borderRadius: 6, padding: "2px 6px" }}>会員限定</span>}
                    {f.cheap && <span style={{ fontSize: 10, fontWeight: 800, color: T.ballInk, background: T.ball, borderRadius: 6, padding: "2px 6px" }}>安い</span>}
                    {f.live && <span style={{ fontSize: 10, fontWeight: 800, color: T.courtDeep, border: `1px solid ${T.court}`, borderRadius: 6, padding: "1px 5px" }}>空き枠表示</span>}
                    {pikCount(f.id) > 0 && <span style={{ fontSize: 10, fontWeight: 800, color: T.ballInk, background: "#EEF6C8", borderRadius: 6, padding: "2px 6px" }}>⚡ピク活{pikCount(f.id)}件</span>}
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: "#8B9B96", flexShrink: 0 }}>{f.km.toFixed(1)}km</div>
                </div>
                <div style={{ fontWeight: 900, fontSize: 15, marginTop: 6 }}>{f.name}</div>
                <div style={{ fontSize: 12, color: "#5E716C", marginTop: 3 }}>
                  {f.area} ・ <VenueTag indoor={f.indoor} size={12} /> ・ {hasCourt(f)
                    ? <span style={{ fontWeight: 800, color: T.courtDeep }}>{cardPrice(f)}</span>
                    : <span style={{ fontWeight: 800, color: "#8A4B2D" }}>体験会のみ</span>}
                </div>
                <div style={{ fontSize: 11, color: "#8B9B96", marginTop: 3 }}>{f.note}</div>
              </button>
            ))}
          </div>
          )}
          {listFacs.length > listLimit && (
            <div style={{ textAlign: "center", marginTop: 16 }}>
              <button style={{ ...S.btn(false), maxWidth: 280, margin: "0 auto" }} onClick={() => setListLimit((n) => n + 24)}>
                続きを見る（残り{listFacs.length - listLimit}件）
              </button>
            </div>
          )}
          <div style={{ fontSize: 11, color: "#AEBCB7", textAlign: "center", marginTop: 16 }}>
            距離は{geoState === "granted" ? "現在地" : "渋谷"}起点の直線距離 ・ 現在 {ALL_FACS.length} コート掲載中
          </div>
        </div>
      </section>

      {/* ==================== イベント ==================== */}
      <section ref={refEvents} className="section" style={{ background: T.bg }}>
        <div className="sectionInner">
          <SectionHead kicker="EVENTS" title="イベント" />
          <p style={{ textAlign: "center", fontSize: 13, color: "#5E716C", marginTop: 6 }}>1人でも参加できるオープンプレー・交流会</p>
          <div className="cardGrid" style={{ maxWidth: 680, margin: "16px auto 0" }}>
            {eventPlans.length === 0 && (
              <p style={{ textAlign: "center", fontSize: 13, color: "#8B9B96", gridColumn: "1/-1" }}>現在、掲載中の体験会・レッスンはありません</p>
            )}
            {eventPlans.map(({ f, p }) => {
              const k = KIND[p.kind];
              return (
                <div key={f.id + p.id} style={S.facCard}>
                  <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                    <span style={{ fontSize: 10, fontWeight: 800, color: k.color, background: k.bg, borderRadius: 6, padding: "2px 6px" }}>{k.icon} {k.label}</span>
                    <div style={{ fontWeight: 900, fontSize: 15 }}>{p.name}</div>
                  </div>
                  <div style={{ fontSize: 13, marginTop: 5, color: "#5E716C", fontWeight: 700 }}>{f.name}</div>
                  <div style={{ fontSize: 13, marginTop: 4, color: T.courtDeep, fontWeight: 800 }}>
                    {planPrice(p)}{p.capacity ? ` ・ 定員〜${p.capacity}名` : ""}
                  </div>
                  <div style={{ fontSize: 12, color: "#8B9B96", marginTop: 3 }}>{f.area}</div>
                  <button style={S.btn(true)} onClick={() => outbound(f)}>予約する →</button>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ==================== みんなのピク活 ==================== */}
      <section ref={refPik} className="section" style={{ background: "#fff" }}>
        <div className="sectionInner">
          <SectionHead kicker="PIKKATSU" title="みんなのピク活" />
          <p style={{ textAlign: "center", fontSize: 13, color: "#5E716C", marginTop: 6, lineHeight: 1.8 }}>
            ⚡ その日どこでどれくらいプレーできたか、みんなの記録。<br className="hideMobile" />
            ★評価じゃなく「自分のプレー記録」。混雑や実績の生きた情報がここに溜まる。
          </p>
          <div style={{ textAlign: "center", marginTop: 16 }}>
            <button
              onClick={openPikGlobal}
              style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "13px 26px", borderRadius: 999, border: "none", background: T.ball, color: T.ballInk, fontWeight: 900, fontSize: 15, cursor: "pointer", fontFamily: FONT, boxShadow: "0 4px 14px rgba(215,244,56,0.5)" }}>
              ⚡ ピク活を投稿する
            </button>
            {!user && <div style={{ fontSize: 11, color: "#8B9B96", marginTop: 8 }}>投稿には無料の新規登録が必要です</div>}
          </div>
          <div style={{ maxWidth: 560, margin: "18px auto 0" }}>
            {timeline.map((k) => {
              const f = facById(k.facilityId);
              return (
                <PikCard key={k.id} k={k} facName={f ? f.name : ""} onFac={() => f && openDetail(f)} onLike={() => likePik(k.id)} />
              );
            })}
          </div>
          <div style={{ textAlign: "center", fontSize: 11, color: "#AEBCB7", marginTop: 16 }}>
            最新{timeline.length}件を表示 ・ 各コートの詳細からもっと見られます
          </div>
        </div>
      </section>

      {/* ==================== コート登録 ==================== */}
      <section ref={refAdd} className="section" style={{ background: T.bg }}>
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

      {/* ==================== お問い合わせ ==================== */}
      <section ref={refContact} className="section" style={{ background: "#fff" }}>
        <div className="narrowInner">
          <SectionHead kicker="CONTACT" title="お問い合わせ" />
          <p style={{ textAlign: "center", fontSize: 13, color: "#5E716C", marginTop: 6, lineHeight: 1.8 }}>
            掲載情報の修正依頼・掲載希望・削除依頼など、お気軽にどうぞ。<br className="hideMobile" />
            施設運営者の方からのご連絡も歓迎します。
          </p>

          <div style={{ ...S.facCard, marginTop: 18, padding: 20 }}>
            {contact.sent ? (
              <div style={{ textAlign: "center", padding: "18px 0" }}>
                <div style={{ fontSize: 34 }}>📮</div>
                <div style={{ fontWeight: 900, fontSize: 16, marginTop: 8 }}>送信しました</div>
                <div style={{ fontSize: 13, color: "#5E716C", marginTop: 6, lineHeight: 1.8 }}>
                  ご連絡ありがとうございます。<br />内容を確認のうえ、順次ご返信します。
                </div>
                <button style={{ ...S.btn(false), marginTop: 14 }} onClick={() => setContact({ name: "", email: "", message: "", sent: false })}>続けて送る</button>
              </div>
            ) : (
              <form name="contact" method="POST" data-netlify="true" netlify-honeypot="bot-field" onSubmit={submitContact}>
                <input type="hidden" name="form-name" value="contact" />
                <p style={{ display: "none" }}>
                  <label>ここは入力しないでください: <input name="bot-field" /></label>
                </p>

                <label style={{ ...S.label, marginTop: 0 }}>お名前 *</label>
                <input name="name" style={S.input} placeholder="例: ピックル太郎" value={contact.name} onChange={(e) => setContact({ ...contact, name: e.target.value })} />

                <label style={S.label}>メールアドレス *</label>
                <input name="email" type="email" style={S.input} placeholder="例: you@example.com" value={contact.email} onChange={(e) => setContact({ ...contact, email: e.target.value })} />

                <label style={S.label}>内容 *</label>
                <textarea name="message" style={{ ...S.input, minHeight: 120, resize: "vertical" }} placeholder="例: 掲載情報に誤りがあります / コートの掲載を希望します" value={contact.message} onChange={(e) => setContact({ ...contact, message: e.target.value })} />

                <button type="submit" style={{ ...S.btn(true), marginTop: 18 }}>この内容で送信する</button>
                <div style={{ fontSize: 10, color: "#AEBCB7", marginTop: 10, textAlign: "center", lineHeight: 1.8 }}>
                  送信により<button type="button" onClick={() => setLegalView("terms")} style={{ border: "none", background: "none", padding: 0, color: T.courtDeep, fontWeight: 800, fontSize: 10, cursor: "pointer" }}>利用規約</button>・
                  <button type="button" onClick={() => setLegalView("privacy")} style={{ border: "none", background: "none", padding: 0, color: T.courtDeep, fontWeight: 800, fontSize: 10, cursor: "pointer" }}>プライバシーポリシー</button>に同意したものとみなします<br />
                  メールでも受付: {CONTACT_EMAIL}
                </div>
              </form>
            )}
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
          {/* サイトをシェア（口コミ拡散の入り口） */}
          <div style={{ maxWidth: 420, margin: "26px auto 0", background: "rgba(215,244,56,0.1)", border: `1.5px solid ${T.ball}`, borderRadius: 16, padding: "18px 18px 20px" }}>
            <div style={{ fontWeight: 900, fontSize: 15 }}>⚡ ピックルイキタイをシェア</div>
            <div style={{ fontSize: 12, opacity: 0.82, marginTop: 7, lineHeight: 1.9 }}>
              ピックル仲間に教えてあげてください。<br />
              {user ? "あなたの招待リンクなら、招待人数もカウントされます。" : "一緒にプレーする仲間が増えると、コート情報ももっと充実します。"}
            </div>
            <button
              onClick={() => {
                const url = user ? `https://pickleikitai.com/?ref=${user.id}&utm_source=invite` : "https://pickleikitai.com/?utm_source=share_footer";
                const text = "ピックルイキタイ - 全国のピックルボールコートがぜんぶ見つかる横断検索サイト";
                if (navigator.share) navigator.share({ title: text, url }).catch(() => {});
                else { navigator.clipboard?.writeText(url); showToast("リンクをコピーしました"); }
              }}
              style={{ width: "100%", marginTop: 14, padding: "13px 0", borderRadius: 12, border: "none", background: T.ball, color: T.ballInk, fontWeight: 900, fontSize: 14, cursor: "pointer", fontFamily: FONT }}>
              シェアする →
            </button>
          </div>

          {/* 伸びしろ報告（バグ報告のポジティブ版） */}
          <div style={{ maxWidth: 420, margin: "16px auto 0", background: "rgba(255,255,255,0.08)", border: "1.5px solid rgba(255,255,255,0.18)", borderRadius: 16, padding: "18px 18px 20px" }}>
            <div style={{ fontWeight: 900, fontSize: 15 }}>🌱 伸びしろ報告</div>
            <div style={{ fontSize: 12, opacity: 0.82, marginTop: 7, lineHeight: 1.9 }}>
              「ここ使いにくい」「この情報が古い」「こんなコートもあるよ」——<br />
              全部が伸びしろです。公式LINEで気軽に送ってください。
            </div>
            <button onClick={() => window.open(LINE_URL, "_blank")} style={{ width: "100%", marginTop: 14, padding: "13px 0", borderRadius: 12, border: "none", background: T.ball, color: T.ballInk, fontWeight: 900, fontSize: 14, cursor: "pointer", fontFamily: FONT }}>
              LINEで伸びしろを報告する →
            </button>
          </div>

          <div style={{ display: "flex", gap: 18, justifyContent: "center", flexWrap: "wrap", marginTop: 22 }}>
            <button style={S.footLink} onClick={() => setLegalView("terms")}>利用規約</button>
            <button style={S.footLink} onClick={() => setLegalView("privacy")}>プライバシーポリシー</button>
            <button style={S.footLink} onClick={() => scrollTo(refContact)}>お問い合わせ</button>
          </div>
          <div style={{ fontSize: 11, opacity: 0.7, marginTop: 16, lineHeight: 1.9 }}>
            掲載情報の正確性は保証されません。予約・利用条件は各施設の公式情報をご確認ください。<br />
            運営: {OPERATOR} ・ {CONTACT_EMAIL}<br />
            © {new Date().getFullYear()} {OPERATOR} — 世界をかっこよく
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
            {(() => {
              const warn = crowdWarn(pikkatsu, sheet.band.label);
              return warn ? (
                <div style={{ fontSize: 12, fontWeight: 800, color: "#B23B2E", background: "#FBE7E3", borderRadius: 10, padding: "8px 10px", marginTop: 10 }}>
                  ⚠️ この時間帯は{warn}
                </div>
              ) : null;
            })()}
            {[...visibleFacs]
              .map((f) => {
                const rows = (f.plans || []).map((p) => ({ p, st: slotStatusFor(f, p, sheet.day.key, sheet.band.key) }));
                return { f, shown: rows.filter((r) => r.st !== "full") };
              })
              .filter((x) => x.shown.length > 0)
              .sort((a, b) => b.shown.length - a.shown.length)
              .map(({ f, shown }) => (
                <div key={f.id} style={{ ...S.facCard, marginTop: 10 }}>
                  <div style={{ marginBottom: 8 }}>
                    <CourtImage fac={f} height={96} rounded={10} />
                  </div>
                  <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                    <CatBadge cat={f.cat} />
                    {f.userSubmitted && <UserBadge />}
                    <div style={{ fontWeight: 900, fontSize: 15 }}>{f.name}</div>
                  </div>
                  <div style={{ fontSize: 11, color: "#8B9B96", marginTop: 2 }}>{f.area} ・ <VenueTag indoor={f.indoor} size={12} /></div>
                  {shown.map(({ p, st }) => {
                    const k = KIND[p.kind];
                    return (
                      <div key={p.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 8, paddingTop: 8, borderTop: `1px solid ${T.line}` }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                            <span style={{ fontSize: 10, fontWeight: 800, color: k.color, background: k.bg, borderRadius: 6, padding: "2px 6px" }}>{k.icon} {k.label}</span>
                            <span style={{ fontWeight: 800, fontSize: 13 }}>{p.name}</span>
                          </div>
                          <div style={{ fontSize: 12, color: "#5E716C", marginTop: 3 }}>
                            {planPrice(p)}{p.capacity ? ` ・ 〜${p.capacity}名` : ""} ・ {st === "open" ? "空きあり" : "公式で確認"}
                          </div>
                        </div>
                        <button style={{ flexShrink: 0, padding: "8px 12px", borderRadius: 10, border: "none", fontWeight: 800, fontSize: 12, background: st === "open" ? T.court : "#EFF2EF", color: st === "open" ? "#fff" : T.ink, cursor: "pointer" }} onClick={() => outbound(f)}>予約する →</button>
                      </div>
                    );
                  })}
                </div>
              ))}
          </div>
        </>
      )}

      {/* ==================== オーバーレイ: ログイン / 新規登録 / アカウント ==================== */}
      {authView && (
        <>
          <div style={{ ...S.sheetBack, zIndex: 100 }} onClick={() => { setAuthView(null); setAuthName(""); }} />
          <div style={{ ...S.sheet, zIndex: 110, maxWidth: 420 }}>
            <div style={{ width: 40, height: 4, background: T.line, borderRadius: 2, margin: "0 auto 16px" }} />

            {authView === "account" ? (() => {
              const mine = pikkatsu.filter((p) => p.nickname === user?.name);
              const courtN = new Set(mine.map((p) => p.facilityId)).size;
              const totalLikes = mine.reduce((n, p) => n + (p.likes || 0), 0);
              const links = user?.links || {};
              // http/httpsのみ許可（javascript: 等のスキームを弾く）
              const safeUrl = (u) => { try { const p = new URL(u); return (p.protocol === "http:" || p.protocol === "https:") ? p.toString() : null; } catch { return null; } };
              const linkList = [
                links.x && { label: "X", url: safeUrl(links.x), icon: "𝕏" },
                links.instagram && { label: "Instagram", url: safeUrl(links.instagram), icon: "📷" },
                links.tiktok && { label: "TikTok", url: safeUrl(links.tiktok), icon: "🎵" },
                links.web && { label: "Web", url: safeUrl(links.web), icon: "🔗" },
              ].filter((l) => l && l.url);
              return (
                <div style={{ paddingBottom: 6 }}>
                  {/* プロフィール */}
                  <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
                    {user?.avatar
                      ? <img src={user.avatar} alt="" style={{ width: 68, height: 68, borderRadius: 999, objectFit: "cover", flexShrink: 0 }} />
                      : <div style={{ width: 68, height: 68, borderRadius: 999, background: T.ball, color: T.ballInk, fontWeight: 900, fontSize: 28, display: "grid", placeItems: "center", flexShrink: 0 }}>{user?.name?.slice(0, 1)}</div>}
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontWeight: 900, fontSize: 19 }}>{user?.name}</div>
                      {user?.bio && <div style={{ fontSize: 12, color: "#5E716C", marginTop: 3, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{user.bio}</div>}
                    </div>
                  </div>
                  {/* SNSリンク */}
                  {linkList.length > 0 && (
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
                      {linkList.map((l) => (
                        <a key={l.label} href={l.url} target="_blank" rel="noopener noreferrer"
                          style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 800, color: T.ink, background: "#EFF5EE", borderRadius: 999, padding: "5px 12px", textDecoration: "none" }}>
                          <span>{l.icon}</span>{l.label}
                        </a>
                      ))}
                    </div>
                  )}
                  {/* 統計 */}
                  <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                    {[["ピク活", mine.length], ["コート", courtN], ["⚡もらった", totalLikes], ["招待", user?.invited || 0]].map(([k, v]) => (
                      <div key={k} style={{ flex: 1, textAlign: "center", background: "#F1F4F0", borderRadius: 12, padding: "10px 0" }}>
                        <div style={{ fontWeight: 900, fontSize: 18, color: T.courtDeep }}>{v}</div>
                        <div style={{ fontSize: 10, color: "#8B9B96", marginTop: 1 }}>{k}</div>
                      </div>
                    ))}
                  </div>

                  {/* 招待リンク + 特典 */}
                  <div style={{ marginTop: 12, background: "#EFF5EE", borderRadius: 14, padding: "14px 16px" }}>
                    <div style={{ fontWeight: 900, fontSize: 13 }}>⚡ 友だちを招待する</div>
                    <div style={{ fontSize: 11, color: "#5E716C", marginTop: 3, lineHeight: 1.6 }}>このリンクから登録した人が「招待」にカウントされます。招待した人数に応じて特典バッジがもらえます</div>
                    <button
                      onClick={() => {
                        const url = `https://pickleikitai.com/?ref=${user?.id}&utm_source=invite`;
                        const text = "ピックルイキタイ - 全国のピックルボールコートがぜんぶ見つかる横断検索サイト";
                        if (navigator.share) navigator.share({ title: text, url }).catch(() => {});
                        else { navigator.clipboard?.writeText(url); showToast("招待リンクをコピーしました"); }
                      }}
                      style={{ width: "100%", marginTop: 10, padding: "11px 0", borderRadius: 10, border: "none", background: T.court, color: "#fff", fontWeight: 900, fontSize: 13, cursor: "pointer", fontFamily: FONT }}>
                      招待リンクをシェア
                    </button>
                    {(() => {
                      const invited = user?.invited || 0;
                      const tiers = [
                        { n: 1, icon: "🌱", label: "はじめの一歩", reward: "プロフィールに「サポーター」バッジ表示" },
                        { n: 3, icon: "🔥", label: "火付け役", reward: "コート登録の優先掲載＋バッジ表示" },
                        { n: 10, icon: "👑", label: "アンバサダー", reward: "運営から限定ノベルティを進呈" },
                      ];
                      const next = tiers.find((t) => invited < t.n);
                      return (
                        <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${T.line}` }}>
                          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            {tiers.map((t) => {
                              const achieved = invited >= t.n;
                              return (
                                <div key={t.n} style={{ display: "flex", alignItems: "center", gap: 10, opacity: achieved ? 1 : 0.5 }}>
                                  <div style={{ width: 30, height: 30, borderRadius: 999, background: achieved ? T.ball : "#fff", border: `1.5px solid ${achieved ? T.ball : T.line}`, display: "grid", placeItems: "center", fontSize: 14, flexShrink: 0 }}>{t.icon}</div>
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: 12, fontWeight: 900 }}>{t.label} <span style={{ fontWeight: 700, color: "#8B9B96" }}>（{t.n}人）</span></div>
                                    <div style={{ fontSize: 10.5, color: "#5E716C", marginTop: 1, lineHeight: 1.4 }}>{t.reward}</div>
                                  </div>
                                  {achieved && <span style={{ fontSize: 13, fontWeight: 900, color: T.courtDeep, flexShrink: 0 }}>✓</span>}
                                </div>
                              );
                            })}
                          </div>
                          {next ? (
                            <div style={{ marginTop: 12 }}>
                              <div style={{ height: 6, borderRadius: 999, background: T.line, overflow: "hidden" }}>
                                <div style={{ height: "100%", width: `${Math.min(100, (invited / next.n) * 100)}%`, background: T.court, borderRadius: 999 }} />
                              </div>
                              <div style={{ fontSize: 11, color: "#5E716C", marginTop: 6 }}>次の特典まであと<b style={{ color: T.courtDeep }}>{next.n - invited}人</b></div>
                            </div>
                          ) : (
                            <div style={{ fontSize: 11, color: "#5E716C", marginTop: 12, lineHeight: 1.7 }}>全ての特典を達成済みです⚡ ありがとうございます</div>
                          )}
                        </div>
                      );
                    })()}
                  </div>

                  <button style={{ ...S.btn(true), marginTop: 12, background: T.ball, color: T.ballInk }} onClick={openPikGlobal}>⚡ ピク活を投稿する</button>
                  <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                    <button style={{ ...S.btn(false), marginTop: 0, flex: 1 }} onClick={openProfileEdit}>プロフィールを編集</button>
                    <button style={{ ...S.btn(false), marginTop: 0, width: 96 }} onClick={() => { localStorage.removeItem("pk_user"); localStorage.removeItem("pk_jwt"); setUser(null); setAuthView(null); showToast("ログアウトしました"); }}>ログアウト</button>
                  </div>

                  {/* 自分のピク活タイムライン */}
                  <div style={{ fontWeight: 900, fontSize: 14, marginTop: 22 }}>自分のピク活 <span style={{ color: "#8B9B96", fontWeight: 700, fontSize: 12 }}>{mine.length}件</span></div>
                  {mine.length === 0
                    ? <div style={{ fontSize: 12, color: "#8B9B96", marginTop: 8 }}>まだピク活がありません。コートで打ったら記録しよう⚡</div>
                    : mine.map((k) => { const f = facById(k.facilityId); return <PikCard key={k.id} k={k} facName={f ? f.name : ""} onFac={() => { setAuthView(null); f && openDetail(f); }} onLike={() => likePik(k.id)} />; })}
                </div>
              );
            })() : (
              <>
                <div style={{ transform: "scale(0.62)", transformOrigin: "center", marginBottom: -18, marginTop: -10 }}>
                  <div style={{ background: T.hero1, borderRadius: 20, padding: "18px 0 22px" }}><Logo /></div>
                </div>

                <div style={{ display: "flex", background: "#F1F4F0", borderRadius: 12, padding: 4, marginTop: 8 }}>
                  {[["login", "ログイン"], ["signup", "新規登録"]].map(([k, label]) => (
                    <button key={k} onClick={() => setAuthView(k)} style={{ flex: 1, padding: "10px 0", borderRadius: 9, border: "none", cursor: "pointer", fontFamily: FONT, fontWeight: 900, fontSize: 13, background: authView === k ? T.ink : "transparent", color: authView === k ? "#fff" : "#8B9B96" }}>{label}</button>
                  ))}
                </div>

                <div style={{ fontSize: 12, fontWeight: 900, color: "#5E716C", marginTop: 20 }}>LINEアカウントで{authView === "login" ? "ログイン" : "登録"}</div>
                <button
                  onClick={startLineLogin}
                  style={{ width: "100%", marginTop: 10, padding: "13px 0", borderRadius: 12, border: "none", background: "#06C755", color: "#fff", fontWeight: 900, fontSize: 14, cursor: "pointer", fontFamily: FONT, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                  <span style={{ background: "#fff", color: "#06C755", borderRadius: 5, padding: "1px 5px", fontSize: 10, fontWeight: 900 }}>LINE</span>
                  LINEで{authView === "login" ? "ログイン" : "登録"}
                </button>

                <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "18px 0 4px" }}>
                  <div style={{ flex: 1, height: 1, background: T.line }} />
                  <span style={{ fontSize: 11, color: "#AEBCB7", fontWeight: 700 }}>または</span>
                  <div style={{ flex: 1, height: 1, background: T.line }} />
                </div>

                <div style={{ fontSize: 12, fontWeight: 900, color: "#5E716C", marginTop: 10 }}>メールアドレスで{authView === "login" ? "ログイン" : "登録"}</div>
                {authView === "signup" && (
                  <input
                    style={{ ...S.input, marginTop: 8 }}
                    placeholder="ニックネーム（例: ピックル太郎）"
                    maxLength={20}
                    value={emailForm.name}
                    onChange={(e) => setEmailForm({ ...emailForm, name: e.target.value })}
                  />
                )}
                <input
                  type="email"
                  style={{ ...S.input, marginTop: 8 }}
                  placeholder="メールアドレス"
                  value={emailForm.email}
                  onChange={(e) => setEmailForm({ ...emailForm, email: e.target.value })}
                />
                <input
                  type="password"
                  style={{ ...S.input, marginTop: 8 }}
                  placeholder={authView === "signup" ? "パスワード（8文字以上）" : "パスワード"}
                  value={emailForm.password}
                  onChange={(e) => setEmailForm({ ...emailForm, password: e.target.value })}
                  onKeyDown={(e) => e.key === "Enter" && submitEmailAuth()}
                />
                <button
                  onClick={submitEmailAuth}
                  disabled={emailSubmitting}
                  style={{ width: "100%", marginTop: 10, padding: "13px 0", borderRadius: 12, border: `1.5px solid ${T.ink}`, background: "#fff", color: T.ink, fontWeight: 900, fontSize: 14, cursor: emailSubmitting ? "default" : "pointer", fontFamily: FONT, opacity: emailSubmitting ? 0.6 : 1 }}>
                  {emailSubmitting ? "送信中…" : authView === "signup" ? "メールで登録する" : "メールでログイン"}
                </button>

                <div style={{ fontSize: 10, color: "#AEBCB7", marginTop: 12, textAlign: "center", lineHeight: 1.8 }}>
                  {authView === "signup" && <>登録により<button onClick={() => setLegalView("terms")} style={{ border: "none", background: "none", padding: 0, color: T.courtDeep, fontWeight: 800, fontSize: 10, cursor: "pointer" }}>利用規約</button>・<button onClick={() => setLegalView("privacy")} style={{ border: "none", background: "none", padding: 0, color: T.courtDeep, fontWeight: 800, fontSize: 10, cursor: "pointer" }}>プライバシーポリシー</button>に同意したものとみなします</>}
                </div>
              </>
            )}
          </div>
        </>
      )}

      {/* ==================== オーバーレイ: 利用規約 / プライバシーポリシー ==================== */}
      {legalView && (
        <>
          <div style={{ ...S.sheetBack, zIndex: 80 }} onClick={() => setLegalView(null)} />
          <div style={{ ...S.sheet, zIndex: 90 }}>
            <div style={{ width: 40, height: 4, background: T.line, borderRadius: 2, margin: "0 auto 12px" }} />
            <div style={{ fontWeight: 900, fontSize: 18 }}>{legalView === "terms" ? "利用規約" : "プライバシーポリシー"}</div>
            <div style={{ fontSize: 11, color: "#8B9B96", marginTop: 3 }}>最終更新: {isoOf(new Date())} ・ 運営: {OPERATOR}</div>
            {(legalView === "terms" ? TERMS : PRIVACY).map(([h, b]) => (
              <div key={h} style={{ marginTop: 16 }}>
                <div style={{ fontWeight: 900, fontSize: 13, color: T.courtDeep }}>{h}</div>
                <div style={{ fontSize: 13, color: "#455B57", marginTop: 5, lineHeight: 1.9 }}>{b}</div>
              </div>
            ))}
            <div style={{ fontSize: 12, color: "#5E716C", marginTop: 18, lineHeight: 1.9, borderTop: `1px solid ${T.line}`, paddingTop: 14 }}>
              <b>お問い合わせ先</b><br />
              {OPERATOR}<br />
              {CONTACT_EMAIL}
            </div>
            <button style={{ ...S.btn(true), marginTop: 18 }} onClick={() => setLegalView(null)}>閉じる</button>
          </div>
        </>
      )}

      {/* ==================== オーバーレイ: プロフィール編集 ==================== */}
      {profileEdit && (
        <>
          <div style={{ ...S.sheetBack, zIndex: 115 }} onClick={() => setProfileEdit(null)} />
          <div style={{ ...S.sheet, zIndex: 125, maxWidth: 440 }}>
            <div style={{ width: 40, height: 4, background: T.line, borderRadius: 2, margin: "0 auto 14px" }} />
            <div style={{ fontWeight: 900, fontSize: 17 }}>プロフィールを編集</div>

            <label style={{ ...S.label, marginTop: 16 }}>プロフィール画像</label>
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 6 }}>
              {profileEdit.avatar
                ? <img src={profileEdit.avatar} alt="" style={{ width: 64, height: 64, borderRadius: 999, objectFit: "cover" }} />
                : <div style={{ width: 64, height: 64, borderRadius: 999, background: T.ball, color: T.ballInk, fontWeight: 900, fontSize: 26, display: "grid", placeItems: "center" }}>{(profileEdit.name || "?").slice(0, 1)}</div>}
              <label style={{ fontSize: 13, fontWeight: 800, color: T.courtDeep, cursor: "pointer" }}>
                画像を選ぶ
                <input type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => {
                  const file = e.target.files?.[0]; if (!file) return;
                  if (file.size > 6 * 1024 * 1024) { showToast("画像は6MBまでです"); return; }
                  setProfileEdit((p) => ({ ...p, avatarFile: file, avatar: URL.createObjectURL(file) }));
                }} />
              </label>
            </div>

            <label style={S.label}>名前 *</label>
            <input style={S.input} maxLength={20} value={profileEdit.name} onChange={(e) => setProfileEdit({ ...profileEdit, name: e.target.value })} />

            <label style={S.label}>自己紹介</label>
            <textarea style={{ ...S.input, minHeight: 70, resize: "vertical" }} maxLength={160} placeholder="ピックル歴・好きなプレースタイルなど" value={profileEdit.bio} onChange={(e) => setProfileEdit({ ...profileEdit, bio: e.target.value })} />

            <label style={S.label}>SNS・リンク（プロフから飛べます）</label>
            {[["x", "X（旧Twitter）", "https://x.com/..."], ["instagram", "Instagram", "https://instagram.com/..."], ["tiktok", "TikTok", "https://tiktok.com/@..."], ["web", "Webサイト", "https://..."]].map(([k, label, ph]) => (
              <input key={k} style={{ ...S.input, marginTop: 6 }} placeholder={`${label}: ${ph}`} value={profileEdit[k]} onChange={(e) => setProfileEdit({ ...profileEdit, [k]: e.target.value })} />
            ))}

            <button style={{ ...S.btn(true), marginTop: 18 }} disabled={savingProfile} onClick={saveProfile}>{savingProfile ? "保存中…" : "保存する"}</button>
            <button style={S.btn(false)} onClick={() => setProfileEdit(null)}>キャンセル</button>
          </div>
        </>
      )}

      {/* ==================== オーバーレイ: ピク活の施設を選ぶ ==================== */}
      {pikPicker && (
        <>
          <div style={{ ...S.sheetBack, zIndex: 55 }} onClick={() => { setPikPicker(false); setPikPickerQ(""); }} />
          <div style={{ ...S.sheet, zIndex: 65 }}>
            <div style={{ width: 40, height: 4, background: T.line, borderRadius: 2, margin: "0 auto 12px" }} />
            <div style={{ fontWeight: 900, fontSize: 17 }}>⚡ どのコートでプレーした？</div>
            <div style={{ fontSize: 12, color: "#8B9B96", marginTop: 3 }}>コートを選ぶとピク活を記録できます</div>
            <input
              autoFocus
              style={{ ...S.input, marginTop: 12 }}
              placeholder="コート名・エリアで絞り込む"
              value={pikPickerQ}
              onChange={(e) => setPikPickerQ(e.target.value)}
            />
            <div style={{ marginTop: 10 }}>
              {ALL_FACS
                .filter((f) => !f.upcoming)
                .filter((f) => { const q = pikPickerQ.trim(); return !q || (f.name + f.area).includes(q); })
                .slice(0, 30)
                .map((f) => (
                  <button key={f.id} onClick={() => { setPikPicker(false); setPikPickerQ(""); openPikForm(f); }}
                    style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left", padding: "10px 12px", marginTop: 6, borderRadius: 12, border: `1.5px solid ${T.line}`, background: "#fff", cursor: "pointer", fontFamily: FONT }}>
                    <div style={{ width: 44, height: 34, borderRadius: 8, overflow: "hidden", flexShrink: 0 }}>
                      <CourtImage fac={f} height={34} rounded={8} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 800, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</div>
                      <div style={{ fontSize: 11, color: "#8B9B96" }}>{f.area} ・ {f.indoor ? "屋内" : "屋外"}</div>
                    </div>
                  </button>
                ))}
            </div>
            <button style={{ ...S.btn(false), marginTop: 12 }} onClick={() => { setPikPicker(false); setPikPickerQ(""); }}>キャンセル</button>
          </div>
        </>
      )}

      {/* ==================== オーバーレイ: ピク活投稿 ==================== */}
      {pikForm && (
        <>
          <div style={{ ...S.sheetBack, zIndex: 60 }} onClick={() => setPikForm(null)} />
          <div style={{ ...S.sheet, zIndex: 70 }}>
            <div style={{ width: 40, height: 4, background: T.line, borderRadius: 2, margin: "0 auto 12px" }} />
            <div style={{ fontWeight: 900, fontSize: 17 }}>⚡ ピク活を投稿</div>
            <div style={{ fontSize: 12, color: "#8B9B96", marginTop: 3 }}>{pikForm.facilityName}</div>

            <label style={S.label}>いつ？ *</label>
            <div style={S.segRow}>
              {[
                { k: "today", label: "今日", iso: todayISO() },
                { k: "yesterday", label: "昨日", iso: shiftISO(-1) },
                { k: "other", label: "その他", iso: pikForm.playedAt },
              ].map((d) => (
                <button key={d.k} style={S.seg(pikForm.dateChoice === d.k)} onClick={() => setPikForm({ ...pikForm, dateChoice: d.k, playedAt: d.k === "other" ? pikForm.playedAt : d.iso })}>{d.label}</button>
              ))}
            </div>
            {pikForm.dateChoice === "other" && (
              <input type="date" max={todayISO()} style={S.input} value={pikForm.playedAt} onChange={(e) => setPikForm({ ...pikForm, playedAt: e.target.value })} />
            )}

            <label style={S.label}>時間帯 *</label>
            <div className="chipScroll" style={{ marginTop: 6, flexWrap: "wrap" }}>
              {BANDS.map((b) => (
                <button key={b.key} style={{ ...S.chip(pikForm.timeBand === b.label), fontSize: 12, padding: "6px 11px" }} onClick={() => setPikForm({ ...pikForm, timeBand: b.label })}>{b.label}時</button>
              ))}
            </div>

            <label style={S.label}>何人で？</label>
            <div style={S.segRow}>
              {[2, 3, 4, 6].map((n) => (
                <button key={n} style={S.seg(pikForm.partySize === n)} onClick={() => setPikForm({ ...pikForm, partySize: n })}>{n === 6 ? "6+" : n}人</button>
              ))}
            </div>

            <label style={S.label}>混み具合</label>
            <div style={S.segRow}>
              {[1, 2, 3].map((c) => (
                <button key={c} style={S.seg(pikForm.crowd === c)} onClick={() => setPikForm({ ...pikForm, crowd: c })}>{CROWD[c].icon} {CROWD[c].label}</button>
              ))}
            </div>

            <label style={S.label}>コートの状態（任意）</label>
            <input style={S.input} maxLength={30} placeholder="例: 風強め / 床すべる / ネット持参必須" value={pikForm.courtCondition} onChange={(e) => setPikForm({ ...pikForm, courtCondition: e.target.value })} />

            <label style={S.label}>ひとこと（任意・140字）</label>
            <textarea style={{ ...S.input, minHeight: 74, resize: "vertical" }} maxLength={140} placeholder="例: 初4人で2h。11時から混み始めた" value={pikForm.comment} onChange={(e) => setPikForm({ ...pikForm, comment: e.target.value })} />
            <div style={{ fontSize: 10, color: "#AEBCB7", textAlign: "right", marginTop: 2 }}>{pikForm.comment.length}/140 ・ 電話番号・URLは投稿できません</div>

            <label style={S.label}>写真（任意・1枚）</label>
            {pikForm.photo ? (
              <div style={{ position: "relative", marginTop: 6 }}>
                <img src={pikForm.photo} alt="投稿写真プレビュー" style={{ width: "100%", height: 170, objectFit: "cover", borderRadius: 12, display: "block" }} />
                <button onClick={() => setPikForm({ ...pikForm, photo: "" })} style={{ position: "absolute", top: 8, right: 8, border: "none", borderRadius: 999, width: 28, height: 28, background: "rgba(8,28,30,0.72)", color: "#fff", fontWeight: 900, fontSize: 14, cursor: "pointer" }}>×</button>
              </div>
            ) : (
              <label style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 6, padding: "16px 0", borderRadius: 12, border: `1.5px dashed ${T.line}`, background: "#FAFCFA", cursor: "pointer", fontWeight: 800, fontSize: 13, color: "#5E716C" }}>
                📷 写真を選ぶ
                <input type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => pickPhoto(e.target.files?.[0])} />
              </label>
            )}
            <div style={{ fontSize: 10, color: "#AEBCB7", marginTop: 4 }}>コートの様子が伝わる写真だと喜ばれます</div>

            <label style={S.label}>投稿者</label>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6, padding: "10px 12px", borderRadius: 10, background: "#F1F4F0" }}>
              <span style={{ width: 24, height: 24, borderRadius: 999, background: T.ball, color: T.ballInk, fontWeight: 900, fontSize: 12, display: "grid", placeItems: "center" }}>{(pikForm.nickname || NONAME).slice(0, 1)}</span>
              <span style={{ fontWeight: 800, fontSize: 13 }}>{pikForm.nickname || NONAME}</span>
            </div>

            <button style={{ ...S.btn(true), marginTop: 18, background: T.ball, color: T.ballInk }} onClick={submitPik}>⚡ この内容で投稿する</button>
            <button style={S.btn(false)} onClick={() => setPikForm(null)}>キャンセル</button>
          </div>
        </>
      )}

      {/* ==================== オーバーレイ: 施設詳細 ==================== */}
      {detail && (
        <>
          <div style={S.sheetBack} onClick={() => setDetail(null)} />
          <div style={S.sheet}>
            <div style={{ width: 40, height: 4, background: T.line, borderRadius: 2, margin: "0 auto 12px" }} />
            <div style={{ position: "relative" }}>
              <CourtImage fac={detail} height={190} rounded={16} showBadge />
              <IkitaiBtn fac={detail} floating />
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 12 }}>
              <CatBadge cat={detail.cat} />
              {detail.userSubmitted && <UserBadge />}
              {detail.cheap && <span style={{ fontSize: 10, fontWeight: 800, color: T.ballInk, background: T.ball, borderRadius: 6, padding: "2px 6px" }}>安い</span>}
            </div>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginTop: 6 }}>
              <div style={{ fontWeight: 900, fontSize: 19 }}>{detail.name}</div>
              <ShareButtons fac={detail} />
            </div>
            <div style={{ fontSize: 13, color: "#5E716C", marginTop: 4 }}>
              {detail.area} ・ <VenueTag indoor={detail.indoor} size={13} /> ・ {geoState === "granted" ? "現在地" : "渋谷"}から約{dist(origin, detail).toFixed(1)}km
            </div>
            <div style={{ fontSize: 12, color: "#8B9B96", marginTop: 6 }}>{detail.rating}</div>
            <div style={{ fontSize: 13, color: "#5E716C", marginTop: 6, lineHeight: 1.6 }}>{detail.note}</div>
            {detail.upcoming && (
              <div style={{ fontSize: 12, fontWeight: 700, color: "#fff", background: "#E4572E", borderRadius: 10, padding: "8px 10px", marginTop: 10 }}>
                🚧 {detail.openDate ? `${detail.openDate}オープン予定` : "開業前"}・まだ利用できません。最新情報は公式サイトで
              </div>
            )}
            {(detail.unverified || detail.userSubmitted) && (
              <div style={{ fontSize: 12, color: "#7A5C00", background: "#FBF3D5", borderRadius: 10, padding: "8px 10px", marginTop: 10 }}>
                💡 {detail.userSubmitted ? "ユーザー投稿の情報です。利用条件は公式でご確認ください" : "ピックルボール利用の可否・条件は施設の公式情報でご確認ください"}
              </div>
            )}

            {/* 混雑傾向（ピク活3件以上で自動表示） */}
            {(() => {
              const t = crowdTrend(pikOf(detail.id));
              return t ? (
                <div style={{ fontSize: 12, fontWeight: 800, color: T.ink, background: "#EFF5EE", borderRadius: 10, padding: "8px 10px", marginTop: 10 }}>
                  📊 混雑傾向: {t}
                </div>
              ) : null;
            })()}

            {/* 基本情報（最寄駅・営業時間・設備） */}
            {(() => {
              const m = FAC_META[detail.id];
              if (!m) return null;
              return (
                <div style={{ marginTop: 14, border: `1.5px solid ${T.line}`, borderRadius: 12, padding: "12px 14px" }}>
                  {m.access && (
                    <div style={{ display: "flex", gap: 8, fontSize: 13, color: "#455B57" }}>
                      <span style={{ flexShrink: 0 }}>🚉</span><span>{m.access}</span>
                    </div>
                  )}
                  {m.hours && (
                    <div style={{ display: "flex", gap: 8, fontSize: 13, color: "#455B57", marginTop: 7 }}>
                      <span style={{ flexShrink: 0 }}>🕒</span><span>{m.hours}</span>
                    </div>
                  )}
                  {m.amenities?.length > 0 && (
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
                      {m.amenities.map((a) => AMENITY[a] && (
                        <span key={a} style={{ fontSize: 11, fontWeight: 700, color: T.ink, background: "#EFF5EE", borderRadius: 8, padding: "3px 8px" }}>
                          {AMENITY[a].icon} {AMENITY[a].label}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* プラン・料金 */}
            <div style={{ marginTop: 14, fontSize: 12, fontWeight: 900, letterSpacing: "0.06em", color: "#5E716C" }}>プラン・料金</div>
            {(detail.plans || []).map((p) => {
              const k = KIND[p.kind];
              return (
                <div key={p.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 8, padding: "10px 12px", border: `1.5px solid ${T.line}`, borderRadius: 12 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                      <span style={{ fontSize: 10, fontWeight: 800, color: k.color, background: k.bg, borderRadius: 6, padding: "2px 6px" }}>{k.icon} {k.label}</span>
                      <span style={{ fontWeight: 800, fontSize: 13 }}>{p.name}</span>
                    </div>
                    <div style={{ fontSize: 13, color: T.courtDeep, fontWeight: 800, marginTop: 3 }}>
                      {planPrice(p)}<span style={{ color: "#8B9B96", fontWeight: 600 }}>{p.capacity ? ` ・ 定員〜${p.capacity}名` : ""}</span>
                    </div>
                  </div>
                  <button style={{ flexShrink: 0, padding: "9px 13px", borderRadius: 10, border: "none", fontWeight: 800, fontSize: 12, background: T.court, color: "#fff", cursor: "pointer" }} onClick={() => outbound(detail)}>予約する →</button>
                </div>
              );
            })}

            <button style={{ ...S.btn(false), marginTop: 12 }} onClick={() => outbound(detail)}>
              {detail.live ? "公式サイトを開く →" : "公式情報を見る →"}
            </button>

            {/* アクセス（地図） */}
            <div style={{ marginTop: 20, fontSize: 12, fontWeight: 900, letterSpacing: "0.06em", color: "#5E716C" }}>アクセス</div>
            <CourtMap fac={detail} />

            {/* ピク活 */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 20 }}>
              <div style={{ fontSize: 14, fontWeight: 900 }}>⚡ ピク活 <span style={{ color: "#8B9B96", fontWeight: 700, fontSize: 12 }}>{pikCount(detail.id)}件</span></div>
              <button style={{ padding: "7px 13px", borderRadius: 999, border: "none", fontWeight: 800, fontSize: 12, background: T.ball, color: T.ballInk, cursor: "pointer" }} onClick={() => openPikForm(detail)}>⚡ ピク活を投稿</button>
            </div>
            {pikCount(detail.id) === 0 && (
              <div style={{ fontSize: 12, color: "#8B9B96", marginTop: 8 }}>まだピク活がありません。最初の記録を書こう⚡</div>
            )}
            {pikOf(detail.id).slice(0, detailPikLimit).map((k) => (
              <PikCard key={k.id} k={k} onLike={() => likePik(k.id)} />
            ))}
            {pikCount(detail.id) > detailPikLimit && (
              <button style={{ ...S.btn(false), marginTop: 8 }} onClick={() => setDetailPikLimit((n) => n + 5)}>もっと見る（残り{pikCount(detail.id) - detailPikLimit}件）</button>
            )}
          </div>
        </>
      )}

      {/* 右下常設の投稿ボタン（Twitter的にどこからでも投稿できる導線） */}
      {!(sheet || detail || pikPicker || pikForm || authView || profileEdit || legalView || addLineGuide || pwaGuide) && (
        <button
          onClick={openPikGlobal}
          aria-label="ピク活を投稿する"
          style={{
            position: "fixed", right: 18, bottom: a2hs ? 92 : 22, zIndex: 80,
            width: 56, height: 56, borderRadius: 999, border: "none",
            background: T.ball, color: T.ballInk, fontSize: 24, fontWeight: 900,
            cursor: "pointer", boxShadow: "0 6px 20px rgba(14,42,43,0.35)",
            display: "grid", placeItems: "center", fontFamily: FONT,
          }}>
          ⚡
        </button>
      )}
    </div>
  );
}
