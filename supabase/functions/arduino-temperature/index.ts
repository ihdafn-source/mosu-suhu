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

type RawPayload = Record<string, unknown>;

function toNumber(value: unknown): number {
	if (typeof value === "number") return value;
	if (typeof value === "string") {
		const normalized = value.trim().replace(",", ".");
		return Number(normalized);
	}
	return Number(value);
}

function toBoolean(value: unknown, fallback: boolean): boolean {
	if (typeof value === "boolean") return value;
	if (typeof value === "number") return value !== 0;
	if (typeof value === "string") {
		const normalized = value.trim().toLowerCase();
		if (["false", "0", "no", "off"].includes(normalized)) return false;
		if (["true", "1", "yes", "on"].includes(normalized)) return true;
	}
	return fallback;
}

async function parsePayload(req: Request): Promise<RawPayload | null> {
	if (req.method === "GET") {
		const url = new URL(req.url);
		return Object.fromEntries(url.searchParams.entries());
	}

	const contentType = req.headers.get("content-type")?.toLowerCase() ?? "";

	if (contentType.includes("application/json")) {
		return await req.json().catch(() => null) as RawPayload | null;
	}

	if (contentType.includes("application/x-www-form-urlencoded")) {
		const text = await req.text().catch(() => "");
		const params = new URLSearchParams(text);
		return Object.fromEntries(params.entries());
	}

	const rawText = await req.text().catch(() => "");
	if (!rawText.trim()) {
		return null;
	}

	try {
		return JSON.parse(rawText) as RawPayload;
	} catch {
		return null;
	}
}

function readString(payload: RawPayload, keys: string[]): string {
	for (const key of keys) {
		const value = payload[key];
		if (value === undefined || value === null) continue;
		const text = String(value).trim();
		if (text) return text;
	}
	return "";
}

function readNumber(payload: RawPayload, keys: string[]): number {
	for (const key of keys) {
		const value = payload[key];
		if (value === undefined || value === null || String(value).trim() === "") continue;
		const numberValue = toNumber(value);
		if (Number.isFinite(numberValue)) return numberValue;
	}
	return Number.NaN;
}

Deno.serve(async (req) => {
	if (req.method === "OPTIONS") {
		return new Response("ok", { headers: corsHeaders });
	}

	if (req.method !== "POST" && req.method !== "GET") {
		return new Response(
			JSON.stringify({ error: "Method not allowed", allowed_methods: ["POST", "GET"] }),
			{ status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
		);
	}

	try {
		const supabaseUrl = Deno.env.get("SUPABASE_URL");
		const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

		if (!supabaseUrl || !serviceRoleKey) {
			return new Response(
				JSON.stringify({ error: "Supabase environment variables are not configured" }),
				{ status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
			);
		}

		const supabase = createClient(supabaseUrl, serviceRoleKey);

		const payload = await parsePayload(req);

		if (!payload) {
			return new Response(
				JSON.stringify({
					error: "Invalid payload",
					detail: "Body harus JSON atau form-urlencoded.",
				}),
				{ status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
			);
		}

		const apiKey = readString(payload, ["api_key", "apiKey", "apikey", "key"]);
		const requestedFloor = readString(payload, ["floor", "floor_id", "lantai", "lantai_id"]);
		const temperature = readNumber(payload, ["temperature", "temp", "suhu"]);
		const humidity = readNumber(payload, ["humidity", "hum", "kelembapan", "kelembaban"]);
		const triggerAlert = toBoolean(payload["trigger_alert"] ?? payload["triggerAlert"], true);

		if (!apiKey || !requestedFloor || !Number.isFinite(temperature) || !Number.isFinite(humidity)) {
			return new Response(
				JSON.stringify({
					error: "Invalid payload",
					required_fields: ["api_key", "floor", "temperature", "humidity"],
					received_keys: Object.keys(payload),
				}),
				{ status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
			);
		}

		const { data: location, error: locationError } = await supabase
			.from("server_locations")
			.select("id, name, floors")
			.eq("api_key", apiKey)
			.is("deleted_at", null)
			.single();

		if (locationError || !location) {
			return new Response(
				JSON.stringify({ error: "API key not found" }),
				{ status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
			);
		}

		const floors = Array.isArray(location.floors) ? location.floors.map((item: unknown) => String(item).trim()).filter(Boolean) : [];
		const normalize = (value: string) => value.trim().toLowerCase();
		const matchedFloor = floors.find((item: string) => normalize(item) === normalize(requestedFloor));
		const floor = matchedFloor ?? requestedFloor;

		if (floors.length > 0 && !matchedFloor) {
			return new Response(
				JSON.stringify({ error: "Floor not found for this location", floors }),
				{ status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
			);
		}

		const timestamp = new Date().toISOString();
		const reading = {
			id: crypto.randomUUID(),
			timestamp,
			temperature,
			humidity,
			location_id: location.id,
			floor_id: floor,
			created_at: timestamp,
		};

		const { error: insertError } = await supabase.from("temperature_logs").insert(reading);

		if (insertError) {
			return new Response(
				JSON.stringify({ error: "Failed to save temperature reading", detail: insertError.message }),
				{ status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
			);
		}

		let alertTriggered = false;

		if (triggerAlert) {
			const alertResponse = await fetch(`${supabaseUrl}/functions/v1/check-temperature-alert`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({}),
			}).catch(() => null);

			alertTriggered = Boolean(alertResponse?.ok);
		}

		return new Response(
			JSON.stringify({
				success: true,
				location_id: location.id,
				floor_id: floor,
				temperature,
				humidity,
				alert_triggered: alertTriggered,
			}),
			{ status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
		);
	} catch (err) {
		return new Response(
			JSON.stringify({ error: "Internal error", detail: String(err) }),
			{ status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
		);
	}
});
