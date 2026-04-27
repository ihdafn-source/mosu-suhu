import { cn } from "@/lib/utils";

type AdminTabKey = "lokasi" | "pengguna" | "telegram";

type PanelTabsProps = {
  activeTab: AdminTabKey;
  onChange: (tab: AdminTabKey) => void;
};

const TAB_ITEMS: Array<{ key: AdminTabKey; label: string }> = [
  { key: "lokasi", label: "Manajemen Lokasi" },
  { key: "pengguna", label: "Manajemen Pengguna" },
  { key: "telegram", label: "Telegram Alert" },
];

const PanelTabs = ({ activeTab, onChange }: PanelTabsProps) => {
  return (
    <div className="flex border-b border-border bg-card overflow-x-auto">
      {TAB_ITEMS.map((item) => (
        <button
          key={item.key}
          type="button"
          onClick={() => onChange(item.key)}
          className={cn(
            "px-6 py-3 whitespace-nowrap font-body text-sm font-medium transition-colors",
            activeTab === item.key
              ? "text-admin-tab border-b-2 border-admin-tab"
              : "text-muted-foreground hover:text-admin-tab-hover",
          )}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
};

export type { AdminTabKey };
export default PanelTabs;
