"use client";
import { User, LogOut, LayoutDashboard, FileText, AlertTriangle, Calendar, ClipboardList, Users, UsersRound, Menu, X } from "lucide-react";
import { useSession, signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface AppNavbarProps {
  userName?: string;
  userRole?: "patient" | "doctor" | "admin";
}

const patientNavItems = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Documents", href: "/documents", icon: FileText },
  { label: "Family", href: "/family", icon: UsersRound },
  { label: "Appointments", href: "/appointments/book", icon: Calendar },
  { label: "Emergency", href: "/emergency/settings", icon: AlertTriangle }
];

const doctorNavItems = [
  { label: "Patient Records", href: "/doctor", icon: ClipboardList },
];

export function AppNavbar({ userName = "Sanchit Kumar Mishra", userRole = "patient" }: AppNavbarProps) {
  const pathname = usePathname();
  const navItems = userRole === "doctor" ? doctorNavItems : patientNavItems;
  const { data: session, status } = useSession();
  const isAuthed = status === "authenticated";
  const effectiveUserName = isAuthed ? (session?.user?.name || session?.user?.email || userName) : userName;
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  useEffect(() => {
    let ignore = false;
    async function fetchAvatar() {
      try {
        const res = await fetch('/api/profile', { method: 'GET' });
        if (!res.ok) return;
        const data = await res.json();
        const url = data?.profile?.profileImageUrl || null;
        if (!ignore) setAvatarUrl(url);
      } catch {}
    }
    if (isAuthed) fetchAvatar();
    return () => { ignore = true; };
  }, [isAuthed]);

  useEffect(() => {
    function onProfileUpdated() {
      (async () => {
        try {
          const res = await fetch('/api/profile', { method: 'GET' });
          if (!res.ok) return;
          const data = await res.json();
          setAvatarUrl(data?.profile?.profileImageUrl || null);
        } catch {}
      })();
    }
    window.addEventListener('profile:updated', onProfileUpdated);
    return () => window.removeEventListener('profile:updated', onProfileUpdated);
  }, []);

  const roleLabels = {
    patient: "Patient",
    doctor: "Healthcare Provider",
    admin: "Administrator",
  } as const;

  return (
    <>
      <header className="h-20 border-b border-border bg-card px-8 flex items-center justify-between sticky top-0 z-40">
      {/* Left section logo */}
      <div className="flex items-center gap-10">
        <Link href="/home" className="flex items-center gap-4 hover:opacity-80 transition-opacity no-underline text-inherit flex-shrink-0">
          <Image src="/logo.jpg" alt="MediLocker Logo" width={44} height={36} className="rounded-sm" />
          <span className="text-xl font-bold tracking-tight text-foreground hidden lg:block">MediLocker</span>
        </Link>

        {/* Desktop Navigation - Hidden on mobile */}
        <nav className="hidden md:flex items-center gap-2">
          {navItems.map((item) => {
            // FIX: Robust highlight logic
            // For root ("/") and "/doctor", we check exact match. For others, we check startsWith.
            const isActive = item.href === "/" || item.href === "/doctor"
              ? pathname === item.href
              : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2.5 px-4 py-2.5 rounded-lg text-sm font-medium transition-all no-underline whitespace-nowrap",
                  isActive 
                    ? "bg-primary/10 text-primary shadow-sm" 
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <item.icon className={cn("h-4.5 w-4.5", isActive ? "text-primary" : "text-muted-foreground")} />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Mobile Hamburger Menu Button - Only on mobile */}
      <button
        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        className="md:hidden flex items-center justify-center h-10 w-10 rounded-lg hover:bg-muted transition-colors"
        aria-label="Toggle menu"
      >
        {mobileMenuOpen ? (
          <X className="h-5 w-5 text-foreground" />
        ) : (
          <Menu className="h-5 w-5 text-foreground" />
        )}
      </button>

      {/* Right section  */}
      <div className="hidden md:flex items-center gap-6">
        {isAuthed ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                className="flex items-center gap-4 pl-5 pr-2 h-12 w-auto min-w-fit rounded-full border border-border hover:bg-muted/40 transition-all shadow-sm"
              >
                <div className="text-left hidden sm:flex flex-col justify-center">
                  <span className="text-sm font-semibold leading-tight tracking-tight text-foreground whitespace-nowrap">
                    {effectiveUserName}
                  </span>
                  <span className="text-[11px] text-muted-foreground font-medium">
                    {roleLabels[userRole]}
                  </span>
                </div>

                {avatarUrl ? (
                  <Image
                    src={avatarUrl}
                    alt="Avatar"
                    width={36}
                    height={36}
                    unoptimized
                    className="h-9 w-9 rounded-full object-cover border border-border flex-shrink-0"
                  />
                ) : (
                  <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20 shadow-inner flex-shrink-0">
                    <User className="h-5 w-5 text-primary" />
                  </div>
                )}
              </Button>
            </DropdownMenuTrigger>
            
            <DropdownMenuContent align="end" className="w-64 mt-3 p-2 rounded-xl">
              <DropdownMenuLabel className="font-normal px-3 py-3">
                <div className="flex flex-col space-y-1.5">
                  <p className="text-sm font-semibold leading-none">{effectiveUserName}</p>
                  <p className="text-xs leading-none text-muted-foreground">{roleLabels[userRole]}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="my-2" />
              <DropdownMenuItem asChild className="rounded-lg py-2.5 cursor-pointer">
                <Link href="/profile" className="flex items-center w-full text-black no-underline hover:text-black hover:no-underline focus:text-black focus:no-underline visited:text-black">
                  <User className="mr-3 h-4 w-4" /> Profile Settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator className="my-2" />
              <DropdownMenuItem
                className="text-destructive focus:bg-destructive/10 focus:text-destructive rounded-lg py-2.5 cursor-pointer"
                onSelect={(event) => {
                  event.preventDefault();
                  signOut({ callbackUrl: "/home" });
                }}
              >
                <LogOut className="mr-3 h-4 w-4" /> Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Link href="/auth" className="no-underline">
            <Button className="h-10 rounded-full px-5">Sign In</Button>
          </Link>
        )}
      </div>
    </header>

    {/* Mobile Navigation Menu - Only on mobile and when open */}
    {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 top-20 bg-black/50 z-30" onClick={() => setMobileMenuOpen(false)}>
          <nav
            className="absolute top-0 left-0 right-0 bg-card border-b border-border rounded-b-lg shadow-lg overflow-hidden"
            onClick={(event) => event.stopPropagation()}
          >
            {navItems.map((item) => {
              const isActive = item.href === "/" || item.href === "/doctor"
                ? pathname === item.href
                : pathname.startsWith(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3.5 text-sm font-medium transition-all no-underline border-b border-border/50 last:border-b-0",
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-foreground hover:bg-muted"
                  )}
                >
                  <item.icon className={cn("h-4 w-4", isActive ? "text-primary" : "text-muted-foreground")} />
                  {item.label}
                </Link>
              );
            })}

            <div className="border-t border-border/50 p-3">
              {isAuthed ? (
                <>
                  <Link
                    href="/profile"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium text-foreground hover:bg-muted no-underline"
                  >
                    <User className="h-4 w-4 text-muted-foreground" />
                    Profile Settings
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      signOut({ callbackUrl: "/home" });
                    }}
                    className="mt-2 flex w-full items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium text-destructive hover:bg-destructive/10"
                  >
                    <LogOut className="h-4 w-4" />
                    Sign Out
                  </button>
                </>
              ) : (
                <Link
                  href="/auth"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center justify-center rounded-lg px-3 py-3 text-sm font-medium text-foreground hover:bg-muted no-underline"
                >
                  Sign In
                </Link>
              )}
            </div>
          </nav>
        </div>
    )}
    </>
  );
}