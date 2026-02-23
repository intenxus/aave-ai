# Test Scenarios & Acceptance Criteria

> **QA Owner Deliverable** for AAVE Skill Team
>
> This document defines the complete test scenarios and acceptance criteria for the AAVE V3 Skill implementation.

---

## Standard Trigger Phrase Test Set (20 items, need >=18 hits)

| # | Input | Expected Skill | Expected Params |
|---|-------|----------------|-----------------|
| 1 | "supply to aave" | aave-planner | action=supply |
| 2 | "deposit to aave" | aave-planner | action=supply |
| 3 | "lend on aave" | aave-planner | action=supply |
| 4 | "borrow from aave" | aave-planner | action=borrow |
| 5 | "take loan on aave" | aave-planner | action=borrow |
| 6 | "repay aave loan" | aave-planner | action=repay |
| 7 | "pay back aave" | aave-planner | action=repay |
| 8 | "withdraw from aave" | aave-planner | action=withdraw |
| 9 | "remove collateral" | aave-planner | action=withdraw |
| 10 | "aave lending" | aave-planner | (action needs completion) |
| 11 | "earn yield on aave" | aave-planner | action=supply |
| 12 | "supply 100 USDC to aave" | aave-planner | action=supply, token=USDC, amount=100 |
| 13 | "borrow ETH from aave" | aave-planner | action=borrow, token=ETH |
| 14 | "repay my aave loan" | aave-planner | action=repay |
| 15 | "withdraw WETH from aave" | aave-planner | action=withdraw, token=WETH |
| 16 | "aave supply" | aave-planner | action=supply |
| 17 | "aave borrow" | aave-planner | action=borrow |
| 18 | "aave repay" | aave-planner | action=repay |
| 19 | "aave withdraw" | aave-planner | action=withdraw |
| 20 | "use aave to earn interest" | aave-planner | action=supply |

**Acceptance Criteria**: At least 18 out of 20 tests should pass (>=90% hit rate)

---

## Conversational Acceptance Samples (15 items)

### TS01: Simple Supply
**Dialog**: "I want to supply 100 USDC to AAVE"

**Expected**:
- Hit Skill: aave-planner
- Recognized params:
  ```json
  {
    "action": "supply",
    "token": "USDC",
    "amount": "100"
  }
  ```
- Missing params: chainId
- Completion: Use AskUserQuestion to ask "Which network do you want to operate on? Ethereum and Arbitrum are supported."
- Final confirmation: Generate deep link or manual path after all params are collected

---

### TS02: Missing Amount
**Dialog**: "I want to borrow ETH"

**Expected**:
- Hit Skill: aave-planner
- Recognized params:
  ```json
  {
    "action": "borrow",
    "token": "ETH"
  }
  ```
- Missing params: amount, chainId
- Completion:
  1. Ask chainId: "Which network do you want to borrow ETH on?"
  2. Ask amount: "How much ETH do you want to borrow?"
- Validation: amount must be positive, chainId must be 1 or 42161

---

### TS03: Invalid Token
**Dialog**: "I want to deposit XYZ"

**Expected**:
- Hit Skill: aave-planner
- Recognized params:
  ```json
  {
    "action": "supply",
    "token": "XYZ"
  }
  ```
- Validation failed: XYZ not in whitelist asset list
- Error message:
  ```
  ⚠️ XYZ is not in the supported asset whitelist.

  Supported assets:
  - Ethereum: USDC, USDT, WETH, WBTC, DAI
  - Arbitrum: USDC, USDT, WETH, WBTC, DAI

  Did you mean WETH or another asset?
  ```
- Fallback: Provide similar options for user selection

---

### TS04: Stable Borrow Not Supported - Downgrade
**Dialog**: "I want to borrow USDC with fixed rate"

**Expected**:
- Hit Skill: aave-planner
- Recognized params:
  ```json
  {
    "action": "borrow",
    "token": "USDC",
    "interestRateMode": 1
  }
  ```
- On-chain check: Query USDC stableBorrowRateEnabled
- Check result: USDC.stableBorrowRateEnabled = false
- Downgrade handling:
  ```json
  {
    "finalInterestRateMode": 2,
    "modeDowngraded": true,
    "modeDowngradeReason": "USDC does not support stable rate borrowing, automatically switched to variable rate"
  }
  ```
- User prompt: "USDC does not support stable rate, switched to variable rate. Current variable rate is X.XX%."
- Continue: Use variable rate for subsequent processing

---

### TS05: Query Health Factor
**Dialog**: "How is my account health?"

**Expected**:
- Hit Skill: aave-risk-assessor
- Trigger match: "health factor"
- Required params: wallet address
- Completion:
  - If no wallet in current session: Ask "Please provide your wallet address"
  - If wallet exists: Use directly
- Query behavior:
  1. Call Pool.getUserAccountData(wallet)
  2. Get healthFactor, totalCollateralBase, totalDebtBase, etc.
- Output format:
  ```
  Your account health factor: 1.85
  Risk level: Moderate (monitor recommended)

  Details:
  - Total collateral value: $10,500
  - Total debt: $5,675
  - Current LTV: 54%
  - Max LTV: 75%
  - Liquidation threshold: 80%
  ```

---

### TS06: Cross-chain Hint
**Dialog**: "I want to borrow on Polygon"

**Expected**:
- Hit Skill: aave-planner
- Recognized params:
  ```json
  {
    "action": "borrow",
    "chainId": 137
  }
  ```
- Validation failed: chainId 137 (Polygon) not in supported list
- Error message:
  ```
  ⚠️ Only Ethereum and Arbitrum networks are supported in the first batch.

  Polygon support is planned for the next iteration.

  Do you want to switch to:
  1. Ethereum (mainnet)
  2. Arbitrum (L2)
  ```
- Fallback: Provide supported chain options

---

### TS07: Missing Chain
**Dialog**: "supply 100 USDC"

**Expected**:
- Hit Skill: aave-planner
- Recognized params:
  ```json
  {
    "action": "supply",
    "token": "USDC",
    "amount": "100"
  }
  ```
- Missing params: chainId
- Completion: Use AskUserQuestion
  ```
  Which network do you want to supply on?

  [Ethereum] [Arbitrum]
  ```
- Validation: Verify chainId is 1 or 42161 after user selection

---

### TS08: Non-whitelist Asset Warning
**Dialog**: "I want to deposit RANDOM_TOKEN"

**Expected**:
- Hit Skill: aave-planner
- Recognized params:
  ```json
  {
    "action": "supply",
    "token": "RANDOM_TOKEN"
  }
  ```
- Validation: RANDOM_TOKEN not in whitelist
- Warning message:
  ```
  ⚠️ **Security Warning**

  RANDOM_TOKEN is not in the supported asset whitelist.

  First batch only supports these whitelisted assets:
  - USDC, USDT, WETH, WBTC, DAI

  Note: Non-whitelist assets may have scam risks.

  Contact the team to extend whitelist if needed.
  ```
- Boundary handling: Do not generate transaction params, terminate flow

---

### TS09: Network Error Fallback
**Dialog**: "supply ETH"

**Scenario**: On-chain RPC call fails

**Expected**:
- Hit Skill: aave-planner
- Recognized params:
  ```json
  {
    "action": "supply",
    "token": "ETH"
  }
  ```
- Failure point: Network error when calling getReserveConfigurationData
- Error message:
  ```
  ⚠️ Unable to fetch on-chain data

  Possible reasons:
  - Unstable network connection
  - RPC node temporarily unavailable

  Please retry later, or manually visit: https://app.aave.com
  ```
- Fallback (manual path):
  ```
  Manual steps:
  1. Visit: https://app.aave.com
  2. Select market: Aave v3 Ethereum
  3. Select asset: ETH
  4. Click: Supply button
  5. Enter amount and confirm
  ```

---

### TS10: AskUserQuestion Unavailable
**Environment**: Runtime without AskUserQuestion tool
**Dialog**: "I want to borrow"

**Expected**:
- Hit Skill: aave-planner
- Recognized params:
  ```json
  {
    "action": "borrow"
  }
  ```
- Missing params: token, amount, chainId
- Fallback (natural language dialog):
  ```
  I'll help you complete the borrow operation. Please provide:

  1. Which asset do you want to borrow? (e.g., USDC, ETH, WBTC)
  2. How much do you want to borrow?
  3. Which network? (Ethereum/Arbitrum)
  ```
- Validation: Same input validation (whitelist check, value check, etc.)
- Param collection: Collect through multi-turn dialog

---

### TS11: Deep Link Failure Fallback
**Scenario**: Deep link pre-fill success rate <80%

**Expected**:
- Precondition: Test 5 cases on Ethereum and Arbitrum each, success rate <80%
- Result: Do not use deep link as primary method
- Default behavior:
  ```
  Please follow these manual steps:

  1. Visit: https://app.aave.com
  2. Select market: Aave v3 {Network}
  3. Connect your wallet
  4. Find {Token} in the asset list
  5. Click "{Action}" button
  6. Enter amount: {Amount}
  7. Confirm transaction
  ```
- Param reference:
  ```
  Operation params:
  - Network: {chainName}
  - Asset: {token}
  - Action: {action}
  - Amount: {amount}
  - Interest rate mode: {interestRateMode}
  ```

---

### TS12: interestRateMode Default
**Dialog**: "borrow 100 USDC"

**Expected**:
- Hit Skill: aave-planner
- Recognized params:
  ```json
  {
    "action": "borrow",
    "token": "USDC",
    "amount": "100"
  }
  ```
- Default handling:
  ```json
  {
    "interestRateMode": 2,
    "finalInterestRateMode": 2
  }
  ```
- Behavior: Default to variable rate (2) when user doesn't specify
- No prompt: Don't show stable borrow hint (user didn't ask)
- Output: Show current variable borrow rate

---

### TS13: eMode Related (Out of Scope)
**Dialog**: "I want to enable eMode"

**Expected**:
- Hit Skill: aave-planner
- Intent: User wants to operate eMode
- Scope check: eMode not in first batch scope (supply/borrow/repay/withdraw)
- Message:
  ```
  ⚠️ eMode management is not in the first batch scope

  First batch only supports:
  - Supply
  - Borrow
  - Repay
  - Withdraw

  eMode support is planned for the next iteration.
  ```
- Param handling: **Do not generate** {action: "eMode"} params

---

### TS14: Repay All
**Dialog**: "Pay off my loan"

**Expected**:
- Hit Skill: aave-planner
- Recognized params:
  ```json
  {
    "action": "repay",
    "amount": "max"
  }
  ```
- Missing params: token, chainId
- Completion:
  1. Ask chainId
  2. Query user's current debt token list
  3. If multiple debts: "Which asset's loan do you want to repay?"
  4. If single debt: Use that token directly
- Special value: amount="max" means repay all (use type(uint256).max)
- Confirmation: "Confirm to repay all {token} loan? Current debt is {currentDebt}"

---

### TS15: Withdraw Exceeds Supply
**Dialog**: "withdraw 1000 ETH"

**Precondition**: User currently has only 10 ETH supplied

**Expected**:
- Hit Skill: aave-planner
- Recognized params:
  ```json
  {
    "action": "withdraw",
    "token": "ETH",
    "amount": "1000"
  }
  ```
- On-chain check: Query user's current ETH supply balance
- Check result: currentSupplied = 10 ETH
- Error message:
  ```
  ⚠️ Withdraw amount exceeds supply balance

  You currently have: 10 ETH available for withdrawal
  Requested withdrawal: 1000 ETH

  Do you want to:
  1. Withdraw all (10 ETH)
  2. Modify withdrawal amount
  3. Cancel operation
  ```
- Fallback: Provide options for user to modify or cancel

---

## Failure Handling Path Validation (at least 3 categories)

### Category 1: Missing/Invalid Params
| Scenario | Input | Expected Behavior |
|----------|-------|-------------------|
| Completely missing params | "use aave" | Ask for specific action |
| Invalid amount | "supply -100 USDC" | Prompt that amount must be positive |
| Invalid token | "supply ABC" | Prompt not in whitelist, provide options |
| Invalid chain | "supply on Bitcoin" | Prompt only Ethereum/Arbitrum supported |

### Category 2: On-chain State Limits
| Scenario | Input | Expected Behavior |
|----------|-------|-------------------|
| Asset frozen | "supply USDC" (USDC frozen) | Prompt asset currently not available for supply |
| Borrow cap reached | "borrow WBTC" | Prompt borrow cap reached |
| Stable not available | "stable borrow USDC" | Downgrade to variable and prompt |
| HF<1.0 | "borrow more" | Warning about liquidation risk |

### Category 3: Runtime/Network Errors
| Scenario | Input | Expected Behavior |
|----------|-------|-------------------|
| RPC timeout | "supply ETH" | Prompt network error, provide manual path |
| Contract call failed | Any operation | Prompt specific error, suggest retry |
| AskUserQuestion unavailable | Missing param dialog | Use natural language dialog instead |
| Deep link failure | When generating link | Fallback to manual steps guide |

---

## Minimum Acceptance Threshold (Go/No-Go Criteria)

### Go/No-Go Checklist

- [ ] **Trigger hit rate**: 20 standard trigger phrases hit >=18 (90%+)
- [ ] **Param completion stability**: Stable completion when params missing, no direct failure
- [ ] **Failure path coverage**: At least 3 failure categories have clear error prompts and next steps
- [ ] **Chain coverage**: First batch 2 chains (Ethereum/Arbitrum) fully covered
- [ ] **Action coverage**: First batch 4 actions (supply/borrow/repay/withdraw) fully covered
- [ ] **Interest rate mode downgrade**: Auto downgrade when stable borrow not supported
- [ ] **Deep link fallback**: Fallback plan when deep link fails
- [ ] **Non-whitelist warning**: Clear warning and boundary for non-whitelist assets
- [ ] **Health Factor query**: aave-risk-assessor can correctly query and explain health factor
- [ ] **Cross-chain handling**: Clear prompt and switch options for unsupported networks

### Acceptance Standards

**Go**: All 10 items pass
**Conditional Go**: 8-9 items pass, remaining items have clear fix plan
**No-Go**: Less than 8 items pass

---

## Test Execution Record Template

### Trigger Phrase Test Record

| # | Input | Hit Skill | Hit Params | Result | Notes |
|---|-------|-----------|------------|--------|-------|
| 1 | "supply to aave" | | | | |
| ... | ... | | | | |

**Stats**: __/20 passed (____%)

### Deep Link Validation Record

| Network | Asset | Action | Pre-fill Success Rate | Result |
|---------|-------|--------|----------------------|--------|
| Ethereum | USDC | supply | | |
| Ethereum | WETH | borrow | | |
| ... | ... | ... | ... | ... |

**Decision**: Primary method / Fallback method

### Conversational Test Record

| Scenario ID | Test Date | Tester | Result | Issue Record |
|-------------|-----------|--------|--------|--------------|
| TS01 | | | | |
| ... | | | | |

---

## Appendix: Whitelist Asset Reference

### Ethereum (chainId: 1)
| Symbol | Address | Decimals | stableBorrowEnabled |
|--------|---------|----------|---------------------|
| USDC | 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48 | 6 | false |
| USDT | 0xdAC17F958D2ee523a2206206994597C13D831ec7 | 6 | false |
| WETH | 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2 | 18 | false |
| WBTC | 0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599 | 8 | false |
| DAI | 0x6B175474E89094C44Da98b954EedeAC495271d0F | 18 | true |

### Arbitrum (chainId: 42161)
| Symbol | Address | Decimals | stableBorrowEnabled |
|--------|---------|----------|---------------------|
| USDC | 0xaf88d065e77c8cC2239327C5EDb3A432268e5831 | 6 | false |
| USDT | 0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9 | 6 | false |
| WETH | 0x82aF49447D8a07e3bd95BD0d56f35241523fBab1 | 18 | false |
| WBTC | 0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f | 8 | false |
| DAI | 0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1 | 18 | true |

---

*Document Version: 1.0*
*Last Updated: 2026-02-22*
*Owner: QA Owner*
