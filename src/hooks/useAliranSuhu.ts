import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../integrations/supabase/client";

export type LogSuhu = {
  id: string;
  timestamp: string;
  recorded_at?: string; 
  temperature: number;
  humidity: number;
  location_id: string;
  floor_id: string;
};

type BarisSuhu = {
  id?: string | number;
  timestamp?: string;
  recorded_at?: string;  
  created_at?: string;
  temperature?: number | string;
  humidity?: number | string;
  location_id?: string | number;
  floor_id?: string | number;
  floor?: string;
};

type KunciRentang = "1D" | "1W" | "1M" | "1Y";

type ArgumenAliranSuhu = {
  locationId: string;
  floorId: string;
};

type HasilAliranSuhu = {
  dataLog: LogSuhu[];
  terbaru: LogSuhu | null;
  sedangMemuat: boolean;
  getJendelaRentangMs: (range: KunciRentang) => number;
};

const RENTANG_WAKTU_MS: Record<KunciRentang, number> = {
  "1D": 24 * 60 * 60 * 1000,
  "1W": 7 * 24 * 60 * 60 * 1000,
  "1M": 30 * 24 * 60 * 60 * 1000,
  "1Y": 365 * 24 * 60 * 60 * 1000,
};

const REFRESH_INTERVAL_MS = 5000;

function mapRow(row: BarisSuhu, fallbackLocationId: string, fallbackFloorId: string): LogSuhu | null {
  const id = String(row.id ?? "").trim();
  const timestamp = String(row.recorded_at ?? row.timestamp ?? row.created_at ?? "").trim();
  const temperature = Number(row.temperature ?? Number.NaN);
  const humidity = Number(row.humidity ?? Number.NaN);
  const location_id = String(row.location_id ?? fallbackLocationId).trim();
  // Use 'floor' instead of 'floor_id' as per new schema
  const floor_id = String((row.floor ?? row.floor_id ?? fallbackFloorId)).trim();

  if (!id || !timestamp || !location_id || !floor_id || !Number.isFinite(temperature) || !Number.isFinite(humidity)) {
    return null;
  }

  return {
    id,
    timestamp,
    temperature,
    humidity,
    location_id,
    floor_id,
  };
}

function mapRows(rows: BarisSuhu[], fallbackLocationId: string, fallbackFloorId: string): LogSuhu[] {
  return rows
    .map((row) => mapRow(row, fallbackLocationId, fallbackFloorId))
    .filter((item): item is LogSuhu => item !== null)
    .sort((left, right) => new Date(left.timestamp).getTime() - new Date(right.timestamp).getTime());
}

export function useAliranSuhu({ locationId, floorId }: ArgumenAliranSuhu): HasilAliranSuhu {
  const [dataLog, setDataLog] = useState<LogSuhu[]>([]);
  const [sedangMemuat, setSedangMemuat] = useState(true);
  const isFetchingRef = useRef(false);

  useEffect(() => {
    let mounted = true;
    const isPlaceholderSelection = locationId.startsWith("default-") || floorId.startsWith("default-");

    if (isPlaceholderSelection) {
      setDataLog([]);
      setSedangMemuat(false);

      return () => {
        mounted = false;
      };
    }

    const loadLogs = async (showLoadingState: boolean) => {
      if (isFetchingRef.current) return;

      isFetchingRef.current = true;

      if (showLoadingState) {
        setSedangMemuat(true);
      }

      try {
        const { data, error } = await supabase
          .from("temperature_readings")
          .select("*")
          .eq("location_id", locationId)
          .eq("floor", floorId)
          .order("recorded_at", { ascending: true });

        if (!mounted) return;

        if (error) {
          if (showLoadingState) {
            setDataLog([]);
          }

          return;
        }

        setDataLog(mapRows((data ?? []) as BarisSuhu[], locationId, floorId));
      } finally {
        if (mounted && showLoadingState) {
          setSedangMemuat(false);
        }

        isFetchingRef.current = false;
      }
    };

    void loadLogs(true);

    const timer = window.setInterval(() => {
      void loadLogs(false);
    }, REFRESH_INTERVAL_MS);

    return () => {
      mounted = false;
      window.clearInterval(timer);
      isFetchingRef.current = false;
    };
  }, [locationId, floorId]);

  const terbaru = useMemo(() => {
    if (dataLog.length === 0) return null;
    return dataLog[dataLog.length - 1];
  }, [dataLog]);

  return {
    dataLog,
    terbaru,
    sedangMemuat,
    getJendelaRentangMs: (range) => RENTANG_WAKTU_MS[range],
  };
}
