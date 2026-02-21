import * as fs from 'fs';
import * as path from 'path';
import { GoogleSearchScraper } from './scraper';
import { GoogleSearchConfig, SearchOutput } from './types';
import { logger } from '../../cli/logger';
import { toCsvRow } from '../../utils/csv';

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

  const filename = customFile || `google-${sanitizeFilename(output.query)}-${Date.now()}.csv`;
  const filepath = path.join(OUTPUT_DIR, filename);

  const header = toCsvRow([
    'query',
    'totalPages',
    'totalResults',
    'outputExtractedAt',
    'title',
    'url',
    'description',
    'source',
    'status',
    'resultExtractedAt',
    'page',
    'instagramUsername',
    'instagramName',
    'instagramPublicacoes',
    'instagramSeguidores',
    'instagramSeguindo',
    'instagramBio',
    'instagramLink',
    'instagramExtractedAt'
  ]);

  const lines = output.results.map(result => toCsvRow([
    output.query,
    output.totalPages,
    output.totalResults,
    output.extractedAt,
    result.title,
    result.url,
    result.description,
    result.source,
    result.status,
    result.extractedAt,
    result.page,
    result.instagramUsername || '',
    result.instagramName || '',
    result.instagramPublicacoes || '',
    result.instagramSeguidores || '',
    result.instagramSeguindo || '',
    result.instagramBio || '',
    result.instagramLink || '',
    result.instagramExtractedAt || ''
  ]));

  const csvContent = [header, ...lines].join('\n');
  fs.writeFileSync(filepath, csvContent, 'utf-8');

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
