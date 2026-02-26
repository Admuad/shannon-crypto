# Shannon Crypto - Technical Architecture

## Executive Summary

Shannon Crypto is an autonomous smart contract security auditing system that combines AI-driven reasoning with traditional static/dynamic analysis tools. Like Shannon (web pentesting), it follows a "proof-by-exploitation" philosophy - only reporting vulnerabilities that can be demonstrated through transaction execution.

## Design Principles

1. **Autonomous Operation** - Single command launches end-to-end audit
2. **Multi-Tool Orchestration** - Integrate Slither, Mythril, Echidna, Foundry
3. **AI-Augmented Analysis** - LLMs for pattern matching, reasoning, and synthesis
4. **Exploit-Based Validation** - Simulate transactions to prove vulnerabilities
5. **Benchmark-Driven** - Built to compete on EVMbench (120 curated vulns)
6. **Multi-Chain Support** - Start with Ethereum, scale to all EVM chains
7. **OpenClaw-Ready** - Chat-based control and scheduling

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CLI / OpenClaw Interface              │
│                   (Commands: audit, report, status)            │
└───────────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────────────┐
│                  Orchestration Layer (Temporal)               │
│   ┌──────────────┬───────────────┬──────────────┐│
│   │ Workflow      │ Task Queue    │ Worker Pool   ││
│   │ Engine       │ Management     │ (Docker)     ││
│   └──────────────┴───────────────┴──────────────┘│
└───────────────────────────┬─────────────────────────────────────┘
                        │
        ┌───────────────┴───────────────┐
        │                              │
        ▼                              ▼
┌───────────────────┐   ┌───────────────────────────────────┐
│  Intelligence     │   │      Tool Execution Layer        │
│  Layer          │   │                                │
│  ┌──────────┐    │   ┌────────┬───────────┬──────────┐│
│  │ AI      │    │   │Slither│Mythril  │Foundry   ││
│  │ Agents  │    │   └────────┴───────────┴──────────┘│
│  └────┬────┘    │                                │
│       │          │   ┌────────────────────────────┐│
│       ▼          │   │ RPC / Execution          ││
│  ┌───────────┐   │   └────────────────────────────┘│
│  │ Static    │   │                                │
│  │ Analysis  │   ▼                                │
│  └────┬─────┘   ┌────────────────────────────┐│
│       │          │   Local Testnet / Public      ││
│       ▼          │   (Anvil / Sepolia / etc.)  ││
│  ┌───────────┐   └────────────────────────────┘│
│  │ Dynamic    │                                   │
│  │ Analysis  │                                   │
│  └────┬─────┘   ┌────────────────────────────┐│
│       │          │   Etherscan / Blockscout   ││
│       ▼          └────────────────────────────┘│
│  ┌───────────┐                               │
│  │ On-chain   │                               │
│  │ Events     │                               │
│  └────┬─────┘   ┌────────────────────────────┐│
│       │          │   Report Generation          ││
│       ▼          └────────────────────────────┘│
│  ┌───────────┐                               │
│  │ Report    │                               │
│  │ + PoCs    │                               │
│  └───────────┘                               │
└─────────────────────────────────────────────────────────────┘
```

## Component Deep Dive

### 1. Orchestration Layer (Temporal)

**Purpose:** Manage end-to-end audit workflow, handle failures, enable parallelization

**Workflow Stages:**
1. **Reconnaissance** - Gather contract data, web3 integration, on-chain events
2. **Static Analysis** - Run Slither, Mythril, Echidna in parallel
3. **Dynamic Analysis** - Foundry tests, fuzzing, state mutation
4. **Vulnerability Synthesis** - AI agent combines findings from all tools
5. **Exploit Simulation** - Build and test exploit transactions on testnet
6. **Report Generation** - Create comprehensive audit report with PoCs

**Retry Strategy:**
- Transient errors (RPC timeout, network issues) - exponential backoff, max 10 retries
- Tool execution failures - retry with different tool variant (e.g., Slither vs. Mythril)
- AI agent failures - fallback to simpler model, continue with partial results

**State Management:**
- Each workflow = immutable workspace (git commits)
- Resume from last completed stage
- Checkpoint after each major phase

### 2. Intelligence Layer

#### 2.1 AI Agent System

**Purpose:** Use LLMs for pattern recognition, reasoning, and exploit construction

**Agent Types:**
- **recon-agent** - Analyze web3.js usage, wallet connections, API patterns
- **vuln-detection-agent** - Combine static analysis outputs, identify vulnerabilities
- **exploit-builder-agent** - Construct exploit transactions, calldata, gas estimates
- **report-agent** - Synthesize findings into human-readable report

**Prompt Engineering:**
- Chain-of-thought reasoning for complex vulnerabilities
- Few-shot examples from historical hacks (e.g., The DAO, Parity Wallet)
- Structured output for tool integration

**Model Fallback:**
- Primary: Claude Sonnet 4.5 (best reasoning)
- Secondary: Z.AI GLM-5 (cost-effective)
- Tertiary: OpenAI GPT-4o (widest compatibility)

#### 2.2 Static Analysis Tools

**Slither**
- Use case: Quick pattern-based scanning
- Output: JSON vulnerabilities with line numbers
- Strengths: Fast, low false positives for common patterns
- Weaknesses: Misses complex logical vulnerabilities

**Mythril**
- Use case: Symbolic execution, deep path exploration
- Output: Execution traces, counterexamples
- Strengths: Finds reentrancy, access control, logic bugs
- Weaknesses: Slow, requires heuristics to reduce state space

**Echidna**
- Use case: Property-based testing, coverage-guided fuzzing
- Output: Property violations, minimization
- Strengths: Finds edge cases, invariants violations
- Weaknesses: Requires good property definitions

**Medusa (Fuzzing)**
- Use case: Value mutation, assertion testing
- Output: Failing transactions, minimization
- Strengths: Finds integer overflows, boundary conditions
- Weaknesses: Time-intensive, many false positives

#### 2.3 Dynamic Analysis Tools

**Foundry Forge**
- Use case: Property testing, fuzzing, invariant checking
- Output: Failing test cases, gas reports
- Strengths: Fast, EVM-accurate, comprehensive
- Weaknesses: Requires test authoring skill

**Foundry Cast**
- Use case: Transaction simulation, state inspection
- Output: Execution traces, gas usage
- Strengths: Real EVM execution, fast
- Weaknesses: Read-only for stateful contracts

**Foundry Anvil**
- Use case: Local testnet, forking mainnet
- Output: EVM state, logs, accounts
- Strengths: Fast, fork support, deterministic
- Weaknesses: Slight EVM differences from mainnet

### 3. Execution Layer

#### 3.1 RPC Management

**Multi-Provider Strategy:**
```typescript
class RPCManager {
  providers: RPCProvider[] = [
    { name: 'alchemy', url: '...', priority: 1 },
    { name: 'infura', url: '...', priority: 2 },
    { name: 'quicknode', url: '...', priority: 3 },
  ];

  async call(tx: Transaction): Promise<Receipt> {
    for (const provider of this.providers) {
      try {
        return await provider.sendTransaction(tx);
      } catch (err) {
        if (!isRetryable(err)) continue;
      }
    }
    throw new Error('All RPC providers failed');
  }
}
```

**Fallback Strategy:**
- Primary: User-specified RPC (from CLI/env)
- Secondary: Public RPCs (default per chain)
- Tertiary: Backup RPCs (emergency fallback)

#### 3.2 Contract Deployment

**Testnet Deployment:**
- Sepolia, Goerli for Ethereum (low cost)
- Deploy exploit contracts to verify functionality
- Never deploy to mainnet without explicit approval

**Local Forking:**
- Anvil fork of mainnet state
- Execute transactions in forked environment
- Faster than testnet, no gas costs
- Slight EVM differences (not for final proof)

### 4. Data Layer

#### 4.1 Source Code Fetching

```typescript
interface SourceFetcher {
  async fetch(address: string): Promise<SourceCode> {
    // Try Etherscan API
    const etherscan = await this.etherscan.getSource(address);
    if (etherscan) return etherscan;

    // Fallback: Blockscout
    const blockscout = await this.blockscout.getSource(address);
    if (blockscout) return blockscout;

    // Fallback: DEDA (verified contracts)
    const deda = await this.deda.getSource(address);
    return deda;
  }
}
```

#### 4.2 On-Chain Events

```typescript
interface EventAnalyzer {
  async analyzeContract(address: string): Promise<EventAnalysis> {
    // Get all transactions
    const txs = await this.getTransactions(address);

    // Identify patterns
    const patterns = {
      highValueTransfers: txs.filter(t => t.value > 1000 * 10**18),
      flashLoanAttacks: this.detectFlashLoanPattern(txs),
      reentrancyCandidates: this.detectReentrancyPattern(txs),
    };

    return patterns;
  }
}
```

### 5. Report Generation

#### 5.1 Report Structure

```markdown
# Smart Contract Security Audit Report

## Executive Summary
- Contract Address: 0x...
- Chain: Ethereum
- Audit Date: 2026-02-26
- Overall Risk: HIGH

## Critical Findings (3)
### [CRIT-001] Reentrancy in withdraw()
**Severity:** Critical
**CVSS:** 9.1
**Location:** `contracts/Bank.sol:142-158`
**Description:** ...

### Proof of Concept
```solidity
contract Exploit {
    IBank public bank;
    function attack() external {
        uint256 balance = bank.balanceOf(address(this));
        bank.withdraw(balance);
        bank.withdraw(balance);
    }
}
```

**Exploit Transaction:**
- To: 0x...
- Value: 0 ETH
- Calldata: 0x...
- Gas Used: 150,000

### Recommendation
- Add non-reentrant modifier to withdraw()
- Use Checks-Effects-Interactions pattern

## High Findings (5)
...

## Medium Findings (8)
...

## Low Findings (12)
...

## Positive Findings
- Good use of OpenZeppelin contracts
- Proper event emission
- Clear documentation

## Appendix
- Tool versions used
- Scope definitions
- Testing methodology
```

### 5.2 Reproducibility

**Each vulnerability includes:**
1. Contract source (with line numbers)
2. Minimal exploit contract
3. Transaction calldata (hex and decoded)
4. Expected vs. actual results
5. Step-by-step exploitation guide

## Vulnerability Detection Strategy

### Multi-Tool Consensus

To reduce false positives, we require consensus across tools:

```typescript
interface Vulnerability {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  tools: {
    slither?: boolean;
    mythril?: boolean;
    echidna?: boolean;
    medusa?: boolean;
    ai?: boolean;
  };
  confidence: 'high' | 'medium' | 'low'; // Based on tool consensus
}

function assessConfidence(vuln: Vulnerability): 'high' | 'medium' | 'low' {
  const toolCount = Object.values(vuln.tools).filter(Boolean).length;
  const aiConfirmed = vuln.tools.ai;

  if (aiConfirmed && toolCount >= 2) return 'high';
  if (toolCount >= 1) return 'medium';
  return 'low';
}
```

### AI-Enhanced Pattern Recognition

The AI agent is trained on:

**Historical Hacks Database:**
- The DAO (reentrancy)
- Parity Multisig (init code bug)
- bZx (numeric overflow)
- Euler (donor manipulation)
- Wintermute (flash loan price manipulation)
- Mixin (oracle manipulation)
- **200+ more** in training set

**Vulnerability Patterns:**
- State patterns (variables, mappings, structs)
- Control flow patterns (if/else, loops, modifiers)
- External call patterns (delegatecall, low-level calls)
- Upgrade patterns (proxy patterns, implementation contracts)

**Contextual Reasoning:**
- Analyze entire contract suite, not just individual contracts
- Understand protocol logic (vaults, rewards, governance)
- Identify attack surface (public functions, access control)
- Consider economic incentives (arbitrage, governance attacks)

## Benchmarking Strategy

### EVMbench Integration

EVMbench provides:
- 120 curated vulnerabilities
- 40 historical audits
- Detect, Patch, and Exploit modes

**Integration Approach:**
```bash
# Run Shannon Crypto on EVMbench test suite
npm run benchmark:evmbench

# Generate comparison report
npm run report:compare \
  --ours ./results/shannon-crypto.json \
  --baseline ./results/evmbench-baseline.json \
  --output ./comparison.html
```

**Metrics:**
- **Detection Rate** - Vulnerabilities found / total vulnerabilities
- **False Positive Rate** - Incorrect detections / total detections
- **Exploit Success Rate** - Successful exploits / critical vulns
- **Time-to-Detection** - Average time per vulnerability
- **Cost-Effectiveness** - Vulnerabilities / API cost

### Custom Benchmarks

**DeFi Rekt News Analysis:**
- Fetch historical hacks from rekt.news
- Reproduce attack vectors
- Test if Shannon Crypto would detect

**OWASP Smart Contract Top 10:**
- Test against official vulnerability list
- Generate compliance report

## Security Considerations

### Tool Security

- **Private Keys** - Never stored, only in env vars
- **API Keys** - Rotatable, scoped permissions
- **Exploit Contracts** - Deployed to testnet only
- **Audit Logs** - Sanitized before sharing

### Operational Security

- **Rate Limiting** - Respect RPC provider limits
- **Error Handling** - No stack traces to users
- **Input Validation** - Validate all addresses, ABIs
- **Access Control** - API tokens, workspace isolation

## Scalability Plan

### Phase 1: Ethereum (v0.1 - v0.3)
- Single-chain optimization
- Solidity/Vyper support
- Full EVM compatibility

### Phase 2: Multi-Chain EVM (v0.4 - v0.6)
- BNB, Polygon, Arbitrum, Optimism
- Chain-specific vulnerability patterns
- Cross-chain bridge testing

### Phase 3: Non-EVM (v1.0+)
- Solana (Rust/Anchor)
- Cosmos (CosmWasm)
- New tooling ecosystem

### Phase 4: Advanced Features (v1.5+)
- Formal verification (K Framework, Certora)
- Machine learning-based anomaly detection
- Real-time protocol monitoring

## Performance Targets

**Audit Speed:**
- Target: < 2 hours for typical DeFi protocol
- Current Baseline: 2-4 weeks (manual audit)

**Cost:**
- Target: <$200 per audit
- Breakdown: AI ($50-100), RPC ($10-20), Tools ($20-50)

**Accuracy:**
- Target: >90% detection rate on EVMbench
- Target: <5% false positive rate

## Next Steps

1. **Implement MVP** - Recon + Slither + Basic AI agent
2. **EVMbench Integration** - Run benchmark, measure accuracy
3. **Add Dynamic Analysis** - Foundry + Medusa integration
4. **OpenCLaw Skill** - Chat-based control
5. **Public Release** - v0.1 launch with Ethereum support

---

*This architecture is designed for production use, not as a toy project.*
