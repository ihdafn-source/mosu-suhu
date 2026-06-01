import { useEffect, useRef, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLokasi } from "@/hooks/useLokasi";
import { ChevronLeft, ChevronRight, Download, FileText, FileSpreadsheet, X, Calendar } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

type DisplayRow = {
  id: string;
  recorded_at: string;
  temperature: number;
  humidity: number;
  location_id: string;
  floor: string;
  locationName: string;
};

type RowOrGap =
  | { type: "row"; data: DisplayRow }
  | { type: "gap"; from: string; to: string; durationMin: number };

const REFRESH_MS = 2000;
const DEFAULT_THRESHOLD = 35;
const GAP_THRESHOLD_MS = 2 * 60 * 1000;
const ROWS_PER_PAGE = 50;
const THRESHOLD_PANAS = 27;
const THRESHOLD_WASPADA = 25;

function formatTime(ts: string) {
  return new Date(ts).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}
function formatDate(ts: string) {
  return new Date(ts).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
}
function formatDuration(ms: number) {
  const totalSec = Math.round(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h} jam ${m} menit`;
  if (m > 0) return `${m} menit ${s} detik`;
  return `${s} detik`;
}
function toDateStr(d: Date) { return d.toISOString().slice(0, 10); }
function addDays(d: Date, days: number) { const r = new Date(d); r.setDate(r.getDate() + days); return r; }
function fmtShortDate(d: Date) {
  return d.toLocaleDateString("id-ID", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

// ─── Export helpers ───────────────────────────────────────────────────────────
function exportCSV(rows: DisplayRow[], fromDate: string, toDate: string) {
  const header = ["Tanggal", "Waktu", "Gedung", "Lantai", "Suhu (°C)", "Kelembapan (%)", "Status"];
  const lines = [header.join(",")];
  for (const r of rows) {
    const date = formatDate(r.recorded_at);
    const time = formatTime(r.recorded_at);
    const status = r.temperature > THRESHOLD_PANAS ? "Panas" : r.temperature > THRESHOLD_WASPADA ? "Waspada" : "Aman";
    lines.push([date, time, `"${r.locationName}"`, r.floor, r.temperature.toFixed(1), r.humidity.toFixed(1), status].join(","));
  }
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `riwayat-suhu_${fromDate}_${toDate}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function exportPDF(rows: DisplayRow[], fromDate: string, toDate: string) {
  const dateRange = `${fmtShortDate(new Date(fromDate + "T00:00:00"))} – ${fmtShortDate(new Date(toDate + "T00:00:00"))}`;
  const tableRows = rows.slice(0, 1000).map((r) => {
    const date = formatDate(r.recorded_at);
    const time = formatTime(r.recorded_at);
    const status = r.temperature > THRESHOLD_PANAS ? "🔴 Panas" : r.temperature > THRESHOLD_WASPADA ? "🟡 Waspada" : "🟢 Aman";
    const rowColor = r.temperature > THRESHOLD_PANAS ? "#fff5f5" : r.temperature > THRESHOLD_WASPADA ? "#fffbeb" : "transparent";
    return `<tr style="background:${rowColor}">
      <td>${date}</td><td>${time}</td><td>${r.locationName}</td><td>${r.floor}</td>
      <td style="text-align:right;font-weight:bold">${r.temperature.toFixed(1)}</td>
      <td style="text-align:right">${r.humidity.toFixed(1)}</td>
      <td style="text-align:center">${status}</td>
    </tr>`;
  }).join("");

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Riwayat Suhu</title>
  <style>
    body { font-family: system-ui, sans-serif; font-size: 11px; color: #1a1a1a; margin: 24px; }
    h1 { font-size: 18px; margin: 0 0 4px; } p { color: #666; margin: 0 0 16px; font-size: 12px; }
    table { width: 100%; border-collapse: collapse; }
    th { background: #f1f5f9; padding: 8px 10px; text-align: left; font-size: 11px; border-bottom: 2px solid #e2e8f0; }
    td { padding: 6px 10px; border-bottom: 1px solid #f1f5f9; }
    @media print { body { margin: 0; } }
  </style></head><body>
  <h1>📊 Riwayat Suhu</h1>
  <p>Periode: ${dateRange} · Total: ${rows.length} data${rows.length > 1000 ? " (ditampilkan 1.000 pertama)" : ""}</p>
  <table><thead><tr>
    <th>Tanggal</th><th>Waktu</th><th>Gedung</th><th>Lantai</th>
    <th>Suhu (°C)</th><th>Kelembapan (%)</th><th>Status</th>
  </tr></thead><tbody>${tableRows}</tbody></table>
  </body></html>`;

  const win = window.open("", "_blank");
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 500);
}

// ─── Mobile Export Bottom Sheet ───────────────────────────────────────────────
type Period = 30 | 90 | 180 | 365 | "custom";

function ExportModalMobile({ onClose, onExport }: {
  onClose: () => void;
  onExport: (from: string, to: string, fmt: "csv" | "pdf") => void;
}) {
  const today = new Date();
  const todayStr = toDateStr(today);
  const [period, setPeriod] = useState<Period>(30);
  const [customFrom, setCustomFrom] = useState(toDateStr(addDays(today, -365)));
  const [customTo, setCustomTo] = useState(todayStr);

  const { fromDate, toDate } = useMemo(() => {
    if (period === "custom") return { fromDate: customFrom, toDate: customTo };
    return { fromDate: toDateStr(addDays(today, -period)), toDate: todayStr };
  }, [period, customFrom, customTo]);

  const periodRange = (p: Period) => {
    if (p === "custom") return null;
    return `${fmtShortDate(addDays(today, -p))} – ${fmtShortDate(today)}`;
  };

  const periods: Period[] = [30, 90, 180, 365, "custom"];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-t-3xl bg-background border-t border-border px-5 pt-5 pb-8 animate-in slide-in-from-bottom-8 duration-300">
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-muted-foreground/30" />
        <div className="flex items-center gap-3 mb-6">
          <div className="h-10 w-10 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Calendar className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="font-bold text-base">Pilih periode</h2>
            <p className="text-xs text-muted-foreground">Pilih periode riwayat, maks. 1 tahun</p>
          </div>
          <button onClick={onClose} className="ml-auto rounded-full p-1.5 hover:bg-muted transition">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        <div className="rounded-2xl border border-border overflow-hidden mb-5">
          {periods.map((p, i) => (
            <div key={String(p)}>
              {i > 0 && <div className="border-t border-border/60" />}
              <button type="button" onClick={() => setPeriod(p)}
                className={["w-full flex items-center justify-between px-4 py-3.5 transition text-left", period === p ? "bg-muted/60" : "hover:bg-muted/30"].join(" ")}>
                <div>
                  <p className="font-semibold text-sm">{p === "custom" ? "Atur periode" : `${p} hari terakhir`}</p>
                  {periodRange(p) && <p className="text-xs text-muted-foreground mt-0.5">{periodRange(p)}</p>}
                </div>
                <span className={["h-5 w-5 rounded-full border-2 flex items-center justify-center transition", period === p ? "border-emerald-500" : "border-muted-foreground/40"].join(" ")}>
                  {period === p && <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />}
                </span>
              </button>
              {p === "custom" && period === "custom" && (
                <div className="px-4 pb-4 grid grid-cols-2 gap-2">
                  <div className="rounded-xl border border-border bg-muted/30 p-3">
                    <p className="text-xs text-muted-foreground mb-1">Dari</p>
                    <input type="date" value={customFrom} max={customTo}
                      onChange={(e) => setCustomFrom(e.target.value)}
                      className="text-sm font-medium bg-transparent outline-none w-full" />
                  </div>
                  <div className="rounded-xl border border-border bg-muted/30 p-3">
                    <p className="text-xs text-muted-foreground mb-1">Ke</p>
                    <input type="date" value={customTo} min={customFrom} max={todayStr}
                      onChange={(e) => setCustomTo(e.target.value)}
                      className="text-sm font-medium bg-transparent outline-none w-full" />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button type="button" onClick={() => onExport(fromDate, toDate, "csv")}
            className="flex items-center justify-center gap-2 rounded-2xl border border-border bg-muted/40 hover:bg-muted/70 px-4 py-3.5 font-semibold text-sm transition">
            <FileSpreadsheet className="h-4 w-4 text-emerald-500" /> Export CSV
          </button>
          <button type="button" onClick={() => onExport(fromDate, toDate, "pdf")}
            className="flex items-center justify-center gap-2 rounded-2xl border border-border bg-muted/40 hover:bg-muted/70 px-4 py-3.5 font-semibold text-sm transition">
            <FileText className="h-4 w-4 text-red-500" /> Export PDF
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Desktop Export Bar ───────────────────────────────────────────────────────
function ExportBarDesktop({ allRows }: { allRows: DisplayRow[] }) {
  const today = new Date();
  const [fromDate, setFromDate] = useState(toDateStr(addDays(today, -30)));
  const [toDate, setToDate] = useState(toDateStr(today));

  function doExport(fmt: "csv" | "pdf") {
    const filtered = allRows.filter((r) => {
      const d = r.recorded_at.slice(0, 10);
      return d >= fromDate && d <= toDate;
    });
    if (fmt === "csv") exportCSV(filtered, fromDate, toDate);
    else exportPDF(filtered, fromDate, toDate);
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-muted/20 px-4 py-3 mb-3">
      <Download className="h-4 w-4 text-muted-foreground shrink-0" />
      <span className="text-sm font-semibold text-muted-foreground">Export Riwayat</span>
      <div className="flex items-center gap-2 flex-wrap ml-auto">
        <div className="flex items-center gap-2">
          <label className="text-xs text-muted-foreground">Dari</label>
          <input type="date" value={fromDate} max={toDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus:ring-1 focus:ring-primary" />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-muted-foreground">Ke</label>
          <input type="date" value={toDate} min={fromDate} max={toDateStr(today)}
            onChange={(e) => setToDate(e.target.value)}
            className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus:ring-1 focus:ring-primary" />
        </div>
        <button type="button" onClick={() => doExport("csv")}
          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 px-3 py-1.5 text-sm font-semibold text-white transition">
          <FileSpreadsheet className="h-3.5 w-3.5" /> Export CSV
        </button>
        <button type="button" onClick={() => doExport("pdf")}
          className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 hover:bg-red-700 px-3 py-1.5 text-sm font-semibold text-white transition">
          <FileText className="h-3.5 w-3.5" /> Export PDF
        </button>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
interface TemperatureTableProps {
  threshold?: number;
  locationId?: string;
  floorId?: string;
}

export default function TemperatureTable({
  threshold = DEFAULT_THRESHOLD,
  locationId,
  floorId,
}: TemperatureTableProps) {
  const { lokasi } = useLokasi();
  const isMobile = useIsMobile();
  const [allRows, setAllRows] = useState<DisplayRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dbError, setDbError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [showExportModal, setShowExportModal] = useState(false);
  const timerRef = useRef<number | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);
  useEffect(() => { setPage(1); }, [locationId, floorId]);

  useEffect(() => {
    const locationMap = new Map(lokasi.map((l) => [l.id, l.name]));
    const fetchRows = async () => {
      let query = supabase
        .from("temperature_readings")
        .select("id, location_id, floor, temperature, humidity, recorded_at")
        .order("recorded_at", { ascending: false })
        .limit(2000);
      if (locationId && !locationId.startsWith("default-")) {
        query = query.eq("location_id", locationId);
      }
      const { data, error } = await query;
      if (!mountedRef.current) return;
      if (error) { setDbError(`[${error.code}] ${error.message}`); setLoading(false); return; }
      setDbError(null);
      const mapped: DisplayRow[] = (data ?? []).map((r: any) => ({
        id: String(r.id ?? Math.random()),
        recorded_at: String(r.recorded_at ?? ""),
        temperature: Number(r.temperature ?? 0),
        humidity: Number(r.humidity ?? 0),
        location_id: String(r.location_id ?? ""),
        floor: String(r.floor ?? "-"),
        locationName: locationMap.get(String(r.location_id)) ?? String(r.location_id ?? "—"),
      })).filter((r) => r.recorded_at);
      setAllRows(mapped);
      setLoading(false);
    };
    void fetchRows();
    timerRef.current = window.setInterval(() => void fetchRows(), REFRESH_MS);
    return () => { if (timerRef.current) window.clearInterval(timerRef.current); };
  }, [lokasi, locationId, floorId]);

  const rowsWithGaps = useMemo((): RowOrGap[] => {
    const result: RowOrGap[] = [];
    for (let i = 0; i < allRows.length; i++) {
      result.push({ type: "row", data: allRows[i] });
      if (i < allRows.length - 1) {
        const curr = new Date(allRows[i].recorded_at).getTime();
        const next = new Date(allRows[i + 1].recorded_at).getTime();
        const diff = curr - next;
        if (diff > GAP_THRESHOLD_MS) {
          result.push({ type: "gap", from: allRows[i + 1].recorded_at, to: allRows[i].recorded_at, durationMin: Math.round(diff / 60000) });
        }
      }
    }
    return result;
  }, [allRows]);

  const totalPages = Math.max(1, Math.ceil(allRows.length / ROWS_PER_PAGE));

  const pageItems = useMemo((): RowOrGap[] => {
    const startRow = (page - 1) * ROWS_PER_PAGE;
    const endRow = page * ROWS_PER_PAGE;
    let rowCount = 0;
    const result: RowOrGap[] = [];
    for (const item of rowsWithGaps) {
      if (item.type === "row") {
        if (rowCount >= startRow && rowCount < endRow) result.push(item);
        rowCount++;
        if (rowCount >= endRow) break;
      } else {
        if (rowCount > startRow && rowCount <= endRow) result.push(item);
      }
    }
    return result;
  }, [rowsWithGaps, page]);

  function handleMobileExport(from: string, to: string, fmt: "csv" | "pdf") {
    const filtered = allRows.filter((r) => {
      const d = r.recorded_at.slice(0, 10);
      return d >= from && d <= to;
    });
    if (fmt === "csv") exportCSV(filtered, from, to);
    else exportPDF(filtered, from, to);
    setShowExportModal(false);
  }

  if (loading) return (
    <div className="flex items-center justify-center py-12 text-muted-foreground text-sm gap-2">
      <span className="h-2 w-2 rounded-full bg-primary animate-pulse" /> Memuat data sensor...
    </div>
  );

  if (dbError) return (
    <div className="rounded-xl border border-red-200 bg-red-50 dark:bg-red-950/30 p-4 space-y-1">
      <p className="font-semibold text-red-700 dark:text-red-400 text-sm">Gagal memuat data</p>
      <p className="font-mono text-xs text-red-600 dark:text-red-300">{dbError}</p>
    </div>
  );

  if (allRows.length === 0) return (
    <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
      Belum ada data sensor yang masuk.
    </div>
  );

  return (
    <div className="space-y-3">
      {/* Info bar */}
      <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
        <span>{allRows.length} data total</span>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" />
            Update tiap {REFRESH_MS / 1000} detik
          </span>
          {/* Mobile export button */}
          {isMobile && (
            <button type="button" onClick={() => setShowExportModal(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary hover:bg-primary/90 px-3 py-1.5 text-xs font-semibold text-primary-foreground transition">
              <Download className="h-3 w-3" /> Export
            </button>
          )}
        </div>
      </div>

      {/* Desktop export bar */}
      {!isMobile && <ExportBarDesktop allRows={allRows} />}

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="px-4 py-3 text-left font-semibold text-muted-foreground whitespace-nowrap">Tanggal</th>
              <th className="px-4 py-3 text-left font-semibold text-muted-foreground whitespace-nowrap">Waktu</th>
              <th className="px-4 py-3 text-left font-semibold text-muted-foreground whitespace-nowrap">Lokasi</th>
              <th className="px-4 py-3 text-left font-semibold text-muted-foreground whitespace-nowrap">Lantai</th>
              <th className="px-4 py-3 text-right font-semibold text-muted-foreground whitespace-nowrap">Suhu (°C)</th>
              <th className="px-4 py-3 text-right font-semibold text-muted-foreground whitespace-nowrap">Kelembapan (%)</th>
              <th className="px-4 py-3 text-center font-semibold text-muted-foreground whitespace-nowrap">Status</th>
            </tr>
          </thead>
          <tbody>
            {pageItems.map((item, idx) => {
              if (item.type === "gap") return (
                <tr key={`gap-${item.from}`}>
                  <td colSpan={7} className="px-4 py-0">
                    <div className="flex items-center gap-3 py-2">
                      <div className="flex-1 border-t-2 border-dashed border-amber-400/60" />
                      <span className="flex items-center gap-1.5 rounded-full bg-amber-100 dark:bg-amber-900/40 px-3 py-1 text-xs font-semibold text-amber-700 dark:text-amber-300 whitespace-nowrap">
                        ⚡ Jeda {formatDuration(item.durationMin * 60 * 1000)} — kemungkinan koneksi/listrik mati
                      </span>
                      <div className="flex-1 border-t-2 border-dashed border-amber-400/60" />
                    </div>
                  </td>
                </tr>
              );

              const row = item.data;
              const isHot = row.temperature > threshold;
              const isWarm = !isHot && row.temperature > threshold * 0.9;

              return (
                <tr key={row.id} className={[
                  "border-b border-border/60 transition-colors",
                  isHot ? "bg-red-50 dark:bg-red-950/40" : isWarm ? "bg-amber-50 dark:bg-amber-950/30" : idx % 2 === 0 ? "bg-background" : "bg-muted/20",
                ].join(" ")}>
                  <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap">{formatDate(row.recorded_at)}</td>
                  <td className="px-4 py-2.5 font-mono text-xs whitespace-nowrap">{formatTime(row.recorded_at)}</td>
                  <td className="px-4 py-2.5 font-medium whitespace-nowrap">{row.locationName}</td>
                  <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap">{row.floor}</td>
                  <td className={["px-4 py-2.5 text-right font-bold tabular-nums whitespace-nowrap",
                    isHot ? "text-red-600 dark:text-red-400" : isWarm ? "text-amber-600 dark:text-amber-400" : "text-foreground"].join(" ")}>
                    {row.temperature.toFixed(1)}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-sky-600 dark:text-sky-400 whitespace-nowrap">
                    {row.humidity.toFixed(1)}
                  </td>
                  <td className="px-4 py-2.5 text-center whitespace-nowrap">
                    {isHot
                      ? <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-700 dark:bg-red-900/60 dark:text-red-300">🔴 Panas</span>
                      : isWarm
                      ? <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700 dark:bg-amber-900/60 dark:text-amber-300">🟡 Hangat</span>
                      : <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300">🟢 Normal</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between px-1">
        <span className="text-xs text-muted-foreground">Halaman {page} dari {totalPages} · {ROWS_PER_PAGE} baris/halaman</span>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => setPage(1)} disabled={page === 1}
            className="rounded-lg px-2 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted disabled:opacity-40 transition">«</button>
          <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted disabled:opacity-40 transition">
            <ChevronLeft className="h-4 w-4" />
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
            .reduce<(number | "...")[]>((acc, p, i, arr) => {
              if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push("...");
              acc.push(p);
              return acc;
            }, [])
            .map((p, i) => p === "..."
              ? <span key={`e${i}`} className="px-1 text-xs text-muted-foreground">…</span>
              : <button key={p} type="button" onClick={() => setPage(p as number)}
                  className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${page === p ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>
                  {p}
                </button>
            )}
          <button type="button" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted disabled:opacity-40 transition">
            <ChevronRight className="h-4 w-4" />
          </button>
          <button type="button" onClick={() => setPage(totalPages)} disabled={page === totalPages}
            className="rounded-lg px-2 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted disabled:opacity-40 transition">»</button>
        </div>
      </div>

      {/* Mobile Export Modal */}
      {showExportModal && (
        <ExportModalMobile onClose={() => setShowExportModal(false)} onExport={handleMobileExport} />
      )}
    </div>
  );
}