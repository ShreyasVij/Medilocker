"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function CreateFamilyButton() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleCreateFamily = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/family/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const data = await res.json();

      if (res.ok && data.success) {
        // Refresh the page to show the new family
        router.refresh();
      } else {
        alert(data.error || "Failed to create family");
      }
    } catch (error) {
      console.error("Error creating family:", error);
      alert("Failed to create family");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleCreateFamily}
      disabled={loading}
      className="w-full bg-blue-600 text-white font-medium py-2.5 px-4 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {loading ? "Creating..." : "Create Family Group"}
    </button>
  );
}
