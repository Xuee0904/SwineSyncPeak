import React, { useState } from 'react';
import { HelpCircle, ChevronDown, ChevronUp, MessageCircle } from 'lucide-react';

export default function FAQs({ scrollToSection }) {
  const [openIndex, setOpenIndex] = useState(null);

  const faqItems = [
    {
      question: 'Why do we need to follow safety protocols even though we are just visiting the farm for a few hours?',
      answer: 'Swine diseases (such as African Swine Fever / ASF and viral respiratory infections) can be carried unknowingly on footwear, clothes, vehicle tires, and hands even during a quick visit. Following our boot baths, hand disinfection, and vehicle tire spray stations ensures you protect our entire herd — and in turn, guarantees that the pigs you purchase and take home to your own farm are 100% healthy and disease-free.'
    },
    {
      question: 'How can we make sure that our chosen swine is healthy?',
      answer: 'Every piglet and fattener batch at Ambo & Ang\'s Oink Yard has a fully transparent health history. When you select an animal, we provide complete records of vaccinations, deworming, iron shots, and current weights. You can also observe their lively behavior, active appetite, and clear skin in person before finalizing your purchase.'
    },
    {
      question: 'What does the farm do when a swine is sick?',
      answer: 'We practice immediate isolation and veterinary-supervised treatment. Any swine exhibiting signs of lethargy, reduced feed intake, or fever is promptly relocated to an isolated recovery pen away from the general population. Prescribed medications and recovery progress are recorded in our health log, and animals are never sold or released until fully cleared by our veterinarian.'
    },
    {
      question: 'Can we schedule a visit to inspect the piglets or fatteners before buying?',
      answer: 'Yes! Scheduled buyer inspections are warmly welcomed. To protect the herd, we ask for at least 24 hours advance notice and adherence to our 72-hour biosecurity rule (no recent contact with external slaughterhouses, pig pens, or livestock trading markets).'
    },
    {
      question: 'What preparations should we make before bringing our pigs home?',
      answer: 'Ensure your receiving pen has been completely disinfected, and dried. We recommend maintaining the same feed starter transition for the first week to reduce relocation stress, and keeping new arrivals observed for the first 7–14 days.'
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
          <div>
            <h1 className="text-3xl font-extrabold font-display text-slate-900 tracking-tight">Frequently Asked Questions</h1>
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
                className="w-full flex items-center justify-between p-5 text-left text-slate-800 hover:text-emerald-700 transition-colors focus:outline-none cursor-pointer"
                aria-expanded={isOpen}
                id={`faq-toggle-btn-${idx}`}
              >
                <span className="font-bold text-slate-800 text-sm sm:text-base leading-snug">
                  {item.question}
                </span>
                <span className="ml-4 shrink-0 p-1.5 bg-slate-50 rounded-xl text-slate-500 transition-transform">
                  {isOpen ? <ChevronUp className="w-4 h-4 text-emerald-600" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                </span>
              </button>

              {/* Dynamic Accordion Body */}
              <div
                className={`transition-all duration-300 ease-in-out overflow-hidden ${isOpen ? 'max-h-96 border-t border-slate-100' : 'max-h-0'
                  }`}
                id={`faq-answer-container-${idx}`}
              >
                <div className="p-5 text-xs sm:text-sm text-slate-600 leading-relaxed bg-slate-50/60">
                  {item.answer}
                </div>
              </div>
            </div>
          );
        })}
      </section>

    </div>
  );
}
