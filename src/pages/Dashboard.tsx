import { useEffect, useMemo, useState } from "react";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import Sidebar from "@/components/dashboard/Sidebar";
import SummaryCards from "@/components/dashboard/SummaryCards";
import TemperatureChart from "@/components/TemperatureChart";
import TemperatureTable from "@/components/dashboard/TemperatureTable";
import LiveSensorPanel from "@/components/dashboard/LiveSensorPanel";
import GradientRamp from "@/components/dashboard/GradientRamp";
import { useLokasi } from "@/hooks/useLokasi";
import { CalendarDays, Clock3, ExternalLink, MapPin } from "lucide-react";
import { useDataSuhu } from "@/hooks/useDataSuhu";
import { useTelegramAlert } from "@/hooks/useTelegramAlert";
import { type LogSuhu } from "@/hooks/useAliranSuhu";

interface DashboardProps {
  onLogoClick: () => void;
}

type RangeKey = "1D" | "1W" | "1M" | "1Y";

const RANGE_KEYS: RangeKey[] = ["1D", "1W", "1M", "1Y"];
const MAX_CHART_POINTS = 260;
const HOURS_24 = Array.from({ length: 24 }, (_, index) => String(index).padStart(2, "0"));
const MINUTES_60 = Array.from({ length: 60 }, (_, index) => String(index).padStart(2, "0"));

type ChartPoint = {
  timestamp: string;
  label: string;
  temperature: number;
  humidity: number;
};

function toInputDateTime(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  return { date: `${year}-${month}-${day}`, time: `${hour}:${minute}` };
}

function pickWindow(logs: LogSuhu[], rangeWindowMs: number, endMs: number) {
  const startMs = endMs - rangeWindowMs;
  return logs.filter((item) => {
    const at = new Date(item.timestamp).getTime();
    return at >= startMs && at <= endMs;
  });
}

function downsample(logs: LogSuhu[]) {
  if (logs.length <= MAX_CHART_POINTS) return logs;
  const bucketSize = Math.ceil(logs.length / MAX_CHART_POINTS);
  const compact: LogSuhu[] = [];
  for (let i = 0; i < logs.length; i += bucketSize) {
    const bucket = logs.slice(i, i + bucketSize);
    if (bucket.length === 0) continue;
    const last = bucket[bucket.length - 1];
    const avgTemp = bucket.reduce((sum, row) => sum + row.temperature, 0) / bucket.length;
    const avgHum = bucket.reduce((sum, row) => sum + row.humidity, 0) / bucket.length;
    compact.push({
      ...last,
      temperature: Math.round(avgTemp * 100) / 100,
      humidity: Math.round(avgHum * 100) / 100,
    });
  }
  return compact;
}

function getWeekKey(date: Date) {
  const utcDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = utcDate.getUTCDay() || 7;
  utcDate.setUTCDate(utcDate.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(utcDate.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((utcDate.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${utcDate.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

// ── BARU: Agregasi per jam untuk mode "Per Jam" di 1D ──────────────────────
function aggregateHourly(logs: LogSuhu[], targetDate: string): ChartPoint[] {
  // Buat 24 slot jam kosong
  const slots: Record<number, { tempSum: number; humSum: number; count: number; ts: string }> = {};
  for (let h = 0; h < 24; h++) {
    slots[h] = { tempSum: 0, humSum: 0, count: 0, ts: `${targetDate}T${String(h).padStart(2, "0")}:00:00` };
  }

  for (const item of logs) {
    const d = new Date(item.timestamp);
    const dateStr = d.toISOString().slice(0, 10);
    if (dateStr !== targetDate) continue;
    const hour = d.getHours();
    slots[hour].tempSum += item.temperature;
    slots[hour].humSum += item.humidity;
    slots[hour].count += 1;
  }

  return Array.from({ length: 24 }, (_, h) => {
    const s = slots[h];
    const label = `${String(h).padStart(2, "0")}:00`;
    if (s.count === 0) {
      return { timestamp: s.ts, label, temperature: 0, humidity: 0 };
    }
    return {
      timestamp: s.ts,
      label,
      temperature: Math.round((s.tempSum / s.count) * 10) / 10,
      humidity: Math.round((s.humSum / s.count) * 10) / 10,
    };
  });
}
// ────────────────────────────────────────────────────────────────────────────

function aggregateForRange(logs: LogSuhu[], range: RangeKey): ChartPoint[] {
  if (range === "1D") {
    const compressed = downsample(logs);
    return compressed.map((item) => ({
      timestamp: item.timestamp,
      label: toChartLabel(item.timestamp),
      temperature: item.temperature,
      humidity: item.humidity,
    }));
  }

  const buckets = new Map<string, { count: number; tempSum: number; humSum: number; latestTs: string; date: Date }>();

  logs.forEach((item) => {
    const date = new Date(item.timestamp);
    let key = "";
    if (range === "1W") {
      key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    } else if (range === "1M") {
      key = getWeekKey(date);
    } else {
      key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    }
    const existing = buckets.get(key);
    if (!existing) {
      buckets.set(key, { count: 1, tempSum: item.temperature, humSum: item.humidity, latestTs: item.timestamp, date });
      return;
    }
    existing.count += 1;
    existing.tempSum += item.temperature;
    existing.humSum += item.humidity;
    if (new Date(existing.latestTs).getTime() < date.getTime()) {
      existing.latestTs = item.timestamp;
      existing.date = date;
    }
  });

  return Array.from(buckets.entries())
    .sort((a, b) => a[1].date.getTime() - b[1].date.getTime())
    .map(([key, value]) => {
      let label = key;
      if (range === "1W") {
        label = value.date.toLocaleDateString("id-ID", { weekday: "short", day: "2-digit" });
      } else if (range === "1M") {
        label = key.replace("-", " ");
      } else if (range === "1Y") {
        label = value.date.toLocaleDateString("id-ID", { month: "short", year: "2-digit" });
      }
      return {
        timestamp: value.latestTs,
        label,
        temperature: Math.round((value.tempSum / value.count) * 100) / 100,
        humidity: Math.round((value.humSum / value.count) * 100) / 100,
      };
    });
}

function toChartLabel(timestamp: string) {
  const date = new Date(timestamp);
  return date.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function toMeridiemLabel(time24: string) {
  const [hourRaw = "00", minuteRaw = "00"] = time24.split(":");
  const hour = Number(hourRaw);
  const minute = Number(minuteRaw);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return "12:00 AM";
  const period = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${String(hour12).padStart(2, "0")}:${String(minute).padStart(2, "0")} ${period}`;
}

function extractCoordinates(value: string | null) {
  if (!value) return null;
  const source = decodeURIComponent(value);
  const atMatch = source.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (atMatch) return { lat: atMatch[1], lng: atMatch[2] };
  const qMatch = source.match(/[?&](q|query)=(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (qMatch) return { lat: qMatch[2], lng: qMatch[3] };
  return null;
}

function buildGoogleMapsUrl(mapsLink: string | null, address: string | null) {
  if (mapsLink && mapsLink.trim()) return mapsLink.trim();
  if (address && address.trim()) return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address.trim())}`;
  return "https://www.google.com/maps";
}

function buildGoogleMapsEmbedUrl(mapsLink: string | null, address: string | null) {
  const coords = extractCoordinates(mapsLink);
  if (coords) return `https://www.google.com/maps?q=${coords.lat},${coords.lng}&z=16&output=embed`;
  if (address && address.trim()) return `https://www.google.com/maps?q=${encodeURIComponent(address.trim())}&z=16&output=embed`;
  if (mapsLink && mapsLink.trim()) return `https://www.google.com/maps?q=${encodeURIComponent(mapsLink.trim())}&z=16&output=embed`;
  return "https://www.google.com/maps?q=Jakarta&z=12&output=embed";
}

type ViewMode = "chart" | "table" | "live";

// ── BARU: mode tampilan grafik 1D ──────────────────────────────────────────
type ChartMode1D = "realtime" | "hourly";
// ────────────────────────────────────────────────────────────────────────────

const Dashboard = ({ onLogoClick }: DashboardProps) => {
  const { lokasi } = useLokasi();
  const [selectedLocationId, setSelectedLocationId] = useState("");
  const [selectedFloorId, setSelectedFloorId] = useState("");
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [selectedRange, setSelectedRange] = useState<RangeKey>("1D");
  const now = toInputDateTime(new Date());
  const [selectedDate, setSelectedDate] = useState(now.date);
  const [selectedTime, setSelectedTime] = useState(now.time);
  const [isRealtimeView, setIsRealtimeView] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>("chart");

  // ── BARU ──────────────────────────────────────────────────────────────────
  const [chartMode1D, setChartMode1D] = useState<ChartMode1D>("realtime");
  // ─────────────────────────────────────────────────────────────────────────

  const [selectedHour = "00", selectedMinute = "00"] = selectedTime.split(":");

  const updateHour = (hour: string) => setSelectedTime(`${hour}:${selectedMinute}`);
  const updateMinute = (minute: string) => setSelectedTime(`${selectedHour}:${minute}`);

  const selectedLocation = useMemo(
    () => lokasi.find((item) => item.id === selectedLocationId) ?? lokasi[0],
    [lokasi, selectedLocationId],
  );

  const selectedFloor = useMemo(
    () => selectedLocation?.floors.find((item) => item.id === selectedFloorId) ?? selectedLocation?.floors[0],
    [selectedFloorId, selectedLocation],
  );

  useEffect(() => {
    if (!selectedLocationId && lokasi.length > 0) {
      setSelectedLocationId(lokasi[0].id);
    }
  }, [lokasi, selectedLocationId]);

  useEffect(() => {
    if (!selectedLocation?.floors?.length) return;
    const floorExists = selectedLocation.floors.some((item) => item.id === selectedFloorId);
    if (!floorExists) setSelectedFloorId(selectedLocation.floors[0].id);
  }, [selectedFloorId, selectedLocation]);

  const mapEmbedUrl = buildGoogleMapsEmbedUrl(selectedLocation?.mapsLink ?? null, selectedLocation?.address ?? null);
  const mapOpenUrl = buildGoogleMapsUrl(selectedLocation?.mapsLink ?? null, selectedLocation?.address ?? null);

  const { dataLog: logs, sedangMemuat: loading, getJendelaRentangMs: getRangeWindowMs, suhuSaatIni, kelembapanSaatIni } = useDataSuhu({
    locationId: selectedLocation?.id ?? "default-1",
    floorId: selectedFloor?.id ?? "default-1-f-1",
  });

  useTelegramAlert(suhuSaatIni, selectedLocation?.name ?? "Tidak diketahui");

  const chartData = useMemo(() => {
    // ── BARU: kalau 1D + mode Per Jam, pakai aggregateHourly ──────────────
    if (selectedRange === "1D" && chartMode1D === "hourly") {
      return aggregateHourly(logs, selectedDate);
    }
    // ──────────────────────────────────────────────────────────────────────
    const rangeMs = getRangeWindowMs(selectedRange);
    const searchMoment = new Date(`${selectedDate}T${selectedTime}:00`).getTime();
    const endMs = isRealtimeView || Number.isNaN(searchMoment) ? Date.now() : searchMoment;
    const inWindow = pickWindow(logs, rangeMs, endMs);
    return aggregateForRange(inWindow, selectedRange);
  }, [getRangeWindowMs, isRealtimeView, logs, selectedDate, selectedRange, selectedTime, chartMode1D]);

  const setRealtimeNow = (range: RangeKey) => {
    const current = toInputDateTime(new Date());
    setSelectedRange(range);
    setSelectedDate(current.date);
    setSelectedTime(current.time);
    setIsRealtimeView(true);
    // ── BARU: reset ke realtime saat ganti range ──────────────────────────
    if (range !== "1D") setChartMode1D("realtime");
    // ──────────────────────────────────────────────────────────────────────
  };

  const handleSearchHistory = () => setIsRealtimeView(false);

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar
        locations={lokasi}
        selectedLocationId={selectedLocation?.id ?? ""}
        selectedFloorId={selectedFloor?.id ?? ""}
        onLocationChange={setSelectedLocationId}
        onFloorChange={setSelectedFloorId}
        onLogoClick={onLogoClick}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed((v) => !v)}
      />

      <main className="flex-1 overflow-y-auto">
        <DashboardHeader
          locations={lokasi}
          selectedLocationId={selectedLocation?.id ?? ""}
          selectedFloorId={selectedFloor?.id ?? ""}
          onLocationChange={setSelectedLocationId}
          onFloorChange={setSelectedFloorId}
          onLogoClick={onLogoClick}
        />

        <div className="p-4 md:p-6 space-y-6">
          <SummaryCards coreTemp={suhuSaatIni} humidity={kelembapanSaatIni} loading={loading} />

          <div className="bg-card rounded-xl border border-border p-4 md:p-5">
            {/* Tab toggle */}
            <div className="flex gap-2 mb-4 flex-wrap">
              <button
                type="button"
                onClick={() => setViewMode("chart")}
                className={`px-4 py-2 rounded-lg font-semibold text-sm transition ${viewMode === "chart" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-accent"}`}
              >
                Tren Suhu
              </button>
              <button
                type="button"
                onClick={() => setViewMode("table")}
                className={`px-4 py-2 rounded-lg font-semibold text-sm transition ${viewMode === "table" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-accent"}`}
              >
                Tabel Histori
              </button>
              <button
                type="button"
                onClick={() => setViewMode("live")}
                className={`px-4 py-2 rounded-lg font-semibold text-sm transition inline-flex items-center gap-2 ${viewMode === "live" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-accent"}`}
              >
                <span className={`h-2 w-2 rounded-full ${viewMode === "live" ? "bg-white animate-pulse" : "bg-emerald-500 animate-pulse"}`} />
                Live Semua Sensor
              </button>
            </div>

            {viewMode === "chart" && (
              <>
                <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h2 className="font-bold text-lg">Tren Suhu</h2>
                    <p className="text-xs text-muted-foreground mt-1">Pantau perubahan suhu dan kelembaban berdasarkan waktu.</p>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
                    <div className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 shadow-sm">
                      <CalendarDays className="h-4 w-4 text-muted-foreground" />
                      <input
                        type="date"
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        className="bg-transparent text-sm outline-none"
                      />
                    </div>
                    <div className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 shadow-sm">
                      <Clock3 className="h-4 w-4 text-muted-foreground" />
                      <select value={selectedHour} onChange={(e) => updateHour(e.target.value)} className="bg-transparent text-sm outline-none">
                        {HOURS_24.map((h) => <option key={h} value={h}>{h}</option>)}
                      </select>
                      <span className="text-sm text-muted-foreground">:</span>
                      <select value={selectedMinute} onChange={(e) => updateMinute(e.target.value)} className="bg-transparent text-sm outline-none">
                        {MINUTES_60.map((m) => <option key={m} value={m}>{m}</option>)}
                      </select>
                      <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
                        {toMeridiemLabel(selectedTime)}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={handleSearchHistory}
                      className="rounded-xl border border-border px-3 py-2 text-sm font-semibold text-foreground hover:bg-accent shadow-sm"
                    >
                      Cari Histori
                    </button>
                  </div>
                </div>

                <div className="mb-3 flex flex-wrap items-center gap-2">
                  {/* Badge mode */}
                  <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                    selectedRange === "1D" && chartMode1D === "hourly"
                      ? "bg-sky-100 text-sky-700"
                      : isRealtimeView
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-amber-100 text-amber-700"
                  }`}>
                    {selectedRange === "1D" && chartMode1D === "hourly"
                      ? "Rata-rata Per Jam"
                      : isRealtimeView
                      ? "Mode Realtime"
                      : "Mode Histori"}
                  </span>
                  <span className="inline-flex items-center rounded-full bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground">
                    {selectedLocation?.shortName ?? "Lokasi"} – {selectedFloor?.name ?? "Lantai"}
                  </span>

                  {/* ── BARU: Toggle Realtime / Per Jam, hanya muncul di 1D ── */}
                  {selectedRange === "1D" && (
                    <div className="ml-auto flex items-center rounded-lg border border-border bg-muted p-0.5 gap-0.5">
                      <button
                        type="button"
                        onClick={() => { setChartMode1D("realtime"); setIsRealtimeView(true); }}
                        className={`rounded-md px-3 py-1 text-xs font-semibold transition ${
                          chartMode1D === "realtime"
                            ? "bg-background text-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        Realtime
                      </button>
                      <button
                        type="button"
                        onClick={() => setChartMode1D("hourly")}
                        className={`rounded-md px-3 py-1 text-xs font-semibold transition ${
                          chartMode1D === "hourly"
                            ? "bg-background text-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        Per Jam
                      </button>
                    </div>
                  )}
                  {/* ──────────────────────────────────────────────────────── */}
                </div>

                <TemperatureChart data={chartData} isHourlyMode={selectedRange === "1D" && chartMode1D === "hourly"} />

                <div className="mt-4 grid grid-cols-4 gap-2">
                  {RANGE_KEYS.map((range) => (
                    <button
                      key={range}
                      type="button"
                      onClick={() => setRealtimeNow(range)}
                      className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${selectedRange === range ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-accent"}`}
                    >
                      {range}
                    </button>
                  ))}
                </div>
              </>
            )}

            {viewMode === "table" && (
              <div>
                <div className="mb-4">
                  <h2 className="font-bold text-lg">Tabel Histori Suhu</h2>
                  <p className="text-xs text-muted-foreground mt-1">
                    Data terbaru – {selectedLocation?.shortName ?? "Lokasi"} · {selectedFloor?.name ?? "Lantai"}
                  </p>
                </div>
                <TemperatureTable
                  locationId={selectedLocation?.id ?? "default-1"}
                  floorId={selectedFloor?.id ?? "default-1-f-1"}
                />
              </div>
            )}

            {viewMode === "live" && (
              <div>
                <div className="mb-4">
                  <h2 className="font-bold text-lg flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse inline-block" />
                    Live Semua Sensor
                  </h2>
                  <p className="text-xs text-muted-foreground mt-1">
                    Status terkini tiap lantai – aman, waspada, atau panas
                  </p>
                </div>
                <LiveSensorPanel />
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <div className="rounded-xl border border-border bg-card p-5 xl:col-span-2">
              <h3 className="font-bold text-xl">Gradient Ramp</h3>
              <p className="mt-1 text-sm text-muted-foreground">Panduan visual level suhu untuk bantu baca kondisi ruangan.</p>
              <div className="mt-4">
                <GradientRamp />
              </div>
              <div className="mt-3 flex items-center justify-between text-sm text-muted-foreground">
                <span>18°C – Sejuk</span>
                <span>25°C – Normal</span>
                <span>27°C+ – Waspada</span>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-center gap-2 text-foreground">
                <MapPin className="h-5 w-5" />
                <h3 className="font-bold text-xl">Lokasi</h3>
              </div>
              <p className="mt-5 text-3xl font-semibold text-foreground leading-tight">{selectedLocation?.name ?? "-"}</p>
              <p className="mt-3 text-sm text-muted-foreground">{selectedLocation?.address ?? "Alamat belum diisi admin."}</p>
              <div className="mt-4 h-[220px] overflow-hidden rounded-xl border border-border/70 bg-background">
                <iframe
                  title="Google Maps Lokasi"
                  src={mapEmbedUrl}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  className="h-full w-full border-0"
                />
              </div>
              <a
                href={mapOpenUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-sky-700"
              >
                <MapPin className="h-4 w-4" /> Buka di Google Maps <ExternalLink className="h-4 w-4" />
              </a>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;