# Build And Setup Notes

This SDK is meant to run independently from another machine, but the fastest path to a working environment still depends on the existing Mango and Continuum build notes already in this workspace.

Rather than duplicating those instructions and letting them drift, keep these source documents nearby during setup:

- Mango TypeScript and workspace overview:
  - [`../../mng-v4/README.md`](../../mng-v4/README.md)
- Mango build and platform gotchas:
  - [`../../mng-v4/FAQ-DEV.md`](../../mng-v4/FAQ-DEV.md)
- Existing clean-build troubleshooting for the relayer:
  - [`../../buildissues.md`](../../buildissues.md)
- Continuum harness API reference:
  - [`../../mng-v4/api.md`](../../mng-v4/api.md)
- Persistent stack and service layout:
  - [`../../persistence.md`](../../persistence.md)
- Devnet deployment and runtime scripts:
  - [`../../deploy.sh`](../../deploy.sh)
  - [`../../scripts/run_devnet_harness.sh`](../../scripts/run_devnet_harness.sh)
  - [`../../scripts/run_devnet_relayer.sh`](../../scripts/run_devnet_relayer.sh)
  - [`../../scripts/run_devnet_quoter.sh`](../../scripts/run_devnet_quoter.sh)

## Suggested Fast Path

For a clean setup, treat the repo docs above as the source of truth for:

- how to build `mango-v4`,
- how to build or validate the Rust relayer,
- how the harness and relayer ports are expected to be exposed,
- which env vars are already assumed by the running stack.

Then use this SDK only for the remote-client layer:

- connect to Solana RPC,
- connect to relayer gRPC,
- connect to harness HTTP,
- place/cancel quotes,
- read optimistic or confirmed state,
- perform direct Mango client actions from the same machine.

## Why This Matters

The expensive setup time is still mostly in the upstream `mango-v4` and relayer build path. Keeping the current docs intact and linked here avoids re-discovering known fixes like:

- Rust or Solana version mismatches,
- stale or unusable `mango_v4.so` artifacts,
- relayer build hangs or release/debug binary confusion,
- service port and runtime-env mismatches between harness, relayer, and clients.
