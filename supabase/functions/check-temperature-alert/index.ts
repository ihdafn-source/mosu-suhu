// @ts-expect-error Supabase Edge Functions resolve URL imports at runtime (Deno).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.0";

declare const Deno: {
  serve: (handler: (req: Request) => Response | Promise<Response>) => void;
  env: {
    get: (key: string) => string | undefined;
  };
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get telegram config
    const { data: config, error: configErr } = await supabase
      .from("telegram_alert_config")
      .select("*")
      .eq("id", 1)
      .single();

    if (configErr || !config) {
      return new Response(
        JSON.stringify({ error: "No telegram config found" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!config.enabled || !config.chat_id || !config.bot_token) {
      return new Response(
        JSON.stringify({ skipped: true, reason: "Telegram alerts disabled or not configured" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check cooldown
    if (config.last_alert_at) {
      const lastAlert = new Date(config.last_alert_at).getTime();
      const cooldownMs = (config.cooldown_seconds || 60) * 1000;
      if (Date.now() - lastAlert < cooldownMs) {
        return new Response(
          JSON.stringify({ skipped: true, reason: "Cooldown active" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    const threshold = Number(config.threshold ?? 25);

    // Get latest readings from all locations
    const { data: locations } = await supabase
      .from("server_locations")
      .select("id, name")
      .is("deleted_at", null);

    if (!locations || locations.length === 0) {
      return new Response(
        JSON.stringify({ skipped: true, reason: "No locations" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const alerts: string[] = [];

    for (const loc of locations) {
      const { data: readings } = await supabase
        .from("temperature_logs")
        .select("temperature, humidity, floor_id, timestamp")
        .eq("location_id", loc.id)
        .order("timestamp", { ascending: false })
        .limit(5);

      if (readings) {
        for (const r of readings) {
          // Only check readings from last 2 minutes
          const age = Date.now() - new Date(r.timestamp).getTime();
          if (age > 120000) continue;

          if (r.temperature > threshold) {
            alerts.push(
              `🔥 *${loc.name}* - ${r.floor_id}\n` +
              `   Suhu: *${r.temperature}°C* (batas: ${threshold}°C)\n` +
              `   Kelembapan: ${r.humidity ?? "—"}%`
            );
          }
        }
      }
    }

    if (alerts.length === 0) {
      return new Response(
        JSON.stringify({ skipped: true, reason: "No alerts needed" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Send Telegram message
    const message =
      `⚠️ *MOSU ALERT: Suhu Tinggi!*\n\n` +
      alerts.join("\n\n") +
      `\n\n🕐 ${new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })}`;

    const telegramUrl = `https://api.telegram.org/bot${config.bot_token}/sendMessage`;
    const telegramRes = await fetch(telegramUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: config.chat_id,
        text: message,
        parse_mode: "Markdown",
      }),
    });

    const telegramData = await telegramRes.json();

    if (!telegramRes.ok) {
      return new Response(
        JSON.stringify({ error: "Telegram API failed", detail: telegramData }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update last alert time
    await supabase
      .from("telegram_alert_config")
      .update({ last_alert_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", 1);

    return new Response(
      JSON.stringify({ success: true, alerts_sent: alerts.length }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Internal error", detail: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
