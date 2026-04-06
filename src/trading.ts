import {
  buildExecutionQueueUserIntent,
  encodePerpCancelAllOrdersQueuePayload,
  encodePerpCancelOrderByClientOrderIdQueuePayload,
  encodePerpPlaceOrderV2QueuePayload,
  I64_MAX_BN,
  PerpMarketIndex,
  PerpOrderSide,
  PerpOrderType,
  PerpSelfTradeBehavior,
  signExecutionQueueIntentMessage,
} from '@blockworks-foundation/mango-v4';
import { MangoContext, buildCanonicalPerpRemainingAccounts } from './context';
import {
  ContinuumRelayerClient,
  SubmitIntentResponse,
  toRelayerAccountMeta,
} from './relayerClient';

export type SubmitPerpOrderParams = {
  marketIndex: number;
  side: PerpOrderSide;
  price: number;
  quantity: number;
  maxQuoteQuantity?: number;
  clientOrderId?: number;
  orderType?: PerpOrderType;
  selfTradeBehavior?: PerpSelfTradeBehavior;
  reduceOnly?: boolean;
  expiryTimestamp?: number;
  limit?: number;
  minExecuteSlot?: bigint;
  expiresAtSlot?: bigint;
};

export type SubmitPerpCancelByClientIdParams = {
  marketIndex: number;
  clientOrderId: number;
  minExecuteSlot?: bigint;
  expiresAtSlot?: bigint;
};

export type SubmitPerpCancelAllParams = {
  marketIndex: number;
  limit?: number;
  minExecuteSlot?: bigint;
  expiresAtSlot?: bigint;
};

async function signIntent(params: {
  context: MangoContext;
  marketIndex: number;
  payload: Uint8Array;
  minExecuteSlot?: bigint;
  expiresAtSlot?: bigint;
}) {
  const remainingAccounts = await buildCanonicalPerpRemainingAccounts(
    params.context,
    params.marketIndex,
  );
  const intent = await buildExecutionQueueUserIntent({
    group: params.context.group.publicKey,
    executionQueue: params.context.executionQueuePk,
    mangoAccount: params.context.mangoAccount.publicKey,
    userOwner: params.context.user.publicKey,
    payload: params.payload,
    remainingAccounts,
  });
  const userSignature = signExecutionQueueIntentMessage(
    params.context.user.secretKey,
    intent.userIntentMessage,
  );

  return {
    remainingAccounts,
    userSignature,
  };
}

export async function submitPerpOrderViaRelayer(
  relayer: ContinuumRelayerClient,
  context: MangoContext,
  params: SubmitPerpOrderParams,
): Promise<SubmitIntentResponse> {
  const perpMarket = context.group.getPerpMarketByMarketIndex(
    params.marketIndex as PerpMarketIndex,
  );
  const payload = encodePerpPlaceOrderV2QueuePayload({
    side: params.side,
    priceLots: BigInt(perpMarket.uiPriceToLots(params.price).toString()),
    maxBaseLots: BigInt(perpMarket.uiBaseToLots(params.quantity).toString()),
    maxQuoteLots: params.maxQuoteQuantity
      ? BigInt(perpMarket.uiQuoteToLots(params.maxQuoteQuantity).toString())
      : BigInt(I64_MAX_BN.toString()),
    clientOrderId: params.clientOrderId ?? Date.now(),
    orderType: params.orderType ?? PerpOrderType.postOnly,
    selfTradeBehavior:
      params.selfTradeBehavior ?? PerpSelfTradeBehavior.decrementTake,
    reduceOnly: params.reduceOnly ?? false,
    expiryTimestamp: params.expiryTimestamp ?? 0,
    limit: params.limit ?? 10,
  });
  const signed = await signIntent({
    context,
    marketIndex: params.marketIndex,
    payload,
    minExecuteSlot: params.minExecuteSlot,
    expiresAtSlot: params.expiresAtSlot,
  });

  return await relayer.submitIntent({
    group: context.group.publicKey.toBase58(),
    execution_queue: context.executionQueuePk.toBase58(),
    market: `${params.marketIndex}`,
    payload,
    remaining_accounts: signed.remainingAccounts.map(toRelayerAccountMeta),
    min_execute_slot: `${params.minExecuteSlot ?? 0n}`,
    expires_at_slot: `${params.expiresAtSlot ?? 0n}`,
    user_owner: context.user.publicKey.toBase58(),
    mango_account: context.mangoAccount.publicKey.toBase58(),
    user_signature: Buffer.from(signed.userSignature),
  });
}

export async function cancelPerpOrderByClientIdViaRelayer(
  relayer: ContinuumRelayerClient,
  context: MangoContext,
  params: SubmitPerpCancelByClientIdParams,
): Promise<SubmitIntentResponse> {
  const payload = encodePerpCancelOrderByClientOrderIdQueuePayload({
    clientOrderId: BigInt(params.clientOrderId),
  });
  const signed = await signIntent({
    context,
    marketIndex: params.marketIndex,
    payload,
    minExecuteSlot: params.minExecuteSlot,
    expiresAtSlot: params.expiresAtSlot,
  });

  return await relayer.submitIntent({
    group: context.group.publicKey.toBase58(),
    execution_queue: context.executionQueuePk.toBase58(),
    market: `${params.marketIndex}`,
    payload,
    remaining_accounts: signed.remainingAccounts.map(toRelayerAccountMeta),
    min_execute_slot: `${params.minExecuteSlot ?? 0n}`,
    expires_at_slot: `${params.expiresAtSlot ?? 0n}`,
    user_owner: context.user.publicKey.toBase58(),
    mango_account: context.mangoAccount.publicKey.toBase58(),
    user_signature: Buffer.from(signed.userSignature),
  });
}

export async function cancelAllPerpOrdersViaRelayer(
  relayer: ContinuumRelayerClient,
  context: MangoContext,
  params: SubmitPerpCancelAllParams,
): Promise<SubmitIntentResponse> {
  const payload = encodePerpCancelAllOrdersQueuePayload({
    limit: params.limit ?? 255,
  });
  const signed = await signIntent({
    context,
    marketIndex: params.marketIndex,
    payload,
    minExecuteSlot: params.minExecuteSlot,
    expiresAtSlot: params.expiresAtSlot,
  });

  return await relayer.submitIntent({
    group: context.group.publicKey.toBase58(),
    execution_queue: context.executionQueuePk.toBase58(),
    market: `${params.marketIndex}`,
    payload,
    remaining_accounts: signed.remainingAccounts.map(toRelayerAccountMeta),
    min_execute_slot: `${params.minExecuteSlot ?? 0n}`,
    expires_at_slot: `${params.expiresAtSlot ?? 0n}`,
    user_owner: context.user.publicKey.toBase58(),
    mango_account: context.mangoAccount.publicKey.toBase58(),
    user_signature: Buffer.from(signed.userSignature),
  });
}
