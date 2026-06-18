import React from "react";
import { Routes, Route } from "react-router-dom";
import { TopNav } from "./components/TopNav";
import { Toaster } from "./components/toast";
import { useAsync } from "./lib/hooks";
import { api } from "./lib/api";
import type { Market } from "./lib/types";

import CommandCenter from "./pages/CommandCenter";
import DemandSupply from "./pages/DemandSupply";
import ReqPlanner from "./pages/ReqPlanner";
import Retention from "./pages/Retention";
import ActionCenter from "./pages/ActionCenter";
import MarketReadiness from "./pages/MarketReadiness";
import StartReadiness from "./pages/StartReadiness";
import DemandHandoffs from "./pages/DemandHandoffs";
import LeadershipDecisions from "./pages/LeadershipDecisions";
import ScenarioLab from "./pages/ScenarioLab";
import DataHealth from "./pages/DataHealth";
import OperatingRules from "./pages/OperatingRules";

export default function App() {
  const { data: markets } = useAsync<Market[]>(() => api.markets(), []);
  const list = markets || [];

  return (
    <div className="app-bg flex min-h-screen flex-col text-ink">
      <TopNav markets={list} />
      <main className="flex-1">
        <div className="mx-auto w-full max-w-[1480px] px-4 py-5 sm:px-6 sm:py-6">
          <Routes>
            <Route path="/" element={<ReqPlanner />} />
            <Route path="/overview" element={<CommandCenter />} />
            <Route path="/action-center" element={<ActionCenter />} />
            <Route path="/retention" element={<Retention />} />
            <Route path="/demand-supply" element={<DemandSupply />} />
            <Route path="/market-readiness" element={<MarketReadiness />} />
            <Route path="/start-readiness" element={<StartReadiness />} />
            <Route path="/demand-handoffs" element={<DemandHandoffs />} />
            <Route path="/leadership-decisions" element={<LeadershipDecisions />} />
            <Route path="/scenario-lab" element={<ScenarioLab />} />
            <Route path="/data-health" element={<DataHealth />} />
            <Route path="/operating-rules" element={<OperatingRules />} />
          </Routes>
        </div>
      </main>
      <Toaster />
    </div>
  );
}
