import { useState } from 'react';
import Header from './components/Header';
import WalletConnect from './components/WalletConnect';
import GiveawayForm from './components/GiveawayForm';
import ResultsDisplay from './components/ResultsDisplay';
import HowItWorks from './components/HowItWorks';
import './App.css';

export interface GiveawayResult {
  winner: string;
  timestamp: number;
  participants: string[];
  randomSeed: string;
  verificationHash: string;
}

function App() {
  const [address, setAddress] = useState('');
  const [result, setResult] = useState<GiveawayResult | null>(null);

  return (
    <div className="app">
      <Header />
      
      <main className="main-content">
        <div className="hero-section">
          <div className="hero-glow"></div>
          <h1 className="hero-title">NFT GIVEAWAY</h1>
          <p className="hero-subtitle">
            Decentralized, verifiable random winner selection using Waku network
          </p>
        </div>

        <WalletConnect address={address} setAddress={setAddress} />

        {address && (
          <>
            <GiveawayForm address={address} onResult={setResult} />
            {result && <ResultsDisplay result={result} />}
            <HowItWorks />
          </>
        )}
      </main>

      <footer className="footer">
        <p>Powered by Waku Network • Verifiable Randomness • Decentralized</p>
      </footer>
    </div>
  );
}

export default App;
