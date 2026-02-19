export const GOOGLE_URL = 'https://www.google.com';

export const SEARCH_INPUT_ROLE = 'combobox' as const;
export const SEARCH_INPUT_NAME = 'Pesquisar';

export const SEARCH_BUTTON_ROLE = 'button' as const;
export const SEARCH_BUTTON_NAME = 'Pesquisa Google';

export const RESULT_CONTAINER = '#rso, [role="main"]';
export const RESULT_ITEM = 'div[data-hveid]';
export const RESULT_TITLE = 'h3';
export const RESULT_LINK = 'a[href^="http"]';

export const NEXT_PAGE_ROLE = 'link' as const;
export const NEXT_PAGE_NAME = 'Mais';

export const IGNORE_PATTERNS = [
  'google.com/search',
  'accounts.google',
  'support.google',
  'maps.google',
  'policies.google',
  'youtube.com'
];

export const CAPTCHA_INDICATORS = [
  'recaptcha',
  'captcha',
  'unusual traffic',
  'verifique que você é humano',
  'verificare che sei un essere umano',
  'nossa systems have detected'
];
