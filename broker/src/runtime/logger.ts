export interface LogRecord {
  readonly event: string;
  readonly [key: string]: string | number | boolean | readonly string[];
}

export interface BrokerLogger {
  readonly write: (record: LogRecord) => void;
}

export const jsonLogger = (write: (line: string) => void): BrokerLogger => ({
  write: (record) =>
    write(
      `${JSON.stringify({ timestamp: new Date().toISOString(), ...record })}\n`,
    ),
});

export const noopLogger: BrokerLogger = { write: () => undefined };
