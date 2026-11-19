export default function SplashScreen({ leaving = false }) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Loading SwineSync"
      className={`fixed inset-0 z-[100] flex items-center justify-center bg-[#eef2f6] px-4 transition-opacity duration-300 ease-out motion-reduce:transition-none ${
        leaving ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      <div className="flex items-center gap-4 animate-pulse motion-reduce:animate-none">
        <div className="flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-emerald-700 text-white font-extrabold text-2xl sm:text-3xl shadow-md shrink-0">
          S
        </div>
        <div className="flex flex-col leading-tight text-left">
          <span className="font-black font-display text-3xl sm:text-4xl tracking-tight text-slate-900">
            Swine<span className="text-emerald-700">Sync</span>
          </span>
          <span className="text-xs sm:text-sm font-semibold text-slate-600">
            for Ambo &amp; Ang&apos;s Oink Yard
          </span>
        </div>
      </div>
    </div>
  );
}
