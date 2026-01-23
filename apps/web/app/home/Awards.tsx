function Awards() {
  return (
    <div className="container mt-5">
      {/* Vertically center both columns */}
      <div className="row align-items-center">
        
        {/* IMAGE COLUMN */}
        <div className="col-6">
          <img
            src="/pic1.png"
            className="img-fluid"
            style={{ transform: "scale(1)" }}
            alt="Dashboard preview"
          />
        </div>

        {/* TEXT COLUMN */}
        <div className="col-6">
          <h1 className="mb-4">
            Transforming health tech by making medical records secure,
            accessible, and family-friendly.
          </h1>

          <div className="row">
            <div className="col-6">
              <ul className="list-unstyled">
                <li>Emergency QR</li>
                <li>Tracking files</li>
              </ul>
            </div>

            <div className="col-6">
              <ul className="list-unstyled">
                <li>Automatic ER form filling</li>
                <li>Family viewing</li>
              </ul>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

export default Awards;
