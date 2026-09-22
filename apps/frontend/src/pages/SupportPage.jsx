import React from "react";
import { HelpCircle, ShieldCheck, Clock, Zap } from "lucide-react";
import { TelegramBrandIcon } from "../components/TelegramBrandIcon";

export const SupportPage = () => {
  const faqs = [
    {
      q: "តើការបញ្ចូលពេជ្រត្រូវចំណាយពេលប៉ុន្មាន?",
      a: "ពេជ្រនឹងត្រូវបញ្ចូលទៅក្នុងគណនីហ្គេមដោយស្វ័យប្រវត្តក្នុងរយៈពេល 30 ទៅ 90 វិនាទី បន្ទាប់ពីការទូទាត់ប្រាក់តាម KHQR ទទួលបានជោគជ័យ។",
    },
    {
      q: "តើកម្មវិធីធនាគារណាខ្លះអាចស្កេនទូទាត់ KHQR បាន?",
      a: "លោកអ្នកអាចទូទាត់តាមកម្មវិធីធនាគារសមាជិកបាគងជាង ៤០+ នៅកម្ពុជា រួមមាន ABA Mobile, Wing Bank, ACLEDA, Sathapana, Canadia និងធនាគារផ្សេងទៀត។",
    },
    {
      q: "ចុះប្រសិនបើខ្ញុំបញ្ចូលខុស User ID ឬ Server ID?",
      a: "យើងមានប្រព័ន្ធ 'ពិនិត្យឈ្មោះ' មុនពេលបង់ប្រាក់ ដើម្បីបង្ហាញឈ្មោះក្នុងហ្គេម និងការពារកុំឱ្យច្រឡំ។ ប្រសិនបើមានបញ្ហា សូមទាក់ទងមកកាន់ Telegram របស់យើងភ្លាមៗ។",
    },
    {
      q: "តើការបញ្ចូលពេជ្រនេះស្របច្បាប់ និងមានសុវត្ថិភាពដល់គណនីដែរឬទេ?",
      a: "បាទ/ចាស! ការបញ្ចូលពេជ្រគឺស្របច្បាប់ 100% តាមរយៈ API ផ្លូវការ (Vizo & G2Bulk) គ្មានការប៉ះពាល់ ឬចាក់សោ (Ban) គណនីឡើយ។",
    },
  ];

  return (
    <div className="max-w-4xl mx-auto py-8 sm:py-12 space-y-12">
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-violet/10 text-brand-violet text-xs font-semibold">
          <HelpCircle className="w-3.5 h-3.5" />
          <span>សេវាបម្រើអតិថិជន 24/7</span>
        </div>
        <h1 className="font-heading font-bold text-3xl sm:text-4xl text-brand-text">
          តើយើងអាចជួយអ្វីដល់លោកអ្នក?
        </h1>
        <p className="text-sm text-brand-muted max-w-lg mx-auto">
          ត្រូវការជំនួយលើការបញ្ជាទិញ ការផ្ទៀងផ្ទាត់ការទូទាត់ ឬគណនីហ្គេមមែនទេ? ក្រុមការងារយើងខ្ញុំត្រៀមខ្លួនជួយលោកអ្នកជានិច្ច។
        </p>
      </div>

      {/* Telegram Live Support Banner */}
      <div className="gradient-brand rounded-2xl sm:rounded-3xl p-6 sm:p-8 text-white shadow-soft flex flex-col sm:flex-row items-center justify-between gap-6">
        <div className="space-y-2 text-center sm:text-left">
          <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider bg-white/20 px-3 py-1 rounded-full">
            <Clock className="w-3.5 h-3.5" />
            <span>ឆ្លើយតបរហ័សភ្លាមៗ</span>
          </div>
          <h3 className="font-heading font-bold text-2xl">
            សេវាគាំទ្រផ្ទាល់តាម Telegram
          </h3>
          <p className="text-sm text-white/90 max-w-md">
            ទំនាក់ទំនងផ្ទាល់ជាមួយក្រុមការងារជំនាញតាម Telegram ជាភាសាខ្មែរ 24 ម៉ោងក្នុងមួយថ្ងៃ។
          </p>
        </div>

        <a
          href="https://t.me/LukasTopupSupport"
          target="_blank"
          rel="noopener noreferrer"
          className="bg-white text-brand-text hover:bg-brand-bg px-6 py-3 rounded-button font-bold text-sm shadow-md transition-all flex items-center gap-2 flex-shrink-0"
        >
          <TelegramBrandIcon className="h-7 w-7" />
          <span>ជជែកតាម Telegram</span>
        </a>
      </div>

      {/* FAQ Accordion Section */}
      <div className="bg-brand-surface rounded-2xl sm:rounded-3xl border border-brand-border p-6 sm:p-8 shadow-card space-y-6">
        <h3 className="font-heading font-bold text-xl text-brand-text">
          សំណួរដែលសួរញឹកញាប់
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {faqs.map((faq, i) => (
            <div key={i} className="p-4 rounded-xl bg-brand-bg border border-brand-border space-y-2">
              <h4 className="font-heading font-semibold text-sm text-brand-text">
                {faq.q}
              </h4>
              <p className="text-xs text-brand-muted leading-relaxed">
                {faq.a}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
