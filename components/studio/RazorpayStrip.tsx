/**
 * "Secured by Razorpay" — shown beside our own pay buttons.
 *
 * Most of the people paying ₹49 have never paid a website they found the
 * same day. The name they recognise from every other checkout (Zomato, Swiggy,
 * IRCTC) does more for trust than anything we can write. Mark from Razorpay's
 * logo (via simple-icons), in their blue and navy.
 */
export function RazorpayStrip({ className = "" }: { className?: string }) {
  return (
    <div className={`flex flex-col items-center gap-1 rounded-xl border border-[#dbe8ff] bg-[#f5f9ff] px-3 py-2.5 ${className}`}>
      <div className="flex items-center gap-1.5 text-[0.78rem] text-[#072654]">
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
          <rect x="3" y="7" width="10" height="7" rx="1.5" />
          <path d="M5.5 7V5a2.5 2.5 0 015 0v2" />
        </svg>
        <span>Secured by</span>
        <span className="flex items-center gap-1" aria-label="Razorpay">
          <svg viewBox="0 0 24 24" className="h-[15px] w-[15px]" fill="#3395FF" aria-hidden>
            <path d="M22.436 0l-11.91 7.773-1.174 4.276 6.625-4.297L11.65 24h4.391l6.395-24zM14.26 10.098L3.389 17.166 1.564 24h9.008l3.688-13.902Z" />
          </svg>
          <span className="text-[0.95rem] font-bold italic tracking-[-0.02em] text-[#072654]">Razorpay</span>
        </span>
      </div>
      <p className="text-[0.7rem] text-[#5b6b85]">UPI · Cards · Netbanking · Wallets</p>
    </div>
  );
}
