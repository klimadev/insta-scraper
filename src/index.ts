import { runGoogleSearch } from './agents/google-search';
import { logger } from './cli/logger';
import { showWizard } from './cli/wizard';
import { MetricsCollector } from './cli/metrics';

function showHelp(): void {
  console.log('');
  console.log('Uso:');
  console.log('  insta-launcher                    Abre wizard interativo');
  console.log('  insta-launcher google "query"     Busca no Google e extrai resultados');
  console.log('');
  console.log('Opções Google:');
  console.log('  --pages=N   Número de páginas (padrão: 3)');
  console.log('');
  console.log('Sem argumentos: inicia o wizard interativo');
  console.log('');
  process.exit(0);
}

async function runGoogle(args: string[]): Promise<void> {
  if (args.length === 0) {
    console.log('');
    console.log('Uso: insta-launcher google "termo de busca" [--pages=3]');
    console.log('');
    process.exit(1);
  }

  let query = '';
  let maxPages = 3;

  for (const arg of args) {
    if (arg.startsWith('--pages=')) {
      maxPages = parseInt(arg.split('=')[1], 10) || 3;
    } else if (arg === '--help' || arg === '-h') {
      showHelp();
    } else if (!arg.startsWith('--')) {
      query = arg;
    }
  }

  const metrics = new MetricsCollector();
  metrics.startOperation('google_search');

  try {
    const output = await runGoogleSearch({
      query,
      maxPages
    });

    metrics.endOperation('google_search', {
      query,
      resultsCount: output.totalResults,
      pagesScanned: output.totalPages
    });

    metrics.printSummary();
  } catch (error) {
    metrics.recordError('google_search');
    metrics.printSummary();
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
  } else {
    await showWizard();
  }
}

main();
