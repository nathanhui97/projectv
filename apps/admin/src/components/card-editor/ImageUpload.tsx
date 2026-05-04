"use client";

import { useState, useRef } from "react";
import { useFormContext } from "react-hook-form";
import type { CardFormValues } from "@/app/(admin)/cards/[id]/CardEditor";
import { Upload, Loader2 } from "lucide-react";
import Image from "next/image";

export default function ImageUpload({ cardId }: { cardId: string }) {
  const { watch, setValue } = useFormContext<CardFormValues>();
  const artUrl: string | undefined = watch("art_url");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    if (!file.type.startsWith("image/")) {
      setError("File must be an image");
      return;
    }
    setUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("cardId", cardId);

    try {
      const res = await fetch("/api/cards/upload-art", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error("Upload failed");
      const { url } = await res.json() as { url: string };
      setValue("art_url", url, { shouldDirty: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Card Art</p>

      {/* Preview */}
      <div
        className="relative aspect-[2/3] rounded-lg border-2 border-dashed bg-muted overflow-hidden cursor-pointer hover:border-primary transition-colors"
        onClick={() => inputRef.current?.click()}
      >
        {artUrl ? (
          <Image src={artUrl} alt="Card art" fill className="object-cover" />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground">
            {uploading ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : (
              <>
                <Upload className="h-6 w-6 mb-2" />
                <span className="text-xs text-center px-2">Click to upload card art</span>
              </>
            )}
          </div>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />

      {artUrl && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="w-full text-xs text-center text-muted-foreground hover:text-foreground border rounded-md py-1.5"
        >
          Replace image
        </button>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
