import { transform } from 'https://cdn.jsdelivr.net/npm/sucrase@3.35.0/+esm';

const EXTERNAL_URLS = {
  react: 'https://esm.sh/react@19.0.1',
  'react/jsx-runtime': 'https://esm.sh/react@19.0.1/jsx-runtime',
  'react-dom/client': 'https://esm.sh/react-dom@19.0.1/client?deps=react@19.0.1',
  'lucide-react': 'https://esm.sh/lucide-react@0.546.0?deps=react@19.0.1',
  jszip: 'https://esm.sh/jszip@3.10.2',
  'firebase/app': 'https://esm.sh/firebase@13.4.0/app',
  'firebase/auth': 'https://esm.sh/firebase@13.4.0/auth',
  'firebase/firestore': 'https://esm.sh/firebase@13.4.0/firestore',
  'firebase/storage': 'https://esm.sh/firebase@13.4.0/storage',
  'firebase/app-check': 'https://esm.sh/firebase@13.4.0/app-check',
  'firebase/messaging': 'https://esm.sh/firebase@13.4.0/messaging',
};

function wrapEsmModule(ns) {
  const out = { __esModule: true };
  for (const key of Object.keys(ns)) {
    out[key] = ns[key];
  }
  if (!('default' in out)) {
    out.default = out;
  }
  return out;
}

function normalizePosix(baseFile, spec) {
  if (spec.startsWith('@/')) {
    return spec.slice(2).replace(/^\/+/, '');
  }
  if (spec.startsWith('/')) {
    return spec.slice(1);
  }
  const baseParts = baseFile.split('/').slice(0, -1);
  for (const part of spec.split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') {
      baseParts.pop();
    } else {
      baseParts.push(part);
    }
  }
  return baseParts.join('/');
}

async function fetchTextIfReal(relPath) {
  const res = await fetch('./' + relPath);
  if (!res.ok) return null;
  const ct = (res.headers.get('content-type') || '').toLowerCase();
  if (ct.includes('text/html')) return null;
  return await res.text();
}

async function resolveAndLoadLocal(rawPath, loadedLocal, inFlight, resolveMap, fromKey) {
  const cacheTag = fromKey + '->' + rawPath;
  if (resolveMap.has(cacheTag)) {
    return resolveMap.get(cacheTag);
  }

  const ext = rawPath.split('.').pop()?.toLowerCase() || '';

  if (ext === 'css') {
    const key = 'css:' + rawPath;
    resolveMap.set(cacheTag, key);
    loadedLocal.set(key, { kind: 'css' });
    return key;
  }

  if (ext === 'json') {
    const key = 'json:' + rawPath;
    resolveMap.set(cacheTag, key);
    if (!loadedLocal.has(key) && !inFlight.has(key)) {
      const p = (async () => {
        const txt = await fetchTextIfReal(rawPath);
        if (txt === null) {
          throw new Error(`Unable to load JSON module: ${rawPath}`);
        }
        const data = JSON.parse(txt);
        loadedLocal.set(key, { kind: 'json', data });
      })();
      inFlight.set(key, p);
    }
    if (inFlight.has(key)) await inFlight.get(key);
    return key;
  }

  if (['jpg', 'jpeg', 'png', 'webp', 'svg', 'gif'].includes(ext)) {
    const key = 'asset:' + rawPath;
    resolveMap.set(cacheTag, key);
    loadedLocal.set(key, { kind: 'asset', url: './' + rawPath });
    return key;
  }

  const candidates =
    ext === 'ts' || ext === 'tsx' || ext === 'js' || ext === 'jsx'
      ? [rawPath]
      : [rawPath + '.tsx', rawPath + '.ts', rawPath + '/index.tsx', rawPath + '/index.ts'];

  // Check if any candidate is already loaded
  for (const cand of candidates) {
    if (loadedLocal.has(cand)) {
      resolveMap.set(cacheTag, cand);
      return cand;
    }
    if (inFlight.has(cand)) {
      await inFlight.get(cand);
      if (loadedLocal.has(cand)) {
        resolveMap.set(cacheTag, cand);
        return cand;
      }
    }
  }

  const probePromise = (async () => {
    const results = await Promise.all(
      candidates.map(async (cand) => ({ cand, text: await fetchTextIfReal(cand) }))
    );
    const hit = results.find((r) => r.text !== null);
    if (!hit) {
      throw new Error(`Unable to resolve module "${rawPath}" (tried ${candidates.join(', ')})`);
    }
    return hit;
  })();

  const hit = await probePromise;
  const resolvedPath = hit.cand;
  resolveMap.set(cacheTag, resolvedPath);

  if (!loadedLocal.has(resolvedPath)) {
    if (!inFlight.has(resolvedPath)) {
      const compilePromise = (async () => {
        const preprocessed = hit.text
          .replace(/\bimport\.meta\.env\b/g, '__importMeta.env')
          .replace(/\bimport\.meta\.url\b/g, '__importMeta.url');

        const transformed = transform(preprocessed, {
          transforms: ['typescript', 'jsx', 'imports'],
          jsxRuntime: 'automatic',
          production: true,
          filePath: resolvedPath,
        });

        const deps = [];
        const reqRegex = /\brequire\(\s*(['"])([^'"]+)\1\s*\)/g;
        let match;
        while ((match = reqRegex.exec(transformed.code)) !== null) {
          deps.push(match[2]);
        }

        loadedLocal.set(resolvedPath, {
          kind: 'code',
          code: transformed.code,
          path: resolvedPath,
        });

        await Promise.all(
          deps.map(async (spec) => {
            if (spec in EXTERNAL_URLS) {
              resolveMap.set(resolvedPath + '->' + spec, 'ext:' + spec);
              return;
            }
            if (spec.startsWith('.') || spec.startsWith('@/') || spec.startsWith('/')) {
              const target = normalizePosix(resolvedPath, spec);
              const depKey = await resolveAndLoadLocal(
                target,
                loadedLocal,
                inFlight,
                resolveMap,
                resolvedPath
              );
              resolveMap.set(resolvedPath + '->' + spec, depKey);
            } else {
              throw new Error(`Unsupported external package "${spec}" in ${resolvedPath}`);
            }
          })
        );
      })();
      inFlight.set(resolvedPath, compilePromise);
    }
    await inFlight.get(resolvedPath);
  }

  return resolvedPath;
}

async function setupTailwindStyles() {
  try {
    const cssText = await fetchTextIfReal('src/index.css');
    const styleEl = document.createElement('style');
    styleEl.setAttribute('type', 'text/tailwindcss');
    styleEl.textContent = cssText || '@import "tailwindcss";\n@custom-variant dark (&:where(.dark, .dark *));';
    document.head.appendChild(styleEl);
  } catch {
    const styleEl = document.createElement('style');
    styleEl.setAttribute('type', 'text/tailwindcss');
    styleEl.textContent = '@import "tailwindcss";\n@custom-variant dark (&:where(.dark, .dark *));';
    document.head.appendChild(styleEl);
  }

  await new Promise((resolve) => {
    const twScript = document.createElement('script');
    twScript.src = 'https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4';
    twScript.onload = () => resolve();
    twScript.onerror = () => resolve();
    document.head.appendChild(twScript);
  });
}

async function bootAppverse() {
  const statusEl = document.getElementById('appverse-boot-msg');
  if (statusEl) {
    statusEl.textContent = 'Starting APPVERSE marketplace...';
  }

  const externalCache = new Map();
  const externalEntries = Object.entries(EXTERNAL_URLS);

  const [, loadedExternals] = await Promise.all([
    setupTailwindStyles(),
    Promise.all(
      externalEntries.map(async ([name, url]) => {
        const mod = await import(url);
        return [name, wrapEsmModule(mod)];
      })
    ),
  ]);

  for (const [name, wrapped] of loadedExternals) {
    externalCache.set('ext:' + name, wrapped);
  }

  const loadedLocal = new Map();
  const inFlight = new Map();
  const resolveMap = new Map();

  const entryKey = await resolveAndLoadLocal(
    'src/main.tsx',
    loadedLocal,
    inFlight,
    resolveMap,
    '<entry>'
  );

  const cjsCache = new Map();

  function runModule(modKey) {
    if (modKey.startsWith('ext:')) {
      const extMod = externalCache.get(modKey);
      if (!extMod) throw new Error(`Missing external module: ${modKey}`);
      return extMod;
    }

    if (cjsCache.has(modKey)) {
      return cjsCache.get(modKey).exports;
    }

    const entry = loadedLocal.get(modKey);
    if (!entry) {
      throw new Error(`Module not loaded: ${modKey}`);
    }

    if (entry.kind === 'css') {
      const m = { exports: {} };
      cjsCache.set(modKey, m);
      return m.exports;
    }

    if (entry.kind === 'asset') {
      const m = { exports: { __esModule: true, default: entry.url } };
      cjsCache.set(modKey, m);
      return m.exports;
    }

    if (entry.kind === 'json') {
      const m = { exports: Object.assign({ __esModule: true, default: entry.data }, entry.data) };
      cjsCache.set(modKey, m);
      return m.exports;
    }

    const moduleObj = { exports: {} };
    cjsCache.set(modKey, moduleObj);

    const localRequire = (spec) => {
      if (spec in EXTERNAL_URLS) {
        return runModule('ext:' + spec);
      }
      const mapped = resolveMap.get(modKey + '->' + spec);
      if (!mapped) {
        throw new Error(`Unresolved import "${spec}" from "${modKey}"`);
      }
      return runModule(mapped);
    };

    const importMeta = {
      env: { DEV: false, PROD: true, MODE: 'production' },
      url: new URL('./' + modKey, window.location.href).href,
    };

    const fn = new Function('require', 'module', 'exports', '__importMeta', entry.code);
    fn(localRequire, moduleObj, moduleObj.exports, importMeta);
    return moduleObj.exports;
  }

  runModule(entryKey);
}

bootAppverse().catch((err) => {
  console.error('APPVERSE static boot failed:', err);
  const msg = document.getElementById('appverse-boot-msg');
  if (msg) {
    msg.textContent =
      'Failed to start APPVERSE: ' +
      (err instanceof Error ? err.message : String(err)) +
      '. Please refresh the page.';
  }
});
