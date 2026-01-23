import React from "react";

function Hero({ isAuthed }: { isAuthed: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center text-center px-5 pt-16 pb-10">
      
      <img
  src="/home.png"
  alt="Hero Image"
  className="w-full max-w-3xl mb-6"
/>

      <h1 className="text-4xl md:text-5xl font-semibold mb-4">
        Your Health Records, Your Control
      </h1>

      <p className="text-lg text-gray-600 max-w-2xl">
        Securely store, manage, and share medical records in one place.
      </p>
    </div>
  );
}

export default Hero;
