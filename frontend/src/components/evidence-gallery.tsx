"use client";

import { useEffect, useRef, useState } from "react";
import { Eye, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { EvidenceImage } from "@/types/report";

const SAFE_IMAGE_DATA = /^data:image\/(?:jpeg|png);base64,[A-Za-z0-9+/=]+$/;

export function EvidenceGallery({ images, label = "View evidence" }: { images: EvidenceImage[]; label?: string }) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const safeImages = images.filter((item) => SAFE_IMAGE_DATA.test(item.data_url));

  const closeModal = () => {
    setOpen(false);
    triggerRef.current?.focus();
  };

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const close = (event: KeyboardEvent) => event.key === "Escape" && closeModal();
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [open]);

  if (!safeImages.length) return null;
  return (
    <>
      <Button ref={triggerRef} type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Eye /> {label} ({safeImages.length})
      </Button>
      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/70 p-4" onMouseDown={closeModal}>
          <section
            role="dialog"
            aria-modal="true"
            aria-label="Visual evidence"
            className="max-h-[92vh] w-full max-w-4xl overflow-auto rounded-xl bg-white p-4 shadow-2xl sm:p-6"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between gap-4">
              <div><h2 className="text-lg font-semibold text-slate-950">Visual evidence</h2><p className="text-sm text-slate-500">Generated from this analysis request.</p></div>
              <Button ref={closeRef} type="button" variant="outline" size="icon-sm" aria-label="Close evidence" onClick={closeModal}><X /></Button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {safeImages.map((item) => (
                <figure key={item.id} className="overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                  {/* The backend only supplies validated, bounded JPEG/PNG data URLs. */}
                  {/* eslint-disable-next-line @next/next/no-img-element -- dimensions vary by generated evidence crop and no remote optimization is needed */}
                  <img src={item.data_url} alt={item.label} className="max-h-[60vh] w-full object-contain" />
                  <figcaption className="border-t border-slate-200 bg-white p-3 text-sm font-medium text-slate-700">{item.label}</figcaption>
                </figure>
              ))}
            </div>
          </section>
        </div>
      )}
    </>
  );
}
