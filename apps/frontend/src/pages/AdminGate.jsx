import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { fetchAdminSession } from "../services/api";

export const AdminGate = ({ children }) => {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let active = true;
    fetchAdminSession().then((session) => {
      if (!active) return;
      if (!session.allowed) navigate("/", { replace: true });
      else if (!session.authenticated) navigate("/admin/login", { replace: true });
      else setReady(true);
    }).catch(() => navigate("/", { replace: true }));
    return () => { active = false; };
  }, [navigate]);
  if (!ready) return <div className="min-h-[55vh] grid place-items-center"><Loader2 className="h-7 w-7 animate-spin text-brand-violet" /></div>;
  return children;
};
