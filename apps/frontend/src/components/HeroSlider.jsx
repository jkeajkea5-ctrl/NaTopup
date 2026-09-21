import React, { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";

export const HeroSlider = ({ promotions }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const touchStartX = useRef(0);

  const defaultSlides = [
    {
      id: "1",
      bannerUrl: "/banners/home-banner.jpg",
      targetUrl: "/game/mobile-legends",
      alt: "NA TOPUP KHQR Banner",
    },
    {
      id: "2",
      bannerUrl: "https://images.unsplash.com/photo-1542751371-adc38448a05e?w=1600&auto=format&fit=crop&q=85",
      targetUrl: "/game/mobile-legends",
      alt: "Mobile Legends: Bang Bang",
    },
    {
      id: "3",
      bannerUrl: "https://images.unsplash.com/photo-1511512578047-dfb367046420?w=1600&auto=format&fit=crop&q=85",
      targetUrl: "/game/pubg-mobile",
      alt: "PUBG Mobile",
    },
    {
      id: "4",
      bannerUrl: "https://images.unsplash.com/photo-1563089145-599997674d42?w=1600&auto=format&fit=crop&q=85",
      targetUrl: "/game/free-fire",
      alt: "Free Fire",
    },
  ];

  const slides = promotions === undefined ? defaultSlides : promotions
    .filter((promotion) => promotion.isActive !== false && promotion.bannerUrl)
    .map((promotion) => ({ ...promotion, alt: promotion.title || "NA TOPUP promotion", targetUrl: promotion.targetUrl || "#games" }));

  useEffect(() => { setCurrentIndex(0); }, [slides.length]);

  useEffect(() => {
    if (isPaused || slides.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % slides.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [isPaused, slides.length]);

  const handlePrev = (e) => {
    e?.preventDefault();
    e?.stopPropagation();
    setCurrentIndex((prev) => (prev - 1 + slides.length) % slides.length);
  };

  const handleNext = (e) => {
    e?.preventDefault();
    e?.stopPropagation();
    setCurrentIndex((prev) => (prev + 1) % slides.length);
  };

  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e) => {
    const touchEndX = e.changedTouches[0].clientX;
    const diff = touchStartX.current - touchEndX;
    if (diff > 50) handleNext();
    if (diff < -50) handlePrev();
  };

  const currentSlide = slides[currentIndex] || slides[0];

  if (!currentSlide) return null;

  return (
    <div
      className="relative -mx-4 -mt-6 sm:mx-0 sm:mt-0 p-0 sm:p-1 rounded-none sm:rounded-3xl overflow-hidden border-0 sm:border sm:border-brand-border/80 shadow-sm hover:shadow-glow transition-all duration-300 group"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Inner Slider Content */}
      <div className="relative rounded-none sm:rounded-[20px] overflow-hidden bg-brand-surface z-10">
        {/* Clickable Image Banner (No text, no button - Bigger Display) */}
        <Link
          to={currentSlide.targetUrl}
          className="block relative w-full h-[220px] sm:h-[340px] md:h-[440px] lg:h-[520px] xl:h-[560px] overflow-hidden"
        >
          <img
            src={currentSlide.bannerUrl}
            alt={currentSlide.alt}
            className="w-full h-full object-cover object-center transition-all duration-700 group-hover:scale-[1.02]"
          />
        </Link>

        {/* Arrows */}
        <button
          type="button"
          onClick={handlePrev}
          aria-label="Previous Slide"
          className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 z-20 p-2 sm:p-2.5 rounded-full bg-black/35 hover:bg-black/60 text-white backdrop-blur-md transition-all shadow-md active:scale-95"
        >
          <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6" />
        </button>
        <button
          type="button"
          onClick={handleNext}
          aria-label="Next Slide"
          className="absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 z-20 p-2 sm:p-2.5 rounded-full bg-black/35 hover:bg-black/60 text-white backdrop-blur-md transition-all shadow-md active:scale-95"
        >
          <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6" />
        </button>

        {/* Pagination Dots */}
        <div className="absolute bottom-3 sm:bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 sm:gap-2 bg-black/25 backdrop-blur-md px-3 py-1.5 rounded-full">
          {slides.map((_, idx) => (
            <button
              key={idx}
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setCurrentIndex(idx);
              }}
              aria-label={`Go to slide ${idx + 1}`}
              className={`h-2 rounded-full transition-all duration-300 ${
                currentIndex === idx
                  ? "w-6 sm:w-7 bg-brand-rose shadow-sm"
                  : "w-2 bg-white/60 hover:bg-white"
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
