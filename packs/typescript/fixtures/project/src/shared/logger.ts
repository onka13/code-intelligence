export interface Logger {
  info(message: string): void;
  error(message: string, cause?: unknown): void;
}

export function createLogger(prefix: string): Logger {
  return {
    info: (message) => console.log(`[${prefix}] ${message}`),
    error: (message, cause) => console.error(`[${prefix}] ${message}`, cause),
  };
}

export const logger = createLogger('orders');
