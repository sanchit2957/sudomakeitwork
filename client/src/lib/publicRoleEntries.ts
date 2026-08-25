import { Activity, Ambulance, Radio, Siren } from "lucide-react";

export const publicRoleEntries = [
  { title: "SOS", caption: "I need help", path: "/emergency", icon: Siren, tone: "bg-[#c94b45] text-white" },
  { title: "Track", caption: "My request", path: "/track", icon: Activity, tone: "bg-white text-[#174e46] border" },
  { title: "Rescue", caption: "Field team", path: "/responder", icon: Ambulance, tone: "bg-white text-[#174e46] border" },
  { title: "Command", caption: "Coordinate", path: "/command", icon: Radio, tone: "bg-white text-[#174e46] border" },
] as const;
