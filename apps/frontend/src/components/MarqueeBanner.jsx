import React from "react";
import { Megaphone, Sparkles, ShieldCheck, Zap } from "lucide-react";

export const MarqueeBanner = ({
  announcements = [
    {
      icon: <Sparkles className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />,
      text: "សូមស្វាគមន៍មកកាន់ NA TOPUP — គេហទំព័របញ្ចូលហ្គេមរហ័ស និងទុកចិត្តបំផុត!",
      highlight: "NA TOPUP",
    },
    {
      icon: <Zap className="w-3.5 h-3.5 text-[#E33B76] flex-shrink-0" />,
      text: "បញ្ចូលពេជ្រ MLBB, Free Fire & PUBG ទទួលបានភ្លាមៗ 24/7 តាមរយៈ KHQR គ្រប់ធនាគារ",
      highlight: "24/7",
    },
    {
      icon: <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />,
      text: "សុវត្ថិភាព 100% មិនទាមទារ Password គ្រាន់តែបញ្ចូល ID & Server ត្រឹមត្រូវ!",
      highlight: "សុវត្ថិភាព 100%",
    },
    {
      icon: <span className="text-sm">💬</span>,
      text: "ត្រូវការជំនួយ ឬមានចម្ងល់ផ្សេងៗ សូមទាក់ទងមកកាន់ Telegram ផ្លូវការ: @nagaming32",
      highlight: "@nagaming32",
    },
  ],
}) => {
  const renderMarqueeGroup = (ariaHidden = false) => (
    <div
      className="flex items-center gap-8 px-4 flex-shrink-0"
      aria-hidden={ariaHidden}
    >
      {announcements.map((item, idx) => (
        <div
          key={idx}
          className="flex items-center gap-2 text-xs sm:text-sm font-medium text-brand-text whitespace-nowrap"
        >
          {item.icon}
          <span>{item.text}</span>
          <span className="text-gray-300 mx-2 select-none">•</span>
        </div>
      ))}
    </div>
  );

  return (
    <div className="relative overflow-hidden rounded-2xl bg-white/80 backdrop-blur-md border border-brand-violet/20 shadow-soft p-1.5 sm:p-2 flex items-center gap-2 sm:gap-3">
      {/* Notice Label Badge */}
      <div className="flex items-center gap-1.5 px-3 py-1 sm:px-3.5 sm:py-1.5 rounded-xl bg-brand-violet text-white font-kulen text-xs sm:text-sm font-bold shadow-sm flex-shrink-0 select-none z-10">
        <Megaphone className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-bounce text-yellow-300" />
        <span>ដំណឹង</span>
      </div>

      {/* Marquee Ticker Track with side gradient fade */}
      <div className="relative flex-1 overflow-hidden">
        {/* Soft edge fades */}
        <div className="absolute left-0 top-0 bottom-0 w-6 sm:w-10 bg-gradient-to-r from-white/90 to-transparent pointer-events-none z-10" />
        <div className="absolute right-0 top-0 bottom-0 w-6 sm:w-10 bg-gradient-to-l from-white/90 to-transparent pointer-events-none z-10" />

        {/* Continuous Marquee Track */}
        <div className="flex w-max animate-marquee-slow hover:[animation-play-state:paused] cursor-default">
          {renderMarqueeGroup(false)}
          {renderMarqueeGroup(true)}
        </div>
      </div>
    </div>
  );
};

export default MarqueeBanner;
