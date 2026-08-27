#!/usr/bin/env node

/**
 * Kopiert die kanonischen Drittanbieterhinweise in den von Vite veröffentlichten
 * public-Ordner. So enthält jeder Build denselben vollständigen Lizenztext wie
 * das Repository, ohne zwei redaktionell gepflegte Fassungen einzuführen.
 */
import { copyFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
await copyFile(
  join(root, 'THIRD_PARTY_NOTICES.md'),
  join(root, 'public', 'THIRD_PARTY_NOTICES.md')
);
