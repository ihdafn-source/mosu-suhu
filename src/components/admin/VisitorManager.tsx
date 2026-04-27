import { useState, useEffect } from "react";
import { Users, RefreshCw } from "lucide-react";
import { supabase } from "../../integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface VisitorLog {
  id: string;
  ip_address: string | null;
  device: string | null;
  browser: string | null;
  visited_at: string;
}

const VisitorManager = () => {
  const [logs, setLogs] = useState<VisitorLog[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLogs = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("visitor_logs")
      .select("*")
      .order("visited_at", { ascending: false })
      .limit(100);

    if (!error && data) {
      setLogs(data as unknown as VisitorLog[]);
    }
    setLoading(false);
  };

  useEffect(() => { fetchLogs(); }, []);

  const formatDate = (d: string) => {
    return new Date(d).toLocaleString("id-ID", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg font-bold text-foreground flex items-center gap-2">
          <Users className="w-5 h-5" /> Manajemen Pengguna
        </h3>
        <Button variant="outline" size="sm" onClick={fetchLogs} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="font-body text-xs w-12">#</TableHead>
                <TableHead className="font-body text-xs">IP Address</TableHead>
                <TableHead className="font-body text-xs">Device</TableHead>
                <TableHead className="font-body text-xs">Browser</TableHead>
                <TableHead className="font-body text-xs">Waktu Kunjungan</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground font-body text-sm py-8">
                    Memuat...
                  </TableCell>
                </TableRow>
              ) : logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground font-body text-sm py-8">
                    Belum ada data pengunjung.
                  </TableCell>
                </TableRow>
              ) : (
                logs.map((log, idx) => (
                  <TableRow key={log.id}>
                    <TableCell className="font-data text-xs text-muted-foreground">{idx + 1}</TableCell>
                    <TableCell className="font-data text-xs">{log.ip_address || "-"}</TableCell>
                    <TableCell className="font-data text-xs">{log.device || "-"}</TableCell>
                    <TableCell className="font-data text-xs">{log.browser || "-"}</TableCell>
                    <TableCell className="font-data text-xs">{formatDate(log.visited_at)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
      <p className="font-body text-xs text-muted-foreground">Menampilkan 100 kunjungan terakhir</p>
    </div>
  );
};

export default VisitorManager;