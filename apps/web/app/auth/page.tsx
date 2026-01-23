"use client";

import { signIn, useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, Suspense, useState } from "react";
import Image from "next/image";

function AuthContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [signingInAsDoctor, setSigningInAsDoctor] = useState(false);

  // Default patient callback
  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard";

  useEffect(() => {
    if (status === "authenticated" && session?.user) {
      if (session.user.isNewUser) {
        router.push("/profile");
      } else {
        router.push(callbackUrl);
      }
    }
  }, [status, session, router, callbackUrl]);

  const handleDoctorSignIn = async () => {
    try {
      setSigningInAsDoctor(true);
      // Sign in with Google, then register as doctor and redirect
      await signIn("google", { 
        callbackUrl: "/doctor/login"
      });
    } catch (error) {
      console.error("Doctor sign in error:", error);
      setSigningInAsDoctor(false);
    }
  };

  return (
    <div className="container" style={{ maxWidth: 520, paddingTop: 80 }}>
      <div
        className="text-center mb-4 d-flex flex-column align-items-center"
        style={{ gap: 6 }}
      >
        <Image
          src="/logo.jpg"
          alt="MediLocker Logo"
          width={50}
          height={40}
        />
        <div>
          <h1 className="h4 m-0">MediLocker</h1>
          <p className="text-muted small m-0">
            Your Health Records, Your Control
          </p>
        </div>
      </div>

      <div className="card shadow-sm">
        <div className="card-body d-grid gap-3">
          <h2 className="h5 text-center">Continue with Google</h2>

          {/* Patient Login */}
          <button
            className="btn btn-outline-danger"
            onClick={() => signIn("google", { callbackUrl })}
            disabled={status === "loading" || signingInAsDoctor}
          >
            {status === "loading"
              ? "Signing in..."
              : "Continue as Patient"}
          </button>

          {/* Doctor Login */}
          <button
            className="btn btn-outline-danger"
            onClick={handleDoctorSignIn}
            disabled={status === "loading" || signingInAsDoctor}
          >
            {signingInAsDoctor ? "Signing in..." : "Continue as Doctor"}
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
