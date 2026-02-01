"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import React from "react";

function getInitials(name?: string | null, email?: string | null) {
  const source = name || email || "";
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function Navbar() {
  const { data: session, status } = useSession();
  const pathname = usePathname();

  const user = session?.user;
  const initials = getInitials(user?.name ?? null, user?.email ?? null);

  // Role-aware links (doctor link shown to doctors/admins only)
  const role = (user as any)?.role as string | undefined;
  const links = [
    { href: "/dashboard", label: "Dashboard", show: true },
    { href: "/documents", label: "Documents", show: true },
    { href: "/family", label: "Family", show: true },
    { href: "/doctor", label: "Doctor", show: role === "doctor" || role === "admin" },
  ].filter(l => l.show);

  // Hide on emergency pages for extreme focus
  if (pathname?.startsWith("/emergency")) return null;

  const navStyle: React.CSSProperties = {
    position: "sticky",
    top: 0,
    zIndex: 1050,
    background: "#f8fafc",
    borderBottom: "1px solid #e2e8f0",
  };

  return (
    <nav className="navbar" style={navStyle}>
      <div className="container" style={{ maxWidth: 1100 }}>
        {/* Row 1: centered brand, auth at right */}
        <div className="d-flex align-items-center position-relative" style={{ minHeight: 48 }}>
          <Link className="navbar-brand fw-bold mx-auto d-flex align-items-center gap-2" href="/" style={{ color: '#0f172a', textDecoration: 'none' }}>
            <Image
              src="/logo.jpg"
              alt="MediLocker Logo"
              width={50}
              height={40}
              style={{ width: 'auto', height: 40 }}
            />
            <span>MediLocker</span>
          </Link>
          <div className="position-absolute" style={{ right: 12 }}>
            {status !== "authenticated" ? (
              <Link className="btn btn-sm btn-outline-secondary" href="/auth">
                Login
              </Link>
            ) : (
              <div className="d-flex align-items-center gap-2">
                <Link href="/profile" className="text-decoration-none">
                  <div
                    title={user?.name ?? user?.email}
                    className="rounded-circle d-flex align-items-center justify-content-center fw-bold flex-shrink-0"
                    style={{
                      width: 36,
                      height: 36,
                      background: "#e6f4f7",
                      color: "#0b7285",
                      border: "1px solid #bae6fd",
                      letterSpacing: "0.4px",
                      fontSize: 13,
                    }}
                  >
                    {initials}
                  </div>
                </Link>
                <button
                  onClick={() => signOut({ callbackUrl: '/' })}
                  className="btn btn-sm btn-outline-secondary"
                >
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Row 2: centered primary nav links (calm, unobtrusive) */}
        <div className="d-flex justify-content-center gap-3 pb-2">
          {links.map(link => (
            <Link
              key={link.href}
              href={link.href}
              className="text-decoration-none"
              style={{
                color: pathname?.startsWith(link.href) ? '#0b7285' : '#334155',
                borderBottom: pathname?.startsWith(link.href) ? '2px solid #0b7285' : '2px solid transparent',
                paddingBottom: 2,
                fontWeight: pathname?.startsWith(link.href) ? 600 : 500,
              }}
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}
