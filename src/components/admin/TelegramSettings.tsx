import { useState, useEffect } from "react";
import { supabase } from "../../integrations/supabase/client";
import { toast } from "sonner";
import { Bot, Save, TestTube } from "lucide-react";

interface TelegramAlertConfig {
  chat_id?: string;
  bot_token?: string;
  threshold?: number;
  cooldown_seconds?: number;
  enabled?: boolean;
}

const TelegramSettings = () => {
  const [chatId, setChatId] = useState("");
  const [botToken, setBotToken] = useState("");
  const [threshold, setThreshold] = useState(25);
  const [cooldownSeconds, setCooldownSeconds] = useState(60);
  const [enabled, setEnabled] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

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
      setThreshold(Number(config.threshold) || 25);
      setCooldownSeconds(config.cooldown_seconds ?? 60);
      setEnabled(config.enabled ?? true);
    }
  };

  const saveConfig = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("telegram_alert_config")
      .update({
        chat_id: chatId,
        bot_token: botToken,
        threshold,
        cooldown_seconds: cooldownSeconds,
        enabled,
        updated_at: new Date().toISOString(),
      })
      .eq("id", 1);

    setSaving(false);
    if (error) {
      toast.error("Gagal menyimpan konfigurasi");
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
            text: "✅ *Test MOSU Alert*\n\nKoneksi Telegram berhasil! Kamu akan menerima notifikasi saat suhu melebihi batas.",
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

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Bot className="w-5 h-5 text-primary" />
        <h3 className="font-display text-lg font-bold text-foreground">Notifikasi Telegram</h3>
      </div>

      <div className="space-y-3">
        <div>
          <label className="font-body text-sm text-muted-foreground block mb-1">Bot Token</label>
          <input
            type="password"
            value={botToken}
            onChange={(e) => setBotToken(e.target.value)}
            placeholder="123456:ABC-DEF..."
            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground font-data text-sm"
          />
        </div>

        <div>
          <label className="font-body text-sm text-muted-foreground block mb-1">Chat ID</label>
          <input
            type="text"
            value={chatId}
            onChange={(e) => setChatId(e.target.value)}
            placeholder="123456789"
            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground font-data text-sm"
          />
        </div>

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
            <label className="font-body text-sm text-muted-foreground block mb-1">Cooldown (detik)</label>
            <input
              type="number"
              value={cooldownSeconds}
              onChange={(e) => setCooldownSeconds(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground font-data text-sm"
            />
          </div>
        </div>

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
      </div>

      <div className="flex gap-2 pt-2">
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