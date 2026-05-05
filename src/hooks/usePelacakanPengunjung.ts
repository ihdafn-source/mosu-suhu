import { useEffect } from "react";
import { supabase } from "../integrations/supabase/client";

const KUNCI_SESI_PENGUNJUNG = "mosu_pengunjung_tercatat_v1";

function deteksiPeramban(userAgent: string): string {
  if (/edg/i.test(userAgent)) return "Edge";
  if (/opr|opera/i.test(userAgent)) return "Opera";
  if (/chrome|crios/i.test(userAgent)) return "Chrome";
  if (/firefox|fxios/i.test(userAgent)) return "Firefox";
  if (/safari/i.test(userAgent)) return "Safari";
  return "Unknown";
}

function deteksiPerangkat (userAgent: string): string {
  if (/tablet|ipad/i.test(userAgent)) return "Tablet";
  if (/mobi|android|iphone/i.test(userAgent)) return "Mobile";
  return "Desktop";
}

export function usePelacakanPengunjung() {
  useEffect(() => {
    const sudahTercatat = sessionStorage.getItem(KUNCI_SESI_PENGUNJUNG) === "1";
    if (sudahTercatat) return;

    const kirimDataPengunjung = async () => {
      const userAgent = navigator.userAgent;
      let ipAddress: string | null = null;

      try {
        const response = await fetch("https://api.ipify.org?format=json");
        if (response.ok) {
          const payload = await response.json() as { ip?: string };
          ipAddress = payload.ip ?? null;
        }
      } catch {
        ipAddress = null;
      }

      const dataPengunjung = {
        ip_address: ipAddress,
        device: deteksiPerangkat(userAgent),
        browser: deteksiPeramban(userAgent),
        // visited_at tidak perlu dikirim, sudah default di DB
      };

      console.log("Insert visitor_logs:", dataPengunjung);

      const { error } = await supabase
        .from("visitor_logs")
        .insert([dataPengunjung]);

      if (error) {
        console.error("Gagal insert visitor_logs:", error);
      } else {
        sessionStorage.setItem(KUNCI_SESI_PENGUNJUNG, "1");
      }
    };
    void kirimDataPengunjung();
  }, []);
}