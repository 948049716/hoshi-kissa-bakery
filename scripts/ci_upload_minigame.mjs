#!/usr/bin/env node
/**
 * CI script to upload `05-微信小游戏版本` to WeChat Mini Game platform via `miniprogram-ci`.
 * Requires environment variable `WX_PRIVATE_KEY` (the private key content downloaded from mp.weixin.qq.com).
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');
const PROJECT_DIR = path.join(REPO_ROOT, '05-微信小游戏版本');

const appid = process.env.WX_APPID || 'wx923bf8440b65a1af';
const privateKey = process.env.WX_PRIVATE_KEY || '';
const version = process.env.WX_VERSION || `4.0.${process.env.GITHUB_RUN_NUMBER || '1'}`;
const desc = process.env.WX_DESC || 'GitHub Actions 自动上传（星夜吃茶微信小游戏）';

if (!privateKey.trim()) {
  console.error('Missing WX_PRIVATE_KEY environment variable.');
  process.exit(1);
}

const ci = require('miniprogram-ci');
const projCfg = JSON.parse(fs.readFileSync(path.join(PROJECT_DIR, 'project.config.json'), 'utf8'));
const setting = projCfg.setting || {};

async function main() {
  const project = new ci.Project({
    appid,
    type: 'miniGame',
    projectPath: PROJECT_DIR,
    privateKey,
    ignores: [
      'node_modules/**/*',
      'cloudfunctions/**/*',
      'cloudbaserc.json',
      'README.md',
      '**/*.md'
    ]
  });

  console.log(`Uploading Mini Game (${appid}) version ${version}...`);
  const uploadResult = await ci.upload({
    project,
    version,
    desc,
    setting: {
      es6: !!setting.es6,
      es7: !!setting.enhance,
      minify: !!setting.minified,
      minifyJS: !!setting.minified,
      autoPrefixWXSS: false
    },
    onProgressUpdate: (progress) => {
      if (progress && progress.message) {
        console.log(`[miniprogram-ci] ${progress.message}`);
      }
    }
  });

  console.log('Upload succeeded:', JSON.stringify(uploadResult));
}

main().catch((err) => {
  console.error('miniprogram-ci upload failed:', err);
  process.exit(1);
});
