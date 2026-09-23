import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { fetchAdminSession } from "../services/api";

export const AdminGate = ({ children }) => {
  const navigate = useNavigate();
  const [session, setSession] = useState(null);
  useEffect(() => {
    let active = true;
    fetchAdminSession().then((session) => {
      if (!active) return;
      if (!session.allowed) navigate("/", { replace: true });
      else if (!session.authenticated) navigate("/admin/login", { replace: true });
      else setSession(session);
    }).catch(() => navigate("/", { replace: true }));
    return () => { active = false; };
  }, [navigate]);
  if (!session) return <div className="min-h-[55vh] grid place-items-center"><Loader2 className="h-7 w-7 animate-spin text-brand-violet" /></div>;
  return React.isValidElement(children) ? React.cloneElement(children, { adminSession: session }) : children;
};
