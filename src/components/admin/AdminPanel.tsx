import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import AdminLogin from "./AdminLogin";
import LocationManager from "./LocationManager";
import VisitorManager from "./VisitorManager";
import TelegramSettings from "./TelegramSettings";
import PanelTabs, { type AdminTabKey } from "./PanelTabs";

interface AdminPanelProps {
  onBack: () => void;
}

const AdminPanel = ({ onBack }: AdminPanelProps) => {
  const [authenticated, setAuthenticated] = useState(false);
  const [activeTab, setActiveTab] = useState<AdminTabKey>("lokasi");

  if (!authenticated) {
    return (
      <div>
        <div className="p-4">
          <Button variant="ghost" size="sm" onClick={onBack} className="gap-2 text-muted-foreground">
            <ArrowLeft className="w-4 h-4" />
            Kembali ke Dashboard
          </Button>
        </div>
        <AdminLogin onSuccess={() => setAuthenticated(true)} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-admin-tab px-4 py-3 flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-2 text-white hover:bg-white/20">
          <ArrowLeft className="w-4 h-4" />
          Dashboard
        </Button>
        <h1 className="font-display text-lg font-bold text-white">Panel Admin</h1>
      </div>
      <PanelTabs activeTab={activeTab} onChange={setActiveTab} />
      <div className="p-4 md:p-6 max-w-5xl mx-auto">
        {activeTab === "lokasi" ? (
          <LocationManager />
        ) : activeTab === "pengguna" ? (
          <VisitorManager />
        ) : (
          <TelegramSettings />
        )}
      </div>
    </div>
  );
};

export default AdminPanel;