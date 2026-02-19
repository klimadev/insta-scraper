import * as fs from 'fs';
import * as path from 'path';
import { GoogleSearchScraper } from './scraper';
import { GoogleSearchConfig, SearchOutput } from './types';
import { logger } from '../../cli/logger';

const OUTPUT_DIR = path.join(process.cwd(), 'output');

function sanitizeFilename(query: string): string {
  return query
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 50);
}

function ensureOutputDir(): void {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
}

function saveOutput(output: SearchOutput, customFile?: string): string {
  ensureOutputDir();
  
  const filename = customFile || `google-${sanitizeFilename(output.query)}-${Date.now()}.json`;
  const filepath = path.join(OUTPUT_DIR, filename);
  
  fs.writeFileSync(filepath, JSON.stringify(output, null, 2), 'utf-8');
  
  return filepath;
}

export async function runGoogleSearch(config: GoogleSearchConfig): Promise<SearchOutput> {
  const scraper = new GoogleSearchScraper();
  
  logger.start('Inicializando Engine...');
  
  logger.update('Conectando ao Google...');
  
  try {
    const output = await scraper.search(config);
    
    if (output.results.length === 0) {
      logger.warn('Nenhum resultado encontrado.');
      return output;
    }
    
    const filepath = saveOutput(output, config.outputFile);
    
    logger.succeed(`${output.results.length} resultados extraídos`);
    
    console.log('');
    console.log(`Resultado salvo em: ${filepath}`);
    console.log('');
    
    return output;
  } catch (error) {
    const err = error as Error;
    
    if (!err.message.includes('EMPTY_QUERY') && 
        !err.message.includes('CAPTCHA_DETECTED')) {
      logger.fail('Erro durante a busca');
    }
    
    throw error;
  }
}

export { GoogleSearchScraper } from './scraper';
export * from './types';
