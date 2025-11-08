import { Shield } from 'lucide-react';

export default function Header() {
  return (
    <header className="header">
      <div className="header-content">
        <div className="logo">
          <Shield size={32} />
          <span>NFT GIVEAWAY</span>
        </div>
      </div>
    </header>
  );
}
