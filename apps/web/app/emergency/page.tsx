export default function EmergencyAccessPage() {
  return (
    <div className="container" style={{ maxWidth: 720 }}>
      <div className="my-4 p-3 border rounded" style={{ background: '#fff' }}>
        <h1 className="h5" style={{ color: '#b91c1c' }}>Emergency Access</h1>
        <p className="text-muted small mb-3">This limited view is for emergency responders. Data is read-only and time-limited.</p>

        <div className="mb-3 p-2 border rounded bg-light">
          <div className="d-flex justify-content-between">
            <span className="small">Access window</span>
            <strong className="small">00:09:59</strong>
          </div>
        </div>

        <h2 className="h6">Shared Data</h2>
        <ul className="text-muted small">
          <li>Name, age</li>
          <li>Primary conditions</li>
          <li>Allergies</li>
          <li>Current medications</li>
          <li>Emergency contacts</li>
        </ul>

        <div className="d-flex gap-2 mt-3">
          <button className="btn btn-sm btn-danger">Revoke now</button>
          <button className="btn btn-sm btn-outline-secondary">Extend 10 min</button>
        </div>
      </div>
    </div>
  );
}
