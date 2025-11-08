import { Shield, Clock, Users, CheckCircle } from 'lucide-react';

export default function HowItWorks() {
  return (
    <div className="how-it-works">
      <h2>How It Works</h2>
      
      <div className="steps">
        <div className="step">
          <div className="step-icon">
            <Users size={32} />
          </div>
          <h3>1. Commit Phase</h3>
          <p>All participants broadcast cryptographic commitments to the Waku network (30s window)</p>
        </div>

        <div className="step">
          <div className="step-icon">
            <Clock size={32} />
          </div>
          <h3>2. Reveal Phase</h3>
          <p>Participants reveal their secrets, verified against commitments (30s window)</p>
        </div>

        <div className="step">
          <div className="step-icon">
            <Shield size={32} />
          </div>
          <h3>3. Verification</h3>
          <p>All reveals are cryptographically verified and combined to generate randomness</p>
        </div>

        <div className="step">
          <div className="step-icon">
            <CheckCircle size={32} />
          </div>
          <h3>4. Winner Selection</h3>
          <p>Verifiable random seed selects winner from participant list</p>
        </div>
      </div>
    </div>
  );
}
