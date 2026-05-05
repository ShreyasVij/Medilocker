import React from "react";

function Stats() {
  return (
    <div className="container mt-4 px-3 md:px-0 md:mt-5">
      {/* Center image + text vertically */}
      <div className="row align-items-center g-4">

        {/* TEXT COLUMN */}
        <div className="col-12 col-md-6 pe-md-5 text-center md:text-start">
          <h1 className="text-2xl md:text-3xl mb-4 md:mb-5 leading-tight">Trust with confidence</h1>

          <h2 className="text-lg md:text-2xl">Customer-first always</h2>
          <p className="text-muted text-sm md:text-base">
            Trusted to protect what matters most — your health data.
          </p>

          <h2 className="text-lg md:text-2xl mt-4">No spam or gimmicks</h2>
          <p className="text-muted text-sm md:text-base">
            No gimmicks, spam, "gamification", or annoying push notifications.
            High quality apps that you use at your pace, the way you like.
          </p>

          <h2 className="text-lg md:text-2xl mt-4">The File universe</h2>
          <p className="text-muted text-sm md:text-base">
            Not just an app, but a whole ecosystem. Our app is made for
            tailored services specific to your needs in an emergency.
          </p>

          <h2 className="text-lg md:text-2xl mt-4">Do better with money</h2>
          <p className="text-muted text-sm md:text-base mb-0">
            With features like family access controls and emergency sharing,
            MediLocker doesn’t just store records — it actively helps you manage
            your health better.
          </p>
        </div>

        {/* IMAGE COLUMN */}
        <div className="col-12 col-md-6 text-center">
          <img
            src="/pic2.png"
            alt="Document processing preview"
            className="img-fluid mx-auto"
            style={{ transform: "scale(1)", maxWidth: "100%" }}
          />
        </div>

      </div>
    </div>
  );
}

export default Stats;
