# Continuum SDK

Self-contained TypeScript SDK for:

- reading optimistic or confirmed state from the Continuum harness,
- submitting perp intents to the relayer over gRPC,
- interacting directly with Mango on-chain state through `@blockworks-foundation/mango-v4`,
- running a minimal remote quoter bot from another machine.

This package is intentionally separate from the deployment repo. It assumes the relayer and harness are already running somewhere reachable over the network.

For build and environment setup, keep the existing repo docs in reach:

- [Build And Setup Notes](./docs/BUILD-SETUP.md)

## What It Covers

- Harness reads via `ContinuumHarnessClient`
- Relayer submits via `ContinuumRelayerClient`
- Mango bootstrap via `createMangoContext`
- High-level helpers:
  - `submitPerpOrderViaRelayer`
  - `cancelPerpOrderByClientIdViaRelayer`
  - `cancelAllPerpOrdersViaRelayer`
- Minimal bot runtime:
  - `RelayerPerpQuoterBot`
  - `continuum-quoter`

The harness API surface follows the existing reference in [`mng-v4/api.md`](../mng-v4/api.md).

## Install

```bash
npm install
npm run build
```

## Remote Quoter Setup

Copy `.env.example` and fill in the actual remote endpoints and account keys:

```bash
cp .env.example .env
```

Required values:

- `CLUSTER_URL`: Solana RPC URL reachable from the client machine
- `USER_KEYPAIR`: absolute path to the user keypair JSON, or raw JSON
- `GROUP_PK`: Mango group public key
- `MANGO_ACCOUNT_PK`: Mango account to trade with
- `EXECUTION_QUEUE_PK`: execution queue public key
- `RELAYER_ADDR`: gRPC relayer address, for example `host:9090`

Optional:

- `HARNESS_URL`: Continuum harness base URL, for example `http://host:9091`
- `PROGRAM_ID`: override Mango program id
- `COINGECKO_*`: fair-price source tuning

Run the quoter:

```bash
npx continuum-quoter
```

Or during development:

```bash
npx ts-node src/bin/run-quoter.ts
```

## Programmatic Usage

```ts
import {
  ContinuumHarnessClient,
  ContinuumRelayerClient,
  PerpOrderSide,
  createMangoContext,
  submitPerpOrderViaRelayer,
} from '@fermilabs/continuum-sdk';

const context = await createMangoContext({
  cluster: 'devnet',
  clusterUrl: process.env.CLUSTER_URL!,
  userKeypair: process.env.USER_KEYPAIR!,
  groupPk: process.env.GROUP_PK!,
  mangoAccountPk: process.env.MANGO_ACCOUNT_PK!,
  executionQueuePk: process.env.EXECUTION_QUEUE_PK!,
});

const harness = new ContinuumHarnessClient(process.env.HARNESS_URL!);
const relayer = new ContinuumRelayerClient(process.env.RELAYER_ADDR!);

const optimistic = await harness.getMarketState(0, 'optimistic');

await submitPerpOrderViaRelayer(relayer, context, {
  marketIndex: 0,
  side: PerpOrderSide.bid,
  price: 120,
  quantity: 0.01,
});
```

## Direct Chain Interactions

The SDK keeps direct Mango access available through the returned context:

- `context.client`
- `context.group`
- `context.mangoAccount`
- `context.connection`

That means the remote client can still:

- inspect full Mango state from chain,
- deposit funds,
- create or manage Mango accounts,
- combine direct on-chain actions with relayer-submitted intents.

Those direct actions use the upstream `@blockworks-foundation/mango-v4` client.

## Notes

- The bundled quoter is intentionally minimal. The larger in-repo bot has more operational behaviors, startup funding logic, and deployment-specific assumptions.
- This SDK keeps the harness read path and relayer write path separate so external users can script their own strategies cleanly.
