import React from "react";

function Awards() {
  return (
    <div className="container mt-4 px-3 md:px-0 md:mt-5">
      <div className="row align-items-center g-4">
        <div className="col-12 col-md-6 text-center">
          <img src="https://placehold.co/600x400?text=Largest+Broker" className="img-fluid mx-auto" style={{ maxWidth: "100%" }} />
        </div>
        <div className="col-12 col-md-6 mt-0 md:mt-5 text-center md:text-start">
          <h1 className="text-2xl md:text-3xl leading-tight">Transforming health tech by making medical records secure, accessible, and family-friendly.</h1>
          <p className="mb-5">
          </p>
          <div className="row g-2">
            <div className="col-12 sm:col-6">
              <ul>
                <li>
                  <p className="text-sm md:text-base">Emergency Qr</p>
                </li>
                <li>
                  <p className="text-sm md:text-base">Tracking files</p>
                </li>
                
              </ul>
            </div>
            <div className="col-12 sm:col-6">
              <ul>
                
                <li>
                  <p className="text-sm md:text-base">Automatic ER form Filling</p>
                </li>
                <li>
                  <p className="text-sm md:text-base">Family viewing </p>
                </li>
              </ul>
            </div>
          </div>
          <img src="https://placehold.co/800x120?text=Press+Logos" className="img-fluid" style={{ width: "100%", maxWidth: 560 }} />
        </div>
      </div>
    </div>
  );
}

export default Awards;