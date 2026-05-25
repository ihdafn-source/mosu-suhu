import { useEffect, useRef, useState, useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowLeft, TableProperties, ChevronLeft, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useLokasi } from "@/hooks/useLokasi";

type RawRow = {
  id: string; location_id: string; floor: string;
  temperature: number; humidity: number; recorded_at: string;
};
type HourlyRow = {
  key: string; date: string; hour: number; hourLabel: string;
  locationId: string; locationName: string; floor: string;
  avgTemp: number; avgHumidity: number; maxTemp: number;
  count: number; firstTs: string; lastTs: string;
};
type RowOrGap = { type: "row"; data: HourlyRow } | { type: "gap"; duration: string };

const GAP_HOUR_MS = 60 * 60 * 1000;
const ROWS_PER_PAGE = 40;
const THRESHOLD_PANAS = 27;
const THRESHOLD_WASPADA = 25; // 90% dari 25

function fmtDate(ts: string) {
  return new Date(ts).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
}
function fmtDuration(ms: number) {
  const m = Math.round(ms / 60000);
  return m < 60 ? `${m} menit` : `${Math.floor(m / 60)} jam ${m % 60} menit`;
}
function statusOf(temp: number) {
  if (temp > THRESHOLD_PANAS) return "panas";
  if (temp > THRESHOLD_WASPADA) return "waspada";
  return "aman";
}

export default function TabelPage() {
  const { lokasi } = useLokasi();
  const [searchParams] = useSearchParams();
  const [rawRows, setRawRows] = useState<RawRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const mountedRef = useRef(true);
  const timerRef = useRef<number | null>(null);

  const [filterDate, setFilterDate] = useState(searchParams.get("date") ?? "");
  const [filterLoc, setFilterLoc] = useState(searchParams.get("loc") ?? "");
  const [filterFloor, setFilterFloor] = useState(searchParams.get("floor") ?? "");

  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);

  useEffect(() => {
    const doFetch = async () => {
      let q = supabase
        .from("temperature_readings")
        .select("id, location_id, floor, temperature, humidity, recorded_at")
        .order("recorded_at", { ascending: false })
        .limit(5000);
      if (filterLoc) q = q.eq("location_id", filterLoc);
      const { data, error } = await q;
      if (!mountedRef.current || error || !data) return;
      setRawRows(data.map((r: any) => ({
        id: String(r.id), location_id: String(r.location_id),
        floor: String(r.floor ?? "-"), temperature: Number(r.temperature),
        humidity: Number(r.humidity), recorded_at: String(r.recorded_at),
      })));
      setLoading(false);
    };
    void doFetch();
    timerRef.current = window.setInterval(() => void doFetch(), 60_000);
    return () => { if (timerRef.current) window.clearInterval(timerRef.current); };
  }, [filterLoc]);

  useEffect(() => { setPage(1); }, [filterDate, filterLoc, filterFloor]);

  const locationMap = useMemo(() => new Map(lokasi.map((l) => [l.id, l.name])), [lokasi]);

  const floorOptions = useMemo(() => {
    const set = new Set(rawRows.map((r) => r.floor));
    return Array.from(set).sort();
  }, [rawRows]);

  const hourlyRows = useMemo((): HourlyRow[] => {
    const buckets = new Map<string, { temps: number[]; hums: number[]; firstTs: string; lastTs: string; locationId: string; floor: string; date: string; hour: number; }>();
    for (const r of rawRows) {
      const d = new Date(r.recorded_at);
      const date = d.toISOString().slice(0, 10);
      const hour = d.getHours();
      if (filterDate && date !== filterDate) continue;
      if (filterFloor && r.floor !== filterFloor) continue;
      const key = `${date}__${String(hour).padStart(2,"0")}__${r.location_id}__${r.floor}`;
      const ex = buckets.get(key);
      if (!ex) {
        buckets.set(key, { temps: [r.temperature], hums: [r.humidity], firstTs: r.recorded_at, lastTs: r.recorded_at, locationId: r.location_id, floor: r.floor, date, hour });
      } else {
        ex.temps.push(r.temperature); ex.hums.push(r.humidity);
        if (r.recorded_at < ex.firstTs) ex.firstTs = r.recorded_at;
        if (r.recorded_at > ex.lastTs) ex.lastTs = r.recorded_at;
      }
    }
    return Array.from(buckets.entries()).map(([key, v]) => ({
      key, date: v.date, hour: v.hour,
      hourLabel: `${String(v.hour).padStart(2,"0")}:00–${String(v.hour+1).padStart(2,"0")}:00`,
      locationId: v.locationId, locationName: locationMap.get(v.locationId) ?? v.locationId,
      floor: v.floor,
      avgTemp: Math.round(v.temps.reduce((a,b)=>a+b,0)/v.temps.length*10)/10,
      avgHumidity: Math.round(v.hums.reduce((a,b)=>a+b,0)/v.hums.length*10)/10,
      maxTemp: Math.max(...v.temps), count: v.temps.length,
      firstTs: v.firstTs, lastTs: v.lastTs,
    })).sort((a,b) => b.date.localeCompare(a.date) || b.hour - a.hour || a.locationId.localeCompare(b.locationId));
  }, [rawRows, filterDate, filterFloor, locationMap]);

  const rowsWithGaps = useMemo((): RowOrGap[] => {
    const result: RowOrGap[] = [];
    for (let i = 0; i < hourlyRows.length; i++) {
      result.push({ type: "row", data: hourlyRows[i] });
      if (i < hourlyRows.length - 1) {
        const curr = new Date(hourlyRows[i].firstTs).getTime();
        const next = new Date(hourlyRows[i+1].lastTs).getTime();
        const diff = curr - next;
        if (diff > GAP_HOUR_MS * 2) {
          result.push({ type: "gap", duration: fmtDuration(diff) });
        }
      }
    }
    return result;
  }, [hourlyRows]);

  const totalPages = Math.max(1, Math.ceil(hourlyRows.length / ROWS_PER_PAGE));

  const pageItems = useMemo((): RowOrGap[] => {
    const start = (page-1)*ROWS_PER_PAGE, end = page*ROWS_PER_PAGE;
    let rowCount = 0;
    const result: RowOrGap[] = [];
    for (const item of rowsWithGaps) {
      if (item.type === "row") {
        if (rowCount >= start && rowCount < end) result.push(item);
        rowCount++;
        if (rowCount >= end) break;
      } else {
        if (rowCount > start && rowCount <= end) result.push(item);
      }
    }
    return result;
  }, [rowsWithGaps, page]);

  const dateOptions = useMemo(() => {
    const set = new Set(hourlyRows.map((r) => r.date));
    return Array.from(set).sort().reverse();
  }, [hourlyRows]);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b border-border bg-background/90 backdrop-blur px-4 py-3 flex items-center gap-3 flex-wrap">
        <Link to="/" className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-semibold text-muted-foreground hover:bg-muted transition">
          <ArrowLeft className="h-4 w-4" /> Kembali
        </Link>
        <div className="flex items-center gap-2">
          <TableProperties className="h-5 w-5 text-primary" />
          <h1 className="font-bold text-lg">Histori Suhu</h1>
        </div>
        <span className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          {hourlyRows.length} data per jam
        </span>
      </header>

      <div className="p-4 md:p-6 space-y-4 max-w-6xl mx-auto">
        <div className="flex flex-wrap gap-2 items-center">
          <select value={filterDate} onChange={(e)=>setFilterDate(e.target.value)} className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm outline-none">
            <option value="">Semua Tanggal</option>
            {dateOptions.map((d)=>(<option key={d} value={d}>{fmtDate(d+"T00:00:00")}</option>))}
          </select>
          <select value={filterLoc} onChange={(e)=>setFilterLoc(e.target.value)} className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm outline-none">
            <option value="">Semua Gedung</option>
            {lokasi.map((l)=>(<option key={l.id} value={l.id}>{l.name}</option>))}
          </select>
          <select value={filterFloor} onChange={(e)=>setFilterFloor(e.target.value)} className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm outline-none">
            <option value="">Semua Lantai</option>
            {floorOptions.map((f)=>(<option key={f} value={f}>Lantai {f}</option>))}
          </select>
          {(filterDate||filterLoc||filterFloor) && (
            <button type="button" onClick={()=>{setFilterDate("");setFilterLoc("");setFilterFloor("");}}
              className="rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted transition">
              Reset Filter
            </button>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground text-sm gap-2">
            <span className="h-2 w-2 rounded-full bg-primary animate-pulse" /> Memuat data...
          </div>
        ) : hourlyRows.length === 0 ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground text-sm">Tidak ada data untuk filter ini.</div>
        ) : (
          <>
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    {["Tanggal","Jam","Gedung","Lantai","Rata Suhu","Maks Suhu","Kelembapan","Status","Data"].map((h)=>(
                      <th key={h} className="px-4 py-3 text-left font-semibold text-muted-foreground whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map((item, idx) => {
                    if (item.type === "gap") return (
                      <tr key={`gap-${idx}`}>
                        <td colSpan={9} className="px-4 py-0">
                          <div className="flex items-center gap-3 py-2">
                            <div className="flex-1 border-t-2 border-dashed border-amber-400/60" />
                            <span className="rounded-full bg-amber-100 dark:bg-amber-900/40 px-3 py-1 text-xs font-semibold text-amber-700 dark:text-amber-300 whitespace-nowrap">
                              ⚡ Jeda {item.duration} — koneksi/listrik mati
                            </span>
                            <div className="flex-1 border-t-2 border-dashed border-amber-400/60" />
                          </div>
                        </td>
                      </tr>
                    );
                    const r = item.data;
                    const status = statusOf(r.maxTemp);
                    const isPanas = status === "panas";
                    const isWaspada = status === "waspada";
                    return (
                      <tr key={r.key} className={["border-b border-border/60",isPanas?"bg-red-50 dark:bg-red-950/40":isWaspada?"bg-amber-50 dark:bg-amber-950/30":idx%2===0?"bg-background":"bg-muted/20"].join(" ")}>
                        <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap">{fmtDate(r.firstTs)}</td>
                        <td className="px-4 py-2.5 font-mono text-xs whitespace-nowrap">{r.hourLabel}</td>
                        <td className="px-4 py-2.5 font-medium whitespace-nowrap">{r.locationName}</td>
                        <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap">Lantai {r.floor}</td>
                        <td className="px-4 py-2.5 text-right font-semibold tabular-nums whitespace-nowrap">{r.avgTemp.toFixed(1)}°C</td>
                        <td className={["px-4 py-2.5 text-right font-bold tabular-nums whitespace-nowrap",isPanas?"text-red-600 dark:text-red-400":isWaspada?"text-amber-600 dark:text-amber-400":"text-foreground"].join(" ")}>{r.maxTemp.toFixed(1)}°C</td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-sky-600 dark:text-sky-400 whitespace-nowrap">{r.avgHumidity.toFixed(1)}%</td>
                        <td className="px-4 py-2.5 text-center whitespace-nowrap">
                          {isPanas?<span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-700 dark:bg-red-900/60 dark:text-red-300">🔴 Panas</span>
                          :isWaspada?<span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700 dark:bg-amber-900/60 dark:text-amber-300">🟡 Waspada</span>
                          :<span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300">🟢 Aman</span>}
                        </td>
                        <td className="px-4 py-2.5 text-center text-xs text-muted-foreground tabular-nums">{r.count}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between px-1">
              <span className="text-xs text-muted-foreground">Halaman {page} dari {totalPages} · {hourlyRows.length} baris</span>
              <div className="flex items-center gap-1">
                <button type="button" onClick={()=>setPage(1)} disabled={page===1} className="rounded-lg px-2 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted disabled:opacity-40">«</button>
                <button type="button" onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={page===1} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted disabled:opacity-40"><ChevronLeft className="h-4 w-4" /></button>
                {Array.from({length:totalPages},(_,i)=>i+1).filter(p=>p===1||p===totalPages||Math.abs(p-page)<=2)
                  .reduce<(number|"...")[]>((acc,p,i,arr)=>{if(i>0&&p-(arr[i-1] as number)>1)acc.push("...");acc.push(p);return acc;},[])
                  .map((p,i)=>p==="..."?<span key={`e${i}`} className="px-1 text-xs text-muted-foreground">…</span>
                  :<button key={p} type="button" onClick={()=>setPage(p as number)} className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${page===p?"bg-primary text-primary-foreground":"text-muted-foreground hover:bg-muted"}`}>{p}</button>)}
                <button type="button" onClick={()=>setPage(p=>Math.min(totalPages,p+1))} disabled={page===totalPages} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button>
                <button type="button" onClick={()=>setPage(totalPages)} disabled={page===totalPages} className="rounded-lg px-2 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted disabled:opacity-40">»</button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}