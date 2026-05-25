import { useMemo } from "react";

export type StatusSuhu = "sejuk" | "normal" | "waspada" | "panas";

/**
 * Tentukan status suhu berdasarkan threshold yang bisa dikonfigurasi.
 * @param suhu - suhu saat ini (°C)
 * @param threshold - batas suhu "panas" dari config Telegram (default 35)
 */
export function usePeringatanSuhu(suhu: number | null, threshold = 27) {
  return useMemo(() => {
    if (suhu === null) return { status: "normal" as StatusSuhu, message: "Menunggu data suhu." };
    if (suhu < 20) return { status: "sejuk" as StatusSuhu, message: "Suhu cenderung sejuk." };
    if (suhu <= 25) return { status: "normal" as StatusSuhu, message: "Suhu dalam rentang normal." };
    if (suhu <= 27) return { status: "waspada" as StatusSuhu, message: `Suhu mendekati batas (${threshold}°C), waspada!` };
    return { status: "panas" as StatusSuhu, message: `Suhu melebihi batas ${threshold}°C! Cek pendingin ruangan.` };
  }, [suhu, threshold]);
}