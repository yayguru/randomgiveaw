import { GiveawayResult } from '../App';
import { Trophy, Users, Hash, Clock } from 'lucide-react';

interface ResultsDisplayProps {
  result: GiveawayResult;
}

export default function ResultsDisplay({ result }: ResultsDisplayProps) {
  return (
    <div className="results-display">
      <h2>
        <Trophy size={24} />
        Giveaway Results
      </h2>

      <div className="result-card winner-card">
        <div className="result-label">🎉 WINNER</div>
        <div className="result-value winner">{result.winner}</div>
      </div>

      <div className="result-grid">
        <div className="result-card">
          <div className="result-label">
            <Users size={18} />
            Participants
          </div>
          <div className="result-value">{result.participants.length}</div>
        </div>

        <div className="result-card">
          <div className="result-label">
            <Clock size={18} />
            Timestamp
          </div>
          <div className="result-value">
            {new Date(result.timestamp).toLocaleString()}
          </div>
        </div>
      </div>

      <div className="result-card">
        <div className="result-label">
          <Hash size={18} />
          Random Seed
        </div>
        <div className="result-value hash">
          {result.randomSeed}
        </div>
      </div>

      <div className="result-card">
        <div className="result-label">
          <Hash size={18} />
          Verification Hash
        </div>
        <div className="result-value hash">
          {result.verificationHash}
        </div>
      </div>
    </div>
  );
}
