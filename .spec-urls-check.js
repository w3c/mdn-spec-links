#!/usr/bin/env node
/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */

'use strict';
const chalk = require('chalk');
const fs = require('fs');
const request = require('sync-request');
const PATH = require('path');
const URL = require('url');
const zlib = require('zlib');

const { JSDOM } = require('jsdom');

const log = msg => console.log(`${msg}`);
const info = msg => console.log(chalk`{keyword('dimgrey')     ${msg}}`);
const warn = msg => console.warn(chalk`{yellowBright     ${msg}}`);
const error = msg => console.error(chalk`{redBright     ${msg}}`);

const needsSpecURL = mdnURL => {
  const exceptions = [
    "https://developer.mozilla.org/docs/Web/API/CanvasRenderingContext2D/createConicGradient",
    "https://developer.mozilla.org/docs/Web/API/Document/featurePolicy",
    "https://developer.mozilla.org/docs/Web/API/FeaturePolicy/allowedFeatures",
    "https://developer.mozilla.org/docs/Web/API/FeaturePolicy/allowsFeature",
    "https://developer.mozilla.org/docs/Web/API/FeaturePolicy/features",
    "https://developer.mozilla.org/docs/Web/API/FeaturePolicy/getAllowlistForFeature",
    "https://developer.mozilla.org/docs/Web/API/FeaturePolicy",
    "https://developer.mozilla.org/docs/Web/API/GlobalEventHandlers/onloadend",
    "https://developer.mozilla.org/docs/Web/API/HTMLElement/inert",
    "https://developer.mozilla.org/docs/Web/API/HTMLIFrameElement/featurePolicy",
    "https://developer.mozilla.org/docs/Web/API/HTMLMediaElement/controller",
    "https://developer.mozilla.org/docs/Web/API/HTMLMediaElement/mediaGroup",
    "https://developer.mozilla.org/docs/Web/API/MouseEvent/region",
    // iterables; we explicitly don’t want spec URLs for these
    "https://developer.mozilla.org/docs/Web/API/CSSTransformValue/entries",
    "https://developer.mozilla.org/docs/Web/API/CSSTransformValue/forEach",
    "https://developer.mozilla.org/docs/Web/API/CSSTransformValue/keys",
    "https://developer.mozilla.org/docs/Web/API/CSSTransformValue/values",
    "https://developer.mozilla.org/docs/Web/API/CSSUnparsedValue/entries",
    "https://developer.mozilla.org/docs/Web/API/CSSUnparsedValue/forEach",
    "https://developer.mozilla.org/docs/Web/API/CSSUnparsedValue/keys",
    "https://developer.mozilla.org/docs/Web/API/CSSUnparsedValue/values",
    "https://developer.mozilla.org/docs/Web/API/DOMTokenList/entries",
    "https://developer.mozilla.org/docs/Web/API/DOMTokenList/forEach",
    "https://developer.mozilla.org/docs/Web/API/DOMTokenList/keys",
    "https://developer.mozilla.org/docs/Web/API/DOMTokenList/values",
    "https://developer.mozilla.org/docs/Web/API/FormData/entries",
    "https://developer.mozilla.org/docs/Web/API/FormData/keys",
    "https://developer.mozilla.org/docs/Web/API/FormData/values",
    "https://developer.mozilla.org/docs/Web/API/Headers/entries",
    "https://developer.mozilla.org/docs/Web/API/Headers/keys",
    "https://developer.mozilla.org/docs/Web/API/Headers/values",
    "https://developer.mozilla.org/docs/Web/API/KeyboardLayoutMap/entries",
    "https://developer.mozilla.org/docs/Web/API/KeyboardLayoutMap/forEach",
    "https://developer.mozilla.org/docs/Web/API/KeyboardLayoutMap/get",
    "https://developer.mozilla.org/docs/Web/API/KeyboardLayoutMap/has",
    "https://developer.mozilla.org/docs/Web/API/KeyboardLayoutMap/keys",
    "https://developer.mozilla.org/docs/Web/API/KeyboardLayoutMap/size",
    "https://developer.mozilla.org/docs/Web/API/KeyboardLayoutMap/values",
    "https://developer.mozilla.org/docs/Web/API/MediaKeyStatusMap/entries",
    "https://developer.mozilla.org/docs/Web/API/MediaKeyStatusMap/forEach",
    "https://developer.mozilla.org/docs/Web/API/MediaKeyStatusMap/keys",
    "https://developer.mozilla.org/docs/Web/API/MediaKeyStatusMap/values",
    "https://developer.mozilla.org/docs/Web/API/NodeList/entries",
    "https://developer.mozilla.org/docs/Web/API/NodeList/forEach",
    "https://developer.mozilla.org/docs/Web/API/NodeList/keys",
    "https://developer.mozilla.org/docs/Web/API/NodeList/values",
    "https://developer.mozilla.org/docs/Web/API/StylePropertyMapReadOnly/entries",
    "https://developer.mozilla.org/docs/Web/API/StylePropertyMapReadOnly/forEach",
    "https://developer.mozilla.org/docs/Web/API/StylePropertyMapReadOnly/keys",
    "https://developer.mozilla.org/docs/Web/API/StylePropertyMapReadOnly/values",
    "https://developer.mozilla.org/docs/Web/API/URLSearchParams/entries",
    "https://developer.mozilla.org/docs/Web/API/URLSearchParams/forEach",
    "https://developer.mozilla.org/docs/Web/API/URLSearchParams/keys",
    "https://developer.mozilla.org/docs/Web/API/URLSearchParams/values",
    "https://developer.mozilla.org/docs/Web/API/XRInputSourceArray/entries",
    "https://developer.mozilla.org/docs/Web/API/XRInputSourceArray/forEach",
    "https://developer.mozilla.org/docs/Web/API/XRInputSourceArray/keys",
    "https://developer.mozilla.org/docs/Web/API/XRInputSourceArray/values",
    "https://developer.mozilla.org/docs/Web/API/CSSTransformValue/entries",
    "https://developer.mozilla.org/docs/Web/API/CSSTransformValue/forEach",
    "https://developer.mozilla.org/docs/Web/API/CSSTransformValue/keys",
    "https://developer.mozilla.org/docs/Web/API/CSSTransformValue/values",
    "https://developer.mozilla.org/docs/Web/API/CSSUnparsedValue/entries",
    "https://developer.mozilla.org/docs/Web/API/CSSUnparsedValue/forEach",
    "https://developer.mozilla.org/docs/Web/API/CSSUnparsedValue/keys",
    "https://developer.mozilla.org/docs/Web/API/CSSUnparsedValue/values",
    "https://developer.mozilla.org/docs/Web/API/DOMTokenList/entries",
    "https://developer.mozilla.org/docs/Web/API/DOMTokenList/forEach",
    "https://developer.mozilla.org/docs/Web/API/DOMTokenList/keys",
    "https://developer.mozilla.org/docs/Web/API/DOMTokenList/values",
    "https://developer.mozilla.org/docs/Web/API/FormData/entries",
    "https://developer.mozilla.org/docs/Web/API/FormData/keys",
    "https://developer.mozilla.org/docs/Web/API/FormData/values",
    "https://developer.mozilla.org/docs/Web/API/Headers/entries",
    "https://developer.mozilla.org/docs/Web/API/Headers/keys",
    "https://developer.mozilla.org/docs/Web/API/Headers/values",
    "https://developer.mozilla.org/docs/Web/API/KeyboardLayoutMap/entries",
    "https://developer.mozilla.org/docs/Web/API/KeyboardLayoutMap/forEach",
    "https://developer.mozilla.org/docs/Web/API/KeyboardLayoutMap/get",
    "https://developer.mozilla.org/docs/Web/API/KeyboardLayoutMap/has",
    "https://developer.mozilla.org/docs/Web/API/KeyboardLayoutMap/keys",
    "https://developer.mozilla.org/docs/Web/API/KeyboardLayoutMap/size",
    "https://developer.mozilla.org/docs/Web/API/KeyboardLayoutMap/values",
    "https://developer.mozilla.org/docs/Web/API/MediaKeyStatusMap/entries",
    "https://developer.mozilla.org/docs/Web/API/MediaKeyStatusMap/forEach",
    "https://developer.mozilla.org/docs/Web/API/MediaKeyStatusMap/keys",
    "https://developer.mozilla.org/docs/Web/API/MediaKeyStatusMap/values",
    "https://developer.mozilla.org/docs/Web/API/NodeList/entries",
    "https://developer.mozilla.org/docs/Web/API/NodeList/forEach",
    "https://developer.mozilla.org/docs/Web/API/NodeList/keys",
    "https://developer.mozilla.org/docs/Web/API/NodeList/values",
    "https://developer.mozilla.org/docs/Web/API/StylePropertyMapReadOnly/entries",
    "https://developer.mozilla.org/docs/Web/API/StylePropertyMapReadOnly/forEach",
    "https://developer.mozilla.org/docs/Web/API/StylePropertyMapReadOnly/keys",
    "https://developer.mozilla.org/docs/Web/API/StylePropertyMapReadOnly/values",
    "https://developer.mozilla.org/docs/Web/API/URLSearchParams/entries",
    "https://developer.mozilla.org/docs/Web/API/URLSearchParams/forEach",
    "https://developer.mozilla.org/docs/Web/API/URLSearchParams/keys",
    "https://developer.mozilla.org/docs/Web/API/URLSearchParams/values",
    "https://developer.mozilla.org/docs/Web/API/XRInputSourceArray/entries",
    "https://developer.mozilla.org/docs/Web/API/XRInputSourceArray/forEach",
    "https://developer.mozilla.org/docs/Web/API/XRInputSourceArray/keys",
    "https://developer.mozilla.org/docs/Web/API/XRInputSourceArray/values",
    // FIXME: for this one we really do need a spec URL
    "https://developer.mozilla.org/docs/Web/HTTP/Headers/Set-Cookie/SameSite",
    // FIXME: for this one we really do need a spec URL
    "https://developer.mozilla.org/docs/Web/API/XRSession/requestHitTestSource",
    // FIXME: for all these we really do need spec URLs
    "https://developer.mozilla.org/docs/Web/API/NDEFMessage/NDEFMessage",
    "https://developer.mozilla.org/docs/Web/API/NDEFReadingEvent/NDEFReadingEvent",
    "https://developer.mozilla.org/docs/Web/API/NDEFReadingEvent/message",
    "https://developer.mozilla.org/docs/Web/API/NDEFReadingEvent/serialNumber",
    // FIXME: for all these we really do need spec URLs
    "https://developer.mozilla.org/docs/Web/API/TextTrack/activeCues",
    "https://developer.mozilla.org/docs/Web/API/TextTrack/addCue",
    "https://developer.mozilla.org/docs/Web/API/TextTrack/cues",
    "https://developer.mozilla.org/docs/Web/API/TextTrack/id",
    "https://developer.mozilla.org/docs/Web/API/TextTrack/inBandMetadataTrackDispatchType",
    "https://developer.mozilla.org/docs/Web/API/TextTrack/kind",
    "https://developer.mozilla.org/docs/Web/API/TextTrack/label",
    "https://developer.mozilla.org/docs/Web/API/TextTrack/language",
    "https://developer.mozilla.org/docs/Web/API/TextTrack/removeCue",
    "https://developer.mozilla.org/docs/Web/API/TextTrackCue/endTime",
    "https://developer.mozilla.org/docs/Web/API/TextTrackCue/id",
    "https://developer.mozilla.org/docs/Web/API/TextTrackCue/pauseOnExit",
    "https://developer.mozilla.org/docs/Web/API/TextTrackCue/startTime",
    "https://developer.mozilla.org/docs/Web/API/TextTrackCue/track",
    "https://developer.mozilla.org/docs/Web/API/VTTCue/align",
    "https://developer.mozilla.org/docs/Web/API/VTTCue/getCueAsHTML",
    "https://developer.mozilla.org/docs/Web/API/VTTCue/line",
    "https://developer.mozilla.org/docs/Web/API/VTTCue/lineAlign",
    "https://developer.mozilla.org/docs/Web/API/VTTCue/position",
    "https://developer.mozilla.org/docs/Web/API/VTTCue/positionAlign",
    "https://developer.mozilla.org/docs/Web/API/VTTCue/region",
    "https://developer.mozilla.org/docs/Web/API/VTTCue/size",
    "https://developer.mozilla.org/docs/Web/API/VTTCue/snapToLines",
    "https://developer.mozilla.org/docs/Web/API/VTTCue/text",
    "https://developer.mozilla.org/docs/Web/API/VTTCue/vertical",
  ]
  if (exceptions.includes(mdnURL)) {
    return false;
  }
  const slugSubstringsNotNeedingSpecURLs = [];
  return !slugSubstringsNotNeedingSpecURLs.some(substring =>
    mdnURL.includes(substring),
  );
};

log('loading SPECURLS.json...');
const SPECURLS = JSON.parse(fs.readFileSync('SPECURLS.json', 'utf-8'));

var MDNURLS = [];
var file;

chalk.level = 3;

const checkSpecURLs = (key, data) => {
  let deprecated = false;
  let standard = true;
  if (data && data instanceof Object && '__compat' in data) {
    const feature = key;
    const bcdFeatureData = data.__compat;
    const mdn_url = bcdFeatureData.mdn_url;
    if ('standard_track' in bcdFeatureData.status) {
      standard = bcdFeatureData.status.standard_track;
      if (!standard) {
        info(`${file}:${feature}: non-standard`);
      }
    }
    if ('deprecated' in bcdFeatureData.status) {
      deprecated = bcdFeatureData.status.deprecated;
      if (!deprecated) {
        info(`${file}:${feature}: deprecated`);
      }
    }
    if (!mdn_url && !(deprecated || !standard)) {
      if (!key.includes('_')) {
        warn(`${file}:${feature}: no mdn_url`);
      }
    }
    let spec_url = bcdFeatureData.spec_url;
    if (spec_url && spec_url.length !== 0) {
      if (deprecated) {
        warn(`${file}:${feature}: deprecated but has spec_url`);
      }
      if (!standard) {
        warn(`${file}:${feature}: nonstandard but has spec_url`);
      }
      if (spec_url instanceof Array) {
        for (const url of spec_url) {
          checkSpecURL(file, feature, url, mdn_url, standard, deprecated);
        }
      } else {
        checkSpecURL(file, feature, spec_url, mdn_url, standard, deprecated);
      }
    } else if (mdn_url && !URL.parse(mdn_url).hash && standard && !deprecated) {
      if (needsSpecURL(mdn_url) && MDNURLS.includes(mdn_url)) {
        error(`${file}:${feature}: ${mdn_url} needs spec URL`);
      }
    }
  }
  return data;
};

const checkSpecURL = (
  file,
  feature,
  spec_url,
  mdn_url,
  standard,
  deprecated,
) => {
  /*
   * // FIXME temporary https://github.com/mdn/browser-compat-data/pull/12171
   * if (spec_url.startsWith('https://w3c.github.io/webcrypto/#Crypto-method-randomUUID')) {
   *   return;
   * }
   */
  if (
    spec_url.startsWith('https://www.rfc-editor.org/rfc/rfc2324') ||
    spec_url.startsWith('https://www.rfc-editor.org/rfc/rfc7168')
  ) {
    // "I'm a teapot" RFC; ignore
    return;
  }
  if (
    spec_url.match(
      /https:\/\/www.khronos.org\/registry\/webgl\/extensions\/[^/]+\//,
    )
  ) {
    return;
  }
  if (SPECURLS.includes(spec_url)) {
    return;
  }
  if (mdn_url && standard && !deprecated) {
    error(`${file}:${feature}: bad spec URL ${spec_url} bad fragment?`);
  }
};

/**
 * @param {Promise<void>} filename
 */
const processFile = filename => {
  log(`Processing ${filename}`);
  JSON.parse(fs.readFileSync(filename, 'utf-8').trim(), checkSpecURLs);
};

if (require.main === module) {
  /**
   * @param {string[]} files
   */
  const load = (...files) => {
    const options = {
      headers: { 'User-Agent': 'bcd-maintenance-script' },
      gzip: true,
    };
    const response = request(
      'GET',
      'https://developer.mozilla.org/sitemaps/en-us/sitemap.xml.gz',
      options,
    );
    const xml = zlib.gunzipSync(response.getBody()).toString('utf8');
    const dom = new JSDOM("");
    const DOMParser = dom.window.DOMParser;
    const parser = new DOMParser;
    const doc = parser.parseFromString(xml, "text/xml");
    const loc_elements = doc.documentElement.querySelectorAll("loc");
    for (let i = 0; i < loc_elements.length; i++) {
      const path = loc_elements[i].textContent.substring(36);
      MDNURLS.push('https://developer.mozilla.org/' + path);
    }
    for (file of files) {
      if (file.indexOf(__dirname) !== 0) {
        file = PATH.resolve(__dirname, file);
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
      load(...subFiles(file));
    }
  };

  const subFiles = file =>
    fs.readdirSync(file).map(subfile => {
      return PATH.join(file, subfile);
    });

  let subdir = "";
  if (PATH.basename(process.env.PWD) !== "browser-compat-data") {
    subdir = "browser-compat-data/"
  }

  if (process.argv[2] && process.argv[2] !== 'all') {
    load(subdir + process.argv[2]);
  } else {
    load(
      subdir + 'api',
      subdir + 'css',
      subdir + 'html',
      subdir + 'http',
      subdir + 'javascript',
      subdir + 'mathml',
      subdir + 'svg',
      subdir + 'webdriver',
    );
  }
}

module.exports = { checkSpecURLs, processFile };
