#!/usr/bin/env ts-node
/**
 * AAVE Position Strategy Planner
 *
 * Build a simple action plan for conservative / balanced / aggressive goals.
 */

import { simulate } from './simulate-position';

type StrategyGoal = 'conservative' | 'balanced' | 'aggressive';

type StrategyStepAction = 'supply' | 'borrow' | 'repay' | 'withdraw';

interface StrategyStep {
  action: StrategyStepAction;
  token: string;
  amount: number;
  rationale: string;
}

interface StrategyRange {
  targetLtvMin: number;
  targetLtvMax: number;
  minHealthFactor: number;
}

interface StrategyPlan {
  goal: StrategyGoal;
  chainId: number;
  userAddress: `0x${string}`;
  preferredCollateral: string;
  preferredBorrow: string;
  startingHealthFactor: number;
  suggestedRange: StrategyRange;
  steps: StrategyStep[];
  safetyFallbacks: string[];
}

function getGoalRange(goal: StrategyGoal): StrategyRange {
  if (goal === 'conservative') {
    return { targetLtvMin: 0.2, targetLtvMax: 0.35, minHealthFactor: 2.0 };
  }
  if (goal === 'balanced') {
    return { targetLtvMin: 0.35, targetLtvMax: 0.55, minHealthFactor: 1.5 };
  }
  return { targetLtvMin: 0.55, targetLtvMax: 0.7, minHealthFactor: 1.25 };
}

function deriveSteps(goal: StrategyGoal, collateralToken: string, borrowToken: string): StrategyStep[] {
  if (goal === 'conservative') {
    return [
      {
        action: 'supply',
        token: collateralToken,
        amount: 1,
        rationale: 'Increase collateral buffer before any borrowing.',
      },
      {
        action: 'borrow',
        token: borrowToken,
        amount: 100,
        rationale: 'Use a small initial borrow and reassess rates.',
      },
    ];
  }

  if (goal === 'balanced') {
    return [
      {
        action: 'supply',
        token: collateralToken,
        amount: 2,
        rationale: 'Set a wider collateral base for moderate leverage.',
      },
      {
        action: 'borrow',
        token: borrowToken,
        amount: 250,
        rationale: 'Borrow in one medium step and monitor HF after execution.',
      },
    ];
  }

  return [
    {
      action: 'supply',
      token: collateralToken,
      amount: 3,
      rationale: 'Build collateral before aggressive leverage.',
    },
    {
      action: 'borrow',
      token: borrowToken,
      amount: 400,
      rationale: 'Borrow in capped chunks, stop if HF drops too fast.',
    },
  ];
}

export async function planPositionStrategy(params: {
  chainId: number;
  userAddress: `0x${string}`;
  goal: StrategyGoal;
  preferredCollateral: string;
  preferredBorrow: string;
}): Promise<StrategyPlan> {
  const { chainId, userAddress, goal, preferredCollateral, preferredBorrow } = params;
  const range = getGoalRange(goal);

  const probe = await simulate(chainId, userAddress, 'borrow', preferredBorrow, 1);
  const startingHealthFactor = probe.current.healthFactor;

  const steps = deriveSteps(goal, preferredCollateral, preferredBorrow);

  return {
    goal,
    chainId,
    userAddress,
    preferredCollateral,
    preferredBorrow,
    startingHealthFactor,
    suggestedRange: range,
    steps,
    safetyFallbacks: [
      'If HF drops below target, repay debt first before adding new borrows.',
      'If variable APR spikes, reduce debt exposure in two repay steps.',
      'Re-check quote-borrow and quote-withdraw before each step.',
    ],
  };
}

if (require.main === module) {
  const [chainIdStr, userAddress, goalStr, collateralToken, borrowToken] = process.argv.slice(2);
  const chainId = Number(chainIdStr);
  const goal = (goalStr || 'balanced') as StrategyGoal;

  if (![1, 42161].includes(chainId)) {
    console.error('Error: chainId must be 1 (Ethereum) or 42161 (Arbitrum)');
    process.exit(1);
  }

  if (!userAddress || !/^0x[a-fA-F0-9]{40}$/.test(userAddress)) {
    console.error('Error: Invalid user address');
    process.exit(1);
  }

  if (!['conservative', 'balanced', 'aggressive'].includes(goal)) {
    console.error('Error: goal must be conservative, balanced, or aggressive');
    process.exit(1);
  }

  const collateral = collateralToken || 'WETH';
  const borrow = borrowToken || 'USDC';

  planPositionStrategy({
    chainId,
    userAddress: userAddress as `0x${string}`,
    goal,
    preferredCollateral: collateral,
    preferredBorrow: borrow,
  })
    .then((plan) => {
      console.log(JSON.stringify(plan, null, 2));
    })
    .catch((error) => {
      console.error('Error:', error instanceof Error ? error.message : String(error));
      process.exit(1);
    });
}
