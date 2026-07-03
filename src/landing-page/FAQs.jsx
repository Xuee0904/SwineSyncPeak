import React, { useState } from 'react';
import { HelpCircle, ChevronDown, ChevronUp, MessageCircle } from 'lucide-react';

export default function FAQs({ scrollToSection }) {
  const [openIndex, setOpenIndex] = useState(null);

  const faqItems = [
    {
      question: 'What is SwineSync and how does the ecosystem function?',
      answer: 'SwineSync is a centralized modern livestock management system designed to coordinate herd telemetry, biosecurity compliance, and administrative logs. It bridges physical farm checkpoints with a cloud database, ensuring caretakers and veterinarians can track swine statuses in real-time.'
    },
    {
      question: 'How do caretakers register or sync new swine profiles?',
      answer: 'Using RFID ear tags, caretakers scan the livestock at designated stations. The RFID scanner feeds tags to the SwineSync interface, which matches the record in the Supabase database. Staff can update weights, genetic categories, and health tags directly through secure portals.'
    },
    {
      question: 'What are the three biosecurity levels and who can access them?',
      answer: 'Level 1 is general access (outer lobby and administration). Level 2 covers general barn areas (feed storage and breeding pens, requiring overalls and disinfection). Level 3 is reserved for sterile breeding chambers and farrowing zones, requiring veterinarian authorization and specialized medical attire.'
    },
    {
      question: 'Is the catalog ready to connect to a live Supabase server?',
      answer: 'Yes. The Swine Catalog component is built around a standardized schema (rfid_tag, breed, weight_kg, status, location). It is structured to swap local state variables for Supabase client listeners (`supabase.from("swine").on("INSERT")`), enabling instantaneous synchronization across all staff devices.'
    },
    {
      question: 'What is the immediate protocol if a sick swine status is flagged?',
      answer: 'If the system or a caretaker flags a sick status, the animal must be immediately relocated to the Isolation Pen (Zone C, Level 3). A notification email is dispatched to the Lead Veterinarian, and a biosecurity quarantine notice is generated. Staff must perform thorough sanitation check-outs.'
    }
  ];

  const handleToggle = (idx) => {
    setOpenIndex(openIndex === idx ? null : idx);
  };

  return (
    <div className="space-y-8 pb-16 text-left animate-fade-in" id="faqs-section">
      {/* Header */}
      <section className="border-b border-slate-100 pb-5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-primary-50 text-primary-600">
            <HelpCircle className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-3xl font-extrabold font-display text-slate-900 tracking-tight">Frequently Asked Questions</h1>
            <p className="text-sm text-slate-500 mt-1">
              Find solutions and technical details regarding biosecurity zones, RFID integration, and staff access.
            </p>
          </div>
        </div>
      </section>

      {/* Accordion List */}
      <section className="max-w-3xl mx-auto space-y-4" id="faqs-accordion-container">
        {faqItems.map((item, idx) => {
          const isOpen = openIndex === idx;
          return (
            <div
              key={idx}
              className="bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all"
              id={`faq-item-${idx}`}
            >
              <button
                onClick={() => handleToggle(idx)}
                className="w-full flex items-center justify-between p-5 text-left text-slate-800 hover:text-primary-750 transition-colors focus:outline-none cursor-pointer"
                aria-expanded={isOpen}
                id={`faq-toggle-btn-${idx}`}
              >
                <span className="font-bold text-slate-850 text-sm sm:text-base leading-snug">
                  {item.question}
                </span>
                <span className="ml-4 shrink-0 p-1.5 bg-slate-50 rounded-xl text-slate-550 transition-transform">
                  {isOpen ? <ChevronUp className="w-4 h-4 text-primary-600" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                </span>
              </button>

              {/* Dynamic Accordion Body */}
              <div
                className={`transition-all duration-300 ease-in-out overflow-hidden ${
                  isOpen ? 'max-h-60 border-t border-slate-50' : 'max-h-0'
                }`}
                id={`faq-answer-container-${idx}`}
              >
                <div className="p-5 text-xs sm:text-sm text-slate-500 leading-relaxed bg-slate-50/50">
                  {item.answer}
                </div>
              </div>
            </div>
          );
        })}
      </section>

      {/* FAQs Footer CTA */}
      <section className="max-w-3xl mx-auto bg-gradient-to-br from-slate-900 to-slate-950 text-white rounded-3xl p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-6 shadow-md mt-12">
        <div className="flex gap-4 items-center">
          <div className="p-3 bg-white/10 rounded-2xl text-primary-300">
            <MessageCircle className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-white text-base">Still have questions?</h3>
            <p className="text-xs text-slate-350 mt-1 font-light leading-relaxed">
              If you need technical coordination or veterinary audit assistance, send us an inquiry.
            </p>
          </div>
        </div>

        <button
          onClick={() => scrollToSection('contact')}
          className="px-5 py-3 bg-primary-600 hover:bg-primary-700 text-white font-bold text-xs rounded-xl shadow-lg shadow-primary-700/10 transition-colors cursor-pointer shrink-0"
          id="faq-contact-cta"
        >
          Contact Support Desk
        </button>
      </section>
    </div>
  );
}
