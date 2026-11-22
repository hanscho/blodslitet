import { type Config } from 'prettier';

const config: Config = {
  singleQuote: true,
  trailingComma: 'all',
  embeddedLanguageFormatting: 'auto',
  plugins: ['@trivago/prettier-plugin-sort-imports'],
  importOrder: ['^[./]'],
  importOrderSeparation: false,
  importOrderSortSpecifiers: true,
};

export default config;
