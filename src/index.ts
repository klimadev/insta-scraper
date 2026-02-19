import { Launcher } from './engine/launcher';
import { runGoogleSearch } from './agents/google-search';
import { logger } from './cli/logger';
import { showWizard } from './cli/wizard';

function showHelp(): void {
  console.log('');
  console.log('Uso:');
  console.log('  insta-launcher                    Abre wizard interativo');
  console.log('  insta-launcher google "query"     Busca no Google e extrai resultados');
  console.log('  insta-launcher instagram          Abre Instagram no browser');
  console.log('');
  console.log('Opções Google:');
  console.log('  --pages=N   Número de páginas (padrão: 3)');
  console.log('  --headless  Executar em modo headless');
  console.log('');
  console.log('Sem argumentos: inicia o wizard interativo');
  console.log('');
  process.exit(0);
}

async function runInstagram(): Promise<void> {
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

async function runGoogle(args: string[]): Promise<void> {
  if (args.length === 0) {
    console.log('');
    console.log('Uso: insta-launcher google "termo de busca" [--pages=3] [--headless]');
    console.log('');
    process.exit(1);
  }

  let query = '';
  let maxPages = 3;
  let headless = false;

  for (const arg of args) {
    if (arg.startsWith('--pages=')) {
      maxPages = parseInt(arg.split('=')[1], 10) || 3;
    } else if (arg === '--headless') {
      headless = true;
    } else if (arg === '--help' || arg === '-h') {
      showHelp();
    } else if (!arg.startsWith('--')) {
      query = arg;
    }
  }

  try {
    await runGoogleSearch({
      query,
      maxPages,
      headless
    });
  } catch (error) {
    process.exit(1);
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0];

  if (command === '--help' || command === '-h') {
    showHelp();
  }

  if (command === 'google') {
    await runGoogle(args.slice(1));
  } else if (command === 'instagram') {
    await runInstagram();
  } else {
    await showWizard();
  }
}

main();
