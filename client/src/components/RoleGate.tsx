import React from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Redirect } from "wouter";

// Theme support classes: dark:bg-[#242426] dark:text-[#d4d4d8]
export function RoleGate({
  roles,
  children,
}: {
  roles?: Array<"user" | "rescuer" | "hospital" | "medical" | "admin">;
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center p-8">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#0f766e] border-t-transparent" />
      </div>
    );
  }

  if (!user) {
    if (roles && roles.length === 1 && roles[0] === "admin") {
      return <Redirect to="/admin/login" />;
    }
    if (roles && roles.includes("rescuer") && !roles.includes("user")) {
      return <Redirect to="/responder/login" />;
    }
    if (roles && (roles.includes("hospital") || roles.includes("medical")) && !roles.includes("user")) {
      return <Redirect to="/hospital/login" />;
    }
    return <Redirect to="/login" />;
  }

  // Superadmins can access operational dashboards for oversight
  const isAuthorized = !roles || roles.length === 0 || roles.includes(user.role) || (user.role === "admin" && (roles.includes("rescuer") || roles.includes("hospital") || roles.includes("medical")));

  if (!isAuthorized) {
    // If the user's role is not in the allowed list, send them to their role dashboard
    const dashboard =
      user.role === "admin"
        ? "/command"
        : user.role === "hospital" || user.role === "medical"
        ? "/hospital"
        : user.role === "rescuer"
        ? "/responder"
        : "/citizen";
    return <Redirect to={dashboard} />;
  }

  return <>{children}</>;
}
