import { useEffect, useRef, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLokasi } from "@/hooks/useLokasi";
import { ChevronLeft, ChevronRight } from "lucide-react";

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
const GAP_THRESHOLD_MS = 2 * 60 * 1000; // 2 menit
const ROWS_PER_PAGE = 50;

function formatTime(ts: string) {
  return new Date(ts).toLocaleTimeString("id-ID", {
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
}

function formatDate(ts: string) {
  return new Date(ts).toLocaleDateString("id-ID", {
    day: "2-digit", month: "short", year: "numeric",
  });
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
  const [allRows, setAllRows] = useState<DisplayRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dbError, setDbError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const timerRef = useRef<number | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);

  // Reset ke page 1 kalau filter berubah
  useEffect(() => { setPage(1); }, [locationId, floorId]);

  useEffect(() => {
    const locationMap = new Map(lokasi.map((l) => [l.id, l.name]));

    const fetchRows = async () => {
      let query = supabase
        .from("temperature_readings")
        .select("id, location_id, floor, temperature, humidity, recorded_at")
        .order("recorded_at", { ascending: false })
        .limit(2000); // Ambil banyak untuk pagination client-side

      if (locationId && !locationId.startsWith("default-")) {
        query = query.eq("location_id", locationId);
      }

      const { data, error } = await query;
      if (!mountedRef.current) return;

      if (error) {
        setDbError(`[${error.code}] ${error.message}`);
        setLoading(false);
        return;
      }

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

  // Inject gap markers antar semua rows (sorted desc = terbaru di atas)
  const rowsWithGaps = useMemo((): RowOrGap[] => {
    const result: RowOrGap[] = [];
    for (let i = 0; i < allRows.length; i++) {
      result.push({ type: "row", data: allRows[i] });
      if (i < allRows.length - 1) {
        const curr = new Date(allRows[i].recorded_at).getTime();
        const next = new Date(allRows[i + 1].recorded_at).getTime();
        const diff = curr - next; // desc order, curr > next
        if (diff > GAP_THRESHOLD_MS) {
          result.push({
            type: "gap",
            from: allRows[i + 1].recorded_at,
            to: allRows[i].recorded_at,
            durationMin: Math.round(diff / 60000),
          });
        }
      }
    }
    return result;
  }, [allRows]);

  // Pagination — hitung total halaman berdasarkan jumlah ROW (bukan gap)
  const totalPages = Math.max(1, Math.ceil(allRows.length / ROWS_PER_PAGE));

  // Ambil slice untuk halaman ini — hitung berdasarkan row count
  const pageItems = useMemo((): RowOrGap[] => {
    const startRow = (page - 1) * ROWS_PER_PAGE;
    const endRow = page * ROWS_PER_PAGE;
    let rowCount = 0;
    const result: RowOrGap[] = [];

    for (const item of rowsWithGaps) {
      if (item.type === "row") {
        if (rowCount >= startRow && rowCount < endRow) {
          result.push(item);
        }
        rowCount++;
        if (rowCount >= endRow) {
          // Cek apakah item berikutnya adalah gap — kalau iya ikutkan
          break;
        }
      } else {
        // Gap: ikutkan kalau row sebelumnya sudah dalam range
        if (rowCount > startRow && rowCount <= endRow) {
          result.push(item);
        }
      }
    }
    return result;
  }, [rowsWithGaps, page]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground text-sm gap-2">
        <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
        Memuat data sensor...
      </div>
    );
  }

  if (dbError) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 dark:bg-red-950/30 p-4 space-y-1">
        <p className="font-semibold text-red-700 dark:text-red-400 text-sm">Gagal memuat data</p>
        <p className="font-mono text-xs text-red-600 dark:text-red-300">{dbError}</p>
      </div>
    );
  }

  if (allRows.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
        Belum ada data sensor yang masuk.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Info bar */}
      <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
        <span>{allRows.length} data total</span>
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" />
          Update tiap {REFRESH_MS / 1000} detik
        </span>
      </div>

      {/* Tabel */}
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
              // ── Gap row ──────────────────────────────────────────────────
              if (item.type === "gap") {
                return (
                  <tr key={`gap-${item.from}`}>
                    <td colSpan={7} className="px-4 py-0">
                      <div className="flex items-center gap-3 py-2">
                        <div className="flex-1 border-t-2 border-dashed border-amber-400/60" />
                        <span className="flex items-center gap-1.5 rounded-full bg-amber-100 dark:bg-amber-900/40 px-3 py-1 text-xs font-semibold text-amber-700 dark:text-amber-300 whitespace-nowrap">
                          ⚡ Jeda {formatDuration((item.durationMin) * 60 * 1000)} — kemungkinan koneksi/listrik mati
                        </span>
                        <div className="flex-1 border-t-2 border-dashed border-amber-400/60" />
                      </div>
                    </td>
                  </tr>
                );
              }

              // ── Data row ─────────────────────────────────────────────────
              const row = item.data;
              const isHot = row.temperature > threshold;
              const isWarm = !isHot && row.temperature > threshold * 0.9;

              return (
                <tr
                  key={row.id}
                  className={[
                    "border-b border-border/60 transition-colors",
                    isHot ? "bg-red-50 dark:bg-red-950/40"
                      : isWarm ? "bg-amber-50 dark:bg-amber-950/30"
                      : idx % 2 === 0 ? "bg-background" : "bg-muted/20",
                  ].join(" ")}
                >
                  <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap">{formatDate(row.recorded_at)}</td>
                  <td className="px-4 py-2.5 font-mono text-xs whitespace-nowrap">{formatTime(row.recorded_at)}</td>
                  <td className="px-4 py-2.5 font-medium whitespace-nowrap">{row.locationName}</td>
                  <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap">{row.floor}</td>
                  <td className={[
                    "px-4 py-2.5 text-right font-bold tabular-nums whitespace-nowrap",
                    isHot ? "text-red-600 dark:text-red-400"
                      : isWarm ? "text-amber-600 dark:text-amber-400"
                      : "text-foreground",
                  ].join(" ")}>
                    {row.temperature.toFixed(1)}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-sky-600 dark:text-sky-400 whitespace-nowrap">
                    {row.humidity.toFixed(1)}
                  </td>
                  <td className="px-4 py-2.5 text-center whitespace-nowrap">
                    {isHot ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-700 dark:bg-red-900/60 dark:text-red-300">
                        🔴 Panas
                      </span>
                    ) : isWarm ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700 dark:bg-amber-900/60 dark:text-amber-300">
                        🟡 Hangat
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300">
                        🟢 Normal
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between px-1">
        <span className="text-xs text-muted-foreground">
          Halaman {page} dari {totalPages} · {ROWS_PER_PAGE} baris/halaman
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setPage(1)}
            disabled={page === 1}
            className="rounded-lg px-2 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted disabled:opacity-40 transition"
          >
            «
          </button>
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted disabled:opacity-40 transition"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          {/* Nomor halaman — tampilkan max 5 */}
          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
            .reduce<(number | "...")[]>((acc, p, i, arr) => {
              if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push("...");
              acc.push(p);
              return acc;
            }, [])
            .map((p, i) =>
              p === "..." ? (
                <span key={`ellipsis-${i}`} className="px-1 text-xs text-muted-foreground">…</span>
              ) : (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPage(p as number)}
                  className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
                    page === p
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {p}
                </button>
              )
            )}

          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted disabled:opacity-40 transition"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setPage(totalPages)}
            disabled={page === totalPages}
            className="rounded-lg px-2 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted disabled:opacity-40 transition"
          >
            »
          </button>
        </div>
      </div>
    </div>
  );
}
