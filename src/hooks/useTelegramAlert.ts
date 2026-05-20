import { useEffect, useRef } from "react";
import { supabase } from "../integrations/supabase/client";

interface TelegramConfig {
  bot_token: string;
  chat_id: string;
  threshold: number;
  cooldown_seconds: number;
  enabled: boolean;
}

/**
 * Request izin browser notification.
 * Dipanggil sekali saat pertama kali hook di-mount.
 */
async function requestNotifPermission() {
  if (!("Notification" in window)) return;
  if (Notification.permission === "default") {
    await Notification.requestPermission();
  }
}

/**
 * Tampilkan Web Push Notification browser (notif kayak berita di HP/desktop).
 */
function showBrowserNotif(title: string, body: string) {
  if (!("Notification" in window)) return;
  if (Notification.permission !== "granted") return;

  new Notification(title, {
    body,
    icon: "/favicon.ico",
    tag: "mosu-suhu-alert", // Satu notif per alert, tidak numpuk
    requireInteraction: false,
  });
}

/**
 * Kirim pesan ke Telegram via bot.
 */
async function sendTelegram(botToken: string, chatId: string, pesan: string) {
  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: pesan,
      parse_mode: "Markdown",
    }),
  });
}

/**
 * Hook ini otomatis:
 * 1. Kirim notifikasi Telegram kalau suhu melebihi threshold
 * 2. Tampilkan browser notification (push-style) di HP/desktop
 *
 * Taruh di Dashboard, kasih suhuSaatIni dan locationName.
 */
export function useTelegramAlert(suhuSaatIni: number, locationName: string) {
  const lastSentRef = useRef<number>(0);
  const configRef = useRef<TelegramConfig | null>(null);
  const hasRequestedNotifRef = useRef(false);

  // Minta izin browser notification sekali saja
  useEffect(() => {
    if (!hasRequestedNotifRef.current) {
      hasRequestedNotifRef.current = true;
      void requestNotifPermission();
    }
  }, []);

  // Load config dari Supabase + refresh tiap 30 detik
  useEffect(() => {
    const loadConfig = async () => {
      const { data } = await supabase
        .from("telegram_alert_config")
        .select("*")
        .eq("id", 1)
        .single();

      if (data && typeof data === "object") {
        const safeData = data as Partial<TelegramConfig>;
        configRef.current = {
          bot_token: safeData.bot_token ?? "",
          chat_id: safeData.chat_id ?? "",
          threshold: Number(safeData.threshold) || 35,
          cooldown_seconds:
            safeData.cooldown_seconds !== undefined ? Number(safeData.cooldown_seconds) : 60,
          enabled: safeData.enabled ?? false,
        };
      }
    };

    void loadConfig();
    const interval = window.setInterval(() => void loadConfig(), 30_000);
    return () => window.clearInterval(interval);
  }, []);

  // Cek suhu & kirim alert setiap kali suhu berubah
  useEffect(() => {
    const config = configRef.current;
    if (!config || !config.enabled) return;
    if (suhuSaatIni <= 0) return; // sensor offline

    if (suhuSaatIni > config.threshold) {
      const now = Date.now();
      const cooldownMs = config.cooldown_seconds * 1000;
      if (now - lastSentRef.current < cooldownMs) return;
      lastSentRef.current = now;

      const waktu = new Date().toLocaleString("id-ID", {
        dateStyle: "short",
        timeStyle: "medium",
      });

      const bodyText =
        `📍 ${locationName} | 🔥 ${suhuSaatIni}°C | Batas: ${config.threshold}°C\n🕐 ${waktu}`;

      const pesanTelegram =
        `🌡️ *MOSU Alert — Suhu Tinggi!*\n\n` +
        `📍 Lokasi: *${locationName}*\n` +
        `🔥 Suhu saat ini: *${suhuSaatIni}°C*\n` +
        `⚠️ Batas: *${config.threshold}°C*\n` +
        `🕐 Waktu: ${waktu}\n\n` +
        `Segera cek pendingin ruangan!`;

      // 1. Browser notification (real-time push, seperti notif berita)
      showBrowserNotif("🌡️ MOSU Alert — Suhu Tinggi!", bodyText);

      // 2. Telegram (silent fail agar tidak crash app)
      if (config.bot_token && config.chat_id) {
        sendTelegram(config.bot_token, config.chat_id, pesanTelegram).catch(() => {});
      }
    }
  }, [suhuSaatIni, locationName]);
}
