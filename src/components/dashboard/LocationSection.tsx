import { Building2, MapPin } from "lucide-react";
import LocationMap from "@/components/LocationMap";
import LocationSelector from "@/components/LocationSelector";
import type { Lokasi } from "@/hooks/useLokasi";

interface LocationSectionProps {
	locations: Lokasi[];
	selectedLocationId: string;
	selectedFloorId: string;
	onLocationChange: (locId: string) => void;
	onFloorChange: (floorId: string) => void;
}

const mapCoords: Record<string, { lat: number; lng: number; name: string }> = {
	"1": { lat: -6.1754, lng: 106.8272, name: "Dana Reksa" },
};

const LocationSection = ({
	locations,
	selectedLocationId,
	selectedFloorId,
	onLocationChange,
	onFloorChange,
}: LocationSectionProps) => {
	const location = locations.find((item) => item.id === selectedLocationId);
	const floor = location?.floors.find((f) => f.id === selectedFloorId) ?? location?.floors[0];
	const coords = mapCoords[selectedLocationId] ?? { lat: -6.1754, lng: 106.8272, name: "Lokasi" };

	return (
		<section className="grid gap-4 xl:grid-cols-5">
			<article className="rounded-3xl border border-border/60 bg-white/85 p-5 backdrop-blur-xl xl:col-span-3">
				<div className="mb-4 flex items-center gap-2">
					<Building2 className="h-4 w-4 text-secondary" />
					<h2 className="font-display text-lg font-bold text-foreground">Pemilihan Lokasi</h2>
				</div>
				<LocationSelector
					locations={locations}
					selectedLocationId={selectedLocationId}
					selectedFloorId={selectedFloorId}
					onLocationChange={onLocationChange}
					onFloorChange={onFloorChange}
				/>
				<div className="mt-4 rounded-2xl border border-border/70 bg-background/80 p-4">
					<p className="font-body text-sm text-foreground">
						Menampilkan pemantauan untuk <span className="font-semibold">{location?.shortName ?? "-"}</span>
						{" "}di <span className="font-semibold">{floor?.name ?? "-"}</span>.
					</p>
				</div>
			</article>

			<article className="overflow-hidden rounded-3xl border border-border/60 bg-white/85 p-5 backdrop-blur-xl xl:col-span-2">
				<div className="mb-4 flex items-center gap-2">
					<MapPin className="h-4 w-4 text-secondary" />
					<h2 className="font-display text-lg font-bold text-foreground">Peta Lokasi</h2>
				</div>
				<div className="h-[260px] rounded-2xl border border-border/70">
					<LocationMap lat={coords.lat} lng={coords.lng} name={coords.name} />
				</div>
			</article>
		</section>
	);
};

export default LocationSection;
