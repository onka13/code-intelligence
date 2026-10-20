import type { LanguagePack } from '../src/packs/pack.js';
import { csharpPack } from './csharp/pack.js';
import { dartPack } from './dart/pack.js';
import { jsonPack } from './json/pack.js';
import { msbuildPack } from './msbuild/pack.js';
import { typescriptPack } from './typescript/pack.js';
import { yamlPack } from './yaml/pack.js';

/** The language packs of this release. Adding a language adds its folder and one entry here (CIN-11). */
export const PACKS: LanguagePack[] = [typescriptPack, dartPack, csharpPack, jsonPack, yamlPack, msbuildPack];
