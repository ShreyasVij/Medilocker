import React from "react";

function Stats() {
  return (
    <div className="container p-3 px-md-0">
      <div className="row align-items-center g-4 py-4 md:py-5">
        <div className="col-12 col-md-6 text-center md:text-start">
          <h1 className="text-2xl md:text-3xl mb-4 md:mb-5 leading-tight">Trust with confidence</h1>
          <h2 className="text-lg md:text-2xl">Customer-first always</h2>
          <p className="text-muted text-sm md:text-base">
            Trusted to protect what matters most — your health data.
          </p>
          <h2 className="text-lg md:text-2xl">No spam or gimmicks</h2>
          <p className="text-muted text-sm md:text-base">
            No gimmicks, spam, "gamification", or annoying push notifications.
            High quality apps that you use at your pace, the way you like.
          </p>
          <h2 className="text-lg md:text-2xl">The File universe</h2>
          <p className="text-muted text-sm md:text-base">
            Not just an app, but a whole ecosystem.Our app is 
            made for tailored services specific to your needs in an Emergency.
          </p>
          <h2 className="text-lg md:text-2xl">Do better with money</h2>
          <p className="text-muted text-sm md:text-base mb-0">
            With features like family access controls and emergency sharing, 
            MediLocker doesn’t just store records — it actively helps you manage your health better.
          </p>
        </div>
        <div className="col-12 col-md-6 text-center">
          <img src="https://placehold.co/900x600?text=Ecosystem" className="img-fluid mx-auto" style={{ width: "100%", maxWidth: 560 }} />
          <div className="text-center">
          </div>
        </div>
      </div>
    </div>
  );
}

export default Stats;