import { useEffect, useMemo, useState } from "react";
import { supabase } from "../integrations/supabase/client";

export interface Lokasi {
  id: string;
  name: string;
  shortName: string;
  floors: { id: string; name: string }[];
  address: string | null;
  mapsLink: string | null;
}

type BarisLokasiServer = {
  id?: string;
  name?: string;
  floors?: unknown;
  address?: string | null;
  maps_link?: string | null;
  deleted_at?: string | null;
};

function buatNamaPendek(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 2) return name;
  return `${parts[0]} ${parts[1]}`;
}

export function useLokasi() {
  const [lokasi, setLokasi] = useState<Lokasi[]>([]);
  const [sedangMemuat, setSedangMemuat] = useState(true);

  useEffect(() => {
    let mounted = true;

    const ambilLokasi = async () => {
      try {
        setSedangMemuat(true);
        const { data } = await supabase
          .from("server_locations")
          .select("*")
          .order("created_at", { ascending: true });

        if (!mounted) return;

        const rows: BarisLokasiServer[] = data ?? [];
        const hasil = rows
          .filter((row) => !row.deleted_at)
          .map((row) => {
            const name = String(row.name ?? "Lokasi");
            const floorsRaw = Array.isArray(row.floors) ? row.floors : [];
            const floors = floorsRaw.map((floor) => ({
              id: String(floor),
              name: String(floor),
            }));

            return {
              id: String(row.id ?? ""),
              name,
              shortName: buatNamaPendek(name),
              floors: floors.length > 0 ? floors : [{ id: "Lantai 1", name: "Lantai 1" }],
              address: row.address ? String(row.address) : null,
              mapsLink: row.maps_link ? String(row.maps_link) : null,
            };
          })
          .filter((item) => item.id);

        setLokasi(hasil);
      } finally {
        if (mounted) {
          setSedangMemuat(false);
        }
      }
    };

    void ambilLokasi();

    return () => {
      mounted = false;
    };
  }, []);

  const fallbackLokasi = useMemo<Lokasi[]>(
    () => [
      {
        id: "default-1",
        name: "Dana Reksa",
        shortName: "Dana Reksa",
        floors: [
          { id: "Lantai 5", name: "Lantai 5" },
          { id: "Lantai 15", name: "Lantai 15" },
        ],
        address: "Jl. Medan Merdeka Barat, Jakarta",
        mapsLink: "https://www.google.com/maps?q=Jl.+Medan+Merdeka+Barat,+Jakarta",
      },
    ],
    [],
  );

  return {
    lokasi: lokasi.length > 0 ? lokasi : fallbackLokasi,
    sedangMemuat,
  };
}