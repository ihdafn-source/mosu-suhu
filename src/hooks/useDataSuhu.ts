import { useAliranSuhu } from "@/hooks/useAliranSuhu";

const TIMEOUT_SENSOR_MS = 30_000; // 30 detik, sesuaikan kebutuhan

type ParameterDataSuhu = {
  locationId: string;
  floorId: string;
};

function isSensorOnline(timestamp: string | undefined): boolean {
  if (!timestamp) return false;
  const selisihMs = Date.now() - new Date(timestamp).getTime();
  return selisihMs < TIMEOUT_SENSOR_MS;
}

export function useDataSuhu({ locationId, floorId }: ParameterDataSuhu) {
  const aliranSuhu = useAliranSuhu({ locationId, floorId });
  const terbaru = aliranSuhu.terbaru;

  const sensorOnline = isSensorOnline(terbaru?.timestamp);

  // Kalau sensor mati → tampilkan 0, bukan nilai terakhir
  const suhuSaatIni = sensorOnline ? (terbaru?.temperature ?? 0) : 0;
  const kelembapanSaatIni = sensorOnline ? (terbaru?.humidity ?? 0) : 0;

  return {
    ...aliranSuhu,
    suhuSaatIni,
    kelembapanSaatIni,
    sensorOnline, // ← export ini juga, bisa dipakai untuk UI (misal tampilin badge "Offline")
  };
}