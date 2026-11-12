import { ALL_COUNTRIES } from './countries';

export const COUNTRY_CODES = ALL_COUNTRIES.map((c) => ({ id: `${c.iso}-${c.code}`, code: c.code, country: c.name, flag: c.flag }));
