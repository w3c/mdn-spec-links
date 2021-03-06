#!/usr/bin/env node
/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */

'use strict';

const chalk = require('chalk');
const fs = require('fs');
const request = require('sync-request');

const util = require('util');
const { JSDOM } = require('jsdom');
const waitImmediate = util.promisify(setImmediate);

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
  'https://www.rfc-editor.org/rfc/rfc2397',
  'https://www.rfc-editor.org/rfc/rfc6454',
  'https://www.rfc-editor.org/rfc/rfc6797',
  'https://www.rfc-editor.org/rfc/rfc7034',
  'https://www.rfc-editor.org/rfc/rfc7239',
  'https://www.rfc-editor.org/rfc/rfc7578',
  'https://www.rfc-editor.org/rfc/rfc8942',
  "https://httpwg.org/specs/rfc6265.html",
  "https://httpwg.org/specs/rfc6266.html",
  "https://httpwg.org/specs/rfc7230.html",
  "https://httpwg.org/specs/rfc7231.html",
  "https://httpwg.org/specs/rfc7232.html",
  "https://httpwg.org/specs/rfc7233.html",
  "https://httpwg.org/specs/rfc7234.html",
  "https://httpwg.org/specs/rfc7235.html",
  "https://httpwg.org/specs/rfc7538.html",
  "https://httpwg.org/specs/rfc7540.html",
  "https://httpwg.org/specs/rfc7725.html",
  "https://httpwg.org/specs/rfc7838.html",
  "https://httpwg.org/specs/rfc8246.html",
  "https://httpwg.org/specs/rfc8470.html",
  'https://www.khronos.org/registry/webgl/specs/latest/1.0/',
  'https://www.khronos.org/registry/webgl/specs/latest/2.0/',
];

const respecRawSpecs = [
  "https://w3c.github.io/badging/",
  "https://w3c.github.io/battery/",
  "https://w3c.github.io/beacon/",
  "https://w3c.github.io/gamepad/",
  "https://w3c.github.io/gamepad/extensions.html",
  "https://w3c.github.io/geolocation-api/",
  "https://w3c.github.io/hr-time/",
  "https://w3c.github.io/html-media-capture/",
  "https://w3c.github.io/input-events/",
  "https://w3c.github.io/manifest/",
  "https://w3c.github.io/manifest-app-info/",
  "https://w3c.github.io/mathml-core/",
  "https://w3c.github.io/mediacapture-fromelement/",
  "https://w3c.github.io/media-playback-quality/",
  "https://w3c.github.io/mediacapture-main/",
  "https://w3c.github.io/mediacapture-output/",
  "https://w3c.github.io/mediacapture-screen-share/",
  "https://w3c.github.io/navigation-timing/",
  "https://w3c.github.io/network-error-logging/",
  "https://w3c.github.io/page-visibility/",
  "https://w3c.github.io/payment-handler/",
  "https://w3c.github.io/payment-method-basic-card/",
  "https://w3c.github.io/payment-request/",
  "https://w3c.github.io/performance-timeline/",
  "https://w3c.github.io/pointerevents/",
  "https://w3c.github.io/pointerlock/",
  "https://w3c.github.io/preload/",
  "https://w3c.github.io/presentation-api/",
  "https://w3c.github.io/push-api/",
  "https://w3c.github.io/remote-playback/",
  "https://w3c.github.io/requestidlecallback/",
  "https://w3c.github.io/resource-timing/",
  "https://w3c.github.io/screen-orientation/",
  "https://w3c.github.io/screen-wake-lock/",
  "https://w3c.github.io/selection-api/",
  "https://w3c.github.io/server-timing/",
  "https://w3c.github.io/speech-api/",
  "https://w3c.github.io/touch-events/",
  "https://w3c.github.io/user-timing/",
  "https://w3c.github.io/vibration/",
  "https://w3c.github.io/web-nfc/",
  "https://w3c.github.io/web-share/",
  "https://w3c.github.io/webrtc-extensions/",
  "https://w3c.github.io/webrtc-identity/",
  "https://w3c.github.io/webrtc-pc/",
  "https://w3c.github.io/webrtc-stats/",
  "https://webaudio.github.io/web-midi-api/",
  "https://wicg.github.io/frame-timing/",
  "https://wicg.github.io/input-device-capabilities/",
  "https://wicg.github.io/visual-viewport/",
  "https://wicg.github.io/netinfo/",
  "https://wicg.github.io/savedata/",
];

const note = msg => console.log(chalk`{cyanBright     ${msg}}`);
const error = msg => console.error(chalk`{redBright     ${msg}}`);
const warn = msg => console.warn(chalk`{yellowBright     ${msg}}`);

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

const processSpecURL = async (specURL, specJSONfile, seconds) => {
  let requestURL = specURL;
  if (respecRawSpecs.includes(requestURL)) {
    requestURL =
      "https://labs.w3.org/spec-generator/?type=respec&url=" + requestURL;
  }
  const contents = getRemoteContents(specURL, requestURL, seconds);
  if (contents.match(/respec-w3c-/)) {
    warn(`${specURL} loads respec`);
  }
  const dom = new JSDOM(contents);
  const document = dom.window.document;

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

  if (specJSONfile === 'mathml.json') {
    allURLs.push('https://w3c.github.io/mathml/#presm_menclose');
  }

  for (let i = 0; i < allIdElements.length; i++) {
    let id = allIdElements[i].getAttribute('id');
    if (id.startsWith('_ref_') ||
      id.startsWith('term-for') ||
      id.startsWith('biblio-') ||
      id.startsWith('bib-') ||
      id.match(/idl-[0-9]+$/) !== null
    ) {
      continue;
    }
    if (requestURL.startsWith('https://github.com')) {
      requestURL = requestURL.replace('user-content-','');
      id = id.replace('user-content-','');
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

  dom.window.close();
  await waitImmediate();
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
      processSpecURL('https://html.spec.whatwg.org/multipage/browsers.html', 'html.json', 0);
      processSpecURL('https://html.spec.whatwg.org/multipage/browsing-the-web.html', 'html.json', 0);
      processSpecURL('https://html.spec.whatwg.org/multipage/canvas.html', 'html.json', 0);
      processSpecURL('https://html.spec.whatwg.org/multipage/common-dom-interfaces.html', 'html.json', 0);
      processSpecURL('https://html.spec.whatwg.org/multipage/comms.html', 'html.json', 0);
      processSpecURL('https://html.spec.whatwg.org/multipage/custom-elements.html', 'html.json', 0);
      processSpecURL('https://html.spec.whatwg.org/multipage/dnd.html', 'html.json', 0);
      processSpecURL('https://html.spec.whatwg.org/multipage/dom.html', 'html.json', 0);
      processSpecURL('https://html.spec.whatwg.org/multipage/dynamic-markup-insertion.html', 'html.json', 0);
      processSpecURL('https://html.spec.whatwg.org/multipage/edits.html', 'html.json', 0);
      processSpecURL('https://html.spec.whatwg.org/multipage/embedded-content-other.html', 'html.json', 0);
      processSpecURL('https://html.spec.whatwg.org/multipage/embedded-content.html', 'html.json', 0);
      processSpecURL('https://html.spec.whatwg.org/multipage/form-control-infrastructure.html', 'html.json', 0);
      processSpecURL('https://html.spec.whatwg.org/multipage/form-elements.html', 'html.json', 0);
      processSpecURL('https://html.spec.whatwg.org/multipage/forms.html', 'html.json', 0);
      processSpecURL('https://html.spec.whatwg.org/multipage/grouping-content.html', 'html.json', 0);
      processSpecURL('https://html.spec.whatwg.org/multipage/history.html', 'html.json', 0);
      processSpecURL('https://html.spec.whatwg.org/multipage/iframe-embed-object.html', 'html.json', 0);
      processSpecURL('https://html.spec.whatwg.org/multipage/image-maps.html', 'html.json', 0);
      processSpecURL('https://html.spec.whatwg.org/multipage/imagebitmap-and-animations.html', 'html.json', 0);
      processSpecURL('https://html.spec.whatwg.org/multipage/indices.html', 'html.json', 0);
      processSpecURL('https://html.spec.whatwg.org/multipage/infrastructure.html', 'html.json', 0);
      processSpecURL('https://html.spec.whatwg.org/multipage/input.html', 'html.json', 0);
      processSpecURL('https://html.spec.whatwg.org/multipage/interaction.html', 'html.json', 0);
      processSpecURL('https://html.spec.whatwg.org/multipage/interactive-elements.html', 'html.json', 0);
      processSpecURL('https://html.spec.whatwg.org/multipage/links.html', 'html.json', 0);
      processSpecURL('https://html.spec.whatwg.org/multipage/media.html', 'html.json', 0);
      processSpecURL('https://html.spec.whatwg.org/multipage/microdata.html', 'html.json', 0);
      processSpecURL('https://html.spec.whatwg.org/multipage/obsolete.html', 'html.json', 0);
      processSpecURL('https://html.spec.whatwg.org/multipage/origin.html', 'html.json', 0);
      processSpecURL('https://html.spec.whatwg.org/multipage/parsing.html', 'html.json', 0);
      processSpecURL('https://html.spec.whatwg.org/multipage/rendering.html', 'html.json', 0);
      processSpecURL('https://html.spec.whatwg.org/multipage/scripting.html', 'html.json', 0);
      processSpecURL('https://html.spec.whatwg.org/multipage/sections.html', 'html.json', 0);
      processSpecURL('https://html.spec.whatwg.org/multipage/semantics-other.html', 'html.json', 0);
      processSpecURL('https://html.spec.whatwg.org/multipage/semantics.html', 'html.json', 0);
      processSpecURL('https://html.spec.whatwg.org/multipage/server-sent-events.html', 'html.json', 0);
      processSpecURL('https://html.spec.whatwg.org/multipage/structured-data.html', 'html.json', 0);
      processSpecURL('https://html.spec.whatwg.org/multipage/system-state.html', 'html.json', 0);
      processSpecURL('https://html.spec.whatwg.org/multipage/tables.html', 'html.json', 0);
      processSpecURL('https://html.spec.whatwg.org/multipage/text-level-semantics.html', 'html.json', 0);
      processSpecURL('https://html.spec.whatwg.org/multipage/timers-and-user-prompts.html', 'html.json', 0);
      processSpecURL('https://html.spec.whatwg.org/multipage/urls-and-fetching.html', 'html.json', 0);
      processSpecURL('https://html.spec.whatwg.org/multipage/web-messaging.html', 'html.json', 0);
      processSpecURL('https://html.spec.whatwg.org/multipage/web-sockets.html', 'html.json', 0);
      processSpecURL('https://html.spec.whatwg.org/multipage/webappapis.html', 'html.json', 0);
      processSpecURL('https://html.spec.whatwg.org/multipage/webstorage.html', 'html.json', 0);
      processSpecURL('https://html.spec.whatwg.org/multipage/window-object.html', 'html.json', 0);
      processSpecURL('https://html.spec.whatwg.org/multipage/workers.html', 'html.json', 0);
      processSpecURL('https://html.spec.whatwg.org/multipage/worklets.html', 'html.json', 0);
      return data;
    }
    if ('ecmascript.json' === data) {
      processSpecURL('https://tc39.es/ecma262/multipage/index.html', 'ecmascript.json', 0);
      processSpecURL('https://tc39.es/ecma262/multipage/scope.html', 'ecmascript.json', 0);
      processSpecURL('https://tc39.es/ecma262/multipage/conformance.html', 'ecmascript.json', 0);
      processSpecURL('https://tc39.es/ecma262/multipage/normative-references.html', 'ecmascript.json', 0);
      processSpecURL('https://tc39.es/ecma262/multipage/overview.html', 'ecmascript.json', 0);
      processSpecURL('https://tc39.es/ecma262/multipage/notational-conventions.html', 'ecmascript.json', 0);
      processSpecURL('https://tc39.es/ecma262/multipage/ecmascript-data-types-and-values.html', 'ecmascript.json', 0);
      processSpecURL('https://tc39.es/ecma262/multipage/abstract-operations.html', 'ecmascript.json', 0);
      processSpecURL('https://tc39.es/ecma262/multipage/syntax-directed-operations.html', 'ecmascript.json', 0);
      processSpecURL('https://tc39.es/ecma262/multipage/executable-code-and-execution-contexts.html', 'ecmascript.json', 0);
      processSpecURL('https://tc39.es/ecma262/multipage/ordinary-and-exotic-objects-behaviours.html', 'ecmascript.json', 0);
      processSpecURL('https://tc39.es/ecma262/multipage/ecmascript-language-source-code.html', 'ecmascript.json', 0);
      processSpecURL('https://tc39.es/ecma262/multipage/ecmascript-language-lexical-grammar.html', 'ecmascript.json', 0);
      processSpecURL('https://tc39.es/ecma262/multipage/ecmascript-language-expressions.html', 'ecmascript.json', 0);
      processSpecURL('https://tc39.es/ecma262/multipage/ecmascript-language-statements-and-declarations.html', 'ecmascript.json', 0);
      processSpecURL('https://tc39.es/ecma262/multipage/ecmascript-language-functions-and-classes.html', 'ecmascript.json', 0);
      processSpecURL('https://tc39.es/ecma262/multipage/ecmascript-language-scripts-and-modules.html', 'ecmascript.json', 0);
      processSpecURL('https://tc39.es/ecma262/multipage/error-handling-and-language-extensions.html', 'ecmascript.json', 0);
      processSpecURL('https://tc39.es/ecma262/multipage/ecmascript-standard-built-in-objects.html', 'ecmascript.json', 0);
      processSpecURL('https://tc39.es/ecma262/multipage/global-object.html', 'ecmascript.json', 0);
      processSpecURL('https://tc39.es/ecma262/multipage/fundamental-objects.html', 'ecmascript.json', 0);
      processSpecURL('https://tc39.es/ecma262/multipage/numbers-and-dates.html', 'ecmascript.json', 0);
      processSpecURL('https://tc39.es/ecma262/multipage/text-processing.html', 'ecmascript.json', 0);
      processSpecURL('https://tc39.es/ecma262/multipage/indexed-collections.html', 'ecmascript.json', 0);
      processSpecURL('https://tc39.es/ecma262/multipage/keyed-collections.html', 'ecmascript.json', 0);
      processSpecURL('https://tc39.es/ecma262/multipage/structured-data.html', 'ecmascript.json', 0);
      processSpecURL('https://tc39.es/ecma262/multipage/managing-memory.html', 'ecmascript.json', 0);
      processSpecURL('https://tc39.es/ecma262/multipage/control-abstraction-objects.html', 'ecmascript.json', 0);
      processSpecURL('https://tc39.es/ecma262/multipage/reflection.html', 'ecmascript.json', 0);
      processSpecURL('https://tc39.es/ecma262/multipage/memory-model.html', 'ecmascript.json', 0);
      processSpecURL('https://tc39.es/ecma262/multipage/grammar-summary.html', 'ecmascript.json', 0);
      processSpecURL('https://tc39.es/ecma262/multipage/additional-ecmascript-features-for-web-browsers.html', 'ecmascript.json', 0);
      processSpecURL('https://tc39.es/ecma262/multipage/strict-mode-of-ecmascript.html', 'ecmascript.json', 0);
      processSpecURL('https://tc39.es/ecma262/multipage/host-layering-points.html', 'ecmascript.json', 0);
      processSpecURL('https://tc39.es/ecma262/multipage/corrections-and-clarifications-in-ecmascript-2015-with-possible-compatibility-impact.html', 'ecmascript.json', 0);
      processSpecURL('https://tc39.es/ecma262/multipage/additions-and-changes-that-introduce-incompatibilities-with-prior-editions.html', 'ecmascript.json', 0);
      processSpecURL('https://tc39.es/ecma262/multipage/colophon.html', 'ecmascript.json', 0);
      processSpecURL('https://tc39.es/ecma262/multipage/bibliography.html', 'ecmascript.json', 0);
      processSpecURL('https://tc39.es/ecma262/multipage/copyright-and-software-license.html', 'ecmascript.json', 0);
      return data;
    }
    if (specURL === 'https://svgwg.org/svg2-draft/') {
      otherSpecs.push('svg-2.json');
      processSVG2files(specURL);
      return data;
    }
    if ('proposal-hashbang.json' === data) {
      processSpecURL('https://tc39.es/proposal-hashbang/out.html');
      return data;
    }
    processSpecURL(specURL, specJSONfile, 0);
  }
  return data;
};


JSON.parse(specMap, processSpecMap);
const staticSpecURLs =
  JSON.parse(fs.readFileSync('.spec-urls-stable.json', 'utf-8').trim());
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
