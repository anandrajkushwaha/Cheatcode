"use client";

import { useRouter } from "next/navigation";

export function LogoutButton() {
  const router = useRouter();
  return (
    <button
      onClick={async () => {
        await fetch("/api/admin/login", { method: "DELETE" });
        router.replace("/admin-login");
        router.refresh();
      }}
      className="text-[0.8rem] text-ink-50 transition-colors hover:text-ink"
    >
      Sign out
    </button>
  );
}
