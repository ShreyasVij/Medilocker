import React from "react";

function Education() {
  return (
    <div className="container mt-5">
      <div className="row">
        <div className="col-6">
          <img src="https://placehold.co/700x400?text=Education" style={{ width: "70%" }} />
        </div>
        <div className="col-6">
          <h1 className="mb-3 fs-2">Free and open access to medical information and records</h1>
          <p>
            An open health education platform covering medical records, reports, and health basics
            from simple to advanced.
          </p>
          {/* <p className="mt-5">
            TradingQ&A, the most active trading and investment community in
            India for all your market related queries.
          </p> */}
        </div>
      </div>
    </div>
  );
}

export default Education;