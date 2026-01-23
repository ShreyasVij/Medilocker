import React from "react";

function Stats() {
  return (
    <div className="container p-3">
      <div className="row p-5">
        <div className="col-6 p-5">
          <h1 className="fs-2 mb-5">Trust with confidence</h1>
          <h2 className="fs-4">Customer-first always</h2>
          <p className="text-muted">
            Trusted to protect what matters most — your health data.
          </p>
          <h2 className="fs-4">No spam or gimmicks</h2>
          <p className="text-muted">
            No gimmicks, spam, "gamification", or annoying push notifications.
            High quality apps that you use at your pace, the way you like.
          </p>
          <h2 className="fs-4">The File universe</h2>
          <p className="text-muted">
            Not just an app, but a whole ecosystem.Our app is 
            made for tailored services specific to your needs in an Emergency.
          </p>
          <h2 className="fs-4">Do better with money</h2>
          <p className="text-muted">
            With features like family access controls and emergency sharing, 
            MediLocker doesn’t just store records — it actively helps you manage your health better.
          </p>
        </div>
        <div className="col-6 p-5">
          <img src="https://placehold.co/900x600?text=Ecosystem" style={{ width: "90%" }} />
          <div className="text-center">
          </div>
        </div>
      </div>
    </div>
  );
}

export default Stats;