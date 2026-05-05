function Awards() {
  return (
    <div className="container mt-4 px-3 md:px-0 md:mt-5">
      {/* Vertically center both columns */}
      <div className="row align-items-center g-4">
        
        {/* IMAGE COLUMN */}
        <div className="col-12 col-md-6 text-center">
          <img
            src="/pic1.png"
            className="img-fluid mx-auto"
            style={{ transform: "scale(1)", maxWidth: "100%" }}
            alt="Dashboard preview"
          />
        </div>

        {/* TEXT COLUMN */}
        <div className="col-12 col-md-6 text-center md:text-start">
          <h1 className="text-2xl md:text-3xl mb-4 leading-tight">
            Transforming health tech by making medical records secure,
            accessible, and family-friendly.
          </h1>

          <div className="row g-2">
            <div className="col-12 sm:col-6">
              <ul className="list-unstyled">
                <li className="text-sm md:text-base">Emergency QR</li>
                <li className="text-sm md:text-base">Tracking files</li>
              </ul>
            </div>

            <div className="col-12 sm:col-6">
              <ul className="list-unstyled">
                <li className="text-sm md:text-base">Automatic ER form filling</li>
                <li className="text-sm md:text-base">Family viewing</li>
              </ul>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

export default Awards;
