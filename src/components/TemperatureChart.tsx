import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface Props {
  data: { timestamp: string; temperature: number; humidity: number; label: string }[];
}

const TemperatureChart = ({ data }: Props) => {
  if (data.length === 0) {
    return (
      <div className="h-[300px] w-full rounded-xl border border-dashed border-border bg-background/50 flex items-center justify-center text-sm text-muted-foreground">
        Belum ada data untuk rentang waktu ini.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data}>
        <defs>
          <linearGradient id="tempStroke" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f97316" stopOpacity={1} />
            <stop offset="100%" stopColor="#fb923c" stopOpacity={0.8} />
          </linearGradient>
          <linearGradient id="humStroke" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2563eb" stopOpacity={1} />
            <stop offset="100%" stopColor="#60a5fa" stopOpacity={0.8} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="4 4" stroke="#d7dde5" />
        <XAxis dataKey="label" minTickGap={24} tick={{ fontSize: 12 }} stroke="#6b7280" />
        <YAxis tick={{ fontSize: 12 }} stroke="#6b7280" width={44} />
        <Tooltip
          contentStyle={{ borderRadius: 12, borderColor: "#d8dee7" }}
          labelFormatter={(_value, payload) => {
            const raw = payload?.[0]?.payload?.timestamp;
            if (!raw) return "";
            return new Date(String(raw)).toLocaleString("id-ID", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            });
          }}
        />
        <Legend verticalAlign="top" height={26} wrapperStyle={{ fontSize: 12 }} />
        <Line
          type="monotone"
          dataKey="temperature"
          name="Suhu (C)"
          stroke="url(#tempStroke)"
          strokeWidth={2.5}
          dot={false}
          activeDot={{ r: 3 }}
        />
        <Line
          type="monotone"
          dataKey="humidity"
          name="Kelembaban (%)"
          stroke="url(#humStroke)"
          strokeWidth={2.5}
          dot={false}
          activeDot={{ r: 3 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
};

export default TemperatureChart;
