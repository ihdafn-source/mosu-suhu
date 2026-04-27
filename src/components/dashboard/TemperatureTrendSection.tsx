import { Activity } from "lucide-react";
import TemperatureChart from "@/components/TemperatureChart";
import GradientRamp from "./GradientRamp";

interface TemperatureTrendSectionProps {
	data: { timestamp: string; label: string; temperature: number; humidity: number }[];
}

const TemperatureTrendSection = ({ data }: TemperatureTrendSectionProps) => {
	return (
		<section className="rounded-3xl border border-border/60 bg-white/85 p-5 backdrop-blur-xl">
			<div className="mb-4 flex items-center justify-between gap-3">
				<div className="flex items-center gap-2">
					<Activity className="h-4 w-4 text-secondary" />
					<h2 className="font-display text-lg font-bold text-foreground">Tren Suhu</h2>
				</div>
				<p className="font-data text-xs uppercase tracking-wider text-muted-foreground">6 Jam Terakhir</p>
			</div>
			<TemperatureChart data={data} />
			<div className="mt-4">
				<GradientRamp />
			</div>
		</section>
	);
};

export default TemperatureTrendSection;
