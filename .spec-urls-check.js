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
  ]
  if (exceptions.includes(mdnURL)) {
    return false;
  }
  const slugSubstringsNotNeedingSpecURLs = [];
  return !slugSubstringsNotNeedingSpecURLs.some(substring =>
    mdnURL.includes(substring),
  );
};

var SPECURLS;
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
  if (
    spec_url.startsWith('https://datatracker.ietf.org/doc/html/rfc2324') ||
    spec_url.startsWith('https://datatracker.ietf.org/doc/html/rfc7168')
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
    let response = request(
      'GET',
      'https://raw.githubusercontent.com/w3c/mdn-spec-links/main/SPECURLS.json',
      options,
    );
    SPECURLS = JSON.parse(response.getBody('utf8'));
    response = request(
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
