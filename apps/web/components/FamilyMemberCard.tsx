"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import ConfirmModal from "./ConfirmModal";
import Toast from "./Toast";

interface FamilyMemberCardProps {
  member: {
    id: string;
    name: string;
    email: string;
    familyRole?: string;
  };
  isCurrentUser: boolean;
  isOwner: boolean;
}

function getInitials(name?: string, email?: string): string {
  if (name) {
    const parts = name.split(" ");
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  }
  if (email) {
    return email.substring(0, 2).toUpperCase();
  }
  return "M";
}

function getRoleBadgeStyles(role: string) {
  if (role === "owner") {
    return "bg-blue-100 text-blue-800 border-blue-200";
  }
  return "bg-gray-100 text-gray-800 border-gray-200";
}

export default function FamilyMemberCard({
  member,
  isCurrentUser,
  isOwner,
}: FamilyMemberCardProps) {
  const router = useRouter();
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleRemoveMember = async () => {
    try {
      setIsDeleting(true);
      setError(null);

      const response = await fetch(`/api/family/members/${member.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to remove member");
      }

      // Success - show success message and refresh
      setShowDeleteModal(false);
      setSuccess(`${member.name} has been removed from the family.`);
      
      // Refresh after short delay to show success message
      setTimeout(() => {
        router.refresh();
      }, 1000);
    } catch (err) {
      console.error("Error removing member:", err);
      setError(err instanceof Error ? err.message : "Failed to remove member");
      setShowDeleteModal(false);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCardClick = (e: React.MouseEvent) => {
    // Don't navigate if clicking on the delete button
    const target = e.target as HTMLElement;
    if (target.closest("button")) {
      return;
    }
    router.push(`/family/members/${member.id}`);
  };

  const memberRole = member.familyRole || "member";
  const canRemove = isOwner && !isCurrentUser && memberRole !== "owner";

  // Debug logging
  console.log('FamilyMemberCard:', {
    memberId: member.id,
    memberName: member.name,
    isOwner,
    isCurrentUser,
    memberRole,
    canRemove
  });

  return (
    <>
      <div
        className="px-6 py-4 hover:bg-gray-50 transition-colors cursor-pointer"
        onClick={handleCardClick}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4 flex-1 min-w-0">
            {/* Avatar */}
            <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-sm font-medium text-gray-700">
                {getInitials(member.name, member.email)}
              </span>
            </div>

            {/* Member Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {member.name || "Member"}
                </p>
                {isCurrentUser && (
                  <span className="text-xs text-gray-500">(You)</span>
                )}
              </div>
              <p className="text-sm text-gray-600 truncate">
                {member.email || "No email"}
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 flex-shrink-0">
            {/* Role Badge */}
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium border ${getRoleBadgeStyles(
                memberRole
              )}`}
            >
              {memberRole === "owner" ? "Owner" : "Member"}
            </span>

            {/* Remove Button (only for owner, not for self or other owners) */}
            {canRemove && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowDeleteModal(true);
                }}
                className="p-2 text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition-colors flex-shrink-0"
                title="Remove member"
                aria-label="Remove member"
              >
                <svg
                  className="w-5 h-5"
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
              </button>
            )}

            {/* View Arrow */}
            <svg
              className="w-5 h-5 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setError(null);
        }}
        onConfirm={handleRemoveMember}
        title="Remove Family Member"
        message={`Are you sure you want to remove ${member.name} from the family? This will revoke their access to shared medical records and emergency tokens.`}
        confirmText="Remove Member"
        cancelText="Cancel"
        confirmButtonClass="bg-red-600 hover:bg-red-700 focus:ring-red-500"
        isLoading={isDeleting}
      />

      {/* Error Toast */}
      {error && (
        <Toast
          message={error}
          type="error"
          onClose={() => setError(null)}
        />
      )}

      {/* Success Toast */}
      {success && (
        <Toast
          message={success}
          type="success"
          onClose={() => setSuccess(null)}
        />
      )}
    </>
  );
}
