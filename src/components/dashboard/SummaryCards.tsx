import { Thermometer, Droplets } from "lucide-react";

interface Props {
  coreTemp: number | null;
  humidity: number | null;
  loading: boolean;
}

const SummaryCards = ({ coreTemp, humidity, loading }: Props) => {
  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="bg-card rounded-xl border border-border p-4">
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Thermometer className="w-4 h-4" />
          Suhu
        </div>
        <p className="text-3xl font-bold mt-2">
          {loading ? "..." : coreTemp !== null ? `${coreTemp}°C` : "-"}
        </p>
      </div>

      <div className="bg-card rounded-xl border border-border p-4">
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Droplets className="w-4 h-4" />
          Kelembaban
        </div>
        <p className="text-3xl font-bold mt-2">
          {loading ? "..." : humidity !== null ? `${humidity}%` : "-"}
        </p>
      </div>
    </div>
  );
};

export default SummaryCards;
