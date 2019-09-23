#!/usr/bin/env node
/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */

'use strict';
const chalk = require('chalk');
const fs = require('fs');
const request = require('sync-request');
const PATH = require('path');
const URL = require('url');

const { JSDOM } = require('jsdom');
const { platform } = require('os');

const IS_WINDOWS = platform() === 'win32';

const dom = new JSDOM();

const replacementsFile ='replacements.json';
/* replacementsFile format:
 *
 * {
 *   "https://developer.mozilla.org/en-US/docs/Web/API/Navigator/foo": [
 *       "#widl-Navigator-foo", // target string
 *       "#dom-navigator-foo"   // replacement string
 *   ]
 * }
 *
 */

const sleep = (ms) => {
  const date = Date.now();
  let currentDate = null;
  do {
    currentDate = Date.now();
  } while (currentDate - date < (ms * 1000));
};

const log = msg => console.log(`${msg}`);
const note = msg => console.log(chalk`{cyanBright     ${msg}}`);
const warn = msg => console.warn(chalk`{yellowBright     ${msg}}`);
const error = msg => console.error(chalk`{redBright     ${msg}}`);
const success = msg => console.log(chalk`{greenBright     ${msg}}`);

chalk.level = 3;

const getMdnArticleContents = (url, seconds, sessionid) => {
  if (seconds) { sleep(seconds); }
  seconds = 60;
  const mdnURL = 'https://wiki.' + url.substring(8)+ '$edit';
  const options = {
    headers: {
      'User-Agent': 'mdn-spec-links-script',
      'Cookie': 'sessionid=' + sessionid,
    },
    gzip: false,  // prevent Z_BUF_ERROR 'unexpected end of file'
    followRedirects: true,  // default
  };
  try {
    const response = request('GET', mdnURL, options);
    const statusCode = response.statusCode;
    if (response.headers['retry-after']) {
      seconds = parseInt(response.headers['retry-after']);
      getMdnArticleContents(mdnURL, seconds);
    } else if (statusCode === 504 || statusCode === 502) {
      getMdnArticleContents(mdnURL, seconds);
    } else if (statusCode === 404) {
      return null;
    } else if (statusCode >= 300) {
      return null;
    }
    const headers = response.headers;
    const setCookieHeader = response.headers['set-cookie'];
    const rawMdnArticleContent = response.getBody('utf8');
    const window = dom.window;
    const html = new window.DOMParser()
      .parseFromString(rawMdnArticleContent, 'text/html');
    let params = {};
    setCookieHeader.forEach(cookie => {
      if (cookie.startsWith('csrftoken')) {
        params.csrftoken = cookie.split(';')[0].split('=')[1];
      }
    });
    params.content =
      html.querySelector('[name="content"]').textContent;
    params.csrfmiddlewaretoken =
      html.querySelector('[name="csrfmiddlewaretoken"]').value;
    params.title =
      html.querySelector('[name="title"]').value;
    params.parent_id =
      html.querySelector('[name="parent_id"]').value;
    params.toc_depth=
      html.querySelector('[name="toc_depth"]').value;
    params.based_on =
      html.querySelector('[name="based_on"]').value;
    params.tags =
      html.querySelector('[name="tags"]').value;
    params.days =
      html.querySelector('[name="days"]').value;
    params.hours =
      html.querySelector('[name="hours"]').value;
    params.minutes =
      html.querySelector('[name="minutes"]').value;
    params.render_max_age =
      html.querySelector('[name="render_max_age"]').value;
    let current_rev = [];
    Array.from(html.querySelectorAll('[name="current_rev"]'))
      .forEach(element => current_rev.push(element.value));
    params.current_rev = current_rev;
    let review_tags = [];
    Array.from(html.querySelectorAll('[name="review_tags"]'))
      .forEach(element => review_tags.push(element.value));
    params.review_tags = review_tags;
    window.close();
    return params;
  } catch(e) {
    log(e);
  }
  return null;
};

const updateMdnArticleContents =
    (url, params, bad, good, seconds, sessionid) => {
  if (seconds) { sleep(seconds); }
  seconds = 60;
  const mdnURL = 'https://wiki.' + url.substring(8)+ '$edit';
  log(`${mdnURL}`);
  if (bad.startsWith('/')) {
    bad = new RegExp(bad.slice(1, -1));
  }
  const newcontent = params.content.replace(bad, good);
  if (newcontent === params.content) {
    error(`${mdnURL} string replacement failed (${bad} => ${good})`);
    return;
  } else {
    params.content = newcontent;
  }
  params.comment = "Fix spec URL";
  params['form-type'] = 'rev';
  let formBody = [];
  for (var key in params) {
    const encodedKey = encodeURIComponent(key);
    if (Array.isArray(params[key])) {
      for (let i = 0; i < params[key].length; i++) {
        const encodedValue = encodeURIComponent(params[key][i]);
        formBody.push(encodedKey + "=" + encodedValue);
      }
    } else {
      const encodedValue = encodeURIComponent(params[key]);
      formBody.push(encodedKey + "=" + encodedValue);
    }
  }
  formBody = formBody.join("&");
  const csrftoken = params.csrftoken;
  const options = {
    headers: {
      'Content-Length': formBody.length,
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'User-Agent': 'batch-update-script',
      'Referer': 'https://wiki.developer.mozilla.org/en-US/docs/Sandbox$edit',
      'Cookie': `sessionid=${sessionid}; csrftoken=${csrftoken}; dwf_sg_task_completion=False; dwf_contrib_beta=False`,
      'X-CSRFToken': csrftoken,
      'X-Requested-With': 'XMLHttpRequest',
    },
    gzip: false,  // prevent Z_BUF_ERROR 'unexpected end of file'
    followRedirects: true,  // default
    body: formBody,
  };
  try {
    const response = request('POST', mdnURL, options);
    const statusCode = response.statusCode;
    if (response.headers['retry-after']) {
      seconds = parseInt(response.headers['retry-after']);
      updateMdnArticleContents(mdnURL, params, bad, good, seconds,
                               sessionid);
    } else if (statusCode === 504 || statusCode === 502) {
      updateMdnArticleContents(mdnURL, params, bad, good, seconds,
                               sessionid);
    } else if (statusCode === 404) {
      return false;
    } else if (statusCode >= 300) {
      return false;
    }
    note(statusCode);
    return !JSON.parse(response.getBody('utf8')).error;
  } catch(e) {
    log(e);
  }
  return false;
};

const doReplacements = (replacementsFile, sessionid) => {
  const replacements = JSON.parse(fs.readFileSync(replacementsFile));
  let count = 0;
  for (var url in replacements) {
    if (count > 100) {
      return;
    }
    var bad, good;
    [ bad, good ] = replacements[url];
    const params = getMdnArticleContents(url, 1, sessionid);
    const succeeded =
      updateMdnArticleContents(url, params, bad, good, 1, sessionid);
    if (succeeded) {
      success(`${url} content replacement succeeded`);
      delete replacements[url];
      fs.writeFileSync(replacementsFile,
        JSON.stringify(replacements, null, 4) + '\n', 'utf-8');
    } else {
      error(`${url} content replacement failed`);
    }
    count++;
  }
};

if (process.argv[2]) {
  doReplacements(replacementsFile, process.argv[2]);
} else {
  console.log("Error: You must specify a sessionid value.");
  process.exit(-1);
}

module.exports = { getMdnArticleContents };
