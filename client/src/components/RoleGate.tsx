import React from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Redirect } from "wouter";

// Theme support classes: dark:bg-[#242426] dark:text-[#d4d4d8]
export function RoleGate({
  roles,
  children,
}: {
  roles?: Array<"user" | "rescuer" | "medical" | "admin">;
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
    return <Redirect to="/login" />;
  }

  if (roles && roles.length > 0 && !roles.includes(user.role)) {
    // If the user's role is not in the allowed list, send them to their role dashboard
    const dashboard = user.role === "admin" ? "/command" : user.role === "medical" ? "/medical" : user.role === "rescuer" ? "/responder" : "/";
    return <Redirect to={dashboard} />;
  }

  return <>{children}</>;
}
