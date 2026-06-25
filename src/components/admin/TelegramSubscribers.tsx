import { useEffect, useState } from "react";
import { supabase } from "../../integrations/supabase/client";
import { toast } from "sonner";
import { Check, X, Users, Clock, UserCheck, UserX, RefreshCw } from "lucide-react";

type SubscriberStatus = "pending" | "approved" | "rejected";

interface Subscriber {
  id: string;
  chat_id: string;
  first_name: string | null;
  username: string | null;
  status: SubscriberStatus;
  created_at: string;
}

function namaTampil(s: Subscriber) {
  if (s.first_name && s.username) return `${s.first_name} (@${s.username})`;
  if (s.first_name) return s.first_name;
  if (s.username) return `@${s.username}`;
  return s.chat_id;
}

function formatWaktu(ts: string) {
  return new Date(ts).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
}

const TelegramSubscribers = () => {
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadSubscribers = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("telegram_subscribers")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      toast.error("Gagal memuat daftar subscriber: " + error.message);
    } else {
      setSubscribers((data ?? []) as Subscriber[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    void loadSubscribers();
    const interval = window.setInterval(() => void loadSubscribers(), 15_000);
    return () => window.clearInterval(interval);
  }, []);

  const updateStatus = async (sub: Subscriber, status: "approved" | "rejected") => {
    setBusyId(sub.id);
    const { error } = await supabase
      .from("telegram_subscribers")
      .update({ status, decided_at: new Date().toISOString() })
      .eq("id", sub.id);
    setBusyId(null);

    if (error) {
      toast.error("Gagal memperbarui status: " + error.message);
      return;
    }

    toast.success(
      status === "approved"
        ? `${namaTampil(sub)} disetujui — akan menerima notifikasi suhu.`
        : `${namaTampil(sub)} ditolak.`
    );
    setSubscribers((prev) => prev.map((s) => (s.id === sub.id ? { ...s, status } : s)));
  };

  const pending = subscribers.filter((s) => s.status === "pending");
  const approved = subscribers.filter((s) => s.status === "approved");
  const rejected = subscribers.filter((s) => s.status === "rejected");

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 mb-2">
        <Users className="w-5 h-5 text-primary" />
        <h3 className="font-display text-lg font-bold text-foreground">Subscriber Telegram</h3>
        <button
          type="button"
          onClick={() => void loadSubscribers()}
          className="ml-auto p-1.5 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition"
          title="Muat ulang"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      <p className="font-body text-sm text-muted-foreground">
        Orang yang chat bot Telegram (klik <strong>Start</strong>) akan muncul di sini sebagai{" "}
        <strong>Menunggu</strong>. Setujui untuk mulai mengirim notifikasi suhu ke mereka.
      </p>

      {/* Menunggu approval */}
      <div className="border border-amber-300/60 rounded-xl p-4 bg-amber-50 dark:bg-amber-950/20 space-y-3">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          <h4 className="font-body text-sm font-semibold text-foreground">Menunggu Approval</h4>
          <span className="ml-auto text-xs font-data text-muted-foreground">{pending.length}</span>
        </div>
        {pending.length === 0 ? (
          <p className="text-xs text-muted-foreground font-body py-1">Tidak ada permintaan baru.</p>
        ) : (
          <div className="space-y-1.5">
            {pending.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-background border border-border"
              >
                <div className="min-w-0">
                  <p className="font-body text-sm text-foreground font-medium truncate">{namaTampil(s)}</p>
                  <p className="text-xs text-muted-foreground font-data">
                    {s.chat_id} · {formatWaktu(s.created_at)}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    disabled={busyId === s.id}
                    onClick={() => void updateStatus(s, "approved")}
                    className="flex items-center gap-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 px-2.5 py-1.5 text-xs font-semibold text-white transition"
                  >
                    <Check className="w-3.5 h-3.5" /> Setuju
                  </button>
                  <button
                    type="button"
                    disabled={busyId === s.id}
                    onClick={() => void updateStatus(s, "rejected")}
                    className="flex items-center gap-1 rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-50 px-2.5 py-1.5 text-xs font-semibold text-white transition"
                  >
                    <X className="w-3.5 h-3.5" /> Tolak
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Sudah disetujui */}
      <div className="border border-border rounded-xl p-4 bg-muted/30 space-y-3">
        <div className="flex items-center gap-2">
          <UserCheck className="w-4 h-4 text-emerald-600" />
          <h4 className="font-body text-sm font-semibold text-foreground">Disetujui (menerima notifikasi)</h4>
          <span className="ml-auto text-xs font-data text-muted-foreground">{approved.length}</span>
        </div>
        {approved.length === 0 ? (
          <p className="text-xs text-muted-foreground font-body py-1">Belum ada yang disetujui.</p>
        ) : (
          <div className="space-y-1.5">
            {approved.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-background border border-border"
              >
                <div className="min-w-0">
                  <p className="font-body text-sm text-foreground font-medium truncate">{namaTampil(s)}</p>
                  <p className="text-xs text-muted-foreground font-data">{s.chat_id}</p>
                </div>
                <button
                  type="button"
                  disabled={busyId === s.id}
                  onClick={() => void updateStatus(s, "rejected")}
                  className="shrink-0 flex items-center gap-1 rounded-lg border border-border hover:bg-muted disabled:opacity-50 px-2.5 py-1.5 text-xs font-semibold text-muted-foreground transition"
                >
                  <X className="w-3.5 h-3.5" /> Cabut akses
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Ditolak */}
      {rejected.length > 0 && (
        <div className="border border-border rounded-xl p-4 bg-muted/30 space-y-3">
          <div className="flex items-center gap-2">
            <UserX className="w-4 h-4 text-muted-foreground" />
            <h4 className="font-body text-sm font-semibold text-foreground">Ditolak</h4>
            <span className="ml-auto text-xs font-data text-muted-foreground">{rejected.length}</span>
          </div>
          <div className="space-y-1.5">
            {rejected.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-background border border-border"
              >
                <div className="min-w-0">
                  <p className="font-body text-sm text-foreground font-medium truncate">{namaTampil(s)}</p>
                  <p className="text-xs text-muted-foreground font-data">{s.chat_id}</p>
                </div>
                <button
                  type="button"
                  disabled={busyId === s.id}
                  onClick={() => void updateStatus(s, "approved")}
                  className="shrink-0 flex items-center gap-1 rounded-lg border border-border hover:bg-muted disabled:opacity-50 px-2.5 py-1.5 text-xs font-semibold text-muted-foreground transition"
                >
                  <Check className="w-3.5 h-3.5" /> Setuju
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default TelegramSubscribers;