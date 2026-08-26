import React from "react";
import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";

// Theme support classes: dark:bg-[#242426] dark:text-[#d4d4d8]
export function RoleGate({
  roles,
  children,
}: {
  roles?: Array<"user" | "rescuer" | "medical" | "admin">;
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();
  const destination = user?.role === "admin" ? "/command" : user?.role === "rescuer" ? "/responder" : user?.role === "medical" ? "/medical" : "/";

  useEffect(() => {
    if (!loading && !user) setLocation(`/login?redirect=${encodeURIComponent(window.location.pathname)}`);
    else if (!loading && user && roles && !roles.includes(user.role)) setLocation(destination);
  }, [destination, loading, roles, setLocation, user]);

  if (loading || !user || (roles && !roles.includes(user.role))) return null;
  return <>{children}</>;
}
