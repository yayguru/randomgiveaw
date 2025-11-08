# On-Chain Verification Requirements

## Smart Contract Architecture (Injective CosmWasm)

### Contract: GiveawayVerifier

```rust
// State Storage
pub struct GiveawayState {
    pub organizer: Addr,
    pub nft_collection: String,  // NFT contract address for eligibility
    pub commit_deadline: Timestamp,
    pub reveal_deadline: Timestamp,
    pub participants: Vec<Addr>,
    pub commitments: HashMap<Addr, String>,  // addr -> commitment_hash
    pub reveals: HashMap<Addr, String>,      // addr -> secret
    pub winner: Option<Addr>,
    pub random_seed: Option<String>,
    pub status: GiveawayStatus,
}

pub enum GiveawayStatus {
    Setup,
    CommitPhase,
    RevealPhase,
    Complete,
    Cancelled,
}
```

### Required Messages

```rust
// Execute Messages
pub enum ExecuteMsg {
    // 1. Organizer creates giveaway
    CreateGiveaway {
        nft_collection: String,
        commit_duration: u64,  // seconds
        reveal_duration: u64,
    },
    
    // 2. Participants register (must hold NFT)
    RegisterParticipant {},
    
    // 3. Participants submit commitment
    SubmitCommitment {
        commitment_hash: String,  // SHA256(secret)
    },
    
    // 4. Participants reveal secret
    RevealSecret {
        secret: String,
    },
    
    // 5. Anyone can trigger winner selection after reveal deadline
    SelectWinner {},
}

// Query Messages
pub enum QueryMsg {
    GetGiveaway {},
    GetParticipants {},
    GetCommitments {},
    GetReveals {},
    VerifyWinner { address: String },
}
```

### Critical Functions

```rust
// 1. NFT Ownership Verification
fn verify_nft_holder(
    deps: Deps,
    nft_contract: &str,
    address: &Addr,
) -> Result<bool, ContractError> {
    // Query NFT contract for token ownership
    let query_msg = Cw721QueryMsg::Tokens {
        owner: address.to_string(),
        start_after: None,
        limit: Some(1),
    };
    
    let response: TokensResponse = deps.querier.query_wasm_smart(
        nft_contract,
        &query_msg,
    )?;
    
    Ok(!response.tokens.is_empty())
}

// 2. Commitment Verification
fn verify_commitment(
    commitment: &str,
    secret: &str,
) -> Result<bool, ContractError> {
    let hash = sha256(secret.as_bytes());
    let hash_hex = hex::encode(hash);
    Ok(hash_hex == commitment)
}

// 3. Deterministic Winner Selection
fn select_winner_deterministic(
    participants: &[Addr],
    combined_entropy: &str,
) -> Result<Addr, ContractError> {
    let seed_hash = sha256(combined_entropy.as_bytes());
    let seed_int = u64::from_be_bytes(seed_hash[0..8].try_into().unwrap());
    let winner_index = (seed_int as usize) % participants.len();
    Ok(participants[winner_index].clone())
}
```

## What's Missing in Current Implementation

### 1. **Permanent Storage**
- ❌ Waku messages are ephemeral
- ✅ Need: Smart contract state storage
- ✅ Need: On-chain commitment registry
- ✅ Need: On-chain reveal registry

### 2. **Time-Lock Enforcement**
- ❌ Current: Trust Waku message timestamps
- ✅ Need: Block height/timestamp verification on-chain
- ✅ Need: Reject late commits/reveals via smart contract

### 3. **Eligibility Proof**
- ❌ Current: Anyone can enter any address
- ✅ Need: NFT ownership verification on-chain
- ✅ Need: Participant registration with proof

### 4. **Verifiable Computation**
- ❌ Current: Winner selection happens in browser
- ✅ Need: On-chain winner selection function
- ✅ Need: Anyone can verify by querying contract

### 5. **Immutable Audit Trail**
- ❌ Current: No permanent record
- ✅ Need: All commits stored on-chain
- ✅ Need: All reveals stored on-chain
- ✅ Need: Winner selection event emitted

### 6. **Slashing/Penalties**
- ❌ Current: No penalty for not revealing
- ✅ Need: Stake requirement (deposit INJ)
- ✅ Need: Slash stake if commit but don't reveal
- ✅ Need: Redistribute slashed funds

## Hybrid Architecture (Recommended)

### Phase 1: Off-Chain Coordination (Waku)
- Fast participant discovery
- Real-time status updates
- No gas costs for messaging

### Phase 2: On-Chain Verification (Smart Contract)
```
1. Organizer deploys giveaway contract
2. Participants register on-chain (proves NFT ownership)
3. Participants submit commitments on-chain
4. Commit deadline passes (enforced by block height)
5. Participants reveal secrets on-chain
6. Reveal deadline passes
7. Anyone triggers SelectWinner() on-chain
8. Contract computes winner deterministically
9. Winner address stored permanently on-chain
```

### Benefits
- ✅ Waku for UX (fast, free messaging)
- ✅ Smart contract for truth (permanent, verifiable)
- ✅ Anyone can verify winner independently
- ✅ Immutable proof of fairness

## Implementation Priority

### CRITICAL (Must Have)
1. **Smart contract for commit/reveal storage**
2. **On-chain NFT ownership verification**
3. **On-chain winner selection function**
4. **Block height time-locks**

### IMPORTANT (Should Have)
5. **Stake/slash mechanism**
6. **Event emission for indexing**
7. **Multi-giveaway support**

### NICE TO HAVE
8. **Waku integration for UX**
9. **Frontend verification UI**
10. **Historical giveaway queries**

## Gas Optimization Notes

- Store commitment hashes (32 bytes) not full secrets
- Use efficient data structures (HashMap vs Vec)
- Batch operations where possible
- Consider pagination for large participant lists

## Security Considerations

- **Frontrunning**: Commitments prevent this
- **Griefing**: Stake requirement prevents commit-no-reveal
- **Sybil**: NFT ownership requirement
- **Organizer Manipulation**: Deterministic selection from all reveals
- **Timestamp Manipulation**: Use block height not block timestamp

## Next Steps

1. Write CosmWasm smart contract
2. Deploy to Injective testnet
3. Integrate contract calls into frontend
4. Add verification UI
5. Test full flow end-to-end
