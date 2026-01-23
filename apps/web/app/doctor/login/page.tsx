
"use client";

import { signIn, useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, Suspense } from "react";
import Image from "next/image";

function AuthContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Get existing callbackUrl or default to dashboard
  const callbackUrl = searchParams.get("callbackUrl") || "/doctor";

  useEffect(() => {
    async function handleDoctorAuth() {
      if (status === "authenticated" && session?.user) {
        try {
          // Register user as doctor (grants doctor role)
          const registerRes = await fetch("/api/doctor/register", { 
            method: "POST" 
          });
          
          if (!registerRes.ok) {
            console.error("Failed to register as doctor");
          }

          // Logic: New users to profile, existing users to their destination
          if (session.user.isNewUser) {
            router.push("/doctor/profile");
          } else {
            router.push("/doctor");
          }
        } catch (error) {
          console.error("Doctor registration error:", error);
        }
      }
    }

    handleDoctorAuth();
  }, [status, session, router, callbackUrl]);

  return (
    <div className="container" style={{ maxWidth: 520, paddingTop: 80 }}>
      <div className="text-center mb-4 d-flex flex-column align-items-center" style={{ gap: 6 }}>
        <Image
          src="/logo.jpg"
          alt="MediLocker Logo"
          width={50}
          height={40}
          className="h-10 w-auto"
        />
        <div>
          <h1 className="h4 m-0">MediLocker</h1>
          <p className="text-muted small m-0">Your Health Records, Your Control</p>
        </div>
      </div>
      <div className="card shadow-sm">
        <div className="card-body d-grid gap-3">
          <h2 className="h5 text-center">Continue with Google</h2>
          <button
            className="btn btn-danger"
            onClick={() => signIn("google", { callbackUrl })}
            disabled={status === "loading"}
          >
            {status === "loading" ? "Signing in..." : "Google"}
          </button>
        </div>
      </div>
    </div>
  );
}


export default function AuthPage() {
  return (
    <Suspense fallback={<div className="text-center mt-10">Loading...</div>}>
      <AuthContent />
    </Suspense>
  );
}