#!/usr/bin/env node

import 'dotenv/config';
import { Cluster } from '@solana/web3.js';
import { PerpOrderSide } from '@blockworks-foundation/mango-v4';
import { createMangoContext } from '../context';
import { ContinuumHarnessClient } from '../harness';
import { ContinuumRelayerClient } from '../relayerClient';
import {
  submitPerpOrderViaRelayer,
  cancelPerpOrderByClientIdViaRelayer,
  cancelAllPerpOrdersViaRelayer,
} from '../trading';

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`missing required env var ${name}`);
  return value;
}

function log(label: string, status: 'OK' | 'FAIL', detail?: unknown) {
  const line: Record<string, unknown> = { test: label, status };
  if (detail !== undefined) line.detail = detail;
  process.stdout.write(`${JSON.stringify(line)}\n`);
}

async function main() {
  const cluster = (process.env.CLUSTER || 'devnet') as Cluster;
  const apiUrl = requiredEnv('FERMI_API_URL');

  // 1. Context creation
  const context = await createMangoContext({
    cluster,
    clusterUrl: requiredEnv('CLUSTER_URL'),
    userKeypair: requiredEnv('USER_KEYPAIR'),
    groupPk: requiredEnv('GROUP_PK'),
    mangoAccountPk: requiredEnv('MANGO_ACCOUNT_PK'),
    executionQueuePk: requiredEnv('EXECUTION_QUEUE_PK'),
    programId: process.env.PROGRAM_ID,
  });
  log('createMangoContext', 'OK', {
    owner: context.user.publicKey.toBase58(),
    mangoAccount: context.mangoAccount.publicKey.toBase58(),
  });

  const harness = new ContinuumHarnessClient(apiUrl);
  const relayer = new ContinuumRelayerClient(apiUrl, process.env.FERMI_API_KEY);

  // 2. Harness: getMarketState
  try {
    const market = await harness.getMarketState(0, 'optimistic');
    log('harness.getMarketState', 'OK', {
      bids: market.bids?.length ?? 0,
      asks: market.asks?.length ?? 0,
      optimistic_seq: market.watermarks?.optimistic_seq,
    });
  } catch (e: any) {
    log('harness.getMarketState', 'FAIL', e.message ?? e);
  }

  // 3. Harness: getUserState
  try {
    const user = await harness.getUserState(context.user.publicKey, 'optimistic');
    log('harness.getUserState', 'OK', {
      owner: user.owner,
      mango_accounts: user.mango_accounts?.length ?? 0,
    });
  } catch (e: any) {
    log('harness.getUserState', 'FAIL', e.message ?? e);
  }

  // 4. Harness: getBalances
  try {
    const balances = await harness.getBalances(context.user.publicKey, 'optimistic');
    log('harness.getBalances', 'OK', balances);
  } catch (e: any) {
    log('harness.getBalances', 'FAIL', e.message ?? e);
  }

  // 5. Harness: getTrades
  try {
    const trades = await harness.getTrades({ market: 0, view: 'optimistic', limit: 5 });
    log('harness.getTrades', 'OK', { count: Array.isArray(trades) ? trades.length : 'non-array' });
  } catch (e: any) {
    log('harness.getTrades', 'FAIL', e.message ?? e);
  }

  // 6. Harness: getCandles
  try {
    const candles = await harness.getCandles({ market: 0, view: 'optimistic', resolutionSec: 60, limit: 5 });
    log('harness.getCandles', 'OK', { count: Array.isArray(candles) ? candles.length : 'non-array' });
  } catch (e: any) {
    log('harness.getCandles', 'FAIL', e.message ?? e);
  }

  // 7. Harness: getFullState
  try {
    const snapshot = await harness.getFullState('optimistic');
    log('harness.getFullState', 'OK', { keys: Object.keys(snapshot) });
  } catch (e: any) {
    log('harness.getFullState', 'FAIL', e.message ?? e);
  }

  // 8. Trading: place a bid order
  let placedClientOrderId: number | null = null;
  try {
    const clientOrderId = Date.now();
    const resp = await submitPerpOrderViaRelayer(relayer, context, {
      marketIndex: 0,
      side: PerpOrderSide.bid,
      price: 70.0, // well below market to avoid fills
      quantity: 0.01,
      clientOrderId,
    });
    placedClientOrderId = clientOrderId;
    log('submitPerpOrderViaRelayer (bid)', 'OK', {
      clientOrderId,
      sequence: resp.sequence,
      tx_signature: resp.tx_signature,
    });
  } catch (e: any) {
    log('submitPerpOrderViaRelayer (bid)', 'FAIL', e.message ?? e);
  }

  // 9. Trading: place an ask order
  let askClientOrderId: number | null = null;
  try {
    const clientOrderId = Date.now();
    const resp = await submitPerpOrderViaRelayer(relayer, context, {
      marketIndex: 0,
      side: PerpOrderSide.ask,
      price: 95.0, // well above market to avoid fills
      quantity: 0.01,
      clientOrderId,
    });
    askClientOrderId = clientOrderId;
    log('submitPerpOrderViaRelayer (ask)', 'OK', {
      clientOrderId,
      sequence: resp.sequence,
      tx_signature: resp.tx_signature,
    });
  } catch (e: any) {
    log('submitPerpOrderViaRelayer (ask)', 'FAIL', e.message ?? e);
  }

  // 10. Trading: cancel by client order ID
  if (placedClientOrderId !== null) {
    try {
      const resp = await cancelPerpOrderByClientIdViaRelayer(relayer, context, {
        marketIndex: 0,
        clientOrderId: placedClientOrderId,
      });
      log('cancelPerpOrderByClientIdViaRelayer', 'OK', {
        clientOrderId: placedClientOrderId,
        sequence: resp.sequence,
      });
    } catch (e: any) {
      log('cancelPerpOrderByClientIdViaRelayer', 'FAIL', e.message ?? e);
    }
  }

  // 11. Trading: cancel all orders
  try {
    const resp = await cancelAllPerpOrdersViaRelayer(relayer, context, {
      marketIndex: 0,
    });
    log('cancelAllPerpOrdersViaRelayer', 'OK', {
      sequence: resp.sequence,
    });
  } catch (e: any) {
    log('cancelAllPerpOrdersViaRelayer', 'FAIL', e.message ?? e);
  }

  // 12. Harness: verify orders cleared
  try {
    const user = await harness.getUserState(context.user.publicKey, 'optimistic');
    const myOrders = user.per_market?.[0]?.open_order_base_lots_bid ?? 'unknown';
    log('post-cancel getUserState', 'OK', {
      open_bid_lots: myOrders,
    });
  } catch (e: any) {
    log('post-cancel getUserState', 'FAIL', e.message ?? e);
  }

  relayer.close();
  process.stdout.write('\nAll tests completed.\n');
}

main().catch((err) => {
  process.stderr.write(`${err instanceof Error ? err.stack : err}\n`);
  process.exit(1);
});
