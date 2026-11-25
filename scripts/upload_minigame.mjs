#!/usr/bin/env node
/**
 * WeChat Mini Game CI uploader / previewer powered by official `miniprogram-ci`.
 * Supports GitHub Actions secrets (`WECHAT_PRIVATE_KEY`, optional `WECHAT_APPID`)
 * and `--dry-run` validation without polluting `05-微信小游戏版本/` with node_modules.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');
const MINIGAME_DIR = path.join(REPO_ROOT, '05-微信小游戏版本');

function parseArgs(argv) {
  const opts = { dryRun: false, action: '', version: '', desc: '', keyPath: '' };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') opts.dryRun = true;
    else if (a === '--action' && argv[i + 1]) opts.action = argv[++i];
    else if (a === '--version' && argv[i + 1]) opts.version = argv[++i];
    else if (a === '--desc' && argv[i + 1]) opts.desc = argv[++i];
    else if (a === '--key-path' && argv[i + 1]) opts.keyPath = argv[++i];
  }
  return opts;
}

function readProjectConfig() {
  const cfgPath = path.join(MINIGAME_DIR, 'project.config.json');
  if (!fs.existsSync(cfgPath)) {
    throw new Error(`Missing project.config.json at ${cfgPath}`);
  }
  return JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
}

function readMajorMinorFromGameVersion() {
  try {
    const req = createRequire(import.meta.url);
    const { GAME_VERSION } = req(path.join(MINIGAME_DIR, 'src', 'constants.js'));
    const parts = String(GAME_VERSION || '0.9.0')
      .replace(/^v/i, '')
      .split('.');
    const major = Number.isFinite(Number(parts[0])) ? Math.max(0, Math.floor(Number(parts[0]))) : 0;
    const minor = Number.isFinite(Number(parts[1])) ? Math.max(0, Math.floor(Number(parts[1]))) : 9;
    return { major, minor, full: `${major}.${minor}.${parts[2] || '0'}` };
  } catch (_) {
    return { major: 0, minor: 9, full: '0.9.0' };
  }
}

function resolveVersion(explicitVersion) {
  const raw = (explicitVersion || '').trim();
  if (raw) return raw.replace(/^v/i, '');
  const { major, minor, full } = readMajorMinorFromGameVersion();
  const runNum = (process.env.GITHUB_RUN_NUMBER || '').trim();
  if (runNum) return `${major}.${minor}.${runNum}`;
  return full;
}

function resolveDesc(explicitDesc) {
  const raw = (explicitDesc || '').trim();
  if (raw) return raw.slice(0, 120);
  const sha = (process.env.GITHUB_SHA || '').slice(0, 7);
  const msg = (process.env.COMMIT_MESSAGE || '').split('\n')[0].trim();
  const base = msg ? (sha ? `${sha} ${msg}` : msg) : sha ? `CI build ${sha}` : 'CI automated upload';
  return base.slice(0, 120);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const cfg = readProjectConfig();
  const appid = (process.env.WECHAT_APPID || cfg.appid || '').trim();
  if (!appid || appid === 'touristappid') {
    throw new Error(`Invalid Mini Game appid '${appid}'. Set a valid appid in project.config.json or WECHAT_APPID.`);
  }

  const action = (args.action || process.env.WECHAT_ACTION || 'upload').trim();
  if (action !== 'upload' && action !== 'preview') {
    throw new Error(`Unsupported WECHAT_ACTION '${action}'. Expected 'upload' or 'preview'.`);
  }

  const version = resolveVersion(args.version || process.env.WECHAT_VERSION);
  const desc = resolveDesc(args.desc || process.env.WECHAT_DESC);
  const robot = Math.max(1, Math.min(30, Number(process.env.WECHAT_ROBOT || 1) || 1));

  const privateKey = (process.env.WECHAT_PRIVATE_KEY || '').trim();
  const privateKeyPath = (args.keyPath || process.env.WECHAT_PRIVATE_KEY_PATH || '').trim();

  // Pre-upload guard: verify all assets under assets/ use WeChat Mini Game whitelisted extensions & pure ASCII paths
  const WECHAT_ALLOWED_ASSET_EXTS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.svg', '.ttf', '.fnt', '.json', '.mp3', '.wav', '.m4a']);
  const assetsRoot = path.join(MINIGAME_DIR, 'assets');
  let totalAssetBytes = 0;
  let totalAssetCount = 0;
  if (fs.existsSync(assetsRoot)) {
    const stack = [assetsRoot];
    while (stack.length > 0) {
      const cur = stack.pop();
      for (const entry of fs.readdirSync(cur, { withFileTypes: true })) {
        const full = path.join(cur, entry.name);
        if (entry.isDirectory()) {
          stack.push(full);
          continue;
        }
        if (entry.name.startsWith('.')) continue;
        const rel = path.relative(MINIGAME_DIR, full).split(path.sep).join('/');
        const ext = path.extname(entry.name).toLowerCase();
        if (!WECHAT_ALLOWED_ASSET_EXTS.has(ext)) {
          throw new Error(
            `[miniprogram-ci] Asset '${rel}' uses non-whitelisted extension '${ext}'. WeChat Mini Game silently drops non-whitelisted files (e.g. .webp) during upload!`
          );
        }
        if (/[^\x20-\x7E]/.test(rel)) {
          throw new Error(
            `[miniprogram-ci] Asset '${rel}' contains non-ASCII characters which may fail on iOS WeChat Mini Game.`
          );
        }
        totalAssetBytes += fs.statSync(full).size;
        totalAssetCount += 1;
      }
    }
  }
  console.log(
    `[miniprogram-ci] Asset preflight OK: ${totalAssetCount} whitelisted ASCII assets (${(totalAssetBytes / 1024).toFixed(1)} KB)`
  );

  if (args.dryRun) {
    console.log(
      JSON.stringify(
        {
          dryRun: true,
          action,
          appid,
          type: 'miniGame',
          projectPath: MINIGAME_DIR,
          version,
          desc,
          robot,
          totalAssetCount,
          totalAssetBytes,
          hasPrivateKey: Boolean(privateKey || (privateKeyPath && fs.existsSync(privateKeyPath)))
        },
        null,
        2
      )
    );
    return;
  }

  if (!privateKey && (!privateKeyPath || !fs.existsSync(privateKeyPath))) {
    const evt = process.env.GITHUB_EVENT_NAME || '';
    if (evt && evt !== 'workflow_dispatch') {
      console.log(
        '::warning::WECHAT_PRIVATE_KEY Secret 尚未配置，已跳过自动上传。请在 GitHub 仓库 Settings -> Secrets and variables -> Actions 添加 WECHAT_PRIVATE_KEY（并确保微信公众平台已配置/关闭 IP 白名单）。'
      );
      return;
    }
    throw new Error('Missing WECHAT_PRIVATE_KEY (or valid WECHAT_PRIVATE_KEY_PATH).');
  }

  const require = createRequire(import.meta.url);
  const ciModPath = process.env.MINIPROGRAM_CI_PATH || 'miniprogram-ci';
  const ci = require(ciModPath);

  const projectOpts = {
    appid,
    type: 'miniGame',
    projectPath: MINIGAME_DIR,
    ignores: [
      'node_modules/**/*',
      'cloudfunctions/**/*',
      'cloudbaserc.json',
      '**/*.md',
      'project.private.config.json'
    ]
  };
  if (privateKey) projectOpts.privateKey = privateKey;
  else projectOpts.privateKeyPath = privateKeyPath;

  const project = new ci.Project(projectOpts);
  const compileSetting = {
    es6: Boolean(cfg.setting && cfg.setting.es6 !== false),
    es7: Boolean(cfg.setting && cfg.setting.enhance !== false),
    minify: Boolean(cfg.setting && cfg.setting.minified !== false),
    minifyJS: Boolean(cfg.setting && cfg.setting.minified !== false),
    uploadWithSourceMap: Boolean(cfg.setting && cfg.setting.uploadWithSourceMap !== false)
  };

  console.log(`[miniprogram-ci] Starting ${action} for appid=${appid}, version=${version}, robot=${robot}`);
  console.log(`[miniprogram-ci] Desc: ${desc}`);

  const assertPackedIncludesAssets = (res) => {
    const pkgs = (res && res.subPackageInfo) || [];
    const fullPkg = pkgs.find((p) => p && p.name === '__FULL__') || pkgs[0];
    if (fullPkg && Number.isFinite(fullPkg.size) && totalAssetBytes > 0) {
      if (fullPkg.size < totalAssetBytes) {
        throw new Error(
          `[miniprogram-ci] Packed __FULL__ size (${fullPkg.size} bytes) is smaller than local assets/ (${totalAssetBytes} bytes)! Some assets were dropped during packaging.`
        );
      }
      console.log(
        `[miniprogram-ci] Post-pack verification OK: __FULL__=${(fullPkg.size / 1024).toFixed(1)} KB >= assets=${(totalAssetBytes / 1024).toFixed(1)} KB`
      );
    }
  };

  if (action === 'preview') {
    const outDir = process.env.RUNNER_TEMP || '/tmp';
    const qrcodeOutputDest = path.join(outDir, 'wechat_preview_qrcode.jpg');
    const previewRes = await ci.preview({
      project,
      desc,
      setting: compileSetting,
      qrcodeFormat: 'image',
      qrcodeOutputDest,
      allowIgnoreUnusedFiles: false,
      robot,
      onProgressUpdate: (task) => {
        if (task && task.status === 'doing') return;
        console.log('[preview progress]', typeof task === 'string' ? task : JSON.stringify(task));
      }
    });
    console.log('[miniprogram-ci] Preview succeeded:', JSON.stringify(previewRes));
    assertPackedIncludesAssets(previewRes);
    console.log(`[miniprogram-ci] QR code saved at: ${qrcodeOutputDest}`);
  } else {
    const uploadRes = await ci.upload({
      project,
      version,
      desc,
      setting: compileSetting,
      allowIgnoreUnusedFiles: false,
      robot,
      onProgressUpdate: (task) => {
        if (task && task.status === 'doing') return;
        console.log('[upload progress]', typeof task === 'string' ? task : JSON.stringify(task));
      }
    });
    console.log('[miniprogram-ci] Upload succeeded:', JSON.stringify(uploadRes));
    assertPackedIncludesAssets(uploadRes);
  }
}

main().catch((err) => {
  console.error('[miniprogram-ci] Failed:', err && err.stack ? err.stack : err);
  process.exit(1);
});
