import React from "react";

function Awards() {
  return (
    <div className="container mt-5">
      <div className="row">
        <div className="col-6 p-5">
          <img src="https://placehold.co/600x400?text=Largest+Broker" />
        </div>
        <div className="col-6 p-5 mt-5">
          <h1>Transforming health tech by making medical records secure, accessible, and family-friendly.</h1>
          <p className="mb-5">
          </p>
          <div className="row">
            <div className="col-6">
              <ul>
                <li>
                  <p>Emergency Qr</p>
                </li>
                <li>
                  <p>Tracking files</p>
                </li>
                
              </ul>
            </div>
            <div className="col-6">
              <ul>
                
                <li>
                  <p>Automatic ER form Filling</p>
                </li>
                <li>
                  <p>Family viewing </p>
                </li>
              </ul>
            </div>
          </div>
          <img src="https://placehold.co/800x120?text=Press+Logos" style={{ width: "90%" }} />
        </div>
      </div>
    </div>
  );
}

export default Awards;