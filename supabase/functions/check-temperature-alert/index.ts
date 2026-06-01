// @ts-expect-error Supabase Edge Functions resolve URL imports at runtime (Deno)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.0";

declare const Deno: {
  serve: (handler: (req: Request) => Response | Promise<Response>) => void;
  env: { get: (key: string) => string | undefined };
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const THRESHOLD_PANAS    = 27;   // °C — kirim Telegram
const THRESHOLD_WASPADA  = 25;   // °C — kirim Telegram warning

async function sendTelegram(botToken: string, chatId: string, pesan: string) {
  const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text: pesan, parse_mode: "Markdown" }),
  });
  return res.ok;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl      = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey   = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(
        JSON.stringify({ error: "Supabase env not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // ── 1. Ambil config Telegram ────────────────────────────────────────────
    const { data: config, error: configError } = await supabase
      .from("telegram_alert_config")
      .select("*")
      .eq("id", 1)
      .single();

    if (configError || !config) {
      return new Response(
        JSON.stringify({ error: "Config not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!config.enabled) {
      return new Response(
        JSON.stringify({ skipped: true, reason: "Alert disabled" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!config.bot_token || !config.chat_id) {
      return new Response(
        JSON.stringify({ skipped: true, reason: "Bot token or chat_id not set" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── 2. Cek cooldown ─────────────────────────────────────────────────────
    const cooldownMs  = (Number(config.cooldown_seconds) || 60) * 1000;
    const lastAlertAt = config.last_alert_at ? new Date(config.last_alert_at).getTime() : 0;
    const now         = Date.now();

    if (now - lastAlertAt < cooldownMs) {
      return new Response(
        JSON.stringify({ skipped: true, reason: "Cooldown active", next_alert_in_seconds: Math.ceil((cooldownMs - (now - lastAlertAt)) / 1000) }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── 3. Ambil data sensor terbaru per lokasi+lantai ──────────────────────
    const { data: readings, error: readError } = await supabase
      .from("temperature_readings")
      .select("location_id, floor, temperature, humidity, recorded_at")
      .order("recorded_at", { ascending: false })
      .limit(500);

    if (readError || !readings) {
      return new Response(
        JSON.stringify({ error: "Failed to fetch readings" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── 4. Ambil 1 data terbaru per lokasi+lantai ───────────────────────────
    const latestMap = new Map<string, typeof readings[0]>();
    for (const r of readings) {
      const key = `${r.location_id}__${r.floor}`;
      if (!latestMap.has(key)) latestMap.set(key, r);
    }
    const latest = Array.from(latestMap.values());

    // Filter data yang tidak lebih dari 10 menit terakhir (sensor aktif)
    const cutoffMs = now - 10 * 60 * 1000;
    const activeReadings = latest.filter((r) =>
      new Date(r.recorded_at).getTime() >= cutoffMs
    );

    if (activeReadings.length === 0) {
      return new Response(
        JSON.stringify({ skipped: true, reason: "No active sensor data in last 10 minutes" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── 5. Ambil nama lokasi ────────────────────────────────────────────────
    const locationIds = [...new Set(activeReadings.map((r) => r.location_id))];
    const { data: locations } = await supabase
      .from("server_locations")
      .select("id, name")
      .in("id", locationIds);

    const locMap = new Map<string, string>(
      (locations ?? []).map((l: { id: string; name: string }) => [l.id, l.name])
    );

    // ── 6. Klasifikasi sensor ───────────────────────────────────────────────
    const sensorPanas    = activeReadings.filter((r) => r.temperature > THRESHOLD_PANAS);
    const sensorWaspada  = activeReadings.filter(
      (r) => r.temperature > THRESHOLD_WASPADA && r.temperature <= THRESHOLD_PANAS
    );

    const adaPanas   = sensorPanas.length > 0;
    const adaWaspada = sensorWaspada.length > 0;

    if (!adaPanas && !adaWaspada) {
      return new Response(
        JSON.stringify({ skipped: true, reason: "All sensors within safe range", checked: activeReadings.length }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── 7. Susun pesan Telegram ─────────────────────────────────────────────
    const waktu = new Date().toLocaleString("id-ID", {
      timeZone: "Asia/Jakarta",
      dateStyle: "short",
      timeStyle: "medium",
    });

    let pesan = "";

    if (adaPanas) {
      pesan += `🚨 *MOSU Alert — Suhu Melebihi Batas!*\n\n`;
      pesan += `⚠️ *Batas panas:* ${THRESHOLD_PANAS}°C\n`;
      pesan += `🕐 *Waktu:* ${waktu}\n\n`;
      pesan += `🔥 *Sensor yang panas:*\n`;
      for (const r of sensorPanas) {
        const namaLokasi = locMap.get(r.location_id) ?? r.location_id;
        pesan += `  • ${namaLokasi} – Lantai ${r.floor}: *${Number(r.temperature).toFixed(1)}°C* | ${Number(r.humidity).toFixed(1)}%\n`;
      }
      if (adaWaspada) {
        pesan += `\n🟡 *Sensor waspada:*\n`;
        for (const r of sensorWaspada) {
          const namaLokasi = locMap.get(r.location_id) ?? r.location_id;
          pesan += `  • ${namaLokasi} – Lantai ${r.floor}: ${Number(r.temperature).toFixed(1)}°C\n`;
        }
      }
      pesan += `\nSegera cek kondisi ruangan dan pendingin!`;
    } else {
      // Hanya waspada
      pesan += `⚠️ *MOSU Warning — Suhu Mendekati Batas*\n\n`;
      pesan += `🌡️ *Batas waspada:* ${THRESHOLD_WASPADA}°C | *Batas panas:* ${THRESHOLD_PANAS}°C\n`;
      pesan += `🕐 *Waktu:* ${waktu}\n\n`;
      pesan += `🟡 *Sensor mendekati batas:*\n`;
      for (const r of sensorWaspada) {
        const namaLokasi = locMap.get(r.location_id) ?? r.location_id;
        pesan += `  • ${namaLokasi} – Lantai ${r.floor}: *${Number(r.temperature).toFixed(1)}°C*\n`;
      }
      pesan += `\nPantau terus kondisi ruangan.`;
    }

    // ── 8. Kirim Telegram ───────────────────────────────────────────────────
    const terkirim = await sendTelegram(config.bot_token, config.chat_id, pesan);

    if (terkirim) {
      // Update last_alert_at di DB biar cooldown jalan
      await supabase
        .from("telegram_alert_config")
        .update({ last_alert_at: new Date().toISOString() })
        .eq("id", 1);
    }

    return new Response(
      JSON.stringify({
        success: true,
        alert_type: adaPanas ? "PANAS" : "WASPADA",
        sensors_panas: sensorPanas.length,
        sensors_waspada: sensorWaspada.length,
        telegram_sent: terkirim,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );

  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Internal error", detail: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});