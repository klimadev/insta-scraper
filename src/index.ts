import { Launcher } from './engine/launcher';
import { logger } from './cli/logger';

async function main(): Promise<void> {
  const launcher = new Launcher();
  
  try {
    await launcher.launch();
  } catch (error) {
    const err = error as Error;
    if (!err.message.includes('CHROME_NOT_FOUND') && !err.message.includes('NETWORK_ERROR')) {
      logger.fail('Erro inesperado');
      console.error(error);
    }
    process.exit(1);
  }
}

main();
