import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useLokasi } from "@/hooks/useLokasi";
import { Thermometer, Droplets, AlertTriangle, CheckCircle, Flame } from "lucide-react";

type SensorLatest = {
  location_id: string;
  floor: string;
  temperature: number;
  humidity: number;
  recorded_at: string;
  locationName: string;
  locationShort: string;
};

const REFRESH_MS = 60 * 1000; // update tiap 1 jam? No — ambil data terbaru tiap 60 detik, tapi tampilkan reading terakhir
const THRESHOLD_PANAS = 35;
const THRESHOLD_WASPADA = 31.5; // 90% dari 35

function formatJam(ts: string) {
  return new Date(ts).toLocaleTimeString("id-ID", {
    hour: "2-digit", minute: "2-digit",
  });
}

function formatTanggal(ts: string) {
  return new Date(ts).toLocaleDateString("id-ID", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

function getStatus(temp: number) {
  if (temp > THRESHOLD_PANAS) return "panas";
  if (temp > THRESHOLD_WASPADA) return "waspada";
  return "aman";
}

export default function LiveSensorPanel() {
  const { lokasi } = useLokasi();
  const [sensors, setSensors] = useState<SensorLatest[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastFetch, setLastFetch] = useState<Date | null>(null);
  const timerRef = useRef<number | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);

  useEffect(() => {
    const locationMap = new Map(lokasi.map((l) => [l.id, { name: l.name, short: l.shortName }]));

    const fetchLatest = async () => {
      // Ambil 1 data terbaru per kombinasi location_id + floor
      const { data, error } = await supabase
        .from("temperature_readings")
        .select("location_id, floor, temperature, humidity, recorded_at")
        .order("recorded_at", { ascending: false })
        .limit(500);

      if (!mountedRef.current || error || !data) return;

      // Group by location+floor, ambil yang terbaru
      const latestMap = new Map<string, SensorLatest>();
      for (const r of data) {
        const key = `${r.location_id}__${r.floor}`;
        if (!latestMap.has(key)) {
          const loc = locationMap.get(String(r.location_id));
          latestMap.set(key, {
            location_id: String(r.location_id),
            floor: String(r.floor ?? "-"),
            temperature: Number(r.temperature),
            humidity: Number(r.humidity),
            recorded_at: String(r.recorded_at),
            locationName: loc?.name ?? String(r.location_id),
            locationShort: loc?.short ?? String(r.location_id),
          });
        }
      }

      setSensors(Array.from(latestMap.values()));
      setLastFetch(new Date());
      setLoading(false);
    };

    void fetchLatest();
    timerRef.current = window.setInterval(() => void fetchLatest(), REFRESH_MS);
    return () => { if (timerRef.current) window.clearInterval(timerRef.current); };
  }, [lokasi]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground text-sm gap-2">
        <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
        Memuat data sensor...
      </div>
    );
  }

  if (sensors.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
        Belum ada data sensor.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Last update info */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" />
        {lastFetch
          ? `Diperbarui pada ${formatJam(lastFetch.toISOString())} · ${sensors.length} sensor aktif`
          : "Memuat..."}
      </div>

      {/* Sensor cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {sensors.map((s) => {
          const status = getStatus(s.temperature);
          const isPanas = status === "panas";
          const isWaspada = status === "waspada";

          return (
            <div
              key={`${s.location_id}-${s.floor}`}
              className={[
                "rounded-xl border p-4 space-y-3 transition-colors",
                isPanas
                  ? "border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/40"
                  : isWaspada
                  ? "border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30"
                  : "border-border bg-card",
              ].join(" ")}
            >
              {/* Header kartu */}
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-bold text-sm leading-tight">{s.locationName}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Lantai {s.floor}</p>
                </div>
                {isPanas ? (
                  <span className="flex items-center gap-1 rounded-full bg-red-100 dark:bg-red-900/60 px-2 py-0.5 text-xs font-bold text-red-700 dark:text-red-300 shrink-0">
                    <Flame className="h-3 w-3" /> Panas
                  </span>
                ) : isWaspada ? (
                  <span className="flex items-center gap-1 rounded-full bg-amber-100 dark:bg-amber-900/60 px-2 py-0.5 text-xs font-bold text-amber-700 dark:text-amber-300 shrink-0">
                    <AlertTriangle className="h-3 w-3" /> Waspada
                  </span>
                ) : (
                  <span className="flex items-center gap-1 rounded-full bg-emerald-100 dark:bg-emerald-900/60 px-2 py-0.5 text-xs font-bold text-emerald-700 dark:text-emerald-300 shrink-0">
                    <CheckCircle className="h-3 w-3" /> Aman
                  </span>
                )}
              </div>

              {/* Angka suhu & kelembapan */}
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5">
                  <Thermometer className={`h-4 w-4 shrink-0 ${isPanas ? "text-red-500" : isWaspada ? "text-amber-500" : "text-muted-foreground"}`} />
                  <span className={`text-2xl font-bold tabular-nums ${isPanas ? "text-red-600 dark:text-red-400" : isWaspada ? "text-amber-600 dark:text-amber-400" : "text-foreground"}`}>
                    {s.temperature.toFixed(1)}°C
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Droplets className="h-4 w-4 text-sky-500 shrink-0" />
                  <span className="text-lg font-semibold tabular-nums text-sky-600 dark:text-sky-400">
                    {s.humidity.toFixed(1)}%
                  </span>
                </div>
              </div>

              {/* Keterangan teks */}
              <p className={[
                "text-xs leading-relaxed rounded-lg px-3 py-2",
                isPanas
                  ? "bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-200"
                  : isWaspada
                  ? "bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200"
                  : "bg-muted text-muted-foreground",
              ].join(" ")}>
                {isPanas
                  ? `⚠️ Pada jam ${formatJam(s.recorded_at)}, suhu ${s.temperature.toFixed(1)}°C dan kelembapan ${s.humidity.toFixed(1)}% — Lantai ${s.floor} ${s.locationName} melebihi batas aman. Segera cek pendingin ruangan!`
                  : isWaspada
                  ? `🟡 Pada jam ${formatJam(s.recorded_at)}, suhu ${s.temperature.toFixed(1)}°C dan kelembapan ${s.humidity.toFixed(1)}% — Lantai ${s.floor} ${s.locationName} mendekati batas panas. Pantau terus.`
                  : `✅ Pada jam ${formatJam(s.recorded_at)}, suhu ${s.temperature.toFixed(1)}°C dan kelembapan ${s.humidity.toFixed(1)}% — Lantai ${s.floor} ${s.locationName} dalam kondisi normal.`}
              </p>

              {/* Timestamp + link histori */}
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  {formatTanggal(s.recorded_at)} · {formatJam(s.recorded_at)}
                </p>
                <Link
                  to={`/tabel?loc=${s.location_id}&floor=${s.floor}`}
                  className="text-xs font-semibold text-primary hover:underline"
                >
                  Lihat Histori →
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}