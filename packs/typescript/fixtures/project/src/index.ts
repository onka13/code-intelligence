import { createApp } from './app';
import { logger } from './shared/logger';

const PORT = Number(process.env.PORT ?? 3000);

export async function main(): Promise<void> {
  const app = createApp();
  app.listen(PORT, () => logger.info(`listening on ${PORT}`));
}

main();
