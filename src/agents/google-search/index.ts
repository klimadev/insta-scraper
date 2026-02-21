import * as fs from 'fs';
import * as path from 'path';
import { GoogleSearchScraper } from './scraper';
import { GoogleSearchConfig, SearchOutput, SearchResult } from './types';
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

function hasPhones(result: SearchResult): boolean {
  if (result.instagramPhonesDetails && result.instagramPhonesDetails.length > 0) {
    return true;
  }

  if (result.instagramPhonesPtBr && result.instagramPhonesPtBr.length > 0) {
    return true;
  }

  if (result.instagramPhonesE164 && result.instagramPhonesE164.length > 0) {
    return true;
  }

  return false;
}

function getResultPhoneDetails(result: SearchResult): Array<{
  phonePtBr: string;
  phoneE164: string;
  confidence: 'low' | 'medium' | 'high';
  sources: string[];
}> {
  if (result.instagramPhonesDetails && result.instagramPhonesDetails.length > 0) {
    return result.instagramPhonesDetails;
  }

  const e164 = result.instagramPhonesE164 || [];
  const ptBr = result.instagramPhonesPtBr || [];
  const fallback: Array<{
    phonePtBr: string;
    phoneE164: string;
    confidence: 'low' | 'medium' | 'high';
    sources: string[];
  }> = [];

  for (let i = 0; i < e164.length; i++) {
    fallback.push({
      phoneE164: e164[i],
      phonePtBr: ptBr[i] || '',
      confidence: 'low',
      sources: []
    });
  }

  return fallback;
}

function getTopDdds(results: SearchResult[], limit: number = 5): string[] {
  const counter = new Map<string, number>();

  for (const result of results) {
    const details = getResultPhoneDetails(result);
    for (const item of details) {
      const digits = item.phoneE164.replace(/\D/g, '');
      if (!digits.startsWith('55') || digits.length < 12) {
        continue;
      }

      const ddd = digits.slice(2, 4);
      counter.set(ddd, (counter.get(ddd) || 0) + 1);
    }
  }

  return Array.from(counter.entries())
    .sort((a, b) => {
      if (b[1] !== a[1]) {
        return b[1] - a[1];
      }

      return a[0].localeCompare(b[0]);
    })
    .slice(0, limit)
    .map(([ddd, count]) => `(${ddd}) ${count}`);
}

function printExtractionSummary(output: SearchOutput, exportedCount: number): void {
  const instagramOkCount = output.results.filter(result => result.status === 'instagram_ok').length;
  const resultsWithPhones = output.results.filter(hasPhones).length;
  const uniquePhones = new Set<string>();
  let totalPhonesFound = 0;

  for (const result of output.results) {
    const details = getResultPhoneDetails(result);
    totalPhonesFound += details.length;

    for (const item of details) {
      uniquePhones.add(item.phoneE164);
    }
  }

  const topDdds = getTopDdds(output.results);

  logger.info('Resumo da extracao de telefones:');
  logger.info(`- Resultados totais: ${output.results.length}`);
  logger.info(`- Perfis Instagram com sucesso: ${instagramOkCount}`);
  logger.info(`- Resultados com telefone: ${resultsWithPhones}`);
  logger.info(`- Telefones encontrados: ${totalPhonesFound} (${uniquePhones.size} unicos)`);
  logger.info(`- Linhas exportadas no CSV: ${exportedCount}`);
  if (topDdds.length > 0) {
    logger.info(`- Top DDDs: ${topDdds.join(' | ')}`);
  }
}

function saveOutput(output: SearchOutput, customFile?: string, onlyWithPhones: boolean = false): string {
  ensureOutputDir();

  const filename = customFile || `google-${sanitizeFilename(output.query)}-${Date.now()}.csv`;
  const filepath = path.join(OUTPUT_DIR, filename);
  const exportResults = onlyWithPhones
    ? output.results.filter(hasPhones)
    : output.results;

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
    'instagramPhonesCount',
    'instagramPhones',
    'instagramPhonesE164',
    'instagramPhonesJson',
    'instagramPrimaryPhone',
    'instagramPrimaryPhoneE164',
    'instagramPrimaryPhoneConfidence',
    'instagramPhonesConfidenceJson',
    'instagramPhonesSourcesJson',
    'instagramExtractedAt'
  ]);

  const lines = exportResults.map(result => {
    const details = getResultPhoneDetails(result);
    const phonesPtBr = details.map(item => item.phonePtBr).filter(Boolean);
    const phonesE164 = details.map(item => item.phoneE164).filter(Boolean);
    const confidenceMap = details.reduce((acc, item) => {
      acc[item.phoneE164] = item.confidence;
      return acc;
    }, {} as Record<string, 'low' | 'medium' | 'high'>);
    const sourcesMap = details.reduce((acc, item) => {
      acc[item.phoneE164] = item.sources;
      return acc;
    }, {} as Record<string, string[]>);
    const primaryPtBr = result.instagramPrimaryPhonePtBr || (details[0]?.phonePtBr || '');
    const primaryE164 = result.instagramPrimaryPhoneE164 || (details[0]?.phoneE164 || '');
    const primaryConfidence = result.instagramPrimaryPhoneConfidence || (details[0]?.confidence || '');

    return toCsvRow([
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
      phonesPtBr.length,
      phonesPtBr.join(' | '),
      phonesE164.join(' | '),
      phonesPtBr.length > 0 ? JSON.stringify(phonesPtBr) : '',
      primaryPtBr,
      primaryE164,
      primaryConfidence,
      phonesE164.length > 0 ? JSON.stringify(confidenceMap) : '',
      phonesE164.length > 0 ? JSON.stringify(sourcesMap) : '',
      result.instagramExtractedAt || ''
    ]);
  });

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
    
    const filepath = saveOutput(output, config.outputFile, Boolean(config.onlyWithPhones));
    
    const exportedCount = config.onlyWithPhones
      ? output.results.filter(hasPhones).length
      : output.results.length;

    if (config.onlyWithPhones) {
      logger.succeed(`${output.results.length} resultados extraídos (${exportedCount} com telefone exportados)`);
    } else {
      logger.succeed(`${output.results.length} resultados extraídos`);
    }

    printExtractionSummary(output, exportedCount);
    
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
