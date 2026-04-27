import { useState } from "react";
import { Check, ChevronDown, Building2, Layers } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { Lokasi } from "@/hooks/useLokasi";

interface LocationSelectorProps {
  locations: Lokasi[];
  selectedLocationId: string;
  selectedFloorId: string;
  onLocationChange: (locId: string) => void;
  onFloorChange: (floorId: string) => void;
}

const LocationSelector = ({
  locations,
  selectedLocationId,
  selectedFloorId,
  onLocationChange,
  onFloorChange,
}: LocationSelectorProps) => {
  const [locOpen, setLocOpen] = useState(false);
  const [floorOpen, setFloorOpen] = useState(false);

  const location = locations.find((l) => l.id === selectedLocationId);
  const floor = location?.floors.find((f) => f.id === selectedFloorId) || location?.floors[0];

  if (!location) {
    return (
      <div className="px-4 py-3 rounded-xl bg-selector text-muted-foreground font-body text-sm">
        Belum ada lokasi
      </div>
    );
  }

  return (
    <div className="flex gap-3">
      <Popover open={locOpen} onOpenChange={setLocOpen}>
        <PopoverTrigger asChild>
          <button className="flex-1 flex items-center justify-between gap-2 px-4 py-3 rounded-xl bg-selector text-foreground font-body text-sm font-semibold border-2 border-selector-border shadow-sm">
            <span className="truncate">{location.shortName}</span>
            <ChevronDown className="w-5 h-5 text-foreground/70 shrink-0" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-[200px] p-0" align="start">
          <Command>
            <CommandInput placeholder="Cari gedung..." />
            <CommandList>
              <CommandEmpty>Tidak ditemukan.</CommandEmpty>
              <CommandGroup>
                {locations.map((loc) => (
                  <CommandItem
                    key={loc.id}
                    value={loc.shortName}
                    onSelect={() => {
                      onLocationChange(loc.id);
                      setLocOpen(false);
                    }}
                  >
                    <Building2 className="w-4 h-4 mr-2" />
                    {loc.shortName}
                    <Check
                      className={cn(
                        "ml-auto h-4 w-4",
                        selectedLocationId === loc.id ? "opacity-100" : "opacity-0"
                      )}
                    />
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {floor && (
        <Popover open={floorOpen} onOpenChange={setFloorOpen}>
          <PopoverTrigger asChild>
            <button className="flex-1 flex items-center justify-between gap-2 px-4 py-3 rounded-xl bg-selector text-foreground font-body text-sm font-semibold border-2 border-selector-border shadow-sm">
              <span className="truncate">{floor.name}</span>
              <ChevronDown className="w-5 h-5 text-foreground/70 shrink-0" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-[200px] p-0" align="start">
            <Command>
              <CommandInput placeholder="Cari lantai..." />
              <CommandList>
                <CommandEmpty>Tidak ditemukan.</CommandEmpty>
                <CommandGroup>
                  {location.floors.map((fl) => (
                    <CommandItem
                      key={fl.id}
                      value={fl.name}
                      onSelect={() => {
                        onFloorChange(fl.id);
                        setFloorOpen(false);
                      }}
                    >
                      <Layers className="w-4 h-4 mr-2" />
                      {fl.name}
                      <Check
                        className={cn(
                          "ml-auto h-4 w-4",
                          selectedFloorId === fl.id ? "opacity-100" : "opacity-0"
                        )}
                      />
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
};

export default LocationSelector;