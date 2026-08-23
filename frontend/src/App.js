import React, { useEffect } from "react";
import "@/App.css";
import "@/index.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { Toaster } from "sonner";

import Landing from "@/pages/Landing";
import Auth from "@/pages/Auth";
import Dashboard from "@/pages/Dashboard";
import Tracker from "@/pages/Tracker";
import Future from "@/pages/Future";
import Community from "@/pages/Community";
import Predict from "@/pages/Predict";
import Scan from "@/pages/Scan";
import Certificate from "@/pages/Certificate";
import Profile from "@/pages/Profile";
import Onboarding from "@/pages/Onboarding";
import EcoGame from "@/pages/EcoGame";
import Challenges from "@/pages/Challenges";
import AppLayout from "@/components/AppLayout";
import { UserProvider } from "@/lib/UserContext";

function App() {
  useEffect(() => {
    // Eagerly wake up the backend (Render free tier sleeps after 15 mins)
    const url = process.env.REACT_APP_BACKEND_URL;
    if (url) fetch(url).catch(() => {});
  }, []);

  return (
    <UserProvider>
      <BrowserRouter>
        <div className="aurora" />
        <Toaster theme="dark" position="bottom-right" toastOptions={{ style: { background: "rgba(13,31,39,0.95)", border: "1px solid rgba(0,255,178,0.25)", color: "#fff" } }} />
        <AnimatePresence mode="wait">
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/onboarding" element={<Onboarding />} />
            <Route element={<AppLayout />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/tracker" element={<Tracker />} />
              <Route path="/predict" element={<Predict />} />
              <Route path="/future" element={<Future />} />
              <Route path="/scan" element={<Scan />} />
              <Route path="/certificate" element={<Certificate />} />
              <Route path="/challenges" element={<Challenges />} />
              <Route path="/community" element={<Community />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/game" element={<EcoGame />} />
            </Route>
          </Routes>
        </AnimatePresence>
      </BrowserRouter>
    </UserProvider>
  );
}

export default App;
