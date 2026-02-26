# Shannon Crypto - AI-Powered Smart Contract Pentesting

**The Autonomous Smart Contract Security Auditor**

Shannon Crypto extends Shannon's autonomous pentesting approach to blockchain security. Instead of scanning web applications, it analyzes smart contracts and DeFi protocols for vulnerabilities using AI agents and specialized tooling.

## Philosophy

**Like Shannon, but for Blockchains:**

- **Autonomous** - Single command launches full security audit
- **Proof-by-Exploitation** - Only reports what can be exploited
- **Multi-Modal** - Static analysis + dynamic execution + transaction simulation
- **Benchmarked** - Built to compete on EVMbench (like XBOW for web)

## Why Shannon Crypto?

The crypto ecosystem faces a security crisis:

- **$100B+** lost to hacks in 2024 alone
- **Traditional audits** are expensive, slow, and often incomplete
- **AI is revolutionizing** the space (OpenAI's EVMbench, Paradigm's tools)

Shannon Crypto aims to be the "Red Team to your vibe-coding Blue team" for smart contracts - automated, autonomous, and proof-based.

## Targets

### Phase 1: Ethereum (Current)
- Smart contracts (Solidity, Vyper)
- DeFi protocols
- NFT marketplaces
- Governance contracts

### Phase 2: EVM Chains (Planned)
- BNB Chain
- Polygon
- Arbitrum
- Optimism
- Base
- Avalanche

### Phase 3: Non-EVM (Future)
- Solana (Rust, Anchor)
- Cosmos (CosmWasm)
- Polkadot (ink!)
- StarkNet (Cairo)

## Comparison: Traditional vs Shannon Crypto

| Aspect | Traditional Audit | Shannon Crypto |
|---------|------------------|----------------|
| Speed | 2-4 weeks | 1-2 days |
| Cost | $20K-$100K | $100-$500 |
| Coverage | Manual sampling | Autonomous full scan |
| Proof | Code review | Transaction execution |
| False Positives | High | Low (exploit-based) |
| Updates | One-time | Continuous/Cron |

## Architecture Overview

```
                    ┌────────────────────────────────┐
                    │   Web3/DApp Reconnaissance  │
                    └──────────────┬─────────────────┘
                                   │
                                   ▼
                    ┌──────────────┴────────────────────┐
                    │                                  │
              ┌───────┴─────────┐          │
              │                  │          │
              ▼                  ▼          ▼
       ┌─────────────┐   ┌─────────────┐   ┌─────────────┐
       │ Web3 Scan   │   │ Contract    │   │ On-chain    │
       │ (Frontend) │   │ Static      │   │ Events      │
       └───────┬────┘   │ Analysis    │   └───────┬────┘
               │         └───────┬────┘           │
               ▼                 ▼                 ▼
       ┌─────────────┐   ┌─────────────┐   ┌─────────────┐
       │ Wallet      │   │ Slither/    │   │ Etherscan  │
       │ Connect    │   │ Mythril/   │   │ DegenQuery │
       └─────────────┘   └───────┬────┘   └─────────────┘
                               │
                               ▼
                   ┌─────────────────────────────────┐
                   │   Vulnerability Analysis     │
                   │   (AI Agent Orchestrator)  │
                   └──────────────┬──────────────┘
                                  │
           ┌──────────────────────┼──────────────────────┐
           │                      │                      │
           ▼                      ▼                      ▼
    ┌─────────────┐      ┌─────────────┐      ┌─────────────┐
    │ Reentrancy  │      │ Access      │      │ Logic       │
    │ Analysis    │      │ Control    │      │ Bugs        │
    └───────┬────┘      └───────┬────┘      └───────┬────┘
            │                      │                      │
            ▼                      ▼                      ▼
    ┌─────────────┐      ┌─────────────┐      ┌─────────────┐
    │ Exploit     │      │ Exploit     │      │ Gas         │
    │ (Simulate)  │      │ (Test)      │      │ Grief       │
    └───────┬────┘      └───────┬────┘      └───────┬────┘
            │                      │                      │
            └──────────────────────┼──────────────────────┘
                                   │
                                   ▼
                    ┌─────────────────────────────────┐
                    │   Report Generation         │
                    │   + Reproducible PoCs      │
                    └─────────────────────────────────┘
```

## Core Components

### 1. Orchestration Layer
- **Temporal** - Workflow engine (from Shannon)
- **Agent SDK** - Claude/alternative model interface
- **Tool Registry** - Pluggable analyzer system

### 2. Intelligence Layer
- **Static Analysis** - Slither, Mythril, Echidna
- **Dynamic Analysis** - Foundry/Forge tests
- **AI Reasoning** - LLM pattern matching + synthesis
- **Fuzzing** - Echidna/Medusa parallel fuzzing

### 3. Execution Layer
- **Local Testnet** - Anvil/Hardhat fork
- **Testnet Deploy** - Sepolia, Goerli for real tx
- **Transaction Builder** - Exploit transaction construction
- **Gas Estimation** - Cost analysis

### 4. Data Layer
- **Etherscan/Blockscout** - Contract source fetching
- **Dune Analytics** - Protocol state analysis
- **DefiLlama** - TVL and usage metrics
- **RPC Nodes** - Multi-provider fallback (Alchemy, Infura, QuickNode)

## Vulnerability Classes (Phase 1: Ethereum)

### Critical
- Reentrancy
- Integer Overflow/Underflow
- Access Control Bypass
- Delegatecall Manipulation
- Timestamp Dependence

### High
- Unchecked Low-Level Calls
- Unprotected Private Data
- Logic Errors
- Front-Running
- Flash Loan Attacks

### Medium
- Gas Optimization Issues
- Centralization Risks
- Upgrade Vulnerabilities
- Price Manipulation

### Low
- Code Style & Best Practices
- Documentation Gaps
- Unnecessary Complexity
- Dead Code

## Roadmap

### v0.1 (MVP - Ethereum Solidity)
- [x] Core architecture design
- [ ] Web3/DApp reconnaissance
- [ ] Static analysis integration (Slither)
- [ ] Basic AI vulnerability detection
- [ ] Testnet exploit simulation
- [ ] Simple report generation

### v0.2 (Enhanced Ethereum)
- [ ] Multiple static analyzers (Mythril, Echidna)
- [ ] Fuzzing integration (Medusa)
- [ ] Gas griefing detection
- [ ] EVMbench benchmarking
- [ ] OpenClaw integration

### v0.3 (Multi-Chain EVM)
- [ ] BNB, Polygon, Arbitrum support
- [ ] Chain-specific vulnerability patterns
- [ ] Multi-chain cross-bridge testing
- [ ] EIP compatibility checking

### v1.0 (Production)
- [ ] Non-EVM support (Solana)
- [ ] Formal verification integration
- [ ] Real-time monitoring
- [ ] CI/CD pipeline integration
- [ ] SaaS deployment option

## Benchmarks

### EVMbench
We will benchmark against OpenAI's EVMbench:
- 120 curated vulnerabilities from 40 audits
- Detect, Patch, and Exploit modes
- Public benchmark for comparison

### Custom Benchmarks
- OWASP Smart Contract Top 10
- DeFi Rekt News analysis
- Historical hacks reproduction

## Technology Stack

```
┌─────────────────────────────────────────────────────┐
│                   User Interface              │
│            OpenClaw / Web / CLI            │
└───────────────────┬─────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────┐
│              Orchestration (Temporal)          │
└───────────────────┬─────────────────────────────┘
                    │
        ┌───────────┴───────────┐
        │                     │
        ▼                     ▼
┌───────────────┐   ┌───────────────┐
│ AI Agents     │   │ Tool Layer   │
│ (LLM-Driven) │   │ Slither,    │
│              │   │ Mythril,    │
│              │   │ Foundry,    │
│              │   │ Echidna     │
└───────────────┘   └───────────────┘
        │                     │
        └───────────┬───────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────┐
│         Execution Environment                 │
│   Anvil (Local) / Testnet (Sepolia)   │
└─────────────────────────────────────────────────────┘
```

### Languages
- **TypeScript** - Core logic and agents
- **Python** - Tool wrappers and analysis scripts
- **Solidity** - Exploit contracts and test harnesses

### Dependencies
- **Temporal** - Workflow orchestration
- **OpenAI/Anthropic SDK** - AI agent execution
- **Foundry** - Contract testing and deployment
- **Ethers.js/Viem** - Blockchain interaction
- **OpenAI/Z.AI API** - LLM inference

## Getting Started

### Prerequisites
- Node.js 20+
- Python 3.10+
- Foundry (forge, cast, anvil)
- Docker (for containerized execution)
- AI Provider API key (OpenAI, Anthropic, or Z.AI)

### Quick Start

```bash
# Clone repo
git clone https://github.com/Admuad/shannon-crypto.git
cd shannon-crypto

# Install dependencies
npm install
pip install -r requirements.txt

# Configure
cp .env.example .env
# Edit .env with your API keys

# Run audit
npm run audit --contract 0x1234... --network ethereum

# Or scan a GitHub repo
npm run audit --repo owner/repo --network ethereum
```

### Examples

```bash
# Audit a deployed contract
npm run audit \
  --contract 0x1f9840a85d5aF5e1aC2f3430623b \
  --network ethereum \
  --rpc https://eth-mainnet.g.alchemy.com/v2/KEY

# Audit a local project
npm run audit \
  --source ./contracts/ \
  --language solidity \
  --network ethereum

# Audit with exploit simulation
npm run audit \
  --contract 0x1234... \
  --simulate-exploits \
  --testnet
```

## Security

**This tool itself must be secure:**

- No private keys stored in code
- All API keys from environment variables
- Exploit contracts are not deployed to mainnet
- Test transactions use testnets only
- Audit logs are sanitized before sharing

## License

AGPL-3.0 (same as Shannon - encourages sharing improvements)

## Contributing

- Issues and feature requests welcome
- PRs with tests preferred
- Research contributions (vulnerability patterns, attack vectors)

## Acknowledgments

- **Shannon** - Architecture inspiration and workflow engine
- **EVMbench** - Benchmark framework
- **OpenAI** - EVMbench and AI security research
- **Foundry** - Testing infrastructure
- **Slither/Mythril/Echidna** - Static analysis tools

---

**Built with ❤️ for a safer blockchain**
