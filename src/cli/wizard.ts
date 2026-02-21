import inquirer from 'inquirer';
import { runGoogleSearch } from '../agents/google-search';
import { logger } from './logger';
import { MetricsCollector } from './metrics';

export async function showWizard(): Promise<void> {
  let running = true;
  const metrics = new MetricsCollector();

  while (running) {
    logger.header();

    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'O que deseja fazer?',
        choices: [
          { name: 'Pesquisar no Google', value: 'google' },
          new inquirer.Separator(),
          { name: 'Ver metricas da sessao', value: 'metrics' },
          { name: 'Sair', value: 'exit' }
        ]
      }
    ]);

    try {
      switch (action) {
        case 'google':
          await runGoogleWizard(metrics);
          break;
        case 'metrics':
          metrics.printSummary();
          break;
        case 'exit':
          running = false;
          console.log('');
          metrics.printSummary();
          console.log('Ate logo!');
          console.log('');
          break;
      }
    } catch (error) {
      const err = error as Error;
      if (!err.message.includes('CHROME_NOT_FOUND') && 
          !err.message.includes('NETWORK_ERROR')) {
        console.error('Erro:', err.message);
      }
    }

    if (running && action !== 'exit') {
      const { continueWizard } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'continueWizard',
          message: 'Deseja fazer outra acao?',
          default: true
        }
      ]);

      if (!continueWizard) {
        running = false;
        console.log('');
        metrics.printSummary();
        console.log('Ate logo!');
        console.log('');
      }
    }
  }
}

async function runGoogleWizard(metrics: MetricsCollector): Promise<void> {
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'query',
      message: 'Termo de busca (substitui "clinica" na dork):',
      validate: (input: string) => {
        if (!input.trim()) {
          return 'O termo de busca nao pode estar vazio.';
        }
        return true;
      }
    },
    {
      type: 'number',
      name: 'maxPages',
      message: 'Numero de paginas (padrao: 3):',
      default: 3,
      validate: (input: number) => {
        if (input < 1 || input > 10) {
          return 'Escolha entre 1 e 10 paginas.';
        }
        return true;
      }
    },
    {
      type: 'confirm',
      name: 'onlyWithPhones',
      message: 'Exportar somente resultados com telefone?',
      default: false
    }
  ]);

  metrics.startOperation('google_search');

  try {
    const output = await runGoogleSearch({
      query: answers.query.trim(),
      maxPages: answers.maxPages,
      onlyWithPhones: answers.onlyWithPhones
    });

    metrics.endOperation('google_search', {
      query: answers.query.trim(),
      resultsCount: output.totalResults,
      pagesScanned: output.totalPages
    });
  } catch (error) {
    metrics.recordError('google_search');
    throw error;
  }
}
