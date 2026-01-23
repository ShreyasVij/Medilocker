import React from "react";

function Hero({ isAuthed }: { isAuthed: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center text-center p-5 mb-5">
      <img src="/homeHero.png" alt="Hero Image" className="mb-4 max-w-md" />
      <h1>Your Health Records, Your Control</h1>
      <p className="mb-4">Securely store, manage, and share medical records in one place.</p>
      {/* Intentionally no sign-in CTA here; top-right navbar handles sign-in */}
    </div>
  );
}

export default Hero;