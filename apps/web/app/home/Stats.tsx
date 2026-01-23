import React from "react";

function Stats() {
  return (
    <div className="container mt-5">
      {/* Center image + text vertically */}
      <div className="row align-items-center">

        {/* TEXT COLUMN */}
        <div className="col-6 pe-5">
          <h1 className="fs-2 mb-5">Trust with confidence</h1>

          <h2 className="fs-4">Customer-first always</h2>
          <p className="text-muted">
            Trusted to protect what matters most — your health data.
          </p>

          <h2 className="fs-4 mt-4">No spam or gimmicks</h2>
          <p className="text-muted">
            No gimmicks, spam, "gamification", or annoying push notifications.
            High quality apps that you use at your pace, the way you like.
          </p>

          <h2 className="fs-4 mt-4">The File universe</h2>
          <p className="text-muted">
            Not just an app, but a whole ecosystem. Our app is made for
            tailored services specific to your needs in an emergency.
          </p>

          <h2 className="fs-4 mt-4">Do better with money</h2>
          <p className="text-muted">
            With features like family access controls and emergency sharing,
            MediLocker doesn’t just store records — it actively helps you manage
            your health better.
          </p>
        </div>

        {/* IMAGE COLUMN */}
        <div className="col-6">
          <img
            src="/pic2.png"
            alt="Document processing preview"
            className="img-fluid"
            style={{ transform: "scale(1.25)" }}
          />
        </div>

      </div>
    </div>
  );
}

export default Stats;
