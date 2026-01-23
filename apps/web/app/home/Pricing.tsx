import React from "react";

function Pricing() {
  return (
    <div className="container">
      <div className="row">
        <div className="col-4">
          <h1 className="mb-3 fs-2">Transparent pricing</h1>
          <p>
            We believe healthcare data access should be simple and fair. 
            No hidden charges, no surprises — just clear and transparent pricing.
          </p>
        </div>
        <div className="col-2"></div>
        <div className="col-6  mb-5">
          <div className="row text-center">
            <div className="col p-3 border">
              <h1 className="mb-3">₹300</h1>
              <p>
                For 250Gb 
                <br />
                for Single Person 
              </p>
            </div>
            <div className="col p-3 border">
              <h1 className="mb-3">₹250</h1>
              <p>
                For 250Gb 
                <br />
                for Family Pack of 5 
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Pricing;