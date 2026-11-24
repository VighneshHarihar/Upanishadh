// Direct provider transport for Node (recording runs, the harness CLI): the same complete() the edge relay uses,
// so Claude goes through the official Anthropic SDK and every other provider through chat-completions.
import { complete } from "../../src/lib/core/complete.ts";
import { PROVIDERS, LlmError, needsKey, withRateRetry } from "../../src/lib/core/llm.ts";

export function nodeTransport(keys, { onWait, baseUrl } = {}) {
  return {
    complete(req, onToken) {
      const key = keys[req.provider];
      if (needsKey(req.provider) && !key) throw new LlmError("no-key", `No ${PROVIDERS[req.provider].name} key in the environment.`);
      return withRateRetry(() => complete(req, { key, baseUrl, onToken }), (ms) => onWait?.(ms, req.model));
    },
  };
}
