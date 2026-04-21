"use client";

import { useDropzone } from "react-dropzone";
import { ImageUp } from "lucide-react";

export function UploadDropzone({ onFile }: { onFile: (file: File) => void }) {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { "image/*": [".png", ".jpg", ".jpeg", ".webp", ".heic"] },
    maxFiles: 1,
    onDrop: (files) => files[0] && onFile(files[0]),
  });

  return (
    <div
      {...getRootProps()}
      className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all
        ${isDragActive ? "border-black bg-neutral-50" : "border-neutral-300 hover:border-neutral-500 hover:bg-neutral-50"}`}
    >
      <input {...getInputProps()} />
      <div className="flex flex-col items-center gap-3 text-neutral-700">
        <ImageUp className="w-10 h-10" strokeWidth={1.5} />
        <div className="text-lg font-medium text-neutral-900">
          {isDragActive ? "Drop it here" : "Upload transaction screenshot"}
        </div>
        <div className="text-sm text-neutral-500 max-w-sm">
          UPI confirmation (GPay, PhonePe, Paytm) or card receipt. PNG/JPG/WebP up to 10MB.
        </div>
      </div>
    </div>
  );
}
