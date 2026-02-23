# aave-ai

AAVE V3 AI tools (skills, plugins) for developers and AI agents integrating the AAVE protocol.

## Installation

### Via npx skills (Universal - works with any agent)

```bash
# Install all skills
npx skills add intenxus/aave-ai

# Install specific skills
npx skills add intenxus/aave-ai --skill aave-integration
npx skills add intenxus/aave-ai --skill aave-planner
```

### Via Claude Code Plugin

```bash
# Add the marketplace
/plugin marketplace add intenxus/aave-ai

# Install individual plugins
/plugin install aave-integration
/plugin install aave-planner
/plugin install aave-risk-assessor
/plugin install aave-security-foundations
/plugin install aave-viem-integration
```

## Skills

| Skill | Description |
|-------|-------------|
| `aave-integration` | Direct AAVE V3 protocol integration for reading on-chain data and executing transactions |
| `aave-planner` | Position planning and strategy generation for AAVE V3 |
| `aave-risk-assessor` | Risk analysis and health factor monitoring for AAVE positions |
| `aave-security-foundations` | Security guidance and audit checklists for AAVE integrations |
| `aave-viem-integration` | EVM blockchain integration using viem for AAVE operations |

## Development

```bash
# Install dependencies
npm install

# Build all packages
npm run build

# Lint all packages
npm run lint

# Format code
npm run format
```

## License

MIT License
