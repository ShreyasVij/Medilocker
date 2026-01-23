"use client";
import { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { AppNavbar } from "@/components/AppNavbar";
import { AppNavbar as DoctorNavbar } from "@/app/doctor/Navbar_doc";
import Footer from "@/components/Footer";

interface AppLayoutProps {
  children: ReactNode;
  role?: "patient" | "doctor" | "admin";
  userName?: string;
}

export function AppLayout({ children, role = "patient", userName }: AppLayoutProps) {
  const pathname = usePathname();
  const isAuth = pathname?.startsWith("/auth");
  const isDoctor = pathname?.startsWith("/doctor");

  if (isAuth) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <main className="flex-1 w-full max-w-3xl mx-auto px-6 py-12">
          {children}
        </main>
      </div>
    );
  }

  if (isDoctor) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <DoctorNavbar
          userName={userName}
          userRole="doctor"
        />
        <main className="flex-1 w-full max-w-7xl mx-auto p-6 md:p-8 overflow-visible">
          {children}
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <AppNavbar
        userName={userName}
        userRole={role}
      />
      <main className="flex-1 w-full max-w-7xl mx-auto p-6 md:p-8 overflow-visible">
        {children}
      </main>
      <Footer />
    </div>
  );
}
