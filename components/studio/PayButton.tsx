"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * The button that opens Razorpay.
 *
 * ------------------------------------------------------- what it does not do
 *
 * It does not grant anything. The handler below fires when the sheet closes
 * successfully, and all it does is tell the person what is happening and ask
 * the page to re-read itself. The plan is granted by the webhook, server to
 * server, because a browser saying "I paid" is not evidence and a tab closed
 * a second early would otherwise lose somebody the month they just bought.
 *
 * It also sends no amount and no plan id. Both come from the server, which is
 * the difference between a checkout and a suggestion.
 *
 * ------------------------------------------------------------- the waiting
 *
 * There is a real gap between the sheet closing and the webhook landing —
 * usually a second or two, occasionally longer. Rather than pretend it is
 * instant, the button says it is activating and refreshes a few times. If it
 * is still not through after that, the page says so rather than spinning
 * forever; the money is taken and the webhook will arrive.
 */

type Phase = "idle" | "opening" | "waiting" | "failed";

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

const CHECKOUT_SRC = "https://checkout.razorpay.com/v1/checkout.js";

function loadCheckout(): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  if (window.Razorpay) return Promise.resolve(true);

  return new Promise((resolve) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${CHECKOUT_SRC}"]`,
    );
    if (existing) {
      existing.addEventListener("load", () => resolve(true), { once: true });
      existing.addEventListener("error", () => resolve(false), { once: true });
      return;
    }
    const el = document.createElement("script");
    el.src = CHECKOUT_SRC;
    el.async = true;
    el.onload = () => resolve(true);
    el.onerror = () => resolve(false);
    document.body.appendChild(el);
  });
}

export function PayButton({
  label,
  name,
  email,
  contact,
}: {
  label: string;
  name: string | null;
  email: string | null;
  contact: string | null;
}) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    const ids = timers.current;
    return () => ids.forEach((id) => window.clearTimeout(id));
  }, []);

  async function start() {
    setError(null);
    setPhase("opening");

    const ready = await loadCheckout();
    if (!ready || !window.Razorpay) {
      setPhase("failed");
      setError("Could not reach the payment window. Check your connection and try again.");
      return;
    }

    let data: { ok?: boolean; subscriptionId?: string; keyId?: string; error?: string };
    try {
      const res = await fetch("/api/app/billing/subscribe", { method: "POST" });
      data = await res.json();
    } catch {
      setPhase("failed");
      setError("Could not start the payment. Try again in a moment.");
      return;
    }

    if (!data.ok || !data.subscriptionId || !data.keyId) {
      setPhase("failed");
      setError(data.error ?? "Could not start the payment.");
      return;
    }

    const rzp = new window.Razorpay({
      key: data.keyId,
      subscription_id: data.subscriptionId,
      name: "Cheatcode",
      description: "Pro — ₹99 a month",
      prefill: {
        name: name ?? undefined,
        email: email ?? undefined,
        contact: contact ?? undefined,
      },
      theme: { color: "#161616" },
      handler: () => {
        setPhase("waiting");
        // The webhook is what grants the plan. These are just looks at the
        // page while it lands.
        [1500, 4000, 8000].forEach((ms) => {
          timers.current.push(window.setTimeout(() => router.refresh(), ms));
        });
      },
      modal: {
        ondismiss: () => setPhase("idle"),
      },
    });

    rzp.open();
  }

  if (phase === "waiting") {
    return (
      <p className="text-[0.88rem] leading-relaxed text-ink-50">
        Payment received. Activating your plan — this page will update in a few
        seconds.
      </p>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={start}
        disabled={phase === "opening"}
        className="flex w-full max-w-[260px] items-center justify-center whitespace-nowrap rounded-full px-5 py-3 text-[0.9rem] font-bold text-[#1a1a1a] transition-opacity hover:opacity-90 disabled:opacity-60"
        style={{
          backgroundImage:
            "linear-gradient(135deg, rgb(180,173,173) 0%, rgb(245,245,245) 50%, rgb(163,163,163) 100%)",
        }}
      >
        {phase === "opening" ? "Opening…" : label}
      </button>

      {error && (
        <p className="mt-3 max-w-[46ch] text-[0.82rem] leading-relaxed text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
