"use client";

import { useEffect } from "react";

export type ConfirmModalProps = {
  open: boolean;
  title?: string;
  description?: string;
  imageUrl?: string;
  fileName?: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
};

export default function ConfirmModal(props: ConfirmModalProps) {
  const {
    open,
    title = "Confirm",
    description,
    imageUrl,
    fileName,
    confirmText = "Confirm",
    cancelText = "Cancel",
    onConfirm,
    onCancel,
  } = props;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center"
    >
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />

      <div className="relative z-10 w-full max-w-sm rounded-lg bg-white shadow-lg">
        <div className="border-b p-4">
          <h3 className="text-base font-semibold text-gray-800">{title}</h3>
        </div>

        <div className="p-4 space-y-3">
          {description ? (
            <p className="text-sm text-gray-600">{description}</p>
          ) : null}

          {fileName ? (
            <p className="text-xs text-gray-500">Selected: {fileName}</p>
          ) : null}

          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageUrl}
              alt="Selected preview"
              className="h-20 w-20 rounded-full object-cover border"
            />
          ) : null}
        </div>

        <div className="flex items-center justify-end gap-2 border-t p-3">
          <button
            onClick={onCancel}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
