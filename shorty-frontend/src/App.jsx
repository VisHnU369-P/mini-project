import React from "react";
import { Routes, Route, Link } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import CodeStats from "./pages/CodeStats";

export default function App() {
  return (
    <div className="body-bg min-h-screen">
      <header className="p-6 bg-white shadow">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Link to="/"><h1 className="text-xl font-bold">Shorty</h1></Link>
          <div className="text-sm muted">React + Express + Postgres</div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-6">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/code/:code" element={<CodeStats />} />
        </Routes>
      </main>

      <footer className="max-w-4xl mx-auto p-6 text-center muted">
        Built for the coding test
      </footer>
    </div>
  );
}
