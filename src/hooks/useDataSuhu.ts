import { useAliranSuhu } from "@/hooks/useAliranSuhu";

type ParameterDataSuhu = {
  locationId: string;
  floorId: string;
};

export function useDataSuhu({ locationId, floorId }: ParameterDataSuhu) {
  const aliranSuhu = useAliranSuhu({ locationId, floorId });
  const suhuSaatIni = aliranSuhu.terbaru?.temperature ?? null;
  const kelembapanSaatIni = aliranSuhu.terbaru?.humidity ?? null;

  return {
    ...aliranSuhu,
    suhuSaatIni,
    kelembapanSaatIni,
  };
}
