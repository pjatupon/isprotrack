const BRAND_KEYWORDS = [
  "apple",
  "macbook",
  "iphone",
  "ipad",
  "imac",
  "dell",
  "hp",
  "lenovo",
  "thinkpad",
  "asus",
  "acer",
  "msi",
  "samsung",
  "lg",
  "sony",
  "toshiba",
  "canon",
  "epson",
  "brother",
  "nvidia",
  "rtx",
  "gtx",
  "geforce",
  "intel",
  "core i3",
  "core i5",
  "core i7",
  "core i9",
  "xeon",
  "amd",
  "ryzen",
  "threadripper",
  "corsair",
  "kingston",
  "western digital",
  "seagate",
  "sandisk",
  "samsung evo",
  "crucial",
  "seiko",
  "citizen",
  "casio",
  "yokogawa",
  "omron",
  "siemens",
  "schneider",
  "dahua",
  "hikvision",
  "hik",
  "ubiquiti",
  "cisco",
  "juniper",
  "microsoft",
  "windows 11 pro",
  "ubuntu",
  "office 365",
  "autocad",
];

const AMBIGUOUS_KEYWORDS: { phrase: string; suggestion: string }[] = [
  { phrase: "คุณภาพดี", suggestion: "ระบุเกณฑ์วัด เช่น อายุการใช้งานขั้นต่ำ/การรับประกันไม่น้อยกว่า N ปี" },
  { phrase: "คุณภาพดีมาก", suggestion: "ระบุเกณฑ์วัด เช่น ผ่านมาตรฐาน ISO/อย. และการรับประกันขั้นต่ำ" },
  { phrase: "มาตรฐานสูง", suggestion: "ระบุมาตรฐานที่อ้างอิง เช่น ISO 9001, TIS, IEC พร้อมเอกสารรับรอง" },
  { phrase: "มีคุณภาพ", suggestion: "ระบุคุณสมบัติที่วัดผลได้ เช่น วัสดุ ชนิด ขนาด อายุการใช้งาน" },
  { phrase: "คุณภาพเยี่ยม", suggestion: "ระบุเกณฑ์รับประกันและมาตรฐานที่อ้างอิงอย่างชัดเจน" },
  { phrase: "ทนทาน", suggestion: "ระบุอายุการใช้งานขั้นต่ำหรือวัสดุที่ใช้ผลิต" },
  { phrase: "ทนทานดี", suggestion: "ระบุอายุการใช้งานขั้นต่ำหรือวัสดุที่ใช้ผลิต" },
  { phrase: "เป็นที่นิยม", suggestion: "ระบุคุณสมบัติที่วัดได้ แทนความนิยมในท้องตลาด" },
  { phrase: "ดีที่สุด", suggestion: "หลีกเลี่ยงคำเปรียบเทียบขั้นสุด ระบุสเปกที่วัดผลได้" },
  { phrase: "มืออาชีพ", suggestion: "ระบุคุณสมบัติ/มาตรฐานผู้ให้บริการที่ตรวจสอบได้" },
  { phrase: "ใช้งานง่าย", suggestion: "ระบุข้อกำหนดการใช้งาน เช่น มีคู่มือภาษาไทย, UI เป็นภาษาไทย" },
  { phrase: "รวดเร็ว", suggestion: "ระบุเวลาส่งมอบ/ระยะเวลาการติดตั้งที่ชัดเจน" },
  { phrase: "สะดวก", suggestion: "ระบุเงื่อนไขการติดตั้ง การบำรุงรักษา หรือการสนับสนุน" },
  { phrase: "ทันสมัย", suggestion: "ระบุรุ่นเทคโนโลยีขั้นต่ำหรือปีที่ผลิต" },
  { phrase: "ประหยัดพลังงาน", suggestion: "ระบุเกณฑ์ เช่น ฉลากประหยัดไฟเบอร์ 5 หรือค่า kWh/ชั่วโมง" },
  { phrase: "eco", suggestion: "ระบุเกณฑ์มาตรฐานสิ่งแวดล้อมที่อ้างอิงได้" },
];

export interface LockInIssue {
  term: string;
  suggestion: string;
}

export interface AmbiguityIssue {
  phrase: string;
  suggestion: string;
}

export interface TorAnalysis {
  lockInIssues: LockInIssue[];
  ambiguityIssues: AmbiguityIssue[];
}

export function analyzeTorSpec(spec: string): TorAnalysis {
  const lower = spec.toLowerCase();

  const lockInIssues: LockInIssue[] = [];
  const lockInSet = new Set<string>();
  for (const keyword of BRAND_KEYWORDS) {
    if (lower.includes(keyword)) {
      lockInSet.add(keyword);
    }
  }
  for (const term of lockInSet) {
    lockInIssues.push({
      term,
      suggestion: `เปลี่ยน "${term}" เป็นการระบุสมรรถนะขั้นต่ำ (เช่น ขนาด จำนวน และคุณลักษณะที่วัดได้) เพื่อไม่ให้เข้าข่ายล็อกสเปกตามมาตรา 9`,
    });
  }

  const ambiguityIssues: AmbiguityIssue[] = [];
  for (const item of AMBIGUOUS_KEYWORDS) {
    if (lower.includes(item.phrase.toLowerCase())) {
      ambiguityIssues.push({ phrase: item.phrase, suggestion: item.suggestion });
    }
  }

  return { lockInIssues, ambiguityIssues };
}

export function highlightTorText(
  text: string,
  analysis: TorAnalysis,
): { text: string; parts: { text: string; type: "normal" | "lockin" | "ambiguous" }[] } {
  const rest = text;
  const matchers: { term: string; type: "lockin" | "ambiguous" }[] = [
    ...analysis.lockInIssues.map((i) => ({ term: i.term, type: "lockin" as const })),
    ...analysis.ambiguityIssues.map((i) => ({ term: i.phrase, type: "ambiguous" as const })),
  ];

  if (matchers.length === 0) {
    return { text, parts: [{ text, type: "normal" }] };
  }

  // Build a combined regex with alternation (escape regex chars)
  const escaped = matchers.map((m) => m.term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const combinedRegex = new RegExp(`(${escaped.join("|")})`, "gi");

  const result: { text: string; type: "normal" | "lockin" | "ambiguous" }[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = combinedRegex.exec(rest)) !== null) {
    if (match.index > lastIndex) {
      result.push({ text: rest.slice(lastIndex, match.index), type: "normal" });
    }
    const matchedTerm = match[0];
    const issue = matchers.find(
      (m) => m.term.toLowerCase() === matchedTerm.toLowerCase(),
    );
    result.push({
      text: matchedTerm,
      type: issue?.type ?? "normal",
    });
    lastIndex = match.index + matchedTerm.length;
    if (match[0].length === 0) break;
  }
  if (lastIndex < rest.length) {
    result.push({ text: rest.slice(lastIndex), type: "normal" });
  }

  return { text, parts: result };
}
