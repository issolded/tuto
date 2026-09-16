// Package existing audited drawing art and descriptions; production files are read-only.
import { cpSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { DRAWING_STEPS } from '../src/lib/drawingSteps.js';
const assets = fileURLToPath(new URL('./androidApp/src/main/assets/', import.meta.url));
mkdirSync(assets, {recursive:true});
cpSync(fileURLToPath(new URL('../drawings/', import.meta.url)), assets+'drawings', {recursive:true});
// The unpublished robot set is not approved for the preview.
rmSync(assets+'drawings/robot', {recursive:true,force:true});
rmSync(assets+'drawings/master', {recursive:true,force:true});
writeFileSync(assets+'drawing_steps.json', JSON.stringify(DRAWING_STEPS));
