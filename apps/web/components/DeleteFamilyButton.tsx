"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ConfirmModal from "./ConfirmModal";
import Toast from "./Toast";

interface DeleteFamilyButtonProps {
  memberCount: number;
}

export default function DeleteFamilyButton({ memberCount }: DeleteFamilyButtonProps) {
  const router = useRouter();
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDeleteFamily = async () => {
    try {
      setIsDeleting(true);
      setError(null);

      const response = await fetch("/api/family", {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to delete family");
      }

      // Success - redirect to family page (will show create family prompt)
      setShowDeleteModal(false);
      router.push("/family");
      router.refresh();
    } catch (err) {
      console.error("Error deleting family:", err);
      setError(err instanceof Error ? err.message : "Failed to delete family");
      setShowDeleteModal(false);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setShowDeleteModal(true)}
        className="inline-flex items-center px-4 py-2 text-sm font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors"
      >
        <svg
          className="w-4 h-4 mr-2"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
          />
        </svg>
        Delete Family
      </button>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setError(null);
        }}
        onConfirm={handleDeleteFamily}
        title="Delete Family"
        message={`Are you sure you want to delete this family? This will remove all ${memberCount} member${memberCount !== 1 ? 's' : ''} from the family, revoke all emergency access tokens, and cannot be undone.`}
        confirmText="Delete Family"
        cancelText="Cancel"
        confirmButtonClass="bg-red-600 hover:bg-red-700 focus:ring-red-500"
        isLoading={isDeleting}
      />

      {/* Error Toast */}
      {error && (
        <Toast message={error} type="error" onClose={() => setError(null)} />
      )}
    </>
  );
}
