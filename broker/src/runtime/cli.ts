import { startBrokerRuntime } from "./broker-runtime.ts";
import { createFederatedBroker } from "./composition.ts";
import { BROKER_VERSION, runtimeConfig } from "./config.ts";
import { jsonLogger } from "./logger.ts";

const HELP = `broker ${BROKER_VERSION}

Usage:
  broker serve
  broker catalog
  broker --version
  broker --help

The serve command owns the normal Codex App Server control socket. It never launches,
wraps, aliases, or replaces the managed codex executable used by the operator.
`;

const main = async (arguments_: readonly string[]): Promise<number> => {
  const command = arguments_[0] ?? "serve";
  if (command === "--help" || command === "-h" || command === "help") {
    process.stdout.write(HELP);
    return 0;
  }
  if (command === "--version" || command === "-v") {
    process.stdout.write(`broker ${BROKER_VERSION}\n`);
    return 0;
  }
  if (arguments_.length > 1 || (command !== "serve" && command !== "catalog")) {
    process.stderr.write(
      `${JSON.stringify({ failure: { type: "ConfigInvalid", detail: "unknown arguments" } })}\n`,
    );
    return 2;
  }
  const config = runtimeConfig(process.env);
  if (config.type === "failure") {
    process.stderr.write(`${JSON.stringify({ failure: config.failure })}\n`);
    return 2;
  }
  if (command === "catalog") {
    const broker = createFederatedBroker(config.value);
    if (broker.type === "failure") {
      process.stderr.write(`${JSON.stringify({ failure: broker.failure })}\n`);
      return 2;
    }
    process.stdout.write(`${JSON.stringify(broker.value.catalog)}\n`);
    await broker.value.close();
    return 0;
  }

  const logger = jsonLogger((line) => process.stderr.write(line));
  const running = await startBrokerRuntime(config.value, logger);
  if (running.type === "failure") {
    process.stderr.write(`${JSON.stringify({ failure: running.failure })}\n`);
    return 2;
  }
  await new Promise<void>((resolve) => {
    const stop = () => resolve();
    process.once("SIGINT", stop);
    process.once("SIGTERM", stop);
  });
  await running.value.close();
  return 0;
};

process.exitCode = await main(process.argv.slice(2));
