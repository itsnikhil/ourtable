"use client";

import { useEffect, useCallback, useState, useRef } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { R2Image } from "@/components/photos/r2-image";
import type { GalleryPhoto } from "@/components/photos/photo-gallery";

type PhotoCarouselModalProps = {
  photos: GalleryPhoto[];
  initialIndex: number;
  onClose: () => void;
};

export function PhotoCarouselModal({
  photos,
  initialIndex,
  onClose,
}: PhotoCarouselModalProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const touchStartXRef = useRef<number | null>(null);

  const total = photos.length;
  const currentPhoto = photos[currentIndex];

  const showPrev = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + total) % total);
  }, [total]);

  const showNext = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % total);
  }, [total]);

  // Keyboard navigation: Escape to close, Arrow keys to navigate
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowLeft") {
        showPrev();
      } else if (e.key === "ArrowRight") {
        showNext();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, showNext, showPrev]);

  // Lock background body scroll while modal is open
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  // Touch swipe support for mobile
  function handleTouchStart(e: React.TouchEvent) {
    touchStartXRef.current = e.touches[0].clientX;
  }

  function handleTouchEnd(e: React.TouchEvent) {
    if (touchStartXRef.current === null) return;
    const touchEndX = e.changedTouches[0].clientX;
    const diff = touchStartXRef.current - touchEndX;

    if (Math.abs(diff) > 50) {
      if (diff > 0) {
        showNext();
      } else {
        showPrev();
      }
    }
    touchStartXRef.current = null;
  }

  if (!currentPhoto) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Photo carousel"
      className="fixed inset-0 z-50 flex flex-col items-center justify-between bg-black/95 backdrop-blur-md select-none animate-in fade-in duration-200"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Top bar with count & close button */}
      <div className="relative z-10 flex w-full items-center justify-between px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-white/90">
            {currentIndex + 1} / {total}
          </span>
          {currentPhoto.uploadedByName ? (
            <span className="text-xs text-white/60">
              Uploaded by {currentPhoto.uploadedByName}
            </span>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close photo view"
          className="rounded-full p-2 text-white/80 transition-colors hover:bg-white/15 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          <X className="size-6" />
        </button>
      </div>

      {/* Main photo view */}
      <div className="relative flex flex-1 w-full items-center justify-center px-2 sm:px-12">
        {total > 1 ? (
          <button
            type="button"
            onClick={showPrev}
            aria-label="Previous photo"
            className="absolute left-2 z-10 rounded-full bg-black/40 p-2 text-white/90 transition hover:bg-black/70 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white sm:left-4"
          >
            <ChevronLeft className="size-8" />
          </button>
        ) : null}

        <div className="relative h-full w-full max-h-[75vh] max-w-5xl">
          <R2Image
            key={currentPhoto.id}
            src={currentPhoto.url}
            alt={
              currentPhoto.uploadedByName
                ? `Photo uploaded by ${currentPhoto.uploadedByName}`
                : "Photo view"
            }
            fill
            sizes="100vw"
            className="object-contain"
            priority
          />
        </div>

        {total > 1 ? (
          <button
            type="button"
            onClick={showNext}
            aria-label="Next photo"
            className="absolute right-2 z-10 rounded-full bg-black/40 p-2 text-white/90 transition hover:bg-black/70 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white sm:right-4"
          >
            <ChevronRight className="size-8" />
          </button>
        ) : null}
      </div>

      {/* Bottom thumbnail strip if multiple photos */}
      {total > 1 ? (
        <div className="relative z-10 flex w-full justify-center px-4 py-3 sm:px-6">
          <div className="flex max-w-xl gap-2 overflow-x-auto p-1 scrollbar-none">
            {photos.map((photo, index) => (
              <button
                key={photo.id}
                type="button"
                onClick={() => setCurrentIndex(index)}
                aria-label={`Go to photo ${index + 1}`}
                className={`relative size-12 shrink-0 overflow-hidden rounded-lg transition sm:size-14 ${
                  index === currentIndex
                    ? "ring-2 ring-white opacity-100 scale-105"
                    : "opacity-50 hover:opacity-80"
                }`}
              >
                <R2Image
                  src={photo.url}
                  alt=""
                  fill
                  sizes="56px"
                  className="object-cover"
                />
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="py-3" />
      )}
    </div>
  );
}
