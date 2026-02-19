import inquirer from 'inquirer';
import { Launcher } from '../engine/launcher';
import { runGoogleSearch } from '../agents/google-search';
import { logger } from './logger';

export async function showWizard(): Promise<void> {
  let running = true;

  while (running) {
    logger.header();

    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'O que deseja fazer?',
        choices: [
          { name: 'Abrir Instagram', value: 'instagram' },
          { name: 'Pesquisar no Google', value: 'google' },
          new inquirer.Separator(),
          { name: 'Sair', value: 'exit' }
        ]
      }
    ]);

    try {
      switch (action) {
        case 'instagram':
          await runInstagramWizard();
          break;
        case 'google':
          await runGoogleWizard();
          break;
        case 'exit':
          running = false;
          console.log('');
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
        console.log('Ate logo!');
        console.log('');
      }
    }
  }
}

async function runInstagramWizard(): Promise<void> {
  const launcher = new Launcher();
  await launcher.launch();
}

async function runGoogleWizard(): Promise<void> {
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'query',
      message: 'Termo de busca:',
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
      name: 'headless',
      message: 'Modo headless (sem interface)?',
      default: false
    }
  ]);

  await runGoogleSearch({
    query: answers.query.trim(),
    maxPages: answers.maxPages,
    headless: answers.headless
  });
}
