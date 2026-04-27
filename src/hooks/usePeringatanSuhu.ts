import { useMemo } from "react";

export type StatusSuhu = "sejuk" | "normal" | "waspada";

export function usePeringatanSuhu(suhu: number | null) {
  return useMemo(() => {
    if (suhu === null) return { status: "normal" as StatusSuhu, message: "Menunggu data suhu." };
    if (suhu < 20) return { status: "sejuk" as StatusSuhu, message: "Suhu cenderung sejuk." };
    if (suhu <= 35) return { status: "normal" as StatusSuhu, message: "Suhu dalam rentang normal." };
    return { status: "waspada" as StatusSuhu, message: "Suhu tinggi, cek pendingin ruangan." };
  }, [suhu]);
}
