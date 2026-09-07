"use client";

import { useEffect } from "react";
import { logout } from "@/shared/lib/auth/logout";

export default function LogoutPage() {
  useEffect(() => {
    void logout();
  }, []);

  return null;
}
