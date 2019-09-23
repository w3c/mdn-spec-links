#!/usr/bin/env node
/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */

'use strict';
const chalk = require('chalk');
const fs = require('fs');
const request = require('sync-request');

const { JSDOM } = require('jsdom');

let allURLs = [];
let bikeshedSpecs = [];
let respecSpecs = [];
let otherSpecs = [];
const allURLsFile = 'SPECURLS.json';
const bikeshedSpecsFile = 'BIKESHED_SPECS.txt';
const respecSpecsFile = 'RESPEC_SPECS.txt';
const otherSpecsFile = 'OTHER_SPECS.txt';

const sleep = (ms) => {
  const date = Date.now();
  let currentDate = null;
  do {
    currentDate = Date.now();
  } while (currentDate - date < (ms * 1000));
};

const stableSpecs = [
  'https://tools.ietf.org/html/rfc2046',
  'https://tools.ietf.org/html/rfc2324',
  'https://tools.ietf.org/html/rfc2616',
  'https://tools.ietf.org/html/rfc6265',
  'https://tools.ietf.org/html/rfc6454',
  'https://tools.ietf.org/html/rfc7168', // "I'm a teapot" RFC; ignore
  'https://tools.ietf.org/html/rfc7230',
  'https://tools.ietf.org/html/rfc7231',
  'https://tools.ietf.org/html/rfc7232',
  'https://tools.ietf.org/html/rfc7233',
  'https://tools.ietf.org/html/rfc7234',
  'https://tools.ietf.org/html/rfc7235',
  'https://tools.ietf.org/html/rfc7239',
  'https://tools.ietf.org/html/rfc7469',
  'https://tools.ietf.org/html/rfc7538',
  'https://tools.ietf.org/html/rfc8470',
  'https://www.khronos.org/registry/webgl/specs/latest/1.0/',
  'https://www.khronos.org/registry/webgl/specs/latest/2.0/',
  'https://www.w3.org/TR/CSS2/',
  'https://www.w3.org/TR/DOM-Level-3-XPath/',
  'https://www.w3.org/TR/MathML3/',
  'https://www.w3.org/TR/SVG11/',
  'https://www.w3.org/TR/WebCryptoAPI/',
  'https://www.w3.org/TR/tracking-dnt/',
  'https://www.w3.org/TR/xml/',
  'https://www.w3.org/TR/xpath-10/',
  'https://www.w3.org/TR/xpath-30/',
  'https://www.w3.org/TR/xpath-31/',
  'https://www.w3.org/TR/xpath20/',
  'https://www.w3.org/TR/xslt-10/',
  'https://www.w3.org/TR/xslt-30/',
  'https://www.w3.org/TR/xslt20/',
];

const respecRawSpecs = [
  "https://mathml-refresh.github.io/mathml-core/",
  "https://w3c.github.io/DOM-Parsing/",
  "https://w3c.github.io/battery/",
  "https://w3c.github.io/beacon/",
  "https://w3c.github.io/gamepad/",
  "https://w3c.github.io/gamepad/extensions.html",
  "https://w3c.github.io/geolocation-api/",
  "https://w3c.github.io/html-media-capture/",
  "https://w3c.github.io/input-events/",
  "https://w3c.github.io/manifest/",
  "https://w3c.github.io/mediacapture-fromelement/",
  "https://w3c.github.io/media-playback-quality/",
  "https://w3c.github.io/mediacapture-main/",
  "https://w3c.github.io/mediacapture-output/",
  "https://w3c.github.io/mediacapture-screen-share/",
  "https://w3c.github.io/navigation-timing/",
  "https://w3c.github.io/network-error-logging/",
  "https://w3c.github.io/payment-handler/",
  "https://w3c.github.io/payment-method-basic-card/",
  "https://w3c.github.io/payment-request/",
  "https://w3c.github.io/performance-timeline/",
  "https://w3c.github.io/pointerevents/",
  "https://w3c.github.io/pointerlock/",
  "https://w3c.github.io/preload/",
  "https://w3c.github.io/presentation-api/",
  "https://w3c.github.io/push-api/",
  "https://w3c.github.io/resource-timing/",
  "https://w3c.github.io/screen-orientation/",
  "https://w3c.github.io/selection-api/",
  "https://w3c.github.io/server-timing/",
  "https://w3c.github.io/speech-api/",
  "https://w3c.github.io/touch-events/",
  "https://w3c.github.io/user-timing/",
  "https://w3c.github.io/web-nfc/",
  "https://w3c.github.io/web-share/",
  "https://w3c.github.io/web-share/level-2/",
  "https://w3c.github.io/webdriver/",
  "https://w3c.github.io/webrtc-extensions/",
  "https://w3c.github.io/webrtc-identity/",
  "https://w3c.github.io/webrtc-pc/",
  "https://w3c.github.io/webrtc-stats/",
  "https://webaudio.github.io/web-midi-api/",
  "https://wicg.github.io/frame-timing/",
  "https://wicg.github.io/InputDeviceCapabilities/",
  "https://wicg.github.io/visual-viewport/",
  "https://wicg.github.io/netinfo/",
  "https://wicg.github.io/savedata/",
];

const note = msg => console.log(chalk`{cyanBright     ${msg}}`);
const error = msg => console.error(chalk`{redBright     ${msg}}`);
const warn = msg => console.warn(chalk`{yellowBright     ${msg}}`);
const success = msg => console.log(chalk`{greenBright     ${msg}}`);

chalk.level = 3;

const specMap = fs.readFileSync('SPECMAP.json', 'utf-8').trim();

const getRemoteContents = (specURL, requestURL, seconds) => {
  if (seconds) { sleep(seconds); }
  seconds = 10;
  const options = {
    headers: { 'User-Agent': 'mdn-spec-links-script' },
    gzip: false,  // prevent Z_BUF_ERROR 'unexpected end of file'
    followRedirects: true,  // default
    retry: true,
    retryDelay: 1000 * seconds,
  };
  try {
    const response = request('GET', requestURL, options);
    const statusCode = response.statusCode;
    if (statusCode === 404) {
      error(`404 ${specURL}`);
      return null;
    } else if (statusCode >= 300) {
      error(`${statusCode} ${specURL}` +
        ` (unexpected status code)`);
      return null;
    }
    return response.getBody('utf8');
  } catch(e) {
    error(`error for ${specURL} ${e.message}.`);
    console.log(e);
  }
};

const processSpecURL = (specURL, specJSONfile, seconds) => {
  if (specURL.startsWith("https://www.w3.org/TR/geolocation-API/")) {
    specURL = "https://w3c.github.io/geolocation-api/";
  }
  let requestURL = specURL;
  if (requestURL.startsWith('https://wicg.github.io/web-share/')) {
    requestURL = requestURL.replace('wicg', 'w3c');
  }
  if (requestURL.startsWith('https://w3c.github.io/netinfo/')) {
    requestURL = requestURL.replace('w3c', 'wicg');
  }
  if (requestURL.startsWith('https://wicg.github.io/mediasession/')) {
    requestURL = requestURL.replace('wicg', 'w3c');
  }
  if (requestURL.startsWith('https://wicg.github.io/media-playback-quality/')) {
    requestURL = requestURL.replace('wicg', 'w3c');
  }
  if (requestURL.startsWith('https://wicg.github.io/media-capabilities/')) {
    requestURL = requestURL.replace('wicg', 'w3c');
  }
  if (requestURL.startsWith('https://w3c.github.io/keyboard-lock/')) {
    requestURL = requestURL.replace('w3c', 'wicg');
  }
  if (respecRawSpecs.includes(requestURL)) {
    requestURL =
      "https://labs.w3.org/spec-generator/?type=respec&url=" + requestURL;
  }
  const contents = getRemoteContents(specURL, requestURL, seconds);
  if (contents.match(/respec-w3c-/)) {
    warn(`${specURL} loads respec`);
  }
  var dom = new JSDOM(contents);
  var document = dom.window.document;
  let count = 0;
  let fixableCount = 0;

  if (document.querySelector('script[src*="respec"]') ||
      document.querySelector('meta[content*="ReSpec"]')) {
    if (!respecSpecs.includes(specJSONfile)) {
      respecSpecs.push(specJSONfile);
    }
  } else if (document.querySelector('body.h-entry') ||
      document.querySelector('meta[content*="Bikeshed"]')) {
    if (!bikeshedSpecs.includes(specJSONfile)) {
      bikeshedSpecs.push(specJSONfile);
    }
  } else if (specJSONfile !== null) {
    if (!otherSpecs.includes(specJSONfile)) {
      otherSpecs.push(specJSONfile);
    }
  }

  const allIdElements =
    [...document.querySelectorAll('*[id]')];
  const allNameElements =
    [...document.querySelectorAll('*:not(meta)[name]')];

  if (requestURL
      .startsWith('https://labs.w3.org/spec-generator/')) {
    requestURL = requestURL.substring(52);
  }

  for (let i = 0; i < allIdElements.length; i++) {
    const id = allIdElements[i].getAttribute('id');
    if (id.startsWith('ref-for') ||
      id.startsWith('_ref_') ||
      id.startsWith('term-for') ||
      id.startsWith('biblio-') ||
      id.startsWith('bib-') ||
      id.match(/idl-[0-9]+$/) !== null
    ) {
      continue;
    }
    if (requestURL.startsWith('https://github.com')) {
      requestURL = requestURL.replace('user-content-','');
    }
    allURLs.push(requestURL+ '#' + id);
    note(requestURL+ '#' + id);
  }

  if (requestURL.startsWith('https://tc39.es/')) {
    return;
  }

  for (let i = 0; i < allNameElements.length; i++) {
    const name = allNameElements[i].getAttribute('name');
    allURLs.push(requestURL + '#' + name);
    note(requestURL + '#' + name);
  }
};

const processSVG2files = baseURL => {
  [
    'access.html',
    'animate.html',
    'attindex.html',
    'backward.html',
    'changes.html',
    'color.html',
    'concepts.html',
    'conform.html',
    'coords.html',
    'eltindex.html',
    'embedded.html',
    'escript.html',
    'extend.html',
    'feature.html',
    'filters.html',
    'fonts.html',
    'geometry.html',
    'i18n.html',
    'idl.html',
    'idlindex.html',
    'implnote.html',
    'interact.html',
    'intro.html',
    'java.html',
    'linking.html',
    'masking.html',
    'metadata.html',
    'mimereg.html',
    'minimize.html',
    'painting.html',
    'paths.html',
    'propidx.html',
    'pservers.html',
    'refs.html',
    'render.html',
    'script.html',
    'shapes.html',
    'single-page.html',
    'struct.html',
    'styling.html',
    'svgdom.html',
    'svgdtd.html',
    'text.html',
    'types.html',
  ].forEach(filename => processSpecURL(baseURL + filename, null, 0));
};

const processSpecMap = (key, data) => {
  if (data && data.length > 0) {
    console.log(data);
    let specURL = key;
    let specJSONfile = data;
    if (stableSpecs.includes(specURL)) {
      otherSpecs.push(specJSONfile);
      return data;
    }
    if ('html.json' === data) {
      processSpecURL('https://html.spec.whatwg.org/', 'html.json', 0);
      return data;
    }
    if (specURL === 'https://svgwg.org/svg2-draft/') {
      otherSpecs.push('svg-2.json');
      processSVG2files(specURL);
      return data;
    }
    processSpecURL(specURL, specJSONfile, 0);
  }
  return data;
};

JSON.parse(specMap, processSpecMap);
const staticSpecURLs =
  JSON.parse(fs.readFileSync('.specurls.json', 'utf-8').trim());
allURLs = allURLs.concat(staticSpecURLs);
allURLs = [...new Set(allURLs)];
allURLs.sort();
fs.writeFileSync(allURLsFile,
  JSON.stringify(allURLs, null, 4) + '\n', 'utf-8');
bikeshedSpecs.sort();
fs.writeFileSync(bikeshedSpecsFile, bikeshedSpecs.join('\n'), 'utf-8');
respecSpecs.sort();
fs.writeFileSync(respecSpecsFile, respecSpecs.join('\n'), 'utf-8');
otherSpecs.sort();
fs.writeFileSync(otherSpecsFile, otherSpecs.join('\n'), 'utf-8');
module.exports = { processSpecURL };
