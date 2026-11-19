import { X, FileText } from 'lucide-react';
import useModalAnimation from '../hooks/useModalAnimation';

const TERMS_SECTIONS = [
  {
    title: '1. Availability, Weights, and Pricing',
    body: 'Headcounts, age ranges, and weight ranges shown on the public landing page of Ambo & Ang\'s Oink Yard are for general reference only. Actual availability, exact live weights, and final pricing are confirmed directly with the farm upon inquiry and on-site inspection.',
  },
  {
    title: '2. Communication Channels and Your Device',
    body: 'Clicking contact actions such as Call, Send SMS, Messenger/Facebook, or Open in Google Maps uses your own phone, desktop, or other device and its installed calling, messaging, browser, or third-party apps to connect you to our communication channels. SwineSync does not place calls or transmit messages on your behalf. Standard mobile carrier, SMS, or internet data charges and the terms of those third-party platforms apply.',
  },
  {
    title: '3. Farm Visits and Biosecurity Rules',
    body: 'On-site visits require prior scheduling and full compliance with our farm biosecurity protocols, including the 72-hour swine isolation rule, tire and foot-bath sanitation, and hand disinfection. To protect herd health, Ambo & Ang\'s Oink Yard reserves the right to reschedule or decline entry if biosecurity requirements are not met.',
  },
  {
    title: '4. Livestock Inspection and Health Records',
    body: 'Buyers are encouraged to inspect their selected weaners or fatteners before completing a purchase. Vaccination and health histories shared during inquiry reflect the farm\'s recorded logs at the time of inspection.',
  },
  {
    title: '5. Authorized Staff Portal Use (SwineSync)',
    body: 'The SwineSync Staff Portal is restricted to authorized personnel of Ambo & Ang\'s Oink Yard. Unauthorized access attempts, credential sharing, or disclosure of internal herd, health, inventory, or transaction records are prohibited.',
  },
  {
    title: '6. Updates to These Terms',
    body: 'We may update these Terms & Conditions as farm operations, biosecurity protocols, or system features change. Continued use of this website indicates acceptance of the latest terms.',
  },
];

export default function TermsModal({ isOpen, onClose }) {
  const { shouldRender, requestClose, panelRef, overlayClassName, panelClassName } =
    useModalAnimation(isOpen, onClose);

  if (!shouldRender) return null;

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm ${overlayClassName}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) requestClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="terms-modal-title"
      id="terms-modal-overlay"
    >
      <div
        ref={panelRef}
        className={`w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh] text-left ${panelClassName}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-4 px-6 py-5 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2.5 rounded-2xl bg-emerald-50 text-emerald-600 shrink-0">
              <FileText className="w-5 h-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h2
                id="terms-modal-title"
                className="text-lg sm:text-xl font-extrabold font-display text-slate-900 tracking-tight"
              >
                Terms &amp; Conditions
              </h2>
              <p className="text-xs text-slate-500">
                SwineSync for Ambo &amp; Ang&apos;s Oink Yard
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={requestClose}
            aria-label="Close Terms and Conditions"
            className="w-11 h-11 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="px-6 py-5 overflow-y-auto space-y-5">
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            By browsing this website or contacting Ambo &amp; Ang&apos;s Oink Yard through SwineSync, you agree to the following terms.
          </p>

          <div className="space-y-4">
            {TERMS_SECTIONS.map((section) => (
              <section key={section.title} className="space-y-1.5">
                <h3 className="text-sm font-bold text-slate-900">{section.title}</h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  {section.body}
                </p>
              </section>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/70 flex items-center justify-end shrink-0">
          <button
            type="button"
            onClick={requestClose}
            className="min-h-[44px] px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-sm rounded-xl transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
