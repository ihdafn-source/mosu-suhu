import { MapPin, Layers } from "lucide-react";
import logoDjid from "@/assets/logo-djid.png";
import logoGunadarma from "@/assets/logo-gunadarma.png";
import logoMosu from "@/assets/logo.png";

interface DashboardHeaderProps {
	locations: Array<{
		id: string;
		name: string;
		shortName: string;
		floors: Array<{ id: string; name: string }>;
	}>;
	selectedLocationId: string;
	selectedFloorId: string;
	onLocationChange: (id: string) => void;
	onFloorChange: (id: string) => void;
	onLogoClick: () => void;
}

const DashboardHeader = ({
	locations,
	selectedLocationId,
	selectedFloorId,
	onLocationChange,
	onFloorChange,
	onLogoClick,
}: DashboardHeaderProps) => {
	const selectedLocation = locations.find((loc) => loc.id === selectedLocationId);
	const floors = selectedLocation?.floors ?? [];

	return (
		<header className="sticky top-0 z-10 border-b border-border bg-background/90 px-4 py-4 backdrop-blur md:px-6">
			<div className="relative overflow-hidden rounded-2xl bg-primary px-4 py-4 md:px-6 md:py-5">
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-3 md:gap-4">
						<img src={logoDjid} alt="Logo DJID" className="h-8 w-auto md:h-10" />
						<img src={logoGunadarma} alt="Logo Gunadarma" className="h-8 w-auto md:h-10" />
					</div>
					<button
						type="button"
						onClick={onLogoClick}
						className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
						aria-label="Buka panel admin"
					>
						<img src={logoMosu} alt="Logo MOSU" className="h-16 w-auto md:h-24" />
					</button>
				</div>
				<div className="mt-4 relative z-10">
					<h1 className="font-display text-2xl font-bold text-foreground md:text-4xl">Monitoring Suhu Server</h1>
					<p className="mt-1 font-body text-sm text-foreground/80 md:text-lg">Direktorat Jenderal Infrastruktur Digital</p>
				</div>
				<img
					src={logoMosu}
					alt=""
					aria-hidden="true"
					className="pointer-events-none absolute -right-6 -bottom-8 h-36 w-auto opacity-20 md:h-56"
				/>
			</div>

			<div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
				<div className="flex items-center gap-2 bg-card border border-border rounded-lg px-3 py-2">
					<MapPin className="w-4 h-4 text-muted-foreground" />
					<select
						value={selectedLocationId}
						onChange={(e) => onLocationChange(e.target.value)}
						className="bg-transparent text-sm outline-none"
					>
						{locations.map((loc) => (
							<option key={loc.id} value={loc.id}>
								{loc.shortName}
							</option>
						))}
					</select>
				</div>

				<div className="flex items-center gap-2 bg-card border border-border rounded-lg px-3 py-2">
					<Layers className="w-4 h-4 text-muted-foreground" />
					<select
						value={selectedFloorId}
						onChange={(e) => onFloorChange(e.target.value)}
						className="bg-transparent text-sm outline-none"
					>
						{floors.map((fl) => (
							<option key={fl.id} value={fl.id}>
								{fl.name}
							</option>
						))}
					</select>
				</div>
			</div>
		</header>
	);
};

export default DashboardHeader;
