#!/usr/bin/env node
/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */

'use strict';
const UTILS = require('./browser-compat-data/scripts/utils.js');
const chalk = require('chalk');
const fs = require('fs');
const request = require('sync-request');
const PATH = require('path');
const URL = require('url');

const { JSDOM } = require('jsdom');
const { platform } = require('os');

const IS_WINDOWS = platform() === 'win32';

const dom = new JSDOM();

const log = msg => console.log(`${msg}`);
const note = msg => console.log(chalk`{cyanBright     ${msg}}`);
const warn = msg => console.warn(chalk`{yellowBright     ${msg}}`);
const error = msg => console.error(chalk`{redBright     ${msg}}`);
const success = msg => console.log(chalk`{greenBright     ${msg}}`);

log('loading SPECMAP.json...');
const SPECMAP = JSON.parse(fs.readFileSync('SPECMAP.json', 'utf-8'));
log('loading SPECURLS.json...');
const SPECURLS = JSON.parse(fs.readFileSync('SPECURLS.json', 'utf-8'));
const options = {
  headers: { 'User-Agent': 'bcd-migration-script' },
  gzip: true,
};
const response = request(
  'GET',
  'https://raw.githubusercontent.com/Fyrd/caniuse/master/data.json',
  options,
);
let specs = Object.create(null);

let bcdJSONfilename = '';
let targetJSONfile = '';

const sleep = ms => {
  const date = Date.now();
  let currentDate = null;
  do {
    currentDate = Date.now();
  } while (currentDate - date < ms * 1000);
};

chalk.level = 3;

const CANIUSE_SPECMAP  = {};

const fixCanIUseSpecURLs = (key, data) => {
  if (data && data instanceof Object && 'spec' in data) {
    let specURL = UTILS.getAdjustedSpecURL(data.spec);
    specURL = specURL
      .replace('#widl-Element-insertAdjacentHTML-void-DOMString-position-DOMString-text', '#dom-element-insertadjacenthtml')
      .replace('#image-orientation', '#the-image-orientation')
      .replace('css-color-4/#color-adjust', 'css-color-adjust-1/#propdef-color-adjust')
      .replace('css-fonts-3/#propdef-font-variant-alternates', 'css-fonts-4/#propdef-font-variant-alternates')
      .replace('css-images-3/#cross-fade-function', 'css-images-4/#cross-fade-function')
      .replace('css-lists-3/#marker-pseudo-element', 'css-pseudo-4/#marker-pseudo')
      .replace('proposal-flatMap/#sec-Array.prototype.flat', 'ecma262/#sec-array.prototype.flat')
      .replace('#sec-Date.prototype.toLocaleDateString', '#sup-date.prototype.tolocaledatestring')
      .replace('#RandomSource-method-getRandomValues', '#Crypto-method-getRandomValues')
      .replace('#widl-KeyboardEvent-charCode', '#dom-keyboardevent-charcode')
      .replace('#widl-KeyboardEvent-code', '#dom-keyboardevent-code')
      .replace('#widl-KeyboardEvent-getModifierState', '#dom-keyboardevent-getmodifierstate')
      .replace('#widl-KeyboardEvent-location', '#dom-keyboardevent-location')
      .replace('#widl-KeyboardEvent-which', '#dom-uievent-which')
      .replace('#unhandled-promise-rejections:event-unhandledrejection', '#unhandled-promise-rejections')
    ;
    specURL = specURL
      .replace('ecma262/#sec-14.1', 'ecma262/#sec-directive-prologues-and-the-use-strict-directive')
      .replace('ecma262/#sec-15.12', 'ecma262/#sec-json-object')
      .replace('ecma262/#sec-15.12', 'ecma262/#sec-json-object')
      .replace('ecma402/#sec-13.1.1', 'ecma402/#sup-String.prototype.localeCompare')
    ;
    if (specURL.endsWith('ecma262/#')) {
      specURL = 'https://tc39.es/ecma262/#sec-generator-function-definitions';
    }
    const parsedURL = URL.parse(specURL);
    if (!parsedURL.hash) {
      return data;
    }
    if (specURL.startsWith('https://html.spec.whatwg.org/multipage/')) {
      specURL = 'https://html.spec.whatwg.org/' + parsedURL.hash;
    }
    if (specURL.startsWith('https://html.spec.whatwg.org/dev/')) {
      specURL = 'https://html.spec.whatwg.org/' + parsedURL.hash;
    }
    const base = parsedURL.host + parsedURL.path;
    if (UTILS.isObsolete(base)) {
      return data;
    }
    if (UTILS.isBrokenSpecURL(specURL, parsedURL, SPECURLS)) {
      error(`caniuse has bad spec URL ${specURL} Bad fragment?`);
      return data;
    }
    note('caniuse spec URL: ' + specURL);
    CANIUSE_SPECMAP[specURL] = {};
    CANIUSE_SPECMAP[specURL].feature = key;
    CANIUSE_SPECMAP[specURL].title = data.title;
  } else {
    return data;
  }
};

log('loading caniuse data...');
const CANIUSE = JSON.parse(response.getBody('utf8'), fixCanIUseSpecURLs);

const getAdjustedData = (locationkey, url, path, baseurl, host, fragment) => {
  if (host.includes('spec.whatwg.org')) {
    path = host.split('.')[0];
    locationkey = fragment;
    if (url.startsWith('https://html.spec.whatwg.org/multipage/')) {
      baseurl = 'https://html.spec.whatwg.org/multipage/';
    }
  } else if (url.includes('/gamepad/extensions.html')) {
    path = 'gamepad-extensions';
    locationkey = fragment;
    baseurl = 'https://w3c.github.io/gamepad/extensions.html';
  } else if (url.includes('/WebAssembly/design/blob/master/Web.md')) {
    path = 'wasm-web-embedding';
    locationkey = fragment;
    baseurl = 'https://webassembly.org/docs/web/';
  } else if (url.startsWith('https://tools.ietf.org/html/')) {
    const name = locationkey.split('#')[0];
    path = name;
    locationkey = fragment;
    baseurl = 'https://tools.ietf.org/html/' + name;
  }
  return [locationkey, path, baseurl];
};

const getSpecShortnameAndLocationKey = (url, feature, mdnURL) => {
  if (url.includes('##')) {
    url = url.replace('##', '#');
  }
  let locationkey = '';
  let baseurl = '';
  let path = URL.parse(url).path;
  const host = URL.parse(url).host;
  const fragment = URL.parse(url).hash.slice(1);
  const filename = path.split('/').slice(-1)[0];
  if (filename !== '') {
    locationkey = filename + '#' + fragment;
    baseurl = PATH.dirname(url.split('#')[0]);
  } else {
    locationkey = fragment;
    baseurl = url.split('#')[0];
  }
  if (baseurl.slice(-2) === '//') {
    error(`${feature}: ${mdnURL} has bad spec URL ${url}`);
    baseurl = baseurl.slice(0, -1);
  }
  baseurl = baseurl.slice(-1) !== '/' ? baseurl + '/' : baseurl;
  [locationkey, path, baseurl] = getAdjustedData(
    locationkey,
    url,
    path,
    baseurl,
    host,
    fragment
  );
  let shortname = PATH.basename(path).toLowerCase();
  if (filename !== '') {
    /* Get the second-to-last component of the path (the name of the parent
     * directory of the file). */
    shortname = path
      .split('/')
      .slice(-2)
      .reverse()
      .pop()
      .toLowerCase();
  }
  if (baseurl in SPECMAP) {
    shortname = SPECMAP[baseurl].slice(0, -5);
  } else {
    SPECMAP[baseurl] = shortname + '.json';
  }
  if (!(shortname in specs)) {
    specs[shortname] = Object.create(null);
  }
  return [shortname, baseurl, locationkey];
};

const getMdnSlug = (mdnURL, feature) => {
  if (mdnURL.startsWith('https://developer.mozilla.org/en-US/docs/Web/')) {
    mdnURL = mdnURL.substring(45);
  } else if (mdnURL.startsWith('https://developer.mozilla.org/en-US/docs/Learn/')) {
    mdnURL = mdnURL.substring(47);
  } else {
    error(`${feature}: Odd MDN URL: ${mdnURL}`);
  }
  return mdnURL;
};

const getMdnJsonURL = (mdnURL, feature, seconds) => {
  const options = {
    headers: { 'User-Agent': 'mdn-spec-links-script' },
    gzip: false, // prevent Z_BUF_ERROR 'unexpected end of file'
    followRedirects: false,
    retry: true,
    retryDelay: 1000 * seconds
  };
  mdnURL = mdnURL.split('#')[0];
  try {
    log(`    ${feature}: getting MDN data from ${mdnURL}`);
    let response = request('HEAD', mdnURL, options);
    if (response.headers.location) {
      while (response.headers.location) {
        mdnURL = 'https://developer.mozilla.org' + response.headers.location;
        log(`    ${feature}: getting MDN data from ${mdnURL}`);
        response = request('HEAD', mdnURL, options);
      }
    }
    return mdnURL + '$json';
  } catch (e) {
    error(`${feature}: error for ${mdnURL} ${e.message}.`);
    log(e);
  }
  return null;
};

const stripTags = input => {
  const window = dom.window;
  const html = new window.DOMParser().parseFromString(input, 'text/html');
  window.close();
  return html.body.textContent || '';
};

const fixEdgeBlinkVersion = versionAdded => {
  if (typeof versionAdded === 'string') {
    if (parseFloat(versionAdded) <= 79) {
      versionAdded = '79';
    }
  }
  return versionAdded;
};

const fixEdgeLegacyVersion = versionAdded => {
  if (typeof versionAdded === 'string') {
    if (parseFloat(versionAdded) >= 79) {
      versionAdded = false;
    }
  }
  return versionAdded;
};

const getDataForEngine = engineSupport => {
  const engineData =
  {
    'hasSupport': false,
    'needsflag': false,
    'partial': false,
    'prefixed': false,
    'altname': false,
  };
  if (engineSupport instanceof Array) {
    for (var versionDetails of engineSupport) {
      if ('version_removed' in versionDetails) {
        continue;
      }
      if ('version_added' in versionDetails) {
        if (versionDetails.version_added === false) {
          continue;
        }
        if (versionDetails.version_added === null) {
          continue;
        }
        if ('alternative_name' in versionDetails &&
            engineData.hasSupport !== true) {
          engineData.altname = true;
          continue;
        }
        if ('prefix' in versionDetails &&
            engineData.hasSupport !== true) {
          engineData.prefixed = true;
          continue;
        }
        if ('partial_implementation' in versionDetails &&
            engineData.hasSupport !== true) {
          engineData.partial = true;
          continue;
        }
        if ('flags' in versionDetails) {
          engineData.hasSupport = true;
          engineData.needsflag = true;
          engineData.altname = false;
          engineData.prefixed = false;
          engineData.partial = false;
          continue;
        }
        engineData.altname = false;
        engineData.prefixed = false;
        engineData.partial = false;
        engineData.needsflag = false;
        engineData.hasSupport = true;
        return engineData;
      }
    }
    return engineData;
  } else if ('version_removed' in engineSupport) {
    return engineData;
  } else if ('version_added' in engineSupport) {
    if (engineSupport.version_added === false) {
      return engineData;
    }
    if (engineSupport.version_added === null) {
      return engineData;
    }
    if ('alternative_name' in engineSupport) {
      engineData.altname = true;
      return engineData;
    }
    if ('prefix' in engineSupport) {
      engineData.prefixed = true;
      return engineData;
    }
    if ('partial_implementation' in engineSupport) {
      engineData.partial = true;
      return engineData;
    }
    if ('flags' in engineSupport) {
      engineData.needsflag = true;
    }
    engineData.hasSupport = true;
    return engineData;
  }
  return engineData;
};

const getSupportData = support => {
  const supportData =
    {
      'engines': [],
      'needsflag': [],
      'partial': [],
      'prefixed': [],
      'altname': [],
    };
  if (!support) {
    return supportData;
  }
  const updateSupportData = (engineData, engineName) => {
    if (engineData.hasSupport &&
      !supportData.engines.includes(engineName)) {
      supportData.engines.push(engineName);
    }
    if (engineData.partial &&
      !supportData.partial.includes(engineName)) {
      supportData.partial.push(engineName);
    }
    if (engineData.prefixed &&
      !supportData.prefixed.includes(engineName)) {
      supportData.prefixed.push(engineName);
    }
    if (engineData.altname &&
      !supportData.altname.includes(engineName)) {
      supportData.altname.push(engineName);
    }
    if (engineData.needsflag &&
      !supportData.needsflag.includes(engineName)) {
      supportData.needsflag.push(engineName);
    }
  };
  if ('chrome' in support) {
    updateSupportData(getDataForEngine(support.chrome), 'blink');
  }
  if ('chrome_android' in support) {
    updateSupportData(getDataForEngine(support.chrome_android), 'blink');
  }
  if ('firefox' in support) {
    updateSupportData(getDataForEngine(support.firefox), 'gecko');
  }
  if ('firefox_android' in support) {
    updateSupportData(getDataForEngine(support.firefox_android), 'gecko');
  }
  if ('safari' in support) {
    updateSupportData(getDataForEngine(support.safari), 'webkit');
  }
  if ('safari_ios' in support) {
    updateSupportData(getDataForEngine(support.safari_ios), 'webkit');
  }
  return supportData;
};

const adjustSupport = support => {
  for (var browser in support) {
    if ('chrome' == browser) {
      const chromeSupport = support.chrome;
      support.edge_blink = JSON.parse(JSON.stringify(chromeSupport));
      if (chromeSupport instanceof Array) {
        for (var i = 0; i < chromeSupport.length; i++) {
          if (!('version_removed' in chromeSupport[i])) {
            support.edge_blink[i].version_added = fixEdgeBlinkVersion(
              chromeSupport[i].version_added
            );
          } else {
            support.edge_blink[i].version_added = false;
          }
        }
      } else {
        if (!('version_removed' in chromeSupport)) {
          support.edge_blink.version_added = fixEdgeBlinkVersion(
            chromeSupport.version_added
          );
        } else {
          support.edge_blink.version_added = false;
        }
      }
      continue;
    }
    if ('edge' == browser) {
      const edgeLegacySupport = support.edge;
      support.edge = Object.create(null);
      if (edgeLegacySupport instanceof Array) {
        if (!('version_removed' in edgeLegacySupport[0])) {
          support.edge.version_added = fixEdgeLegacyVersion(
            edgeLegacySupport[0].version_added
          );
        } else {
          support.edge.version_added = false;
        }
      } else {
        if (!('version_removed' in edgeLegacySupport)) {
          support.edge.version_added = fixEdgeLegacyVersion(
            edgeLegacySupport.version_added
          );
        } else {
          support.edge.version_added = false;
        }
      }
      continue;
    }
  }
  return support;
};

const addSpecLink = (
  feature,
  filename,
  shortname,
  baseurl,
  locationkey,
  slug,
  title,
  summary,
  support,
  caniuse
) => {
  let featureDetails = Object.create(null);
  const supportData = getSupportData(support);
  if (supportData) {
    if (supportData.engines.length > 1) {
      note(
        `${feature}: ${locationkey} ${title} ${baseurl}#${locationkey}` +
        ` in two or more engines.`
      );
    }
    featureDetails.engines = supportData.engines;
    if (supportData.partial.length > 0) {
      featureDetails.partial = supportData.partial;
    }
    if (supportData.needsflag.length > 0) {
      featureDetails.needsflag = supportData.needsflag;
    }
    if (supportData.prefixed.length > 0) {
      featureDetails.prefixed = supportData.prefixed;
    }
    if (supportData.altname.length > 0) {
      featureDetails.altname = supportData.altname;
    }
  }
  featureDetails.filename = null;
  if (filename && !filename.includes('.local')) {
    featureDetails.filename = filename;
  }
  featureDetails.name = feature;
  featureDetails.slug = slug;
  featureDetails.summary = summary;
  featureDetails.support = adjustSupport(support);
  if (caniuse) {
    note(
      `${feature}: ${locationkey} added` +
      ` https://www.caniuse.com/#feat=${caniuse.feature} link for` +
      ` ${caniuse.title}.`
    );
    featureDetails.caniuse = caniuse;
  }
  featureDetails.title = title;
  if (!(locationkey in specs[shortname])) {
    specs[shortname][locationkey] = [];
  }
  specs[shortname][locationkey].push(featureDetails);
  success(
    `${feature}: ${locationkey} added to ${shortname}.json (${baseurl}).`
  );
};

const isBrokenURL = url => {
  const parsedURL = URL.parse(url);
  return (
    !parsedURL.host ||
    !url.includes('#') ||
    parsedURL.path.includes('http://') ||
    parsedURL.hash.includes('http://')
  );
};

const isForTargetJSONfile = (specURL, feature, mdnURL)  => {
  var shortname, baseurl, locationkey;
  [shortname, baseurl, locationkey] = getSpecShortnameAndLocationKey(
    specURL,
    feature,
    mdnURL
  );
  if (baseurl.startsWith('https://html.spec.whatwg.org/')) {
    baseurl = 'https://html.spec.whatwg.org/multipage/';
  }
  if (SPECMAP[baseurl] === targetJSONfile) {
    return true;
  }
  return false;
};

const processSpecURL = (url, feature, bcdData, mdnURL, mdnData) => {
  const parsedURL = URL.parse(url);
  if (url.startsWith('https://tools.ietf.org/html/rfc7168')) {
    // 'I'm a teapot' RFC; ignore
    return;
  }
  if (isBrokenURL(url)) {
    error('broken');
    return;
  }
  let caniuse = 'caniuse' in bcdData ? bcdData.caniuse : null;
  let adjustedURL = url;
  if (url.startsWith('https://html.spec.whatwg.org/multipage/')) {
    adjustedURL = 'https://html.spec.whatwg.org/' + parsedURL.hash;
  }
  if (!caniuse && adjustedURL in CANIUSE_SPECMAP) {
    caniuse = {};
    caniuse.feature = CANIUSE_SPECMAP[adjustedURL].feature;
    caniuse.title = CANIUSE_SPECMAP[adjustedURL].title;
  }
  const slug = getMdnSlug(mdnURL, feature);
  const title = mdnData.title;
  const summary = stripTags(mdnData.summary).replace(/\u00A0/g, ' ');
  let filename = bcdJSONfilename.split('browser-compat-data/').pop();
  let support = 'support' in bcdData ? bcdData.support : null;
  if (!support) {
    feature = mdnURL.split('/').pop();
    filename = null;
  }
  if ('support_from' in bcdData) {
    /* format:
     *   "support_from":
     *     ["html/elements/img.json", "html.elements.img.crossorigin"] */
    const data = JSON.parse(
      fs
        .readFileSync('browser-compat-data/' + bcdData.support_from[0], 'utf-8')
        .replace('≤','')
        .trim()
    );
    support = `${bcdData.support_from[1]}.__compat.support`
      .split('.')
      .reduce((o, i) => o[i], data);
  }
  var shortname, baseurl, locationkey;
  [shortname, baseurl, locationkey] = getSpecShortnameAndLocationKey(
    url,
    feature,
    mdnURL
  );
  addSpecLink(
    feature,
    filename,
    shortname,
    baseurl,
    locationkey,
    slug,
    title,
    summary,
    support,
    caniuse
  );
  return;
};

const processMdnURL = (mdnURL, feature, seconds) => {
  if (seconds) {
    sleep(seconds);
  }
  seconds = 20;
  const mdnURLjson = getMdnJsonURL(mdnURL, feature, seconds);
  if (mdnURLjson === null) {
    return null;
  }
  const options = {
    headers: { 'User-Agent': 'mdn-spec-links-script' },
    gzip: false, // prevent Z_BUF_ERROR 'unexpected end of file'
    followRedirects: true, // default
    retry: true,
    retryDelay: 1000 * seconds
  };
  try {
    const response = request('GET', mdnURLjson, options);
    const statusCode = response.statusCode;
    if (statusCode === 404) {
      error(`${feature}: 404 ${mdnURL}`);
      return null;
    } else if (statusCode >= 300) {
      error(
        `${feature}: ${statusCode} ${mdnURLjson}` + ` (unexpected status code)`
      );
      return null;
    }
    return JSON.parse(response.getBody('utf8'));
  } catch (e) {
    error(`${feature}: error for ${mdnURL} ${e.message}.`);
    log(e);
  }
  return null;
};

const processBCD = (key, data) => {
  if (key === 'version_added') {
    if (typeof data === 'string' && data.startsWith('≤')) {
      data = data.substring(1);
    }
  }
  if (data && data instanceof Object && '__compat' in data) {
    const feature = key;
    const bcdData = data.__compat;
    note(`${feature}: getting BCD data`);
    if (!('spec_url' in bcdData)) {
      warn(`${feature}: no spec_url`);
      return data;
    }
    if ('status' in bcdData && bcdData.status.deprecated) {
      warn(`${feature}: deprecated`);
      return data;
    }
    if (!('mdn_url' in bcdData)) {
      warn(`${feature}: no mdn_url`);
      return data;
    }
    let mdnURL = 'https://developer.mozilla.org/en-US' +
      URL.parse(bcdData.mdn_url).path;
    const specURLs = bcdData.spec_url;
    if (targetJSONfile !== '') {
      if (specURLs instanceof Array) {
        let hasAnchorForTargetJSONfile = false;
        for (var i = 0; i < specURLs.length; i++) {
          if (isForTargetJSONfile(specURLs[i], feature, mdnURL)) {
            hasAnchorForTargetJSONfile = true;
          }
        }
        if (!hasAnchorForTargetJSONfile) {
          return data;
        }
      } else if (typeof specURLs === 'string') {
        if (!isForTargetJSONfile(specURLs, feature, mdnURL)) {
          warn(`${feature} not in ${targetJSONfile}`);
          return data;
        }
      }
    }
    if (URL.parse(bcdData.mdn_url).hash) {
      mdnURL += URL.parse(bcdData.mdn_url).hash;
    }
    const mdnData = processMdnURL(mdnURL, feature);
    if (mdnData === null) {
      return data;
    }
    if (specURLs instanceof Array) {
      specURLs.forEach(specURL => {
        processSpecURL(specURL, feature, bcdData, mdnURL, mdnData);
      });
      return data;
    }
    if (typeof specURLs === 'string') {
      processSpecURL(specURLs, feature, bcdData, mdnURL, mdnData);
      return data;
    }
  }
  return data;
};

/**
 * @param {Promise<void>} filename
 */
const processFile = filename => {
  log(`Processing ${filename}`);
  let bcdFile = fs.readFileSync(filename, 'utf-8').trim();
  bcdJSONfilename = filename;
  JSON.parse(bcdFile, processBCD);
};

if (require.main === module) {
  /**
   * @param {string[]} files
   */
  const load = (dir, ...files) => {
    for (let file of files) {
      if (file.indexOf(__dirname) !== 0) {
        file = PATH.resolve(__dirname, dir, file);
      }

      if (!fs.existsSync(file)) {
        continue; // Ignore non-existent files
      }

      if (fs.statSync(file).isFile()) {
        if (PATH.extname(file) === '.json') {
          processFile(file);
        }

        continue;
      }

      load(dir, ...subFiles(file));
    }
  };
  const subFiles = file =>
    fs.readdirSync(file).map(subfile => {
      return PATH.join(file, subfile);
    });
  if (process.argv[2] && process.argv[2].includes(".json")) {
    targetJSONfile = process.argv[2];
  } else if (process.argv[3] && process.argv[3].includes(".json")) {
    targetJSONfile = process.argv[3];
  }
  if (process.argv[2] && process.argv[2] &&
      !(process.argv[2].includes('.json'))) {
    load('browser-compat-data', process.argv[2]);
  } else {
    load(
      'browser-compat-data',
      'api',
      'css',
      'html',
      'http',
      'javascript',
      'mathml',
      'svg',
      'webdriver',
      'xpath',
      'xslt'
    );
  }
  load('.local', '.');
  fs.writeFileSync(
    'SPECMAP.json',
    JSON.stringify(SPECMAP, null, 4) + '\n',
    'utf-8'
  );
  for (var shortname in specs) {
    const filename = shortname + '.json';
    if ('' != targetJSONfile && filename !== targetJSONfile) {
      continue;
    }
    fs.writeFileSync(
      filename,
      JSON.stringify(specs[shortname], null, 4) + '\n',
      'utf-8'
    );
  }
}

module.exports = { processBCD, processFile };
