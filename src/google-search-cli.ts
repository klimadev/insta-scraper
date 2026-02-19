import { runGoogleSearch } from './agents/google-search';

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('');
    console.log('Uso: npm run dev:google "termo de busca" [--pages=3]');
    console.log('');
    process.exit(1);
  }

  let query = '';
  let maxPages = 3;

  for (const arg of args) {
    if (arg.startsWith('--pages=')) {
      maxPages = parseInt(arg.split('=')[1], 10) || 3;
    } else {
      query = arg;
    }
  }

  try {
    await runGoogleSearch({
      query,
      maxPages,
      headless: false
    });
  } catch (error) {
    process.exit(1);
  }
}

main();
