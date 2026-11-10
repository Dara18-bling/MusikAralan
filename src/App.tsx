import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Login } from "./app/Login";
import { Dashboard } from "./app/Dashboard";
import { ForgotPassword } from "./app/ForgotPassword";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<Navigate to="/forgot-password" replace />} />
        <Route path="/:role/*" element={<Dashboard />} />
      </Routes>
    </BrowserRouter>
  );
}