import { useState } from 'react';
import { ChainId, EthereumChainId } from '@injectivelabs/ts-types';
import { WalletStrategy } from '@injectivelabs/wallet-strategy';
import { Wallet } from '@injectivelabs/wallet-base';
import { getInjectiveAddress } from '@injectivelabs/sdk-ts';
import { Wallet as WalletIcon, LogOut } from 'lucide-react';

const walletStrategy = new WalletStrategy({
  chainId: ChainId.Testnet,
  ethereumOptions: {
    ethereumChainId: EthereumChainId.Sepolia,
    rpcUrl: 'https://eth-sepolia.g.alchemy.com/v2/demo',
  },
});

interface WalletConnectProps {
  address: string;
  setAddress: (address: string) => void;
}

export default function WalletConnect({ address, setAddress }: WalletConnectProps) {
  const [connecting, setConnecting] = useState(false);

  const connect = async (wallet: Wallet) => {
    try {
      setConnecting(true);
      walletStrategy.setWallet(wallet);
      const addresses = await walletStrategy.getAddresses();
      const injAddress = getInjectiveAddress(addresses[0]);
      setAddress(injAddress);
    } catch (error) {
      console.error('Connection failed:', error);
    } finally {
      setConnecting(false);
    }
  };

  const disconnect = () => {
    setAddress('');
  };

  if (address) {
    return (
      <div className="wallet-connected">
        <div className="wallet-info">
          <WalletIcon size={20} />
          <span className="wallet-address">
            {address.slice(0, 12)}...{address.slice(-8)}
          </span>
        </div>
        <button onClick={disconnect} className="btn-disconnect">
          <LogOut size={18} />
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <div className="wallet-connect-section">
      <h2>Connect Wallet</h2>
      <div className="wallet-buttons">
        <button 
          onClick={() => connect(Wallet.Keplr)} 
          disabled={connecting}
          className="btn-wallet"
        >
          <WalletIcon size={20} />
          Keplr
        </button>
        <button 
          onClick={() => connect(Wallet.Leap)} 
          disabled={connecting}
          className="btn-wallet"
        >
          <WalletIcon size={20} />
          Leap
        </button>
        <button 
          onClick={() => connect(Wallet.Metamask)} 
          disabled={connecting}
          className="btn-wallet"
        >
          <WalletIcon size={20} />
          MetaMask
        </button>
      </div>
    </div>
  );
}
