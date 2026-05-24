import { useState, useEffect } from "react";
import { supabase } from "../../integrations/supabase/client";
import { toast } from "sonner";
import { Bot, Save, TestTube, Eye, EyeOff, Trash2, Building2 } from "lucide-react";
import type { LinkedFloor } from "../../hooks/useTelegramAlert";
import { useLokasi } from "../../hooks/useLokasi";

interface TelegramAlertConfig {
  chat_id?: string;
  bot_token?: string;
  threshold?: number;
  humidity_threshold?: number;
  cooldown_seconds?: number;
  enabled?: boolean;
  linked_floors?: LinkedFloor[];
}

function maskSecret(value: string) {
  if (!value) return "";
  if (value.length <= 8) return "****";
  return value.slice(0, 4) + "••••••••" + value.slice(-4);
}

const TelegramSettings = () => {
  const { lokasi } = useLokasi();

  const [chatId, setChatId] = useState("");
  const [botToken, setBotToken] = useState("");
  const [threshold, setThreshold] = useState(28);
  const [humidityThreshold, setHumidityThreshold] = useState(80);
  const [cooldownSeconds, setCooldownSeconds] = useState(60);
  const [enabled, setEnabled] = useState(true);
  const [linkedFloors, setLinkedFloors] = useState<LinkedFloor[]>([]);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [showChatId, setShowChatId] = useState(false);
  const [selectedLocationId, setSelectedLocationId] = useState("");
  const [selectedFloorId, setSelectedFloorId] = useState("");

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    const { data } = await supabase
      .from("telegram_alert_config")
      .select("*")
      .eq("id", 1)
      .single();

    const config = (data ?? {}) as TelegramAlertConfig;

    if (data) {
      setChatId(config.chat_id ?? "");
      setBotToken(config.bot_token ?? "");
      setThreshold(Number(config.threshold) || 28);
      setHumidityThreshold(Number(config.humidity_threshold) || 80);
      setCooldownSeconds(config.cooldown_seconds ?? 60);
      setEnabled(config.enabled ?? true);
      setLinkedFloors(Array.isArray(config.linked_floors) ? config.linked_floors : []);
    }
  };

  const saveConfig = async () => {
    // Kalau ada gedung+lantai dipilih, append dulu sebelum save
    let floorsToSave = linkedFloors;
    if (selectedLocationId && selectedFloorId) {
      const alreadyAdded = linkedFloors.some(
        (f) => f.location_id === selectedLocationId && f.floor_id === selectedFloorId
      );
      if (!alreadyAdded) {
        const loc = lokasi.find((l) => l.id === selectedLocationId);
        const locationName = loc?.name ?? selectedLocationId;
        floorsToSave = [
          ...linkedFloors,
          { location_id: selectedLocationId, location_name: locationName, floor_id: selectedFloorId },
        ];
        setLinkedFloors(floorsToSave);
      }
      setSelectedLocationId("");
      setSelectedFloorId("");
    }

    setSaving(true);
    const { error } = await supabase
      .from("telegram_alert_config")
      .upsert(
        {
          id: 1,
          chat_id: chatId,
          bot_token: botToken,
          threshold,
          humidity_threshold: humidityThreshold,
          cooldown_seconds: cooldownSeconds,
          enabled,
          linked_floors: floorsToSave,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" }
      );

    setSaving(false);
    if (error) {
      toast.error("Gagal menyimpan konfigurasi: " + error.message);
    } else {
      toast.success("Konfigurasi Telegram disimpan!");
    }
  };

  const testAlert = async () => {
    if (!chatId || !botToken) {
      toast.error("Isi Bot Token dan Chat ID dulu!");
      return;
    }
    setTesting(true);
    try {
      const res = await fetch(
        `https://api.telegram.org/bot${botToken}/sendMessage`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text:
              `✅ *Test MOSU Alert*\n\nKoneksi Telegram berhasil!\n\n` +
              `⚙️ Konfigurasi aktif:\n` +
              `• Batas suhu: *${threshold}°C*\n` +
              `• Batas kelembapan: *${humidityThreshold}%*\n` +
              `• Cooldown: *${cooldownSeconds} detik*\n` +
              `• Lantai terhubung: *${linkedFloors.length} lantai*`,
            parse_mode: "Markdown",
          }),
        }
      );
      const data = await res.json();
      if (data.ok) {
        toast.success("Pesan test berhasil dikirim ke Telegram!");
      } else {
        toast.error(`Gagal: ${data.description}`);
      }
    } catch {
      toast.error("Gagal mengirim pesan test");
    }
    setTesting(false);
  };

  const removeLinkedFloor = (index: number) => {
    setLinkedFloors((prev) => prev.filter((_, i) => i !== index));
  };

  const selectedLocation = lokasi.find((l) => l.id === selectedLocationId);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        <Bot className="w-5 h-5 text-primary" />
        <h3 className="font-display text-lg font-bold text-foreground">Notifikasi Telegram</h3>
      </div>

      {/* Bot Token */}
      <div>
        <label className="font-body text-sm text-muted-foreground block mb-1">Bot Token</label>
        <div className="relative">
          <input
            type={showToken ? "text" : "password"}
            value={botToken}
            onChange={(e) => setBotToken(e.target.value)}
            placeholder="123456:ABC-DEF..."
            className="w-full px-3 py-2 pr-10 rounded-lg border border-border bg-background text-foreground font-data text-sm"
          />
          <button
            type="button"
            onClick={() => setShowToken((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        {botToken && !showToken && (
          <p className="text-xs text-muted-foreground mt-1 font-data">{maskSecret(botToken)}</p>
        )}
      </div>

      {/* Chat ID */}
      <div>
        <label className="font-body text-sm text-muted-foreground block mb-1">Chat ID</label>
        <div className="relative">
          <input
            type={showChatId ? "text" : "password"}
            value={chatId}
            onChange={(e) => setChatId(e.target.value)}
            placeholder="123456789"
            className="w-full px-3 py-2 pr-10 rounded-lg border border-border bg-background text-foreground font-data text-sm"
          />
          <button
            type="button"
            onClick={() => setShowChatId((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            {showChatId ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        {chatId && !showChatId && (
          <p className="text-xs text-muted-foreground mt-1 font-data">{maskSecret(chatId)}</p>
        )}
      </div>

      {/* Batas Suhu + Kelembapan */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="font-body text-sm text-muted-foreground block mb-1">Batas Suhu (°C)</label>
          <input
            type="number"
            value={threshold}
            onChange={(e) => setThreshold(Number(e.target.value))}
            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground font-data text-sm"
          />
        </div>
        <div>
          <label className="font-body text-sm text-muted-foreground block mb-1">Batas Kelembapan (%)</label>
          <input
            type="number"
            value={humidityThreshold}
            onChange={(e) => setHumidityThreshold(Number(e.target.value))}
            min={0}
            max={100}
            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground font-data text-sm"
          />
        </div>
      </div>

      {/* Cooldown */}
      <div>
        <label className="font-body text-sm text-muted-foreground block mb-1">Cooldown (detik)</label>
        <input
          type="number"
          value={cooldownSeconds}
          onChange={(e) => setCooldownSeconds(Number(e.target.value))}
          className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground font-data text-sm"
        />
      </div>

      {/* Aktifkan notifikasi */}
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          className="rounded"
          id="tg-enabled"
        />
        <label htmlFor="tg-enabled" className="font-body text-sm text-foreground">
          Aktifkan notifikasi Telegram
        </label>
      </div>

      {/* Gedung & Lantai Terhubung */}
      <div className="border border-border rounded-xl p-4 bg-muted/30 space-y-3">
        <div className="flex items-center gap-2">
          <Building2 className="w-4 h-4 text-primary" />
          <h4 className="font-body text-sm font-semibold text-foreground">
            Gedung & Lantai Terhubung
          </h4>
          <span className="ml-auto text-xs text-muted-foreground font-data">
            {linkedFloors.length} lantai
          </span>
        </div>

        {/* Daftar lantai yang sudah tersimpan */}
        {linkedFloors.length === 0 ? (
          <p className="text-xs text-muted-foreground font-body py-1">
            Belum ada lantai yang terhubung.
          </p>
        ) : (
          <div className="space-y-1.5">
            {linkedFloors.map((lf, i) => (
              <div
                key={i}
                className="flex items-center justify-between px-3 py-2 rounded-lg bg-background border border-border"
              >
                <div>
                  <span className="font-body text-sm text-foreground font-medium">{lf.location_name}</span>
                  <span className="text-muted-foreground font-data text-xs ml-2">– {lf.floor_id}</span>
                </div>
                <button
                  type="button"
                  onClick={() => removeLinkedFloor(i)}
                  className="text-destructive hover:text-destructive/70 p-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Pilih gedung + lantai baru — langsung Simpan */}
        <div className="grid grid-cols-2 gap-2 pt-1">
          <select
            value={selectedLocationId}
            onChange={(e) => { setSelectedLocationId(e.target.value); setSelectedFloorId(""); }}
            className="px-2 py-2 rounded-lg border border-border bg-background text-foreground font-body text-sm"
          >
            <option value="">Pilih Gedung</option>
            {lokasi.map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
          <select
            value={selectedFloorId}
            onChange={(e) => setSelectedFloorId(e.target.value)}
            disabled={!selectedLocationId}
            className="px-2 py-2 rounded-lg border border-border bg-background text-foreground font-body text-sm disabled:opacity-50"
          >
            <option value="">Pilih Lantai</option>
            {selectedLocation?.floors.map((f) => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </select>
        </div>
        <p className="text-xs text-muted-foreground font-body">
          Pilih gedung & lantai lalu klik <strong>Simpan</strong> untuk menambahkan.
        </p>
      </div>

      {/* Tombol Simpan & Test */}
      <div className="flex gap-2 pt-1">
        <button
          onClick={saveConfig}
          disabled={saving}
          className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg bg-primary text-primary-foreground font-body text-sm font-medium"
        >
          <Save className="w-4 h-4" />
          {saving ? "Menyimpan..." : "Simpan"}
        </button>
        <button
          onClick={testAlert}
          disabled={testing}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border bg-background text-foreground font-body text-sm font-medium hover:bg-muted"
        >
          <TestTube className="w-4 h-4" />
          {testing ? "..." : "Test"}
        </button>
      </div>
    </div>
  );
};

export default TelegramSettings;