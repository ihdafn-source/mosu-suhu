import { useState } from "react";
import { motion } from "framer-motion";
import { Lock, Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface SiteLockProps {
  onSuccess: () => void;
}

// Kunci akses ke seluruh dashboard. Memakai baris admin_config yang sama
// dengan Panel Admin (id = 1, kolom pin_code) supaya tidak perlu tabel baru.
// Setelah berhasil, status "sudah login" disimpan di sessionStorage agar
// pengguna tidak diminta PIN lagi selama tab browser masih terbuka.
const SiteLock = ({ onSuccess }: SiteLockProps) => {
  const [pin, setPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("admin_config")
        .select("pin_code")
        .eq("id", 1)
        .single();

      if (error) {
        throw new Error(error.message || "Gagal membaca data admin_config");
      }

      const pinMasuk = pin.trim();

      if (!data?.pin_code) {
        toast.error("PIN belum diisi di tabel admin_config");
        return;
      }

      if (String(data.pin_code).trim() === pinMasuk) {
        sessionStorage.setItem("mosu_site_unlocked", "1");
        toast.success("Berhasil masuk");
        onSuccess();
      } else {
        toast.error("Kode akses salah!");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Gagal memverifikasi kode akses";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-background">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm p-8 bg-card rounded-xl border border-border shadow-lg mx-4"
      >
        <div className="flex flex-col items-center mb-6">
          <div className="w-14 h-14 rounded-full bg-primary/20 flex items-center justify-center mb-3">
            <Lock className="w-7 h-7 text-primary" />
          </div>
          <h2 className="font-display text-lg font-bold text-foreground">Akses Terkunci</h2>
          <p className="font-body text-sm text-muted-foreground mt-1">Masukkan kode akses untuk melanjutkan</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <Input
              type={showPin ? "text" : "password"}
              placeholder="Kode akses"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              className="pr-10 text-center tracking-widest font-data text-lg"
              maxLength={20}
              autoFocus
            />
            <button
              type="button"
              onClick={() => setShowPin(!showPin)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <Button
            type="submit"
            disabled={loading || !pin}
            className="w-full bg-[#ABF5FD] hover:bg-[#99edf6] text-slate-900"
          >
            {loading ? "Memverifikasi..." : "Masuk"}
          </Button>
        </form>
      </motion.div>
    </div>
  );
};

export default SiteLock;