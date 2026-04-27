import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Pencil, Trash2, RotateCcw, MapPin, Server, Layers, Link2 } from "lucide-react";
import { supabase } from "../../integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

interface ServerLocation {
  id: string;
  name: string;
  api_url: string | null;
  api_key: string | null;
  floors: string[];
  address: string | null;
  maps_link: string | null;
  created_at: string;
  deleted_at: string | null;
}

const LocationManager = () => {
  const [locations, setLocations] = useState<ServerLocation[]>([]);
  const [trash, setTrash] = useState<ServerLocation[]>([]);
  const [showTrash, setShowTrash] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", api_url: "", api_key: "", floors: "", address: "", maps_link: "" });
  const [loading, setLoading] = useState(true);

  const fetchLocations = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("server_locations")
      .select("*")
      .order("created_at", { ascending: true });

    if (error) {
      toast.error("Gagal memuat data lokasi");
      setLoading(false);
      return;
    }

    const active = (data || []).filter((l: any) => !l.deleted_at).map((l: any) => ({
      ...l,
      floors: Array.isArray(l.floors) ? l.floors : [],
    }));
    const deleted = (data || []).filter((l: any) => l.deleted_at).map((l: any) => ({
      ...l,
      floors: Array.isArray(l.floors) ? l.floors : [],
    }));
    setLocations(active);
    setTrash(deleted);
    setLoading(false);
  };

  useEffect(() => { fetchLocations(); }, []);

  const resetForm = () => {
    setForm({ name: "", api_url: "", api_key: "", floors: "", address: "", maps_link: "" });
    setEditingId(null);
    setShowForm(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error("Nama lokasi wajib diisi");
      return;
    }

    const floorsArray = form.floors.split(",").map((f) => f.trim()).filter(Boolean);
    const nowIso = new Date().toISOString();
    const payload = {
      name: form.name.trim(),
      api_url: form.api_url.trim() || null,
      api_key: form.api_key.trim() || null,
      floors: floorsArray,
      address: form.address.trim() || null,
      maps_link: form.maps_link.trim() || null,
      updated_at: nowIso,
    };

    if (editingId) {
      const { error } = await supabase.from("server_locations").update(payload).eq("id", editingId);
      if (error) {
        toast.error(`Gagal mengupdate: ${error.message}`);
        return;
      }
      toast.success("Lokasi diperbarui");
    } else {
      const insertPayload = {
        id: crypto.randomUUID(),
        created_at: nowIso,
        ...payload,
      };

      const { error } = await supabase.from("server_locations").insert(insertPayload);
      if (error) {
        toast.error(`Gagal menambahkan: ${error.message}`);
        return;
      }
      toast.success("Lokasi ditambahkan");
    }
    resetForm();
    fetchLocations();
  };

  const handleEdit = (loc: ServerLocation) => {
    setForm({
      name: loc.name,
      api_url: loc.api_url || "",
      api_key: loc.api_key || "",
      floors: loc.floors.join(", "),
      address: loc.address || "",
      maps_link: loc.maps_link || "",
    });
    setEditingId(loc.id);
    setShowForm(true);
  };

  const handleSoftDelete = async (id: string) => {
    const { error } = await supabase
      .from("server_locations")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);
    if (error) { toast.error("Gagal menghapus"); return; }
    toast.success("Lokasi dipindahkan ke sampah");
    fetchLocations();
  };

  const handleRestore = async (id: string) => {
    const { error } = await supabase
      .from("server_locations")
      .update({ deleted_at: null })
      .eq("id", id);
    if (error) { toast.error("Gagal memulihkan"); return; }
    toast.success("Lokasi dipulihkan");
    fetchLocations();
  };

  const handlePermanentDelete = async (id: string) => {
    const { error } = await supabase.from("server_locations").delete().eq("id", id);
    if (error) { toast.error("Gagal menghapus permanen"); return; }
    toast.success("Lokasi dihapus permanen");
    fetchLocations();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg font-bold text-foreground flex items-center gap-2">
          <Server className="w-5 h-5" /> Manajemen Lokasi Server
        </h3>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowTrash(!showTrash)}
            className="text-muted-foreground"
          >
            <Trash2 className="w-4 h-4 mr-1" /> Sampah ({trash.length})
          </Button>
          <Button
            size="sm"
            onClick={() => { resetForm(); setShowForm(true); }}
            className="bg-admin-tab hover:bg-admin-tab/90 text-white"
          >
            <Plus className="w-4 h-4 mr-1" /> Tambah
          </Button>
        </div>
      </div>

      {/* Form */}
      <AnimatePresence>
        {showForm && (
          <motion.form
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            onSubmit={handleSubmit}
            className="overflow-hidden bg-card border border-border rounded-lg p-4 space-y-3"
          >
            <p className="font-body text-sm font-semibold text-foreground">
              {editingId ? "Edit Lokasi" : "Tambah Lokasi Baru"}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="font-body text-xs text-muted-foreground mb-1 block">Nama Lokasi Server *</label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Dana Reksa" />
              </div>
              <div>
                <label className="font-body text-xs text-muted-foreground mb-1 block">Kode VPN</label>
                <Input value={form.api_url} onChange={(e) => setForm({ ...form, api_url: e.target.value })} placeholder="Masukkan kode VPN" />
              </div>
              <div>
                <label className="font-body text-xs text-muted-foreground mb-1 block">API Key Arduino</label>
                <Input value={form.api_key} onChange={(e) => setForm({ ...form, api_key: e.target.value })} placeholder="API key dari Arduino IDE" />
              </div>
              <div>
                <label className="font-body text-xs text-muted-foreground mb-1 block">Lantai (pisahkan dengan koma)</label>
                <Input value={form.floors} onChange={(e) => setForm({ ...form, floors: e.target.value })} placeholder="Lantai 5, Lantai 15" />
              </div>
              <div>
                <label className="font-body text-xs text-muted-foreground mb-1 block">Alamat</label>
                <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Jl. Medan Merdeka..." />
              </div>
              <div className="md:col-span-2">
                <label className="font-body text-xs text-muted-foreground mb-1 block flex items-center gap-1">
                  <Link2 className="w-3 h-3" /> Link Google Maps (opsional)
                </label>
                <Input value={form.maps_link} onChange={(e) => setForm({ ...form, maps_link: e.target.value })} placeholder="https://maps.google.com/..." />
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <Button type="submit" size="sm" className="bg-admin-tab hover:bg-admin-tab/90 text-white">
                {editingId ? "Simpan Perubahan" : "Tambahkan"}
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={resetForm}>Batal</Button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {/* Active locations */}
      {loading ? (
        <p className="text-muted-foreground font-body text-sm">Memuat...</p>
      ) : !showTrash ? (
        <div className="space-y-2">
          {locations.length === 0 && (
            <p className="text-muted-foreground font-body text-sm text-center py-8">Belum ada lokasi server. Klik "Tambah" untuk menambahkan.</p>
          )}
          {locations.map((loc) => (
            <div key={loc.id} className="bg-card border border-border rounded-lg p-4 flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <p className="font-body text-sm font-semibold text-foreground">{loc.name}</p>
                {loc.api_url && <p className="font-data text-xs text-muted-foreground truncate">VPN: {loc.api_url}</p>}
                {loc.api_key && <p className="font-data text-xs text-muted-foreground truncate">API Key: {loc.api_key}</p>}
                {loc.floors.length > 0 && (
                  <p className="font-data text-xs text-muted-foreground flex items-center gap-1 mt-1">
                    <Layers className="w-3 h-3" /> {loc.floors.join(", ")}
                  </p>
                )}
                {loc.address && (
                  <p className="font-data text-xs text-muted-foreground flex items-center gap-1 mt-1">
                    <MapPin className="w-3 h-3" /> {loc.address}
                  </p>
                )}
                {loc.maps_link && (
                  <a href={loc.maps_link} target="_blank" rel="noopener noreferrer" className="font-data text-xs text-admin-tab hover:underline mt-1 inline-block">
                    Buka di Google Maps →
                  </a>
                )}
              </div>
              <div className="flex gap-1 shrink-0">
                <Button size="icon" variant="ghost" onClick={() => handleEdit(loc)} className="h-8 w-8">
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
                <Button size="icon" variant="ghost" onClick={() => handleSoftDelete(loc.id)} className="h-8 w-8 text-destructive hover:text-destructive">
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Trash view */
        <div className="space-y-2">
          <p className="font-body text-xs text-muted-foreground uppercase tracking-wider">Sampah</p>
          {trash.length === 0 && (
            <p className="text-muted-foreground font-body text-sm text-center py-8">Sampah kosong.</p>
          )}
          {trash.map((loc) => (
            <div key={loc.id} className="bg-card border border-border rounded-lg p-4 flex items-center justify-between gap-4 opacity-60">
              <p className="font-body text-sm text-foreground">{loc.name}</p>
              <div className="flex gap-1">
                <Button size="sm" variant="outline" onClick={() => handleRestore(loc.id)}>
                  <RotateCcw className="w-3.5 h-3.5 mr-1" /> Pulihkan
                </Button>
                <Button size="sm" variant="destructive" onClick={() => handlePermanentDelete(loc.id)}>
                  Hapus Permanen
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default LocationManager;