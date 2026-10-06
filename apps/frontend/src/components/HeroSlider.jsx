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
      className="group relative w-full overflow-hidden rounded-2xl border border-[#A2AB73]/35 bg-[#FFF3CC] shadow-md transition-all duration-300 hover:-translate-y-0.5 hover:shadow-glow sm:rounded-3xl"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Inner Slider Content */}
      <div className="relative z-10 overflow-hidden rounded-[inherit] bg-brand-surface">
        {/* Keep the source artwork's responsive 1500:767 presentation. */}
        <Link
          to={currentSlide.targetUrl}
          className="relative block aspect-[1500/767] w-full overflow-hidden"
        >
          <img
            src={currentSlide.bannerUrl}
            alt={currentSlide.alt}
            className="h-full w-full object-cover object-center transition-transform duration-700 group-hover:scale-[1.015]"
          />
        </Link>

        {/* Arrows */}
        {slides.length > 1 && (
          <>
            <button
              type="button"
              onClick={handlePrev}
              aria-label="Previous Slide"
              className="absolute left-2 top-1/2 z-20 -translate-y-1/2 rounded-full border border-white/30 bg-black/30 p-1.5 text-white shadow-md backdrop-blur-md transition-all hover:bg-black/60 active:scale-95 sm:left-4 sm:p-2.5"
            >
              <ChevronLeft className="h-4 w-4 sm:h-6 sm:w-6" />
            </button>
            <button
              type="button"
              onClick={handleNext}
              aria-label="Next Slide"
              className="absolute right-2 top-1/2 z-20 -translate-y-1/2 rounded-full border border-white/30 bg-black/30 p-1.5 text-white shadow-md backdrop-blur-md transition-all hover:bg-black/60 active:scale-95 sm:right-4 sm:p-2.5"
            >
              <ChevronRight className="h-4 w-4 sm:h-6 sm:w-6" />
            </button>
          </>
        )}

        {/* Pagination Dots */}
        {slides.length > 1 && (
          <div className="absolute bottom-2 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-white/20 bg-black/25 px-2.5 py-1 backdrop-blur-md sm:bottom-4 sm:gap-2 sm:px-3 sm:py-1.5">
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
                className={`h-1.5 rounded-full transition-all duration-300 sm:h-2 ${
                  currentIndex === idx
                    ? "w-5 bg-brand-rose shadow-sm sm:w-7"
                    : "w-1.5 bg-white/65 hover:bg-white sm:w-2"
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
