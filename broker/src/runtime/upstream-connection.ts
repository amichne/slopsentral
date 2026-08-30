import { createConnection } from "node:net";

import WebSocket from "ws";

import type { BrokerFailure } from "../broker/failure.ts";
import type { Outcome } from "../broker/types.ts";
import type { CodexProtocolValidators } from "../protocol/validators.ts";

export interface QualifiedUpstreamConnection {
  readonly connection: WebSocket;
  readonly validators: CodexProtocolValidators;
}

export type QualifiedUpstreamConnector = () => Promise<
  Outcome<QualifiedUpstreamConnection, BrokerFailure>
>;

export const connectUnixWebSocket = (
  socketPath: string,
  maximumPayloadBytes: number,
  handshakeTimeoutMs = 10_000,
): Promise<WebSocket> =>
  new Promise((resolve, reject) => {
    const websocket = new WebSocket("ws://localhost/", {
      createConnection: () => createConnection(socketPath),
      handshakeTimeout: handshakeTimeoutMs,
      maxPayload: maximumPayloadBytes,
      perMessageDeflate: false,
    });
    const opened = () => {
      websocket.removeEventListener("error", failed);
      resolve(websocket);
    };
    const failed = () => {
      websocket.removeEventListener("open", opened);
      reject(new Error("Unix WebSocket connection failed."));
    };
    websocket.addEventListener("open", opened, { once: true });
    websocket.addEventListener("error", failed, { once: true });
  });
