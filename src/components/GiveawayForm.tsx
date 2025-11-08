import { useState } from 'react';
import { createLightNode, waitForRemotePeer, Protocols } from '@waku/sdk';
import { GiveawayResult } from '../App';
import { Users, Play, Clock } from 'lucide-react';

interface GiveawayFormProps {
  address: string;
  onResult: (result: GiveawayResult) => void;
}

interface Commitment {
  address: string;
  commitment: string;
  timestamp: number;
}

interface Reveal {
  address: string;
  secret: string;
  timestamp: number;
}

const COMMIT_TOPIC = '/nft-giveaway/1/commits/proto';
const REVEAL_TOPIC = '/nft-giveaway/1/reveals/proto';
const COMMIT_WINDOW = 30000; // 30 seconds
const REVEAL_WINDOW = 30000; // 30 seconds

export default function GiveawayForm({ address, onResult }: GiveawayFormProps) {
  const [participants, setParticipants] = useState<string>('');
  const [running, setRunning] = useState(false);
  const [phase, setPhase] = useState<'idle' | 'commit' | 'reveal' | 'complete'>('idle');
  const [timeLeft, setTimeLeft] = useState(0);
  const [status, setStatus] = useState('');

  const generateCommitment = async (secret: string): Promise<string> => {
    const encoder = new TextEncoder();
    const data = encoder.encode(secret);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  };

  const runGiveaway = async () => {
    if (!participants.trim()) {
      setStatus('❌ Add participants first');
      return;
    }

    const participantList = participants
      .split('\n')
      .map(p => p.trim())
      .filter(p => p.length > 0);

    if (participantList.length === 0) {
      setStatus('❌ No valid participants');
      return;
    }

    setRunning(true);
    setStatus('🔧 Initializing Waku node...');

    try {
      // Initialize Waku
      const node = await createLightNode({ defaultBootstrap: true });
      await node.start();
      await waitForRemotePeer(node, [Protocols.LightPush, Protocols.Filter]);
      
      setStatus('✅ Connected to Waku network');

      // COMMIT PHASE
      setPhase('commit');
      setStatus('📝 COMMIT PHASE - Broadcasting commitment...');
      
      const secret = crypto.randomUUID();
      const commitment = await generateCommitment(secret);
      const commitments: Commitment[] = [];

      // Broadcast commitment
      const commitMsg = {
        address,
        commitment,
        timestamp: Date.now()
      };

      await node.lightPush.send({
        contentTopic: COMMIT_TOPIC,
        payload: new TextEncoder().encode(JSON.stringify(commitMsg))
      });

      commitments.push(commitMsg);

      // Listen for other commitments
      const commitDecoder = {
        contentTopic: COMMIT_TOPIC,
        fromWireToProtoObj: (bytes: Uint8Array) => bytes
      };

      await node.filter.subscribe([commitDecoder], (msg) => {
        if (msg.payload) {
          const data = JSON.parse(new TextDecoder().decode(msg.payload));
          if (data.address !== address) {
            commitments.push(data);
          }
        }
      });

      // Wait for commit window
      let remaining = COMMIT_WINDOW / 1000;
      const commitInterval = setInterval(() => {
        remaining--;
        setTimeLeft(remaining);
        setStatus(`📝 COMMIT PHASE - ${remaining}s remaining (${commitments.length} commits)`);
        if (remaining <= 0) clearInterval(commitInterval);
      }, 1000);

      await new Promise(resolve => setTimeout(resolve, COMMIT_WINDOW));

      // REVEAL PHASE
      setPhase('reveal');
      setStatus('🔓 REVEAL PHASE - Broadcasting reveal...');
      
      const reveals: Reveal[] = [];

      // Broadcast reveal
      const revealMsg = {
        address,
        secret,
        timestamp: Date.now()
      };

      await node.lightPush.send({
        contentTopic: REVEAL_TOPIC,
        payload: new TextEncoder().encode(JSON.stringify(revealMsg))
      });

      reveals.push(revealMsg);

      // Listen for other reveals
      const revealDecoder = {
        contentTopic: REVEAL_TOPIC,
        fromWireToProtoObj: (bytes: Uint8Array) => bytes
      };

      await node.filter.subscribe([revealDecoder], (msg) => {
        if (msg.payload) {
          const data = JSON.parse(new TextDecoder().decode(msg.payload));
          if (data.address !== address) {
            reveals.push(data);
          }
        }
      });

      // Wait for reveal window
      remaining = REVEAL_WINDOW / 1000;
      const revealInterval = setInterval(() => {
        remaining--;
        setTimeLeft(remaining);
        setStatus(`🔓 REVEAL PHASE - ${remaining}s remaining (${reveals.length} reveals)`);
        if (remaining <= 0) clearInterval(revealInterval);
      }, 1000);

      await new Promise(resolve => setTimeout(resolve, REVEAL_WINDOW));

      // VERIFICATION & SELECTION
      setPhase('complete');
      setStatus('🔍 Verifying reveals...');

      // Verify reveals match commitments
      const validReveals = [];
      for (const reveal of reveals) {
        const expectedCommitment = await generateCommitment(reveal.secret);
        const matchingCommit = commitments.find(
          c => c.address === reveal.address && c.commitment === expectedCommitment
        );
        if (matchingCommit) {
          validReveals.push(reveal);
        }
      }

      setStatus(`✅ ${validReveals.length}/${reveals.length} reveals verified`);

      // Combine entropy
      const combinedEntropy = validReveals
        .map(r => r.secret)
        .sort()
        .join('');

      const finalHash = await generateCommitment(combinedEntropy);
      
      // Select winner
      const hashNum = parseInt(finalHash.slice(0, 8), 16);
      const winnerIndex = hashNum % participantList.length;
      const winner = participantList[winnerIndex];

      const result: GiveawayResult = {
        winner,
        timestamp: Date.now(),
        participants: participantList,
        randomSeed: finalHash,
        verificationHash: finalHash
      };

      onResult(result);
      setStatus('🎉 Winner selected!');

      await node.stop();

    } catch (error) {
      console.error('Giveaway failed:', error);
      setStatus(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setRunning(false);
      setPhase('idle');
    }
  };

  return (
    <div className="giveaway-form">
      <h2>
        <Users size={24} />
        Setup Giveaway
      </h2>

      <div className="form-group">
        <label>Participants (one per line)</label>
        <textarea
          value={participants}
          onChange={(e) => setParticipants(e.target.value)}
          placeholder="inj1abc...&#10;inj1def...&#10;inj1ghi..."
          rows={8}
          disabled={running}
        />
      </div>

      <button 
        onClick={runGiveaway} 
        disabled={running || !participants.trim()}
        className="btn-primary"
      >
        {running ? (
          <>
            <Clock size={20} className="spin" />
            Running...
          </>
        ) : (
          <>
            <Play size={20} />
            Start Giveaway
          </>
        )}
      </button>

      {status && (
        <div className={`status ${phase}`}>
          {status}
          {timeLeft > 0 && <span className="timer">{timeLeft}s</span>}
        </div>
      )}
    </div>
  );
}
