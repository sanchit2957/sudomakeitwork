import { useEffect } from "react";
import { useLocation } from "wouter";

export default function Emergency() {
  const [, setLocation] = useLocation();
  useEffect(() => { setLocation("/"); }, [setLocation]);
  return <div className="min-h-screen bg-[#f6f8f7]" aria-live="polite" />;
}
