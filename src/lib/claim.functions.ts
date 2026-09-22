/**
 * Claim boundary. The client may send ONLY a password attempt and a request id;
 * the reward amount and every authorization decision live on the server.
 */
import { createServerFn } from "@tanstack/react-start";
import { claimCoins } from "./claim.server";

export const claimCoinsFn = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string; password: string; requestId: string }) => d)
  .handler(async ({ data: d }) =>
    claimCoins({ token: d.token, password: d.password, requestId: d.requestId }),
  );
