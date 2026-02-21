interface PhoneExtractionInput {
  bio?: string;
  link?: string;
  bioLinks?: Array<{ url?: string }>;
}

export type PhoneConfidence = 'low' | 'medium' | 'high';

export interface ExtractedPhoneMetadata {
  phonePtBr: string;
  phoneE164: string;
  confidence: PhoneConfidence;
  sources: string[];
}

export interface ExtractedBrazilPhones {
  phonesPtBr: string[];
  phonesE164: string[];
  phonesDetails: ExtractedPhoneMetadata[];
  primaryPhonePtBr?: string;
  primaryPhoneE164?: string;
  primaryPhoneConfidence?: PhoneConfidence;
}

const URL_PROTOCOL_PATTERN = /^https?:\/\//i;
const CONFIDENCE_WEIGHT: Record<PhoneConfidence, number> = {
  low: 1,
  medium: 2,
  high: 3
};

interface DetectedPhoneState {
  confidence: PhoneConfidence;
  sources: Set<string>;
}

function normalizeUrlCandidate(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }

  if (URL_PROTOCOL_PATTERN.test(trimmed)) {
    return trimmed;
  }

  if (trimmed.startsWith('wa.me/')) {
    return `https://${trimmed}`;
  }

  return trimmed;
}

function decodeMaybeEncodedText(value: string): string {
  let current = value;

  for (let i = 0; i < 2; i++) {
    try {
      const decoded = decodeURIComponent(current);
      if (decoded === current) {
        break;
      }
      current = decoded;
    } catch {
      break;
    }
  }

  return current;
}

function pickHigherConfidence(current: PhoneConfidence, incoming: PhoneConfidence): PhoneConfidence {
  return CONFIDENCE_WEIGHT[incoming] > CONFIDENCE_WEIGHT[current] ? incoming : current;
}

function registerPhone(
  phoneMap: Map<string, DetectedPhoneState>,
  rawValue: string,
  source: string,
  confidence: PhoneConfidence
): void {
  const e164 = toBrazilPhoneE164(rawValue);
  if (!e164) {
    return;
  }

  const existing = phoneMap.get(e164);
  if (!existing) {
    phoneMap.set(e164, {
      confidence,
      sources: new Set([source])
    });
    return;
  }

  existing.confidence = pickHigherConfidence(existing.confidence, confidence);
  existing.sources.add(source);
}

function toBrazilPhoneE164(raw: string): string | null {
  let digits = raw.replace(/\D/g, '');

  if (!digits) {
    return null;
  }

  if (digits.startsWith('55')) {
    digits = digits.slice(2);
  }

  if (digits.length === 12 && digits.startsWith('0')) {
    digits = digits.slice(1);
  }

  if (digits.length === 11 && digits.startsWith('0')) {
    digits = digits.slice(1);
  }

  if (digits.length !== 10 && digits.length !== 11) {
    return null;
  }

  const ddd = digits.slice(0, 2);
  const subscriber = digits.slice(2);

  if (ddd.startsWith('0') || Number(ddd) < 11 || Number(ddd) > 99) {
    return null;
  }

  if (subscriber.length !== 8 && subscriber.length !== 9) {
    return null;
  }

  if (subscriber.startsWith('0')) {
    return null;
  }

  return `+55${ddd}${subscriber}`;
}

function formatBrazilPhonePtBr(e164: string): string {
  const digits = e164.replace(/\D/g, '');
  const national = digits.slice(2);
  const ddd = national.slice(0, 2);
  const subscriber = national.slice(2);

  if (subscriber.length === 9) {
    return `+55 (${ddd}) ${subscriber.slice(0, 5)}-${subscriber.slice(5)}`;
  }

  return `+55 (${ddd}) ${subscriber.slice(0, 4)}-${subscriber.slice(4)}`;
}

function collectPhonesFromText(
  text: string,
  phoneMap: Map<string, DetectedPhoneState>,
  source: string,
  confidence: PhoneConfidence
): void {
  const decodedText = decodeMaybeEncodedText(text);
  const candidates = decodedText.match(/(?:\+?\d[\d\s().-]{7,}\d)/g) || [];

  for (const candidate of candidates) {
    registerPhone(phoneMap, candidate, source, confidence);
  }
}

function collectPhonesFromUrl(
  rawUrl: string,
  phoneMap: Map<string, DetectedPhoneState>,
  sourcePrefix: string,
  depth: number = 0
): void {
  if (!rawUrl || depth > 2) {
    return;
  }

  const decoded = decodeMaybeEncodedText(rawUrl);
  collectPhonesFromText(decoded, phoneMap, `${sourcePrefix}_raw_text`, 'medium');

  const normalized = normalizeUrlCandidate(decoded);

  try {
    const url = new URL(normalized);
    const host = url.hostname.toLowerCase();
    const isWhatsappHost =
      host === 'wa.me' ||
      host.endsWith('.wa.me') ||
      host.includes('whatsapp.com') ||
      host.includes('api.whatsapp.com');

    if (host === 'wa.me' || host.endsWith('.wa.me')) {
      const pathPhone = url.pathname.replace(/\//g, '');
      registerPhone(phoneMap, pathPhone, `${sourcePrefix}_wa_path`, 'high');
    }

    const phoneParam = url.searchParams.get('phone');
    if (phoneParam) {
      registerPhone(
        phoneMap,
        phoneParam,
        isWhatsappHost ? `${sourcePrefix}_wa_phone_param` : `${sourcePrefix}_phone_param`,
        isWhatsappHost ? 'high' : 'medium'
      );
    }

    for (const value of url.searchParams.values()) {
      const decodedValue = decodeMaybeEncodedText(value);
      collectPhonesFromText(decodedValue, phoneMap, `${sourcePrefix}_query_text`, 'medium');

      if (decodedValue.includes('http') || decodedValue.includes('wa.me')) {
        collectPhonesFromUrl(decodedValue, phoneMap, `${sourcePrefix}_nested`, depth + 1);
      }
    }
  } catch {
    return;
  }
}

function buildPrimaryPhone(phonesDetails: ExtractedPhoneMetadata[]): {
  primaryPhonePtBr?: string;
  primaryPhoneE164?: string;
  primaryPhoneConfidence?: PhoneConfidence;
} {
  if (phonesDetails.length === 0) {
    return {};
  }

  const sorted = [...phonesDetails].sort((a, b) => {
    const confidenceDiff = CONFIDENCE_WEIGHT[b.confidence] - CONFIDENCE_WEIGHT[a.confidence];
    if (confidenceDiff !== 0) {
      return confidenceDiff;
    }

    if (a.sources.length !== b.sources.length) {
      return b.sources.length - a.sources.length;
    }

    return a.phoneE164.localeCompare(b.phoneE164);
  });

  return {
    primaryPhonePtBr: sorted[0].phonePtBr,
    primaryPhoneE164: sorted[0].phoneE164,
    primaryPhoneConfidence: sorted[0].confidence
  };
}

export function extractBrazilPhones(input: PhoneExtractionInput): ExtractedBrazilPhones {
  const phoneMap = new Map<string, DetectedPhoneState>();

  if (input.bio) {
    collectPhonesFromText(input.bio, phoneMap, 'bio_text', 'low');
  }

  if (input.link) {
    collectPhonesFromUrl(input.link, phoneMap, 'profile_link');
    collectPhonesFromText(input.link, phoneMap, 'profile_link_text', 'medium');
  }

  if (input.bioLinks && input.bioLinks.length > 0) {
    for (let i = 0; i < input.bioLinks.length; i++) {
      const link = input.bioLinks[i];
      if (!link.url) {
        continue;
      }

      const sourcePrefix = `bio_link_${i + 1}`;
      collectPhonesFromUrl(link.url, phoneMap, sourcePrefix);
      collectPhonesFromText(link.url, phoneMap, `${sourcePrefix}_text`, 'medium');
    }
  }

  const phonesE164 = Array.from(phoneMap.keys()).sort();
  const phonesDetails = phonesE164.map(phoneE164 => {
    const state = phoneMap.get(phoneE164)!;
    return {
      phoneE164,
      phonePtBr: formatBrazilPhonePtBr(phoneE164),
      confidence: state.confidence,
      sources: Array.from(state.sources).sort()
    };
  });
  const phonesPtBr = phonesDetails.map(phone => phone.phonePtBr);
  const primary = buildPrimaryPhone(phonesDetails);

  return {
    phonesPtBr,
    phonesE164,
    phonesDetails,
    primaryPhonePtBr: primary.primaryPhonePtBr,
    primaryPhoneE164: primary.primaryPhoneE164,
    primaryPhoneConfidence: primary.primaryPhoneConfidence
  };
}
