export type BrokerFailure =
  | { readonly type: "BrokerClosed" }
  | { readonly type: "CatalogReloadFailed"; readonly code: string }
  | { readonly type: "UnknownNamespace"; readonly namespace: string }
  | {
      readonly type: "UnknownTool";
      readonly namespace: string;
      readonly tool: string;
    }
  | {
      readonly type: "InvalidArguments";
      readonly tool: string;
      readonly detail: string;
    }
  | { readonly type: "CatalogInvalid"; readonly issues: readonly string[] }
  | { readonly type: "CatalogIncompatible"; readonly threadId: string }
  | { readonly type: "ProviderUnavailable"; readonly namespace: string }
  | {
      readonly type: "ProviderStartupFailed";
      readonly namespace: string;
      readonly code: string;
    }
  | {
      readonly type: "ProviderInvocationFailed";
      readonly tool: string;
      readonly code: string;
    }
  | { readonly type: "ProviderResultInvalid"; readonly tool: string }
  | { readonly type: "UpstreamUnavailable" }
  | { readonly type: "UpstreamProtocolFailure"; readonly detail: string }
  | {
      readonly type: "CodexProtocolIncompatible";
      readonly actual: string;
      readonly detail: string;
    }
  | { readonly type: "InvocationCancelled"; readonly invocationId: string }
  | { readonly type: "InvocationTimedOut"; readonly invocationId: string }
  | { readonly type: "BrokerOverloaded"; readonly limit: string };
