"use client";

import { useDropzone } from "react-dropzone";
import { ImageUp, ArrowUpRight } from "lucide-react";

export function UploadDropzone({ onFile }: { onFile: (file: File) => void }) {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { "image/*": [".png", ".jpg", ".jpeg", ".webp", ".heic"] },
    maxFiles: 1,
    onDrop: (files) => files[0] && onFile(files[0]),
  });

  return (
    <div className="max-w-xl mx-auto">
      <div
        {...getRootProps()}
        className={`relative overflow-hidden rounded-[28px] p-10 text-center cursor-pointer transition-all
          border-2 border-dashed
          ${
            isDragActive
              ? "border-[var(--ink)] bg-[var(--sky)]"
              : "border-[rgba(11,15,30,0.18)] bg-white/60 hover:bg-white/80 hover:border-[rgba(11,15,30,0.35)]"
          }`}
      >
        <input {...getInputProps()} />

        {/* decorative pastel glow */}
        <div className="pointer-events-none absolute -top-24 -right-20 w-64 h-64 rounded-full bg-[var(--sky)]/60 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-20 w-64 h-64 rounded-full bg-[var(--peach)]/50 blur-3xl" />

        <div className="relative flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-white/80 border border-[rgba(11,15,30,0.08)] flex items-center justify-center shadow-sm">
            <ImageUp className="w-7 h-7 text-[var(--ink)]" strokeWidth={1.5} />
          </div>
          <div>
            <div className="text-xl font-medium text-[var(--ink)] tracking-tight">
              {isDragActive ? (
                "Drop it here"
              ) : (
                <>
                  Drop your screenshot, or{" "}
                  <span className="font-serif-italic text-[1.08em]">browse</span>
                </>
              )}
            </div>
            <div className="mt-2 text-sm text-[var(--ink-muted)] max-w-sm">
              UPI confirmation (GPay, PhonePe, Paytm) or card receipt. PNG, JPG, WebP up to 10MB.
            </div>
          </div>
          <div className="inline-flex items-center gap-1.5 mt-2 text-xs text-[var(--ink)] font-medium">
            <span>Pick a file</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </div>
        </div>
      </div>
    </div>
  );
}
