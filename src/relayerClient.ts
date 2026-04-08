import { AccountMeta, PublicKey } from '@solana/web3.js';

export type RelayerAccountMeta = {
  pubkey: string;
  is_signer: boolean;
  is_writable: boolean;
};

export type SubmitIntentRequest = {
  group: string;
  execution_queue: string;
  market: string;
  payload: Uint8Array;
  remaining_accounts: RelayerAccountMeta[];
  min_execute_slot?: string;
  expires_at_slot?: string;
  user_owner: string;
  mango_account: string;
  user_signature: Uint8Array;
};

export type SubmitIntentResponse = {
  sequence: string;
  tx_signature: string;
  user_intent_message: Buffer;
  ctm_envelope_message: Buffer;
};

function toBase64(data: Uint8Array): string {
  return Buffer.from(data).toString('base64');
}

function fromBase64(data: string): Buffer {
  return Buffer.from(data, 'base64');
}

export function toRelayerAccountMeta(account: AccountMeta): RelayerAccountMeta {
  return {
    pubkey: account.pubkey.toBase58(),
    is_signer: !!account.isSigner,
    is_writable: !!account.isWritable,
  };
}

export class ContinuumRelayerClient {
  private readonly baseUrl: string;
  private readonly apiKey?: string;

  constructor(baseUrl: string, apiKey?: string) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.apiKey = apiKey;
  }

  async submitIntent(request: SubmitIntentRequest): Promise<SubmitIntentResponse> {
    const body = {
      group: request.group,
      execution_queue: request.execution_queue,
      market: request.market,
      payload: toBase64(request.payload),
      remaining_accounts: request.remaining_accounts,
      min_execute_slot: request.min_execute_slot,
      expires_at_slot: request.expires_at_slot,
      user_owner: request.user_owner,
      mango_account: request.mango_account,
      user_signature: toBase64(request.user_signature),
    };

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    const response = await fetch(`${this.baseUrl}/submit-intent`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`submit-intent failed: ${response.status} ${text}`);
    }

    const json = (await response.json()) as {
      sequence: string;
      tx_signature: string;
      user_intent_message: string;
      ctm_envelope_message: string;
    };

    return {
      sequence: json.sequence,
      tx_signature: json.tx_signature,
      user_intent_message: fromBase64(json.user_intent_message),
      ctm_envelope_message: fromBase64(json.ctm_envelope_message),
    };
  }

  close(): void {
    // no-op — HTTP client has no persistent connection to close
  }
}

export function publicKeyString(value: string | PublicKey): string {
  return value instanceof PublicKey ? value.toBase58() : value;
}
