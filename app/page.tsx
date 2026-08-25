"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type PropertyType = "house" | "land" | "mansion";

type Comparable = {
  id: number;
  address: string;
  landArea: number;
  buildingArea: number;
  exclusiveArea: number;
  layout: string;
  builtDate: string;
  soldPrice: number;
  soldDate: string;
  constructionUnit: number;
  usefulLife: number;
};

type Factor = { title: string; description: string };

const TSUBO = 3.30578;
const propertyLabels: Record<PropertyType, string> = {
  house: "中古戸建て",
  land: "土地",
  mansion: "マンション",
};

const defaultFactors: Record<PropertyType, { plus: Factor[]; minus: Factor[] }> = {
  house: {
    plus: [
      { title: "立地・利便性が良好", description: "最寄り駅や生活施設へのアクセスに優れています。" },
      { title: "日当たり・開放感", description: "採光・通風に恵まれ、明るい住環境です。" },
      { title: "建物の状態が良好", description: "維持管理が丁寧で、建物状態が良好です。" },
      { title: "間取り・使い勝手", description: "生活動線が良く、幅広い世帯に適しています。" },
    ],
    minus: [
      { title: "築年数の経過", description: "築年数を考慮し建物価値を補正します。" },
      { title: "周辺の競合状況", description: "販売中の類似物件との競合を考慮します。" },
      { title: "前面道路の条件", description: "道路幅員や接道状況を価格へ反映します。" },
      { title: "高低差・地勢の影響", description: "敷地形状や高低差による制約を考慮します。" },
    ],
  },
  land: {
    plus: [
      { title: "駅・生活施設への利便性", description: "交通と買い物の利便性に優れています。" },
      { title: "整形地・間口の広さ", description: "建築計画を立てやすい敷地形状です。" },
      { title: "日当たり・方位", description: "採光を確保しやすい道路付けです。" },
      { title: "住環境・街並み", description: "落ち着いた住宅地として需要があります。" },
    ],
    minus: [
      { title: "前面道路の条件", description: "道路幅員やセットバックを考慮します。" },
      { title: "高低差・擁壁", description: "造成や擁壁の状態を価格へ反映します。" },
      { title: "不整形・間口", description: "建築プランへの制約を考慮します。" },
      { title: "周辺の競合状況", description: "販売中の類似土地との競合を考慮します。" },
    ],
  },
  mansion: {
    plus: [
      { title: "駅への利便性", description: "複数沿線や駅徒歩圏の利便性があります。" },
      { title: "所在階・眺望", description: "開放感や眺望、日当たりに優れています。" },
      { title: "管理状態", description: "共用部の維持管理が良好です。" },
      { title: "間取り・専有面積", description: "需要の高い広さと使いやすい間取りです。" },
    ],
    minus: [
      { title: "築年数の経過", description: "築年数と設備の更新状況を考慮します。" },
      { title: "管理費等の負担", description: "管理費・修繕積立金の水準を反映します。" },
      { title: "所在階・方位", description: "採光や眺望への影響を考慮します。" },
      { title: "周辺の競合状況", description: "同一棟・近隣棟の売出状況を考慮します。" },
    ],
  },
};

const emptyComp = (id: number): Comparable => ({ id, address: "", landArea: 0, buildingArea: 0, exclusiveArea: 0, layout: "", builtDate: "", soldPrice: 0, soldDate: "", constructionUnit: 66, usefulLife: 25 });

function localToday() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

function toHalfWidth(value: string) {
  return value.replace(/[０-９Ａ-Ｚａ-ｚ]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0xfee0)).replace(/，/g, ",").replace(/．/g, ".").replace(/　/g, " ");
}

function parseNumber(value = "") {
  const normalized = toHalfWidth(value).replace(/,/g, "");
  return Number(normalized.match(/-?\d+(?:\.\d+)?/)?.[0] || 0);
}

function parsePrice(value = "") {
  const normalized = toHalfWidth(value).replace(/,/g, "");
  const oku = Number(normalized.match(/(\d+(?:\.\d+)?)\s*億/)?.[1] || 0);
  const man = Number(normalized.match(/(\d+(?:\.\d+)?)\s*万/)?.[1] || 0);
  if (oku || man) return oku * 10_000 + man;
  return parseNumber(normalized);
}

function japaneseDateToIso(value = "") {
  const s = toHalfWidth(value).replace(/\s+/g, " ");
  let year = Number(s.match(/(20\d{2}|19\d{2})年/)?.[1] || 0);
  const reiwa = Number(s.match(/令和\s*(\d+)年/)?.[1] || 0);
  const heisei = Number(s.match(/平成\s*(\d+)年/)?.[1] || 0);
  if (!year && reiwa) year = 2018 + reiwa;
  if (!year && heisei) year = 1988 + heisei;
  const month = Number(s.match(/(\d{1,2})月/)?.[1] || 1);
  const day = Number(s.match(/(\d{1,2})日/)?.[1] || 1);
  return year ? `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}` : "";
}

function formatDateJa(value: string) {
  if (!value) return "—";
  const [year, month, day] = value.split("-").map(Number);
  return `${year}年${month}月${day ? `${day}日` : ""}`;
}

function formatMonthJa(value: string) {
  if (!value) return "—";
  const [year, month] = value.split("-").map(Number);
  return year && month ? `${year}年${month}月` : "—";
}

function formatDateSlash(value: string) {
  if (!value) return "—";
  const [year, month, day] = value.split("-").map(Number);
  return year && month && day ? `${year}/${month}/${day}` : "—";
}

function normalizeReins(raw: string) {
  return raw.replace(/&amp;/g, "&").replace(/&#x20;/g, " ").split(/\r?\n/).map((line) => toHalfWidth(line).trim()).filter(Boolean);
}

const reinsStopLabels = new Set([
  "価格", "基本情報", "変更前価格", "うち価格消費税", "㎡単価", "坪単価",
  "都道府県名", "所在地名1", "所在地名2", "所在地名3", "建物名", "部屋番号", "その他所在地表示",
  "土地面積", "建物面積", "専有面積", "不動産ID(土地)", "不動産ID(建物)", "面積計測方式",
  "バルコニー(テラス)面積", "土地共有持分面積", "間取タイプ", "間取部屋数", "間取その他", "その他",
  "築年月", "建物構造", "建物工法", "建物形式", "地上階層", "地下階層", "所在階", "バルコニー方向",
  "成約価格", "成約年月日", "成約時期", "登録年月日", "変更年月日", "更新年月日",
  "現況", "引渡時期", "用途地域", "土地権利", "備考1", "備考2", "備考3", "備考4",
]);

function afterLabel(lines: string[], labels: string | string[]) {
  const list = Array.isArray(labels) ? labels : [labels];
  for (const label of list) {
    const index = lines.findIndex((line) => line === label);
    if (index < 0) continue;
    for (let i = index + 1; i < Math.min(lines.length, index + 6); i += 1) {
      const candidate = lines[i];
      if (/^[（(].*[）)]$/.test(candidate) || candidate === "基本情報" || candidate === "※3.30578で換算" || list.includes(candidate)) continue;
      if (reinsStopLabels.has(candidate)) return "";
      return candidate;
    }
  }
  return "";
}

function parseReins(raw: string, id: number, type: PropertyType): Comparable {
  const lines = normalizeReins(raw);
  const rooms = Math.round(parseNumber(afterLabel(lines, "間取部屋数")));
  const layoutType = toHalfWidth(afterLabel(lines, "間取タイプ")).toUpperCase();
  return {
    ...emptyComp(id),
    address: [afterLabel(lines, "都道府県名"), afterLabel(lines, "所在地名1"), afterLabel(lines, "所在地名2"), afterLabel(lines, "所在地名3")].filter(Boolean).join(""),
    landArea: parseNumber(afterLabel(lines, "土地面積")),
    buildingArea: parseNumber(afterLabel(lines, "建物面積")),
    exclusiveArea: parseNumber(afterLabel(lines, "専有面積")),
    layout: rooms && layoutType ? `${rooms}${layoutType}` : layoutType,
    builtDate: japaneseDateToIso(afterLabel(lines, "築年月")),
    soldPrice: parsePrice(afterLabel(lines, ["成約価格", "価格"])),
    soldDate: japaneseDateToIso(afterLabel(lines, ["成約年月日", "成約時期", "更新年月日", "変更年月日", "登録年月日"])),
    constructionUnit: type === "house" ? 66 : 0,
    usefulLife: type === "house" ? 25 : 0,
  };
}

function yearsBetween(from: string, to: string) {
  if (!from || !to) return 0;
  const a = new Date(from); const b = new Date(to);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return 0;
  let years = b.getFullYear() - a.getFullYear();
  if (b.getMonth() < a.getMonth() || (b.getMonth() === a.getMonth() && b.getDate() < a.getDate())) years -= 1;
  return Math.max(0, years);
}

function compUnit(comp: Comparable, type: PropertyType) {
  if (!comp.soldPrice) return 0;
  if (type === "land") return comp.landArea ? comp.soldPrice / (comp.landArea / TSUBO) : 0;
  if (type === "mansion") return comp.exclusiveArea ? comp.soldPrice / (comp.exclusiveArea / TSUBO) : 0;
  if (!comp.landArea) return 0;
  const age = yearsBetween(comp.builtDate, comp.soldDate);
  const remaining = Math.max(0, comp.usefulLife - age);
  const buildingResidual = (comp.buildingArea / TSUBO) * comp.constructionUnit * (remaining / Math.max(1, comp.usefulLife));
  return Math.max(0, comp.soldPrice - buildingResidual) / (comp.landArea / TSUBO);
}

function roundOne(value: number) { return Math.round(value * 10) / 10; }
function formatNumber(value: number, digits = 0) { return Number.isFinite(value) ? value.toLocaleString("ja-JP", { minimumFractionDigits: digits, maximumFractionDigits: digits }) : "0"; }
function ceilEnding80(value: number) { return value ? Math.ceil((value - 80) / 100) * 100 + 80 : 0; }
function floorEnding80(value: number) { return value ? Math.max(80, Math.floor((value - 80) / 100) * 100 + 80) : 0; }

function residualRateAtAge(age: number, life: number) {
  const safeLife = Math.max(1, life);
  return Math.max(0, 1 - Math.max(0, age) / safeLife);
}

function Field({ label, value, onChange, type = "text", suffix, className = "" }: { label?: string; value: string | number; onChange: (value: string) => void; type?: string; suffix?: string; className?: string }) {
  return <label className={`field ${className}`}>{label && <span>{label}</span>}<span className="field-control"><input type={type} value={value} onChange={(event) => onChange(event.target.value)} />{suffix && <small>{suffix}</small>}</span></label>;
}

function FormattedNumberInput({ value, onChange, decimals = 0, className = "", ariaLabel, showPlus = false, showZero = false }: { value: number; onChange: (value: number) => void; decimals?: number; className?: string; ariaLabel?: string; showPlus?: boolean; showZero?: boolean }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const visibleValue = value || showZero ? `${showPlus && value >= 0 ? "+" : ""}${formatNumber(value, decimals)}` : "";
  return <input aria-label={ariaLabel} className={className} inputMode="decimal" type="text" value={editing ? draft : visibleValue} onFocus={() => { setEditing(true); setDraft(value || showZero ? value.toFixed(decimals) : ""); }} onChange={(event) => { const next = event.target.value.replace(/,/g, "").replace(/^\+/, ""); setDraft(next); if (next === "") onChange(0); else if (/^-?\d*(?:\.\d*)?$/.test(next) && Number.isFinite(Number(next))) onChange(Number(next)); }} onBlur={() => setEditing(false)} />;
}

function MoneyEditor({ value, onChange, className = "" }: { value: number; onChange: (value: number) => void; className?: string }) {
  return <label className={`money-editor ${className}`}><FormattedNumberInput value={value} onChange={onChange} ariaLabel="価格" /><span>万円</span></label>;
}

function EditableChoice({ value, onChange, options, label }: { value: string | number; onChange: (value: string) => void; options: { value: string; label: string }[]; label: string }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    return () => document.removeEventListener("pointerdown", closeOnOutsideClick);
  }, [open]);
  return <span ref={rootRef} className={`editable-choice ${open ? "is-open" : ""}`}><input value={value} onChange={(event) => onChange(event.target.value)} /><button type="button" className="choice-toggle no-print" aria-label={`${label}の候補を表示`} aria-expanded={open} onClick={(event) => { event.preventDefault(); setOpen((current) => !current); }}>▼</button>{open && <span className="choice-menu no-print">{options.map((option) => <button type="button" key={option.value} onClick={(event) => { event.preventDefault(); onChange(option.value); setOpen(false); }}>{option.label}</button>)}</span>}</span>;
}

function DetailEditor({ icon, label, value, onChange, type = "text", secondary, options, className = "" }: { icon: string; label: string; value: string | number; onChange: (value: string) => void; type?: string; secondary?: string; options?: { value: string; label: string }[]; className?: string }) {
  return <label className={`detail-item ${className}`}><i>{icon}</i><div><strong>{label}</strong>{type === "area" ? <FormattedNumberInput value={Number(value)} decimals={2} onChange={(next) => onChange(String(next))} ariaLabel={label} /> : options ? <EditableChoice value={value} onChange={onChange} options={options} label={label} /> : <input type={type} value={value} onChange={(event) => onChange(event.target.value)} />}{secondary && <small>{secondary}</small>}{type === "area" && <span className="area-print-value">{formatNumber(Number(value), 2)}{secondary}</span>}{type === "month" && <span className="detail-print-value">{formatMonthJa(String(value))}</span>}</div></label>;
}

function PageHeader({ number, title, english, description }: { number: string; title: string; english: string; description: string }) {
  return <><aside className="page-rail"><strong>{number}</strong><i /><span>{english}</span></aside><header className="page-header"><div className="title-line"><h2>{title}</h2><p>{english}</p></div><div className="header-rule" /><p className="header-description">{description}</p></header></>;
}

function AreaValue({ value }: { value: number }) {
  if (!value) return <span className="muted">—</span>;
  return <span>{formatNumber(value, 2)}㎡ <small>（{formatNumber(value / TSUBO, 2)}坪）</small></span>;
}

function PriceValue({ value }: { value: number }) { return <>{value ? `${formatNumber(Math.round(value))}万円` : "—"}</>; }

function DepreciationChart({ age, life }: { age: number; life: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ratio = window.devicePixelRatio || 1, width = canvas.clientWidth, height = canvas.clientHeight;
    canvas.width = width * ratio; canvas.height = height * ratio;
    const ctx = canvas.getContext("2d"); if (!ctx) return;
    ctx.scale(ratio, ratio); ctx.clearRect(0, 0, width, height);
    const left = 54, right = width - 28, top = 30, bottom = height - 45;
    ctx.strokeStyle = "#b9bec8"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(left, top); ctx.lineTo(left, bottom); ctx.lineTo(right, bottom); ctx.stroke();
    ctx.font = '12px "Yu Gothic", sans-serif'; ctx.fillStyle = "#666";
    for (let pct = 0; pct <= 100; pct += 20) { const y = bottom - (pct / 100) * (bottom - top); ctx.fillText(`${pct}%`, 14, y + 4); ctx.strokeStyle = "#edf0f4"; ctx.beginPath(); ctx.moveTo(left, y); ctx.lineTo(right, y); ctx.stroke(); }
    const safeLife = Math.max(1, life); ctx.strokeStyle = "#071a43"; ctx.lineWidth = 2.5; ctx.beginPath();
    for (let year = 0; year <= safeLife; year += 1) { const x = left + (year / safeLife) * (right - left); const pct = residualRateAtAge(year, safeLife); const y = bottom - pct * (bottom - top); if (year === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
    ctx.stroke(); const pointAge = Math.min(safeLife, Math.max(0, age)); const pointRate = residualRateAtAge(age, safeLife); const pointX = left + (pointAge / safeLife) * (right - left); const pointY = bottom - pointRate * (bottom - top);
    ctx.strokeStyle = "#b17a16"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(pointX, pointY); ctx.lineTo(pointX, bottom); ctx.stroke(); ctx.fillStyle = "#b17a16"; ctx.beginPath(); ctx.arc(pointX, pointY, 8, 0, Math.PI * 2); ctx.fill();
    ctx.font = 'bold 16px "Yu Mincho", serif'; ctx.fillText(`${Math.round(pointRate * 100)}%`, Math.min(pointX + 12, right - 45), pointY - 10); ctx.font = '12px "Yu Gothic", sans-serif';
    const ticks = Array.from(new Set(Array.from({ length: 6 }, (_, index) => index === 5 ? safeLife : Math.round((safeLife * index) / 5))));
    ticks.forEach((year) => { const x = left + (year / safeLife) * (right - left); ctx.fillStyle = "#30343b"; const label = year === 0 ? "新築" : `${year}年`; const offset = year === safeLife ? ctx.measureText(label).width : 12; ctx.fillText(label, Math.max(left - 4, x - offset), bottom + 24); });
  }, [age, life]);
  return <canvas ref={canvasRef} className="depreciation-canvas" />;
}

export default function Home() {
  const [type, setType] = useState<PropertyType>("house");
  const [propertyName, setPropertyName] = useState(""); const [address, setAddress] = useState(""); const [mansionName, setMansionName] = useState(""); const [appraisalDate, setAppraisalDate] = useState(localToday); const [staff, setStaff] = useState("");
  const [landArea, setLandArea] = useState(0); const [buildingArea, setBuildingArea] = useState(0); const [exclusiveArea, setExclusiveArea] = useState(0); const [layout, setLayout] = useState(""); const [builtDate, setBuiltDate] = useState(""); const [transport, setTransport] = useState(""); const [road, setRoad] = useState(""); const [floors, setFloors] = useState(""); const [other, setOther] = useState(""); const [structure, setStructure] = useState("木造");
  const [comparables, setComparables] = useState<Comparable[]>(() => Array.from({ length: 5 }, (_, i) => emptyComp(i + 1)));
  const [surroundLow, setSurroundLow] = useState(0); const [surroundHigh, setSurroundHigh] = useState(0); const [unitManual, setUnitManual] = useState(false); const [adjustLow, setAdjustLow] = useState(0); const [adjustHigh, setAdjustHigh] = useState(0); const [targetUnitLowManual, setTargetUnitLowManual] = useState(0); const [targetUnitHighManual, setTargetUnitHighManual] = useState(0); const [targetUnitManual, setTargetUnitManual] = useState(false);
  const [buildingUnit, setBuildingUnit] = useState(66); const [usefulLife, setUsefulLife] = useState(25); const [newBuildingPriceManual, setNewBuildingPriceManual] = useState(0); const [appraisalLowManual, setAppraisalLowManual] = useState(0); const [appraisalHighManual, setAppraisalHighManual] = useState(0); const [recommendedManual, setRecommendedManual] = useState(0);
  const [factors, setFactors] = useState(defaultFactors.house); const [activeImport, setActiveImport] = useState<number | null>(null); const [pasteText, setPasteText] = useState(""); const [saved, setSaved] = useState(false); const loadedRef = useRef(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("kansai-valuation-report-v1");
      if (stored) {
        const d = JSON.parse(stored); setType(d.type ?? "house"); setPropertyName(d.propertyName ?? ""); setAddress(d.address ?? ""); setMansionName(d.mansionName ?? ""); setAppraisalDate(d.appraisalDate ?? localToday()); setStaff(d.staff ?? ""); setLandArea(d.landArea ?? 0); setBuildingArea(d.buildingArea ?? 0); setExclusiveArea(d.exclusiveArea ?? 0); setLayout(d.layout ?? ""); setBuiltDate(d.builtDate ?? ""); setTransport(d.transport ?? ""); setRoad(d.road ?? ""); setFloors(d.floors ?? ""); setOther(d.other ?? ""); setStructure(d.structure ?? "木造"); setComparables(d.comparables ?? Array.from({ length: 5 }, (_, i) => emptyComp(i + 1))); setSurroundLow(d.surroundLow ?? 0); setSurroundHigh(d.surroundHigh ?? 0); setUnitManual(d.unitManual ?? false); setAdjustLow(d.adjustLow ?? 0); setAdjustHigh(d.adjustHigh ?? 0); setTargetUnitLowManual(d.targetUnitLowManual ?? 0); setTargetUnitHighManual(d.targetUnitHighManual ?? 0); setTargetUnitManual(d.targetUnitManual ?? false); setBuildingUnit(d.buildingUnit ?? 66); setUsefulLife(d.usefulLife ?? 25); setNewBuildingPriceManual(d.newBuildingPriceManual ?? 0); setAppraisalLowManual(d.appraisalLowManual ?? 0); setAppraisalHighManual(d.appraisalHighManual ?? 0); setRecommendedManual(d.recommendedManual ?? 0); setFactors(d.factors ?? defaultFactors[d.type as PropertyType] ?? defaultFactors.house);
      }
    } catch { /* ignore corrupt local draft */ }
    loadedRef.current = true;
  }, []);

  const validUnits = useMemo(() => comparables.map((comp) => compUnit(comp, type)).filter((value) => value > 0), [comparables, type]);
  const averageUnit = useMemo(() => validUnits.reduce((sum, value) => sum + value, 0) / Math.max(1, validUnits.length), [validUnits]);
  useEffect(() => { if (!unitManual) { setSurroundLow(averageUnit ? roundOne(averageUnit * 0.95) : 0); setSurroundHigh(averageUnit ? roundOne(averageUnit * 1.05) : 0); } }, [averageUnit, unitManual]);

  useEffect(() => {
    if (!loadedRef.current) return;
    const payload = { type, propertyName, address, mansionName, appraisalDate, staff, landArea, buildingArea, exclusiveArea, layout, builtDate, transport, road, floors, other, structure, comparables, surroundLow, surroundHigh, unitManual, adjustLow, adjustHigh, targetUnitLowManual, targetUnitHighManual, targetUnitManual, buildingUnit, usefulLife, newBuildingPriceManual, appraisalLowManual, appraisalHighManual, recommendedManual, factors };
    const timer = window.setTimeout(() => { localStorage.setItem("kansai-valuation-report-v1", JSON.stringify(payload)); setSaved(true); window.setTimeout(() => setSaved(false), 1200); }, 350);
    return () => window.clearTimeout(timer);
  }, [type, propertyName, address, mansionName, appraisalDate, staff, landArea, buildingArea, exclusiveArea, layout, builtDate, transport, road, floors, other, structure, comparables, surroundLow, surroundHigh, unitManual, adjustLow, adjustHigh, targetUnitLowManual, targetUnitHighManual, targetUnitManual, buildingUnit, usefulLife, newBuildingPriceManual, appraisalLowManual, appraisalHighManual, recommendedManual, factors]);

  const targetAge = yearsBetween(builtDate, appraisalDate); const residualRate = residualRateAtAge(targetAge, usefulLife); const autoNewBuildingPrice = (buildingArea / TSUBO) * buildingUnit; const newBuildingPrice = newBuildingPriceManual || autoNewBuildingPrice; const buildingValue = type === "house" ? newBuildingPrice * residualRate : 0; const targetArea = type === "mansion" ? exclusiveArea / TSUBO : landArea / TSUBO; const autoAdjustedLow = surroundLow + adjustLow; const autoAdjustedHigh = surroundHigh + adjustHigh; const adjustedLow = targetUnitManual ? targetUnitLowManual : autoAdjustedLow; const adjustedHigh = targetUnitManual ? targetUnitHighManual : autoAdjustedHigh; const landAppraisalLow = Math.max(0, adjustedLow * targetArea); const landAppraisalHigh = Math.max(0, adjustedHigh * targetArea); const autoAppraisalLow = landAppraisalLow + buildingValue; const autoAppraisalHigh = landAppraisalHigh + buildingValue; const appraisalLow = appraisalLowManual || autoAppraisalLow; const appraisalHigh = appraisalHighManual || autoAppraisalHigh; const recommendedAuto = ceilEnding80(Math.max(appraisalLow, appraisalHigh) * 1.02); const recommended = recommendedManual || recommendedAuto; const challenge = floorEnding80(recommended * 1.05); const speed = floorEnding80(recommended * 0.95);

  function changeType(next: PropertyType) { setType(next); setFactors(defaultFactors[next]); setStructure(next === "mansion" ? "鉄筋コンクリート造" : "木造"); if (next === "house") { setBuildingUnit(66); setUsefulLife(25); } setUnitManual(false); setTargetUnitManual(false); setTargetUnitLowManual(0); setTargetUnitHighManual(0); setAppraisalLowManual(0); setAppraisalHighManual(0); setRecommendedManual(0); }
  function updateComp(id: number, key: keyof Comparable, value: string | number) { setComparables((current) => current.map((comp) => comp.id === id ? { ...comp, [key]: value } : comp)); }
  function addComparable() { setComparables((current) => current.length >= 5 ? current : [...current, emptyComp(Math.max(...current.map((comp) => comp.id), 0) + 1)]); }
  function removeComparable() { setComparables((current) => current.length <= 1 ? current : current.slice(0, -1)); }
  function importReins() { if (activeImport === null || !pasteText.trim()) return; const parsed = parseReins(pasteText, activeImport, type); setComparables((current) => current.map((comp) => comp.id === activeImport ? { ...comp, ...parsed } : comp)); setPasteText(""); setActiveImport(null); setUnitManual(false); }
  function updateFactor(side: "plus" | "minus", index: number, key: keyof Factor, value: string) { setFactors((current) => ({ ...current, [side]: current[side].map((factor, i) => i === index ? { ...factor, [key]: value } : factor) })); }
  function handleStructureChange(next: string) {
    setStructure(next);
    if (next === "木造") { setBuildingUnit(66); setUsefulLife(25); }
    if (["軽量鉄骨造", "鉄骨造", "鉄筋コンクリート造", "鉄骨鉄筋コンクリート造"].includes(next)) { setBuildingUnit(90); setUsefulLife(30); }
  }

  const structureOptions = ["木造", "軽量鉄骨造", "鉄骨造", "鉄筋コンクリート造", "鉄骨鉄筋コンクリート造", "その他"].map((item) => ({ value: item, label: item }));
  const floorOptions = ["平屋", "2階建て", "3階建て"].map((item) => ({ value: item, label: item }));
  const detailEditors = type === "land" ? [
    <DetailEditor key="address" icon="⌖" label="所在地" value={address} onChange={setAddress} />,
    <DetailEditor key="land" icon="▦" label="土地面積" type="area" value={landArea || ""} onChange={(value) => setLandArea(Number(value))} secondary={`㎡（${formatNumber(landArea / TSUBO, 2)}坪）`} className="area-detail" />,
    <DetailEditor key="road" icon="▤" label="接道状況" value={road} onChange={setRoad} />,
    <DetailEditor key="transport" icon="◎" label="最寄り駅・交通" value={transport} onChange={setTransport} />,
  ] : type === "mansion" ? [
    <DetailEditor key="address" icon="⌖" label="所在地" value={address} onChange={setAddress} />,
    <DetailEditor key="mansion" icon="⌂" label="マンション名" value={mansionName} onChange={setMansionName} />,
    <DetailEditor key="exclusive" icon="▦" label="専有面積" type="area" value={exclusiveArea || ""} onChange={(value) => setExclusiveArea(Number(value))} secondary={`㎡（${formatNumber(exclusiveArea / TSUBO, 2)}坪）`} className="area-detail" />,
    <DetailEditor key="layout" icon="▥" label="間取り" value={layout} onChange={setLayout} />,
    <DetailEditor key="built" icon="▣" label="築年月" type="month" value={builtDate.slice(0, 7)} onChange={setBuiltDate} />,
    <DetailEditor key="floors" icon="◫" label="所在階・階数" value={floors} onChange={setFloors} options={floorOptions} />,
    <DetailEditor key="structure" icon="▤" label="構造" value={structure} onChange={handleStructureChange} options={structureOptions} />,
    <DetailEditor key="transport" icon="◎" label="最寄り駅・交通" value={transport} onChange={setTransport} />,
  ] : [
    <DetailEditor key="address" icon="⌖" label="所在地" value={address} onChange={setAddress} />,
    <DetailEditor key="land" icon="▦" label="土地面積" type="area" value={landArea || ""} onChange={(value) => setLandArea(Number(value))} secondary={`㎡（${formatNumber(landArea / TSUBO, 2)}坪）`} className="area-detail" />,
    <DetailEditor key="building" icon="▥" label="建物面積" type="area" value={buildingArea || ""} onChange={(value) => setBuildingArea(Number(value))} secondary={`㎡（${formatNumber(buildingArea / TSUBO, 2)}坪）`} className="area-detail" />,
    <DetailEditor key="layout" icon="▤" label="間取り" value={layout} onChange={setLayout} />,
    <DetailEditor key="built" icon="▣" label="築年月" type="month" value={builtDate.slice(0, 7)} onChange={setBuiltDate} />,
    <DetailEditor key="structure" icon="⌂" label="構造" value={structure} onChange={handleStructureChange} options={structureOptions} />,
    <DetailEditor key="floors" icon="◫" label="階数" value={floors} onChange={setFloors} options={floorOptions} />,
    <DetailEditor key="road" icon="▰" label="接道状況" value={road} onChange={setRoad} />,
    <DetailEditor key="transport" icon="◎" label="最寄り駅・交通" value={transport} onChange={setTransport} />,
  ];

  return <main>
    <section className="editor-toolbar no-print" aria-label="査定書の編集メニュー"><div className="type-switch" aria-label="物件種別"><span className="toolbar-type-label">物件種別</span>{(Object.keys(propertyLabels) as PropertyType[]).map((item) => <button key={item} className={type === item ? "active" : ""} onClick={() => changeType(item)}>{propertyLabels[item]}</button>)}</div><div className="toolbar-actions"><small>{saved ? "自動保存しました" : "入力内容は自動保存されます"}</small><button className="ghost-button" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>表紙へ</button><button className="primary-button" onClick={() => window.print()}>印刷・PDF保存</button></div></section>
    <div className="report-stack">
      <article id="page-1" className={`report-page cover-page ${type === "mansion" ? "mansion-cover" : ""}`}>
        <header className="cover-title"><p>PROPERTY VALUATION REPORT</p><h1>不動産査定報告書</h1><i /></header>
        <div className="cover-fields"><Field label="お客様名" value={propertyName} onChange={setPropertyName} /><Field label="所在地" value={address} onChange={setAddress} />{type === "mansion" && <Field label="マンション名" value={mansionName} onChange={setMansionName} className="cover-mansion-field" />}<Field label="査定日" type="date" value={appraisalDate} onChange={setAppraisalDate} className="cover-date-start" /><Field label="担当者" value={staff} onChange={setStaff} /></div>
        <p className="cover-message">市場動向・周辺成約事例をもとに、<br />現在の市場価値を分析しました。</p>
        <footer className="cover-company"><i className="cover-company-logo" role="img" aria-label="CASA" /><span>関西不動産販売</span></footer>
      </article>
      <article id="page-2" className="report-page result-page">
        <PageHeader number="02" title="査定結果" english="VALUATION RESULT" description="周辺の市場動向や類似物件の成約事例をもとに、対象不動産の市場価値を算出しました。" /><div className="result-photo" />
        <section className="valuation-box"><div className="section-tab">査定価格 <small>（市場価値の目安）</small></div><div className="valuation-range"><MoneyEditor value={Math.round(appraisalLow)} onChange={setAppraisalLowManual} /><b>〜</b><MoneyEditor value={Math.round(appraisalHigh)} onChange={setAppraisalHighManual} /></div><p>現在の市場で取引されると想定される価格の幅を示しています。</p><div className="recommended-row"><span>推奨売出価格</span><MoneyEditor value={Math.round(recommended)} onChange={setRecommendedManual} /><p>市場での競争力と成約までの期間を<br />考慮した、最もバランスの良い売出<br />価格を推奨いたします。</p></div><button className="mini-reset no-print" onClick={() => { setAppraisalLowManual(0); setAppraisalHighManual(0); setRecommendedManual(0); }}>自動計算に戻す</button></section>
        <section className="property-details"><div className="section-heading"><span />査定対象物件の詳細<span /></div><div className="detail-grid">{detailEditors}</div></section>
        <div className="disclaimer-box"><span>!</span><p>上記査定価格は、{formatDateJa(appraisalDate)}時点の市場データを基に算出した目安です。<br />実際の成約価格は、売却時期・市場動向・物件の状態・交渉条件等により変動します。</p></div>
      </article>
      <article id="page-3" className="report-page comps-page">
        <PageHeader number="03" title="周辺成約事例との比較" english="MARKET COMPARISON" description="対象物件と条件の近い周辺の成約事例を比較しました。" />
        <aside className="target-summary"><b>対象物件</b><p>所在地　：{address || "—"}</p><p>{type === "mansion" ? "専有面積" : "土地面積"}：<AreaValue value={type === "mansion" ? exclusiveArea : landArea} /></p>{type === "house" && <p>建物面積：<AreaValue value={buildingArea} /></p>}{type !== "land" && <p>間取り　：{layout || "—"}</p>}{type !== "land" && <p>築年月　：{formatMonthJa(builtDate)}</p>}</aside>
        <p className="unit-lead">類似物件は <strong>坪単価 {formatNumber(surroundLow, 1)}〜{formatNumber(surroundHigh, 1)} 万円</strong> で成約しています。</p>
        <div className="case-controls no-print"><span>事例数</span><button onClick={removeComparable} disabled={comparables.length <= 1}>−</button><strong>{comparables.length}件</strong><button onClick={addComparable} disabled={comparables.length >= 5}>＋</button><small>1〜5件まで調整できます</small></div>
        <section className="comparison-table-wrap"><table className="comparison-table"><thead><tr><th>事例</th>{comparables.map((comp, index) => <th key={comp.id}><span>事例 {index + 1}</span><button className="import-button no-print" onClick={() => setActiveImport(comp.id)}>レインズ取込</button></th>)}</tr></thead><tbody>
          <tr><th>所在地</th>{comparables.map((comp) => <td key={comp.id}><input value={comp.address} onChange={(e) => updateComp(comp.id, "address", e.target.value)} placeholder="所在地" /></td>)}</tr>
          {type !== "mansion" && <tr><th>土地面積</th>{comparables.map((comp) => <td key={comp.id}><div className="area-inline"><FormattedNumberInput value={comp.landArea} decimals={2} onChange={(value) => updateComp(comp.id, "landArea", value)} ariaLabel="土地面積" /><small>㎡（約{formatNumber(comp.landArea / TSUBO, 2)}坪）</small></div></td>)}</tr>}
          {type === "house" && <tr><th>建物面積</th>{comparables.map((comp) => <td key={comp.id}><div className="area-inline"><FormattedNumberInput value={comp.buildingArea} decimals={2} onChange={(value) => updateComp(comp.id, "buildingArea", value)} ariaLabel="建物面積" /><small>㎡（約{formatNumber(comp.buildingArea / TSUBO, 2)}坪）</small></div></td>)}</tr>}
          {type === "mansion" && <tr><th>専有面積</th>{comparables.map((comp) => <td key={comp.id}><div className="area-inline"><FormattedNumberInput value={comp.exclusiveArea} decimals={2} onChange={(value) => updateComp(comp.id, "exclusiveArea", value)} ariaLabel="専有面積" /><small>㎡（約{formatNumber(comp.exclusiveArea / TSUBO, 2)}坪）</small></div></td>)}</tr>}
          {type !== "land" && <tr><th>間取り</th>{comparables.map((comp) => <td key={comp.id}><input value={comp.layout} onChange={(e) => updateComp(comp.id, "layout", e.target.value)} placeholder="4LDK" /></td>)}</tr>}
          {type !== "land" && <tr><th>築年月</th>{comparables.map((comp) => <td key={comp.id}><input className="centered-date comparison-date-input" type="month" value={comp.builtDate.slice(0, 7)} onChange={(e) => updateComp(comp.id, "builtDate", e.target.value)} /><span className="comparison-print-date">{formatMonthJa(comp.builtDate)}</span></td>)}</tr>}
          <tr><th>成約価格</th>{comparables.map((comp) => <td key={comp.id}><div className="price-inline"><FormattedNumberInput className="price-input" value={comp.soldPrice} onChange={(value) => updateComp(comp.id, "soldPrice", value)} ariaLabel="成約価格" /><small>万円</small></div></td>)}</tr>
          <tr><th>成約時期</th>{comparables.map((comp) => <td key={comp.id}><input className="centered-date comparison-date-input" type="date" value={comp.soldDate} onChange={(e) => updateComp(comp.id, "soldDate", e.target.value)} /><span className="comparison-print-date">{formatDateSlash(comp.soldDate)}</span></td>)}</tr>
          {type === "house" && <tr className="compact-settings no-print"><th>建物基準</th>{comparables.map((comp) => <td key={comp.id}><input type="number" value={comp.constructionUnit} onChange={(e) => updateComp(comp.id, "constructionUnit", Number(e.target.value))} /><small>万円/坪</small><input type="number" value={comp.usefulLife} onChange={(e) => updateComp(comp.id, "usefulLife", Number(e.target.value))} /><small>年</small></td>)}</tr>}
          <tr className="unit-row"><th>坪単価<br /><small>{type === "house" ? "（土地相当）" : type === "mansion" ? "（専有面積）" : "（土地）"}</small></th>{comparables.map((comp) => <td key={comp.id}><strong>{compUnit(comp, type) ? formatNumber(compUnit(comp, type), 1) : "—"}</strong><small>万円／坪</small></td>)}</tr>
        </tbody></table></section>
        <section className="market-range-box"><div>周辺の成約坪単価<small>（{type === "house" ? "土地相当" : propertyLabels[type]}）</small></div><div className="market-range-editor"><div><FormattedNumberInput value={surroundLow} decimals={1} showZero onChange={(value) => { setUnitManual(true); setSurroundLow(value); }} ariaLabel="周辺成約坪単価 下限" /><b>〜</b><FormattedNumberInput value={surroundHigh} decimals={1} showZero onChange={(value) => { setUnitManual(true); setSurroundHigh(value); }} ariaLabel="周辺成約坪単価 上限" /></div><small>万円／坪</small><button className="inline-auto no-print" onClick={() => setUnitManual(false)}>自動値に戻す</button></div><p className="market-commentary">上記成約は、対象物件と立地・土地広さ・建物面積・築年数・間取り等が<br />近い物件を抽出したものです。<br />周辺の{type === "mansion" ? "マンション" : "土地"}成約坪単価は{formatNumber(surroundLow, 1)}～{formatNumber(surroundHigh, 1)}万円で推移しており、<br />対象物件の条件を踏まえた価格水準の判断材料としています。</p></section><footer className="page-note">※成約価格は市場事例をもとに作成しており、実際の成約価格を保証するものではありません。</footer>
      </article>
      <article id="page-4" className="report-page analysis-page">
        <PageHeader number="04" title={type === "mansion" ? "マンション評点" : "土地評点"} english="VALUE ANALYSIS" description="対象物件の特徴や市場動向をもとに、プラス要因・マイナス要因を整理し、査定価格を算出しました。" />
        <section className="factor-columns">{(["plus", "minus"] as const).map((side) => <div className={`factor-column ${side}`} key={side}><h3>{side === "plus" ? "+ PLUS（プラス要因）" : "− MINUS（マイナス要因）"}</h3>{factors[side].map((factor, index) => <div className="factor-item" key={index}><i>{side === "plus" ? ["◎", "☀", "⌂", "▦"][index] : ["▣", "▥", "▰", "▲"][index]}</i><div><input value={factor.title} onChange={(e) => updateFactor(side, index, "title", e.target.value)} /><textarea value={factor.description} onChange={(e) => updateFactor(side, index, "description", e.target.value)} /></div></div>)}</div>)}</section>
        <aside className="calculation-flow"><h3>査定価格の算出フロー</h3><div className="flow-box"><span>周辺成約坪単価</span><div className="unit-edit-row"><FormattedNumberInput value={surroundLow} decimals={1} showZero onChange={(value) => { setUnitManual(true); setSurroundLow(value); }} ariaLabel="周辺成約坪単価 下限" /><b>〜</b><FormattedNumberInput value={surroundHigh} decimals={1} showZero onChange={(value) => { setUnitManual(true); setSurroundHigh(value); }} ariaLabel="周辺成約坪単価 上限" /><small>万円／坪</small></div><button className="inline-auto no-print" onClick={() => setUnitManual(false)}>平均±5％へ戻す</button></div><b className="flow-symbol">×</b><div className="flow-box editable-flow"><span>対象物件の評価補正</span><div><FormattedNumberInput value={adjustLow} decimals={1} showPlus showZero onChange={setAdjustLow} ariaLabel="評価補正 下限" /><b>〜</b><FormattedNumberInput value={adjustHigh} decimals={1} showPlus showZero onChange={setAdjustHigh} ariaLabel="評価補正 上限" /><small>万円／坪</small></div></div><b className="flow-symbol equals-symbol">＝</b><div className="flow-box gold-box"><span>対象物件の査定坪単価</span><div className="target-unit-edit"><FormattedNumberInput value={adjustedLow} decimals={1} showZero onChange={(value) => { setTargetUnitManual(true); setTargetUnitLowManual(value); setTargetUnitHighManual(targetUnitManual ? targetUnitHighManual : adjustedHigh); }} ariaLabel="対象物件の査定坪単価 下限" /><b>〜</b><FormattedNumberInput value={adjustedHigh} decimals={1} showZero onChange={(value) => { setTargetUnitManual(true); setTargetUnitLowManual(targetUnitManual ? targetUnitLowManual : adjustedLow); setTargetUnitHighManual(value); }} ariaLabel="対象物件の査定坪単価 上限" /><small>万円／坪</small></div><button className="inline-auto no-print" onClick={() => setTargetUnitManual(false)}>自動値に戻す</button></div><div className="down-arrow">▼</div><div className="flow-box final-flow"><span>{type === "mansion" ? "マンションの査定価格" : "土地の査定価格"}</span><strong><PriceValue value={landAppraisalLow} />〜<PriceValue value={landAppraisalHigh} /></strong><small>※上記価格は、対象物件の条件・市場動向を総合的に判断した目安です。</small></div></aside>
        <section className="overall-box"><i>!</i><div><strong>総合評価</strong><p>周辺成約事例から算出した坪単価に、対象物件固有の評価補正を加え、現在の市場性を総合的に反映した査定価格です。</p></div></section><footer className="wide-note">※実際の成約価格は、売却時期・市場動向・物件の状態・交渉条件等により変動する可能性があります。</footer>
      </article>
      {type === "house" && <article id="page-5" className="report-page building-page">
        <PageHeader number="05" title="建物の経年減価による評価" english="PROPERTY VALUE ANALYSIS" description="築年数・構造・建物状態・設備仕様等を考慮し、建物の経年減価を反映した評価額を算出しました。" />
        <section className="building-flow"><div className="building-step"><span>新築時想定建物価格</span><MoneyEditor className="building-money" value={Math.round(newBuildingPrice)} onChange={setNewBuildingPriceManual} /><button className="mini-reset no-print" onClick={() => setNewBuildingPriceManual(0)}>面積×単価へ戻す</button></div><b>▼</b><div className="building-step dual-step"><span>築年数</span><strong>{targetAge}<small>年</small></strong></div><b>▼</b><div className="building-step structure-step"><span>構造</span><EditableChoice value={structure} onChange={handleStructureChange} options={structureOptions} label="構造" /></div><div className="building-config print-hidden-preserve"><Field label="建物単価" value={buildingUnit} type="number" onChange={(v) => setBuildingUnit(Number(v))} suffix="万円/坪" /><Field label="耐用年数" value={usefulLife} type="number" onChange={(v) => setUsefulLife(Number(v))} suffix="年" /></div><b>▼</b><div className="building-step dual-step depreciation-step"><span>経年による減価を考慮</span><strong className="residual-copy"><span>残存価値率　約</span><b>{Math.round(residualRate * 100)}</b><small>％</small></strong></div><b>▼</b><div className="building-total"><span>建物評価額</span><strong>{formatNumber(Math.round(buildingValue))}<small>万円</small></strong></div></section>
        <section className="building-chart"><h3>建物の残存価値の目安（{structure}の場合）</h3><DepreciationChart age={targetAge} life={usefulLife} /><div className="chart-label">対象物件　築{targetAge}年</div></section><section className="evaluation-points"><strong>評価のポイント</strong><p>✓ 建物の維持管理状況・劣化状況を確認</p><p>✓ 設備のグレード・仕様を考慮</p><p>✓ リフォーム・修繕履歴を考慮</p><p>✓ 周辺の中古建物の取引動向を参考</p></section><footer className="building-note"><b>i</b><p>建物評価額は、税務上の減価償却費を算出するものではありません。<br />築年数・構造・施工状況・維持管理状態・設備仕様・リフォーム履歴等を総合的に考慮した査定上の参考価格です。</p></footer>
      </article>}
      <article id="page-strategy" className="report-page strategy-page">
        <PageHeader number={type === "house" ? "06" : "05"} title="販売戦略のご提案" english="SELLING STRATEGY" description="市場動向や対象物件の特性を踏まえ、最適な価格で早期に成約できるよう、戦略的に販売活動を進めてまいります。" />
        <section className="price-strategy"><h3>価格戦略のイメージ</h3><p>ご希望に合わせて、以下の3つの価格戦略をご提案いたします。</p><div className="strategy-cards"><div className="strategy-card"><h4>CHALLENGE<small>チャレンジ価格</small></h4><strong>{formatNumber(challenge)}<small>万円</small></strong><p>相場より高めの価格から市場の反応を確認する戦略</p><ul><li>高値での成約を目指す</li><li>販売期間：やや長期化の可能性</li><li>できるだけ高く売りたい方向け</li></ul></div><div className="strategy-card recommended-card"><em>おすすめ</em><h4>RECOMMEND<small>推奨売出価格</small></h4><strong>{formatNumber(recommended)}<small>万円</small></strong><p>市場での競争力と成約までの期間を考慮した価格</p><ul><li>成約の可能性が最も高い価格帯</li><li>適正な期間での成約が期待できる</li><li>価格とスピードのバランス重視</li></ul></div><div className="strategy-card"><h4>SPEED<small>スピード売却価格</small></h4><strong>{formatNumber(speed)}<small>万円</small></strong><p>市場に売却を完了したい方向けのスピード重視戦略</p><ul><li>早期成約が期待できる</li><li>販売期間：短期での成約を目指す</li><li>早く現金化したい方向け</li></ul></div></div></section>
        <section className="sales-flow"><h3>販売活動の流れ <small>（イメージ）</small></h3>{[["01", "販売準備・調査", "物件の魅力を最大限に引き出すための調査・プランニング"], ["02", "広告・情報公開", "ポータルサイトや各種媒体へ掲載し、広く告知"], ["03", "購入希望者へのご紹介", "購入希望顧客やネットワークへ物件情報をご紹介"], ["04", "ご案内・内覧対応", "物件の魅力を丁寧にお伝えする内覧対応"], ["05", "条件交渉・契約", "購入希望者との条件調整からご契約・お引渡しへ"]].map(([num, title, text]) => <div className="sales-step" key={num}><i>{["▣", "▤", "♙", "⌂", "◇"][Number(num) - 1]}</i><b>{num}</b><div><strong>{title}</strong><p>{text}</p></div></div>)}</section>
        <section className="strengths"><b>当社の強み</b>{[["♙", "豊富な購入希望顧客", "多数の購入希望顧客へ早期にご紹介"], ["▣", "幅広い広告展開力", "各種媒体を活用して効果的に訴求"], ["▥", "地域密着の販売力", "地域の相場と需要を熟知したご提案"], ["♡", "安心のサポート体制", "お引渡しまで専門スタッフが対応"], ["¥", "売却後のご相談も対応", "住み替え・税務相談もワンストップ"]].map(([icon, title, text]) => <div key={title}><i>{icon}</i><strong>{title}</strong><p>{text}</p></div>)}</section><footer className="strategy-footer"><strong>お客様のご希望や状況に合わせて、最適な販売プランをご提案いたします。</strong><span>ご不明点やご要望がございましたら、どうぞお気軽にご相談ください。</span></footer>
      </article>
    </div>
    {activeImport !== null && <div className="modal-backdrop no-print" role="dialog" aria-modal="true" aria-label="REINS文字列取込"><div className="import-modal"><button className="modal-close" onClick={() => setActiveImport(null)}>×</button><span className="eyebrow">事例 {activeImport}</span><h2>REINSの文字列を貼り付け</h2><p>物件詳細画面をすべてコピーして貼り付けると、所在地・面積・間取り・築年月・価格・時期を自動抽出します。</p><textarea autoFocus value={pasteText} onChange={(e) => setPasteText(e.target.value)} placeholder="ここにREINSの文字列を貼り付けてください" /><div className="modal-actions"><button className="ghost-button" onClick={() => setActiveImport(null)}>キャンセル</button><button className="primary-button" onClick={importReins} disabled={!pasteText.trim()}>抽出して事例へ反映</button></div></div></div>}
  </main>;
}
