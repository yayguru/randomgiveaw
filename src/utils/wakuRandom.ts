import { createLightNode, waitForRemotePeer, Protocols, createEncoder, createDecoder } from '@waku/sdk';
import { GiveawayResult } from '../App';

const CONTENT_TOPIC = '/giveaway-randomness/1/commit-reveal/proto';

interface CommitMessage {
  participantId: string;
  commitment: string; // hash of secret
  timestamp: number;
}

interface RevealMessage {
  participantId: string;
  secret: string;
  timestamp: number;
}

/**
 * Real Waku-based verifiable randomness using commit-reveal scheme
 */
export async function selectWinner(
  participants: string[],
  organizerAddress: string
): Promise<GiveawayResult> {
  const node = await createLightNode({ defaultBootstrap: true });
  await node.start();
  await waitForRemotePeer(node, [Protocols.LightPush, Protocols.Filter]);

  const encoder = createEncoder({ contentTopic: CONTENT_TOPIC });
  const decoder = createDecoder(CONTENT_TOPIC);

  // Generate our secret
  const ourSecret = generateSecret();
  const ourCommitment = await hashSecret(ourSecret);
  
  const commits: CommitMessage[] = [];
  const reveals: RevealMessage[] = [];

  // Phase 1: Commit phase - collect commitments
  const commitMessage: CommitMessage = {
    participantId: organizerAddress,
    commitment: ourCommitment,
    timestamp: Date.now(),
  };

  // Send our commitment
  await node.lightPush.send(encoder, {
    payload: new TextEncoder().encode(JSON.stringify(commitMessage)),
  });

  commits.push(commitMessage);

  // Listen for other commitments (in real implementation, wait for multiple participants)
  const commitDeadline = Date.now() + 30000; // 30 second commit window
  
  await new Promise<void>((resolve) => {
    const unsubscribe = node.filter.subscribe([decoder], (message) => {
      if (!message.payload) return;
      
      try {
        const data = JSON.parse(new TextDecoder().decode(message.payload));
        if (data.commitment && !data.secret) {
          commits.push(data as CommitMessage);
        }
      } catch (e) {
        console.error('Failed to parse commit message:', e);
      }

      if (Date.now() >= commitDeadline) {
        unsubscribe.then(() => resolve());
      }
    });

    setTimeout(() => {
      unsubscribe.then(() => resolve());
    }, 30000);
  });

  // Phase 2: Reveal phase - reveal secrets
  const revealMessage: RevealMessage = {
    participantId: organizerAddress,
    secret: ourSecret,
    timestamp: Date.now(),
  };

  await node.lightPush.send(encoder, {
    payload: new TextEncoder().encode(JSON.stringify(revealMessage)),
  });

  reveals.push(revealMessage);

  // Listen for reveals
  const revealDeadline = Date.now() + 30000; // 30 second reveal window

  await new Promise<void>((resolve) => {
    const unsubscribe = node.filter.subscribe([decoder], (message) => {
      if (!message.payload) return;
      
      try {
        const data = JSON.parse(new TextDecoder().decode(message.payload));
        if (data.secret) {
          reveals.push(data as RevealMessage);
        }
      } catch (e) {
        console.error('Failed to parse reveal message:', e);
      }

      if (Date.now() >= revealDeadline) {
        unsubscribe.then(() => resolve());
      }
    });

    setTimeout(() => {
      unsubscribe.then(() => resolve());
    }, 30000);
  });

  // Verify reveals match commitments
  const validReveals = await verifyReveals(commits, reveals);

  // Combine all valid secrets for final randomness
  const combinedEntropy = validReveals.map(r => r.secret).join('|');
  const finalSeed = await hashSecret(combinedEntropy);

  // Select winner deterministically from seed
  const participantsHash = await hashParticipants(participants, finalSeed);
  const winnerIndex = parseInt(participantsHash.slice(0, 8), 16) % participants.length;
  const winner = participants[winnerIndex];

  const verificationHash = await generateVerificationHash(
    participants,
    winner,
    finalSeed,
    organizerAddress,
    commits,
    validReveals
  );

  await node.stop();

  return {
    winner,
    timestamp: Date.now(),
    participants: [...participants],
    randomSeed: finalSeed,
    verificationHash,
  };
}

function generateSecret(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

async function hashSecret(secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(secret);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function verifyReveals(
  commits: CommitMessage[],
  reveals: RevealMessage[]
): Promise<RevealMessage[]> {
  const valid: RevealMessage[] = [];

  for (const reveal of reveals) {
    const commit = commits.find(c => c.participantId === reveal.participantId);
    if (!commit) continue;

    const revealHash = await hashSecret(reveal.secret);
    if (revealHash === commit.commitment) {
      valid.push(reveal);
    }
  }

  return valid;
}

async function hashParticipants(participants: string[], seed: string): Promise<string> {
  const data = participants.join('|') + '|' + seed;
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function generateVerificationHash(
  participants: string[],
  winner: string,
  seed: string,
  organizer: string,
  commits: CommitMessage[],
  reveals: RevealMessage[]
): Promise<string> {
  const data = [
    participants.join('|'),
    winner,
    seed,
    organizer,
    JSON.stringify(commits),
    JSON.stringify(reveals),
    Date.now().toString()
  ].join('::');
  
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function verifyResult(result: GiveawayResult, organizerAddress: string): Promise<boolean> {
  try {
    const participantsHash = await hashParticipants(result.participants, result.randomSeed);
    const expectedIndex = parseInt(participantsHash.slice(0, 8), 16) % result.participants.length;
    const expectedWinner = result.participants[expectedIndex];

    return expectedWinner === result.winner;
  } catch (error) {
    console.error('Verification failed:', error);
    return false;
  }
}
