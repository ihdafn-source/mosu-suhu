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

async function sendTelegram(botToken: string, chatId: string, pesan: string) {
  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text: pesan, parse_mode: "Markdown" }),
  }).catch(() => {});
}

// Webhook ini didaftarkan ke Telegram lewat setWebhook (lihat skrip setup).
// Tiap kali ada orang baru chat bot (terutama /start), Telegram akan
// nge-hit endpoint ini. Pesan apapun dari chat_id yang belum terdaftar
// otomatis didaftarkan sebagai "pending" — menunggu approval admin di
// Panel Admin. Kalau chat_id sudah pernah terdaftar (pending/approved/
// rejected), cukup dibalas status terkininya, tidak didaftarkan ulang.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(JSON.stringify({ error: "Supabase env not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: config } = await supabase
      .from("telegram_alert_config")
      .select("bot_token")
      .eq("id", 1)
      .single();

    const botToken = config?.bot_token as string | undefined;

    const update = await req.json().catch(() => null);
    const message = update?.message;
    const chatId = message?.chat?.id ? String(message.chat.id) : null;

    if (!chatId) {
      // Bukan pesan teks biasa (misal edited_message dll) — abaikan saja.
      return new Response(JSON.stringify({ ok: true, skipped: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const firstName = message?.chat?.first_name ?? message?.from?.first_name ?? null;
    const username = message?.chat?.username ?? message?.from?.username ?? null;

    const { data: existing } = await supabase
      .from("telegram_subscribers")
      .select("status")
      .eq("chat_id", chatId)
      .maybeSingle();

    if (!existing) {
      await supabase.from("telegram_subscribers").insert({
        chat_id: chatId,
        first_name: firstName,
        username,
        status: "pending",
      });

      if (botToken) {
        await sendTelegram(
          botToken,
          chatId,
          `👋 Halo${firstName ? " " + firstName : ""}!\n\n` +
            `Permintaanmu untuk menerima notifikasi *MOSU Alert* sudah dikirim ke admin.\n` +
            `Kamu akan dapat pesan begitu admin menyetujui (approve) permintaan ini.`
        );
      }
    } else if (botToken) {
      const pesanStatus =
        existing.status === "approved"
          ? "✅ Kamu sudah terdaftar dan akan menerima notifikasi MOSU Alert."
          : existing.status === "rejected"
          ? "❌ Permintaanmu sebelumnya ditolak admin. Hubungi admin jika ini keliru."
          : "⏳ Permintaanmu masih menunggu approval admin.";
      await sendTelegram(botToken, chatId, pesanStatus);
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Internal error", detail: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});