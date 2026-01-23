import Link from "next/link";

export default function Footer() {
  return (
    <footer className="bg-background border-t border-border text-muted-foreground mt-auto w-full">
      <div className="max-w-7xl mx-auto px-6 py-10 md:py-16">
        <div className="flex flex-col md:flex-row justify-between gap-12">
          
          {/* Brand - Explicitly take 1/3 space on desktop */}
          <div className="flex-1 space-y-4 max-w-sm">
            <Link href="/" className="hover:opacity-80 transition-opacity no-underline">
              <h5 className="text-xl font-bold text-foreground">MediLocker</h5>
            </Link>
            <p className="text-sm leading-relaxed">
              MediLocker is a secure digital vault for your medical records,
              enabling seamless access, sharing, and long-term health tracking.
            </p>
          </div>

          {/* Resources - Fixed Width for consistent alignment */}
          <div className="flex-1 md:flex md:flex-col md:items-center">
            <div className="space-y-4">
              <h6 className="text-xs font-bold uppercase tracking-widest text-foreground">Resources</h6>
              <ul className="space-y-3 text-sm">
                <li><a href="#" className="hover:text-primary transition-colors">Privacy Policy</a></li>
                <li><a href="#" className="hover:text-primary transition-colors">Terms of Service</a></li>
                <li><a href="#" className="hover:text-primary transition-colors">Security</a></li>
                <li><a href="#" className="hover:text-primary transition-colors">Support</a></li>
              </ul>
            </div>
          </div>

          {/* Contact - Aligned Right on desktop */}
          <div className="flex-1 md:text-right space-y-4">
            <h6 className="text-xs font-bold uppercase tracking-widest text-foreground">Contact</h6>
            <div className="space-y-2 text-sm">
              <p className="font-semibold text-foreground">medilocker@gmail.com</p>
              <p>India</p>
              <p>Designed for secure healthcare data access.</p>
            </div>
          </div>
        </div>

        <div className="mt-12 border-t border-border pt-8 text-center text-xs opacity-60">
          © {new Date().getFullYear()} MediLocker. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
