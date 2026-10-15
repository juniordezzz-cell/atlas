import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { montar } from './montar.mjs';

const destino = join(dirname(fileURLToPath(import.meta.url)), 'dist', 'index.ts');
mkdirSync(dirname(destino), { recursive: true });
writeFileSync(destino, montar());
console.log('Bundle gerado em', destino);
