import { Building2, ChevronDown, Layers, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import logo from "@/assets/logo.png";

interface Floor {
	id: string;
	name: string;
}

interface Location {
	id: string;
	name: string;
	shortName: string;
	floors: Floor[];
}

interface Props {
	locations: Location[];
	selectedLocationId: string;
	selectedFloorId: string;
	onLocationChange: (id: string) => void;
	onFloorChange: (id: string) => void;
	onLogoClick: () => void;
	isCollapsed: boolean;
	onToggleCollapse: () => void;
}

const Sidebar = ({
	locations,
	selectedLocationId,
	selectedFloorId,
	onLocationChange,
	onFloorChange,
	onLogoClick,
	isCollapsed,
	onToggleCollapse,
}: Props) => {
	return (
		<>
			<aside className={`${isCollapsed ? "w-0 md:w-0" : "w-64 md:w-64"} hidden md:flex flex-col bg-card border-r border-border transition-all duration-300 overflow-hidden`}>
				<div className="p-5 border-b border-border flex items-center justify-between gap-3">
					<button
						type="button"
						onClick={onLogoClick}
						className="flex items-center gap-3 min-w-0 text-left"
						aria-label="Buka panel admin"
					>
						<img src={logo} alt="MOSU" className="h-14 w-14 shrink-0 object-contain" />
						<div className="min-w-0">
							<h2 className="font-bold truncate text-base">Monitoring Suhu</h2>
							<p className="text-xs text-muted-foreground truncate">Server Dashboard</p>
						</div>
					</button>
					<button
						type="button"
						onClick={onToggleCollapse}
						className="rounded-md border border-border bg-background p-2 text-muted-foreground hover:bg-muted"
						aria-label={isCollapsed ? "Buka sidebar" : "Tutup sidebar"}
					>
						{isCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
					</button>
				</div>

				<nav className="flex-1 p-4 space-y-2">
					<p className="text-xs font-medium text-muted-foreground uppercase mb-3">Lokasi</p>
					{locations.map((loc) => (
						<div key={loc.id}>
							<button
								onClick={() => onLocationChange(loc.id)}
								className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm ${
									selectedLocationId === loc.id ? "bg-[#ABF5FD] text-slate-900 font-medium" : "text-muted-foreground hover:bg-muted"
								}`}
							>
								<Building2 className="w-4 h-4" />
								{loc.shortName}
								<ChevronDown className={`w-3.5 h-3.5 ml-auto ${selectedLocationId === loc.id ? "rotate-180" : ""}`} />
							</button>

							{selectedLocationId === loc.id && (
								<div className="pl-6 pt-1 space-y-1">
									{loc.floors.map((fl) => (
										<button
											key={fl.id}
											onClick={() => onFloorChange(fl.id)}
											className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm ${
												selectedFloorId === fl.id ? "bg-[#ABF5FD] text-slate-900" : "text-muted-foreground hover:bg-muted"
											}`}
										>
											<Layers className="w-3.5 h-3.5" />
											{fl.name}
										</button>
									))}
								</div>
							)}
						</div>
					))}
				</nav>
			</aside>

			{isCollapsed && (
				<button
					type="button"
					onClick={onToggleCollapse}
					className="hidden md:inline-flex fixed left-4 top-24 z-30 items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground shadow-sm hover:bg-muted"
					aria-label="Buka sidebar"
				>
					<PanelLeftOpen className="h-4 w-4" />
					Panel
				</button>
			)}
		</>
	);
};

export default Sidebar;
