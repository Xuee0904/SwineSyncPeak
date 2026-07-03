import React, { useState } from 'react';
import { Mail, Phone, MapPin, Clock, Send, CheckCircle2, User, HelpCircle, FileText } from 'lucide-react';

export default function Contact() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    role: 'Visitor',
    subject: '',
    message: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    const { id, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [id]: value
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    if (!formData.name || !formData.email || !formData.subject || !formData.message) {
      setError('Please complete all fields.');
      return;
    }

    setIsSubmitting(true);

    // Simulate sending inquiry message
    setTimeout(() => {
      setIsSubmitting(false);
      setSubmitted(true);
      setFormData({
        name: '',
        email: '',
        role: 'Visitor',
        subject: '',
        message: ''
      });
    }, 1200);
  };

  return (
    <div className="space-y-8 pb-4 text-left animate-fade-in" id="contact-section">
      {/* Header */}
      <section className="border-b border-slate-700 pb-5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-primary-500/20 text-primary-400">
            <Mail className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-3xl font-extrabold font-display text-white tracking-tight">Contact Us</h2>
            <p className="text-sm text-slate-400 mt-1">
              Submit support tickets, report biosecurity issues, or request veterinary audits.
            </p>
          </div>
        </div>
      </section>

      {/* Main Grid split: Form vs Info */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Contact Form Column */}
        <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-100 p-6 sm:p-8 shadow-sm" id="contact-form-container">
          {submitted ? (
            <div className="py-12 text-center space-y-4 max-w-sm mx-auto" id="contact-success-panel">
              <div className="inline-flex items-center justify-center p-3 rounded-full bg-emerald-100 text-emerald-600 animate-bounce">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <h2 className="text-2xl font-bold font-display text-slate-900">Message Received!</h2>
              <p className="text-sm text-slate-500 leading-relaxed">
                Thank you for contacting SwineSync support. An operations coordinator or vet technician will respond within 12 hours.
              </p>
              <button
                onClick={() => setSubmitted(false)}
                className="mt-6 px-5 py-2.5 bg-slate-950 hover:bg-slate-800 text-white font-semibold text-xs rounded-xl shadow-md cursor-pointer transition-colors"
                id="reset-contact-form-btn"
              >
                Send Another Message
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5" id="contact-inquiry-form">
              {error && (
                <div className="p-3 text-xs text-rose-700 bg-rose-50 border border-rose-100 rounded-xl" id="contact-error-msg">
                  {error}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {/* Full Name */}
                <div className="space-y-1.5">
                  <label htmlFor="name" className="text-xs font-semibold text-slate-700 tracking-wide uppercase">
                    Full Name
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-450">
                      <User className="w-4 h-4 text-slate-400" />
                    </span>
                    <input
                      type="text"
                      id="name"
                      required
                      placeholder="Jane Doe"
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 focus:bg-white transition-all"
                      value={formData.name}
                      onChange={handleChange}
                    />
                  </div>
                </div>

                {/* Email Address */}
                <div className="space-y-1.5">
                  <label htmlFor="email" className="text-xs font-semibold text-slate-700 tracking-wide uppercase">
                    Email Address
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-450">
                      <Mail className="w-4 h-4 text-slate-400" />
                    </span>
                    <input
                      type="email"
                      id="email"
                      required
                      placeholder="jane.doe@example.com"
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 focus:bg-white transition-all"
                      value={formData.email}
                      onChange={handleChange}
                    />
                  </div>
                </div>
              </div>

              {/* Staff / Client Role Dropdown */}
              <div className="space-y-1.5">
                <label htmlFor="role" className="text-xs font-semibold text-slate-700 tracking-wide uppercase">
                  Your Role
                </label>
                <select
                  id="role"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 focus:bg-white transition-all"
                  value={formData.role}
                  onChange={handleChange}
                >
                  <option value="Visitor">Visitor / Delivery Driver</option>
                  <option value="Caretaker">Farm Caretaker / Staff</option>
                  <option value="Veterinarian">Visiting Veterinarian</option>
                  <option value="Auditor">Regulatory Auditor</option>
                  <option value="Other">Other / Vendor</option>
                </select>
              </div>

              {/* Subject */}
              <div className="space-y-1.5">
                <label htmlFor="subject" className="text-xs font-semibold text-slate-700 tracking-wide uppercase">
                  Subject Inquiry
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-450">
                    <HelpCircle className="w-4 h-4 text-slate-400" />
                  </span>
                  <input
                    type="text"
                    id="subject"
                    required
                    placeholder="e.g. Requesting Audit Clearance, RFID Scan Issue"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 focus:bg-white transition-all"
                    value={formData.subject}
                    onChange={handleChange}
                  />
                </div>
              </div>

              {/* Message Details */}
              <div className="space-y-1.5">
                <label htmlFor="message" className="text-xs font-semibold text-slate-700 tracking-wide uppercase">
                  Message Description
                </label>
                <textarea
                  id="message"
                  required
                  rows="5"
                  placeholder="Provide precise details, barn numbers, or transaction IDs if applicable..."
                  className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 focus:bg-white transition-all resize-none"
                  value={formData.message}
                  onChange={handleChange}
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-primary-600 hover:bg-primary-700 text-white font-bold text-sm rounded-xl shadow-lg shadow-primary-700/10 cursor-pointer transition-colors disabled:opacity-75 disabled:cursor-not-allowed"
                id="contact-submit-btn"
              >
                {isSubmitting ? (
                  'Submitting message...'
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Send Inquiry
                  </>
                )}
              </button>
            </form>
          )}
        </div>

        {/* Sidebar Info Column */}
        <div className="space-y-6">
          {/* Operations Address info */}
          <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm space-y-5 text-xs text-slate-600">
            <h3 className="text-base font-extrabold font-display text-slate-900">Headquarters</h3>
            
            <div className="space-y-3.5">
              <div className="flex gap-3">
                <MapPin className="w-5 h-5 text-primary-600 shrink-0 mt-0.5" />
                <span className="leading-relaxed">
                  SwineSync Operations Hub <br />
                  Sector A, Biosafety Parkway <br />
                  Green Valley, GV 82405
                </span>
              </div>

              <div className="flex gap-3">
                <Phone className="w-5 h-5 text-primary-600 shrink-0" />
                <span>+1 (800) 555-SYNC</span>
              </div>

              <div className="flex gap-3">
                <Mail className="w-5 h-5 text-primary-600 shrink-0" />
                <span>support@swinesync.com</span>
              </div>

              <div className="flex gap-3">
                <Clock className="w-5 h-5 text-primary-600 shrink-0 mt-0.5" />
                <span>
                  Admin Offices: Mon - Fri (08:00 - 17:00) <br />
                  Veterinary Desk: 24/7 Hotline
                </span>
              </div>
            </div>
          </div>

          {/* SVG Map Graphic */}
          <div className="bg-slate-900 rounded-3xl p-6 text-white text-center shadow-md relative overflow-hidden flex flex-col justify-between h-48 border border-slate-800">
            <div className="absolute inset-0 bg-slate-950/20 opacity-40 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px]" />
            <div className="relative z-10 text-left space-y-1">
              <span className="text-[10px] text-primary-300 font-bold uppercase tracking-wider block">FACILITY COORDINATES</span>
              <span className="font-mono text-xs text-slate-400">LAT: 34.0522° N • LON: 118.2437° W</span>
            </div>
            
            {/* Visual Dot representing coordinate */}
            <div className="relative z-10 mx-auto w-12 h-12 rounded-full border border-primary-500/30 flex items-center justify-center bg-primary-500/10">
              <span className="absolute flex h-3.5 w-3.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-primary-500"></span>
              </span>
            </div>

            <div className="relative z-10 text-[10px] text-slate-400 font-medium">
              RFID scanners active across sectors A, B, and C
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
