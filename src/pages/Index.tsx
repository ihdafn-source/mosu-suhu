import { Suspense, lazy, useState } from "react";
import { AnimatePresence } from "framer-motion";
import LoadingScreen from "@/components/LoadingScreen";
import { usePelacakanPengunjung } from "@/hooks/usePelacakanPengunjung";

const Dashboard = lazy(() => import("@/pages/Dashboard"));
const AdminPanel = lazy(() => import("@/components/admin/AdminPanel"));

const Index = () => {
  const [loading, setLoading] = useState(true);
  const [showAdmin, setShowAdmin] = useState(false);

  usePelacakanPengunjung();

  return (
    <>
      <AnimatePresence>
        {loading && <LoadingScreen onFinish={() => setLoading(false)} />}
      </AnimatePresence>
      {!loading && (
        <div className="min-h-screen bg-background">
          <Suspense
            fallback={
              <div className="flex min-h-screen items-center justify-center text-muted-foreground font-body text-sm">
                Memuat tampilan...
              </div>
            }
          >
            {showAdmin ? (
              <AdminPanel onBack={() => setShowAdmin(false)} />
            ) : (
              <Dashboard onLogoClick={() => setShowAdmin(true)} />
            )}
          </Suspense>
        </div>
      )}
    </>
  );
};

export default Index;