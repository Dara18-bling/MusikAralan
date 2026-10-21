import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Login } from "./app/Login";
import { Dashboard } from "./app/Dashboard";
import { ResetPassword } from "./app/ResetPassword";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/:role/*" element={<Dashboard />} />
      </Routes>
    </BrowserRouter>
  );
}