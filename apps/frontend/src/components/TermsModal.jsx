import React from "react";
import {
  ShieldCheck,
  Zap,
  RotateCcw,
  Lock,
  Headphones,
  Check,
  X,
  FileText,
} from "lucide-react";

export const TermsModal = ({ isOpen, onClose, onAgree }) => {
  if (!isOpen) return null;

  const handleAgree = () => {
    if (onAgree) onAgree();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-2xl max-h-[90vh] flex flex-col bg-white rounded-3xl shadow-2xl border border-brand-border overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Ribbon */}
        <div className="bg-brand-violet text-white px-6 py-4 flex items-center justify-between shadow-sm flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-kulen font-bold text-base sm:text-lg leading-tight">
                លក្ខខណ្ឌ និងកិច្ចព្រមព្រៀង
              </h3>
              <p className="text-xs text-white/80 font-medium">
                TERMS AND CONDITIONS
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Terms Content */}
        <div className="p-6 overflow-y-auto space-y-4 text-xs sm:text-sm text-gray-600 leading-relaxed font-sans">
          {/* Section 1: Payment & Instant Delivery */}
          <div className="p-4 rounded-2xl bg-[#FAF8FD] border border-brand-border/60 space-y-1.5">
            <div className="flex items-center gap-2 text-brand-violet font-kulen font-bold text-sm">
              <Zap className="w-4 h-4 text-brand-violet flex-shrink-0" />
              <span>១. ការទូទាត់ និងការផ្ទេរពេជ្រ (Payment & Delivery)</span>
            </div>
            <p className="text-gray-700 leading-relaxed">
              ការទូទាត់ត្រូវបានធ្វើឡើងតាមរយៈប្រព័ន្ធ <strong>Bakong / ABA KHQR</strong> ដោយស្វ័យប្រវត្តិ។ ពេជ្រ ឬកញ្ចប់ហ្គេមនឹងត្រូវបានបញ្ចូលដោយស្វ័យប្រវត្តិចូលក្នុងគណនីហ្គេមរបស់អ្នកភ្លាមៗក្នុងរយៈពេល <strong>៣០ វិនាទី ទៅ ២ នាទី</strong> បន្ទាប់ពីការទូទាត់ត្រូវបានបញ្ជាក់ជោគជ័យ។
            </p>
          </div>

          {/* Section 2: Account Information Responsibility */}
          <div className="p-4 rounded-2xl bg-[#FAF8FD] border border-brand-border/60 space-y-1.5">
            <div className="flex items-center gap-2 text-brand-violet font-kulen font-bold text-sm">
              <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span>២. ព័ត៌មានគណនីហ្គេម (Account Information Responsibility)</span>
            </div>
            <p className="text-gray-700 leading-relaxed">
              អតិថិជនមានកាតព្វកិច្ចត្រួតពិនិត្យ <strong>User ID</strong> និង <strong>Server/Zone ID</strong> ឱ្យបានត្រឹមត្រូវមុននឹងធ្វើការទូទាត់។ ប្រព័ន្ធយើងមានប៊ូតុង <strong>"ពិនិត្យ ឈ្មោះ"</strong> ដើម្បីផ្ទៀងផ្ទាត់ឈ្មោះគណនីរបស់អ្នក។ ប្រសិនបើអតិថិជនបញ្ចូលខុសដោយសារកំហុសផ្ទាល់ខ្លួន ប្រព័ន្ធមិនអាចកែប្រែ ឬបង្វិលប្រាក់វិញបានឡើយ។
            </p>
          </div>

          {/* Section 3: Refund Policy */}
          <div className="p-4 rounded-2xl bg-[#FAF8FD] border border-brand-border/60 space-y-1.5">
            <div className="flex items-center gap-2 text-brand-violet font-kulen font-bold text-sm">
              <RotateCcw className="w-4 h-4 text-brand-rose flex-shrink-0" />
              <span>៣. គោលការណ៍បង្វិលប្រាក់ (Refund Policy)</span>
            </div>
            <p className="text-gray-700 leading-relaxed">
              ដោយសារទំនិញជាផលិតផលឌីជីថល (Digital Goods) ដែលបញ្ជូនភ្លាមៗចូលគណនីហ្គេម ការបញ្ជាទិញដែលបានផ្ញើជោគជ័យ <strong>មិនអាចលុបចោល ឬបង្វិលប្រាក់វិញបានទេ</strong>។ ករណីកាត់លុយជោគជ័យ តែប្រព័ន្ធមិនបានផ្ញើពេជ្រលើសពី ១៥ នាទី យើងនឹងធ្វើការត្រួតពិនិត្យ និងបញ្ចូលជូនឡើងវិញ ឬបង្វិលប្រាក់ជូនវិញ <strong>១០០%</strong>។
            </p>
          </div>

          {/* Section 4: Safety & Privacy */}
          <div className="p-4 rounded-2xl bg-[#FAF8FD] border border-brand-border/60 space-y-1.5">
            <div className="flex items-center gap-2 text-brand-violet font-kulen font-bold text-sm">
              <Lock className="w-4 h-4 text-blue-600 flex-shrink-0" />
              <span>៤. សុវត្ថិភាព និងការសម្ងាត់ (Safety & Privacy)</span>
            </div>
            <p className="text-gray-700 leading-relaxed">
              យើងមិនដែលទាមទារ <strong>ពាក្យសម្ងាត់ (Password)</strong> ឬព័ត៌មានចូលប្រើប្រាស់គណនីរបស់អ្នកឡើយ។ ការបញ្ចូលទឹកប្រាក់ដំណើរការដោយផ្ទាល់តាមរយៈ API ផ្លូវការរបស់ហ្គេម (Moonton/G2Bulk/Vizo) ដោយសុវត្ថិភាព ១០០% មិនបាត់បង់គណនីឡើយ។
            </p>
          </div>

          {/* Section 5: Customer Support */}
          <div className="p-4 rounded-2xl bg-[#FAF8FD] border border-brand-border/60 space-y-1.5">
            <div className="flex items-center gap-2 text-brand-violet font-kulen font-bold text-sm">
              <Headphones className="w-4 h-4 text-purple-600 flex-shrink-0" />
              <span>៥. ជំនួយអតិថិជន ២៤/៧ (Customer Support)</span>
            </div>
            <p className="text-gray-700 leading-relaxed">
              ប្រសិនបើមានបញ្ហាបច្ចេកទេស ការទូទាត់ ឬការផ្ទេរពេជ្រមានការយឺតយ៉ាវ សូមទាក់ទងមកកាន់ផ្នែកបម្រើអតិថិជនរបស់យើងតាមរយៈ Telegram: <strong>@LukasTopupSupport</strong> ឬ Telegram Help Desk ដើម្បីទទួលបានការដោះស្រាយភ្លាមៗ។
            </p>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 bg-gray-50 border-t border-brand-border flex items-center justify-between gap-3 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl border border-gray-300 text-gray-700 hover:bg-gray-100 font-kulen font-semibold text-xs sm:text-sm transition-all cursor-pointer"
          >
            បិទ
          </button>
          <button
            type="button"
            onClick={handleAgree}
            className="px-6 py-2.5 rounded-xl bg-brand-violet hover:bg-[#7D67C7] text-white font-kulen font-bold text-xs sm:text-sm shadow-md active:scale-95 transition-all flex items-center gap-2 cursor-pointer"
          >
            <Check className="w-4 h-4" />
            <span>ខ្ញុំយល់ព្រម (I Agree)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
