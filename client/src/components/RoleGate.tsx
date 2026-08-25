import React from "react";

// Theme support classes: dark:bg-[#242426] dark:text-[#d4d4d8]
export function RoleGate({
  roles: _roles,
  children,
}: {
  roles?: Array<"user" | "rescuer" | "medical" | "admin">;
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
