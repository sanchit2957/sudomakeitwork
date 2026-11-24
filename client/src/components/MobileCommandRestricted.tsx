import React from "react";
import { DesktopOnlyGate } from "./DesktopOnlyGate";

export default function MobileCommandRestricted() {
  return (
    <DesktopOnlyGate
      portalName="State Emergency Command Centre"
      portalType="admin"
    />
  );
}
