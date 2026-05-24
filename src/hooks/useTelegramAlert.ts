import { useEffect, useRef } from "react";
import { supabase } from "../integrations/supabase/client";

interface TelegramConfig {
  bot_token: string;
  chat_id: string;
  threshold: number;
  humidity_threshold: number;
  cooldown_seconds: number;
  enabled: boolean;
  linked_floors: LinkedFloor[];
}

export interface LinkedFloor {
  location_id: string;
  location_name: string;
  floor_id: string;
}

interface SensorReading {
  temperature: number;
  humidity: number;
  locationName: string;
  floorId: string;
}

async function requestNotifPermission() {
  if (!("Notification" in window)) return;
  if (Notification.permission === "default") {
    await Notification.requestPermission();
  }
}

function showBrowserNotif(title: string, body: string, tag: string) {
  if (!("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  new Notification(title, {
    body,
    icon: "/favicon.ico",
    tag,
    requireInteraction: false,
  });
}

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

async function fetchAllSensorReadings(linkedFloors: LinkedFloor[]): Promise<SensorReading[]> {
  if (linkedFloors.length === 0) return [];
  const results: SensorReading[] = [];
  for (const lf of linkedFloors) {
    const { data } = await supabase
      .from("temperature_readings")
      .select("temperature, humidity, recorded_at")
      .eq("location_id", lf.location_id)
      .eq("floor", lf.floor_id)
      .order("recorded_at", { ascending: false })
      .limit(1)
      .single();
    if (data) {
      const ageMs = Date.now() - new Date((data as any).recorded_at).getTime();
      if (ageMs < 5 * 60 * 1000) {
        results.push({
          temperature: Number((data as any).temperature),
          humidity: Number((data as any).humidity),
          locationName: lf.location_name,
          floorId: lf.floor_id,
        });
      }
    }
  }
  return results;
}

export function useTelegramAlert(suhuSaatIni: number, locationName: string) {
  const lastSentAlertRef = useRef<number>(0);   // cooldown untuk OVERHEAT (Telegram + browser)
  const lastSentWarnRef = useRef<number>(0);    // cooldown untuk WARNING (browser only)
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
        let linkedFloors: LinkedFloor[] = [];
        if (Array.isArray(safeData.linked_floors)) {
          linkedFloors = safeData.linked_floors as LinkedFloor[];
        }
        configRef.current = {
          bot_token: safeData.bot_token ?? "",
          chat_id: safeData.chat_id ?? "",
          threshold: Number(safeData.threshold) || 35,
          humidity_threshold: Number(safeData.humidity_threshold) || 80,
          cooldown_seconds: safeData.cooldown_seconds !== undefined ? Number(safeData.cooldown_seconds) : 60,
          enabled: safeData.enabled ?? false,
          linked_floors: linkedFloors,
        };
      }
    };
    void loadConfig();
    const interval = window.setInterval(() => void loadConfig(), 30_000);
    return () => window.clearInterval(interval);
  }, []);

  // Cek suhu & kirim notif
  useEffect(() => {
    const checkAllSensors = async () => {
      const config = configRef.current;
      if (!config || !config.enabled) return;

      const now = Date.now();
      const cooldownMs = config.cooldown_seconds * 1000;
      const warnCooldownMs = cooldownMs * 2; // warning lebih jarang, 2x cooldown

      let readings: SensorReading[] = [];
      if (config.linked_floors.length > 0) {
        readings = await fetchAllSensorReadings(config.linked_floors);
      } else if (suhuSaatIni > 0) {
        readings = [{ temperature: suhuSaatIni, humidity: 0, locationName, floorId: "-" }];
      }
      if (readings.length === 0) return;

      const avgTemp = readings.reduce((s, r) => s + r.temperature, 0) / readings.length;
      const avgHum = readings.reduce((s, r) => s + r.humidity, 0) / readings.length;

      // Sensor yang MELEWATI batas (OVERHEAT)
      const hotSensors = readings.filter((r) => r.temperature > config.threshold);
      const humidSensors = readings.filter((r) => r.humidity > config.humidity_threshold);

      // Sensor yang MENDEKATI batas tapi belum lewat (WARNING — 90% threshold)
      const warnTempSensors = readings.filter(
        (r) => r.temperature > config.threshold * 0.9 && r.temperature <= config.threshold
      );
      const warnHumSensors = readings.filter(
        (r) => r.humidity > config.humidity_threshold * 0.9 && r.humidity <= config.humidity_threshold
      );

      const isOverheat = hotSensors.length > 0 || humidSensors.length > 0;
      const isWarning = warnTempSensors.length > 0 || warnHumSensors.length > 0;

      const waktu = new Date().toLocaleString("id-ID", { dateStyle: "short", timeStyle: "medium" });

      // === OVERHEAT: Telegram + Browser notification ===
      if (isOverheat && now - lastSentAlertRef.current >= cooldownMs) {
        lastSentAlertRef.current = now;

        let pesanTelegram =
          `🚨 *MOSU Alert — ${hotSensors.length > 0 && humidSensors.length > 0 ? "Suhu & Kelembapan Tinggi" : hotSensors.length > 0 ? "Suhu Tinggi" : "Kelembapan Tinggi"}!*\n\n` +
          `📊 *Rata-rata:* ${avgTemp.toFixed(1)}°C | ${avgHum.toFixed(1)}%\n` +
          `⚠️ *Batas:* Suhu ${config.threshold}°C | Kelembapan ${config.humidity_threshold}%\n` +
          `🕐 *Waktu:* ${waktu}\n\n`;

        if (hotSensors.length > 0) {
          pesanTelegram += `🔥 *Lantai suhu tinggi:*\n`;
          for (const r of hotSensors) {
            pesanTelegram += `  • ${r.locationName} – ${r.floorId}: *${r.temperature.toFixed(1)}°C*\n`;
          }
          pesanTelegram += "\n";
        }
        if (humidSensors.length > 0) {
          pesanTelegram += `💧 *Lantai kelembapan tinggi:*\n`;
          for (const r of humidSensors) {
            pesanTelegram += `  • ${r.locationName} – ${r.floorId}: *${r.humidity.toFixed(1)}%*\n`;
          }
          pesanTelegram += "\n";
        }
        pesanTelegram += `Segera cek kondisi ruangan!`;

        // Browser notif — OVERHEAT
        showBrowserNotif(
          "🚨 MOSU Alert — Batas Terlampaui!",
          `Rata-rata: ${avgTemp.toFixed(1)}°C | ${avgHum.toFixed(1)}%` +
          (hotSensors.length > 0 ? ` | 🔥 ${hotSensors.length} lantai panas` : "") +
          (humidSensors.length > 0 ? ` | 💧 ${humidSensors.length} lantai lembap` : ""),
          "mosu-alert-overheat"
        );

        // Telegram
        if (config.bot_token && config.chat_id) {
          sendTelegram(config.bot_token, config.chat_id, pesanTelegram).catch(() => {});
        }
      }

      // === WARNING: Browser notification saja (tidak kirim Telegram) ===
      else if (isWarning && !isOverheat && now - lastSentWarnRef.current >= warnCooldownMs) {
        lastSentWarnRef.current = now;

        const warnLines: string[] = [];
        for (const r of warnTempSensors) {
          warnLines.push(`${r.locationName} – ${r.floorId}: ${r.temperature.toFixed(1)}°C`);
        }
        for (const r of warnHumSensors) {
          warnLines.push(`${r.locationName} – ${r.floorId}: ${r.humidity.toFixed(1)}%`);
        }

        // Browser notif — WARNING
        showBrowserNotif(
          "⚠️ MOSU Warning — Suhu Mendekati Batas",
          warnLines.join(" | ") + ` | Batas: ${config.threshold}°C`,
          "mosu-alert-warning"
        );
      }
    };

    void checkAllSensors();
    const interval = window.setInterval(() => void checkAllSensors(), 60_000);
    return () => window.clearInterval(interval);
  }, [suhuSaatIni, locationName]);
}