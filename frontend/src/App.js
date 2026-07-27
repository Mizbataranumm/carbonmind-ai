import React from "react";
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
import AppLayout from "@/components/AppLayout";
import { UserProvider } from "@/lib/UserContext";

function App() {
  return (
    <UserProvider>
      <BrowserRouter>
        <div className="aurora" />
        <Toaster theme="dark" position="top-right" toastOptions={{ style: { background: "rgba(13,31,39,0.95)", border: "1px solid rgba(0,255,178,0.25)", color: "#fff" } }} />
        <AnimatePresence mode="wait">
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/auth" element={<Auth />} />
            <Route element={<AppLayout />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/tracker" element={<Tracker />} />
              <Route path="/predict" element={<Predict />} />
              <Route path="/future" element={<Future />} />
              <Route path="/scan" element={<Scan />} />
              <Route path="/certificate" element={<Certificate />} />
              <Route path="/community" element={<Community />} />
            </Route>
          </Routes>
        </AnimatePresence>
      </BrowserRouter>
    </UserProvider>
  );
}

export default App;
