
import { Activity } from "lucide-react";
import TemperatureChart from "@/components/TemperatureChart";
import TemperatureTable from "@/components/dashboard/TemperatureTable";
import GradientRamp from "./GradientRamp";

interface TemperatureTrendSectionProps {
	data: { timestamp: string; label: string; temperature: number; humidity: number; floor?: string; building?: string }[];
	locationId?: string;
	floorId?: string;
}



const TemperatureTrendSection = ({ data, locationId = "", floorId = "" }: TemperatureTrendSectionProps) => {
	return (
		<section className="rounded-3xl border border-border/60 bg-white/85 p-5 backdrop-blur-xl">
			<div className="mb-4 flex items-center gap-3">
				<div className="flex items-center gap-2">
					<Activity className="h-4 w-4 text-secondary" />
					<h2 className="font-display text-lg font-bold text-foreground">Tren Suhu</h2>
				</div>
			</div>
			<TemperatureChart data={data} />
			{/* Tabel tren suhu di bawah grafik, di atas gradient ramp */}
			<div className="mt-4">
				<div className="rounded-2xl border border-border bg-white/90 p-4">
					<TemperatureTable locationId={locationId} floorId={floorId} />
				</div>
			</div>
			<div className="mt-4">
				<GradientRamp />
			</div>
		</section>
	);
};

export default TemperatureTrendSection;
