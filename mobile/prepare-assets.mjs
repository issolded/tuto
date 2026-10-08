// Package drawing instructions; artwork is loaded from Storage by ActivitiesScreen.
import { cpSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { DRAWING_STEPS } from '../src/lib/drawingSteps.js';
const assets = fileURLToPath(new URL('./androidApp/src/main/assets/', import.meta.url));
mkdirSync(assets, {recursive:true});
// Remove obsolete offline-preview artwork even on incremental builds. Native
// RemotePhoto accepts HTTPS only; these 44 MB of local copies were never read.
// Web/source drawings remain untouched, as do all live URLs and image quality.
rmSync(assets+'drawings', {recursive:true,force:true});
writeFileSync(assets+'drawing_steps.json', JSON.stringify(DRAWING_STEPS));

cpSync(fileURLToPath(new URL("./public-config.json", import.meta.url)), assets + "public-config.json");
