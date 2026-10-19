import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Login } from "./app/Login";
import { Dashboard } from "./app/Dashboard";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/:role/*" element={<Dashboard />} />
      </Routes>
    </BrowserRouter>
  );
}