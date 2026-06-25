import { useRef, useState } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster } from "sonner";
import LoadingScreen from "@/components/LoadingScreen";
import SiteLock from "@/components/Sitelock";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";
import { usePelacakanPengunjung } from "@/hooks/usePelacakanPengunjung";

const App = () => {
  const [unlocked, setUnlocked] = useState(
    () => sessionStorage.getItem("mosu_site_unlocked") === "1"
  );
  const [loading, setLoading] = useState(true);
  const loadingStartedAt = useRef(Date.now());

  const handleLoadingFinish = () => {
    const elapsed = Date.now() - loadingStartedAt.current;
    const remaining = Math.max(0, 1200 - elapsed);
    window.setTimeout(() => setLoading(false), remaining);
  };

  usePelacakanPengunjung();

  if (!unlocked) {
    return <SiteLock onSuccess={() => setUnlocked(true)} />;
  }

  if (loading) {
    return <LoadingScreen onFinish={handleLoadingFinish} />;
  }

  return (
    <>
      <Toaster style={{ zIndex: 9999, position: "fixed" }} />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </>
  );
};

export default App;