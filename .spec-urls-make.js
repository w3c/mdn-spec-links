#!/usr/bin/env node
/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

import chalk from "chalk";
import { readFileSync, writeFileSync } from "fs";
import request from "sync-request";

import { JSDOM } from "jsdom";

let allURLs = [];
const bikeshedSpecs = [];
const respecSpecs = [];
const otherSpecs = [];
const allURLsFile = "SPECURLS.json";
const bikeshedSpecsFile = "BIKESHED_SPECS.txt";
const respecSpecsFile = "RESPEC_SPECS.txt";
const otherSpecsFile = "OTHER_SPECS.txt";

const sleep = (ms) => {
  const date = Date.now();
  let currentDate = null;
  do {
    currentDate = Date.now();
  } while (currentDate - date < ms * 1000);
};

const stableSpecs = [
  "https://www.rfc-editor.org/rfc/rfc2397",
  "https://www.rfc-editor.org/rfc/rfc6454",
  "https://www.rfc-editor.org/rfc/rfc6797",
  "https://www.rfc-editor.org/rfc/rfc7239",
  "https://www.rfc-editor.org/rfc/rfc7578",
  "https://www.rfc-editor.org/rfc/rfc8942",
  "https://httpwg.org/specs/rfc6265.html",
  "https://httpwg.org/specs/rfc6266.html",
  "https://httpwg.org/specs/rfc7838.html",
  "https://httpwg.org/specs/rfc8246.html",
  "https://httpwg.org/specs/rfc9110.html",
  "https://httpwg.org/specs/rfc9111.html",
  "https://httpwg.org/specs/rfc9112.html",
  "https://httpwg.org/specs/rfc9113.html",
  "https://registry.khronos.org/webgl/specs/latest/1.0/",
  "https://registry.khronos.org/webgl/specs/latest/2.0/",
];

const respecRawSpecs = [
  "https://w3c.github.io/badging/", // NO TR
  "https://w3c.github.io/battery/", // yes
  "https://w3c.github.io/beacon/", // OUT OF DATE TR
  "https://w3c.github.io/gamepad/", // yes
  "https://w3c.github.io/gamepad/extensions.html", // NO TR
  "https://w3c.github.io/hr-time/", // yes
  "https://w3c.github.io/html-media-capture/", // ca. 2018 TR Rec
  "https://w3c.github.io/input-events/", // yes
  "https://w3c.github.io/manifest/", // OUT OF DATE TR
  "https://w3c.github.io/manifest-app-info/", // yes
  "https://w3c.github.io/mathml-core/", // NO TR
  "https://w3c.github.io/mathml/",
  "https://w3c.github.io/mediacapture-fromelement/", // yes
  "https://w3c.github.io/media-playback-quality/", // NO TR
  "https://w3c.github.io/mediacapture-main/", // yes
  "https://w3c.github.io/mediacapture-output/", // yes
  "https://w3c.github.io/mediacapture-screen-share/", // yes
  "https://w3c.github.io/mst-content-hint/",
  "https://w3c.github.io/navigation-timing/", // yes
  "https://w3c.github.io/network-error-logging/", // OUT OF DATE TR
  "https://w3c.github.io/page-visibility/", // OUT OF DATE TR
  "https://w3c.github.io/payment-handler/", // yes
  "https://w3c.github.io/payment-method-basic-card/", // OUT OF DATE TR
  "https://w3c.github.io/payment-request/", // yes
  "https://w3c.github.io/performance-timeline/", // yes
  "https://w3c.github.io/pointerevents/", // yes
  "https://w3c.github.io/pointerlock/", // OUT OF DATE TR
  "https://w3c.github.io/preload/", // OUT OF DATE TR
  "https://w3c.github.io/push-api/", // yes
  "https://w3c.github.io/requestidlecallback/", // OUT OF DATE TR
  "https://w3c.github.io/resource-timing/", // OUT OF DATE TR
  "https://w3c.github.io/screen-orientation/", // yes
  "https://w3c.github.io/screen-wake-lock/", // yes
  "https://w3c.github.io/selection-api/", // yes
  "https://w3c.github.io/server-timing/", // yes
  "https://w3c.github.io/speech-api/", // NO TR; never had a TR
  "https://w3c.github.io/touch-events/", // OUT OF DATE TR
  "https://w3c.github.io/user-timing/", // yes
  "https://w3c.github.io/vibration/", // OUT OF DATE TR
  "https://w3c.github.io/web-nfc/", // NO TR; never had a TR
  "https://w3c.github.io/web-share/", // yes
  "https://w3c.github.io/web-share-target/",
  "https://w3c.github.io/webrtc-extensions/", // NO TR; never had a TR
  "https://w3c.github.io/webrtc-identity/", // out of date TR
  "https://w3c.github.io/webrtc-pc/", // out of date TR
  "https://w3c.github.io/webrtc-stats/", // yes
  "https://webaudio.github.io/web-midi-api/", // out of date TR
  "https://wicg.github.io/eyedropper-api/",
  "https://wicg.github.io/frame-timing/", // NO TR; never had a TR
  "https://wicg.github.io/input-device-capabilities/", // NO TR; never had a TR
  "https://wicg.github.io/manifest-incubations/",
  "https://wicg.github.io/visual-viewport/", // NO TR; never had a TR
  "https://wicg.github.io/netinfo/", // NO TR; never had a TR
  "https://wicg.github.io/savedata/", // NO TR; never had a TR
  "https://wicg.github.io/window-controls-overlay/",
];

const note = (msg) => console.log(chalk`{cyanBright     ${msg}}`);
const error = (msg) => console.error(chalk`{redBright     ${msg}}`);
const warn = (msg) => console.warn(chalk`{yellowBright     ${msg}}`);

chalk.level = 3;

const specMap = readFileSync("SPECMAP.json", "utf-8").trim();

const getRemoteContents = (specURL, requestURL, seconds) => {
  if (seconds) {
    sleep(seconds);
  }
  seconds = 10;
  const options = {
    headers: { "User-Agent": "mdn-spec-links-script" },
    gzip: false, // prevent Z_BUF_ERROR 'unexpected end of file'
    followRedirects: true, // default
    retry: true,
    retryDelay: 1000 * seconds,
  };
  try {
    const response = request("GET", requestURL, options);
    const statusCode = response.statusCode;
    if (statusCode === 404) {
      error(`404 ${specURL}`);
      return null;
    } else if (statusCode >= 300) {
      error(`${statusCode} ${specURL}` + ` (unexpected status code)`);
      return null;
    }
    return response.getBody("utf8");
  } catch (e) {
    error(`error for ${specURL} ${e.message}.`);
    console.log(e);
  }
};

const processSpecURL = async (
  specURL,
  specJSONfile,
  seconds,
  originalURL = null
) => {
  let requestURL = specURL;
  if (respecRawSpecs.includes(requestURL)) {
    requestURL =
      "https://labs.w3.org/spec-generator/?type=respec&url=" + requestURL;
  }
  if (requestURL.startsWith("https://drafts.csswg.org/")) {
    return;
  }
  const contents = getRemoteContents(specURL, requestURL, seconds);
  if (contents && contents.match(/respec-w3c-/)) {
    warn(`${specURL} loads respec`);
  }
  const dom = new JSDOM(contents);
  const document = dom.window.document;

  const meta = document.querySelector("meta[http-equiv=refresh]");
  if (meta) {
    const redirectURL = new URL(meta.content.split("=")[1], requestURL).href;
    processSpecURL(redirectURL, specJSONfile, seconds, requestURL);
    return;
  }
  if (
    document.querySelector('script[src*="respec"]') ||
    document.querySelector('meta[content*="ReSpec"]')
  ) {
    if (!respecSpecs.includes(specJSONfile)) {
      respecSpecs.push(specJSONfile);
    }
  } else if (
    document.querySelector("body.h-entry") ||
    document.querySelector('meta[content*="Bikeshed"]')
  ) {
    if (!bikeshedSpecs.includes(specJSONfile)) {
      bikeshedSpecs.push(specJSONfile);
    }
  } else if (specJSONfile !== null) {
    if (!otherSpecs.includes(specJSONfile)) {
      otherSpecs.push(specJSONfile);
    }
  }

  const allIdElements = [...document.querySelectorAll("*[id]")];
  const allNameElements = [...document.querySelectorAll("*:not(meta)[name]")];

  if (originalURL) {
    requestURL = originalURL;
  }

  if (requestURL.startsWith("https://labs.w3.org/spec-generator/")) {
    requestURL = requestURL.substring(52);
  }

  if (specJSONfile === "mathml.json") {
    allURLs.push("https://w3c.github.io/mathml/#presm_menclose");
  }

  for (let i = 0; i < allIdElements.length; i++) {
    let id = allIdElements[i].getAttribute("id");
    if (
      id.startsWith("_ref_") ||
      id.startsWith("term-for") ||
      id.startsWith("biblio-") ||
      id.startsWith("bib-") ||
      id.match(/idl-[0-9]+$/) !== null
    ) {
      continue;
    }
    if (requestURL.startsWith("https://github.com")) {
      requestURL = requestURL.replace("user-content-", "");
      id = id.replace("user-content-", "");
    }
    allURLs.push(requestURL + "#" + id);
    note(requestURL + "#" + id);
  }

  if (requestURL.startsWith("https://tc39.es/")) {
    return;
  }

  for (let i = 0; i < allNameElements.length; i++) {
    const name = allNameElements[i].getAttribute("name");
    allURLs.push(requestURL + "#" + name);
    note(requestURL + "#" + name);
  }

  dom.window.close();
};

const processSVG2files = (baseURL) => {
  [
    "access.html",
    "animate.html",
    "attindex.html",
    "backward.html",
    "changes.html",
    "color.html",
    "concepts.html",
    "conform.html",
    "coords.html",
    "eltindex.html",
    "embedded.html",
    "escript.html",
    "extend.html",
    "feature.html",
    "filters.html",
    "fonts.html",
    "geometry.html",
    "i18n.html",
    "idl.html",
    "idlindex.html",
    "implnote.html",
    "interact.html",
    "intro.html",
    "java.html",
    "linking.html",
    "masking.html",
    "metadata.html",
    "mimereg.html",
    "minimize.html",
    "painting.html",
    "paths.html",
    "propidx.html",
    "pservers.html",
    "refs.html",
    "render.html",
    "script.html",
    "shapes.html",
    "struct.html",
    "styling.html",
    "svgdom.html",
    "svgdtd.html",
    "text.html",
    "types.html",
  ].forEach((filename) => processSpecURL(baseURL + filename, null, 0));
};

const processSpecMap = (key, data) => {
  if (data && data.length > 0) {
    console.log(data);
    const specURL = key;
    const specJSONfile = data;
    if (stableSpecs.includes(specURL)) {
      otherSpecs.push(specJSONfile);
      return data;
    }
    if ("html.json" === data) {
      processSpecURL(
        "https://html.spec.whatwg.org/multipage/browsers.html",
        "html.json",
        0
      );
      processSpecURL(
        "https://html.spec.whatwg.org/multipage/browsing-the-web.html",
        "html.json",
        0
      );
      processSpecURL(
        "https://html.spec.whatwg.org/multipage/canvas.html",
        "html.json",
        0
      );
      processSpecURL(
        "https://html.spec.whatwg.org/multipage/common-dom-interfaces.html",
        "html.json",
        0
      );
      processSpecURL(
        "https://html.spec.whatwg.org/multipage/comms.html",
        "html.json",
        0
      );
      processSpecURL(
        "https://html.spec.whatwg.org/multipage/custom-elements.html",
        "html.json",
        0
      );
      processSpecURL(
        "https://html.spec.whatwg.org/multipage/dnd.html",
        "html.json",
        0
      );
      processSpecURL(
        "https://html.spec.whatwg.org/multipage/dom.html",
        "html.json",
        0
      );
      processSpecURL(
        "https://html.spec.whatwg.org/multipage/dynamic-markup-insertion.html",
        "html.json",
        0
      );
      processSpecURL(
        "https://html.spec.whatwg.org/multipage/edits.html",
        "html.json",
        0
      );
      processSpecURL(
        "https://html.spec.whatwg.org/multipage/embedded-content-other.html",
        "html.json",
        0
      );
      processSpecURL(
        "https://html.spec.whatwg.org/multipage/embedded-content.html",
        "html.json",
        0
      );
      processSpecURL(
        "https://html.spec.whatwg.org/multipage/form-control-infrastructure.html",
        "html.json",
        0
      );
      processSpecURL(
        "https://html.spec.whatwg.org/multipage/form-elements.html",
        "html.json",
        0
      );
      processSpecURL(
        "https://html.spec.whatwg.org/multipage/forms.html",
        "html.json",
        0
      );
      processSpecURL(
        "https://html.spec.whatwg.org/multipage/grouping-content.html",
        "html.json",
        0
      );
      processSpecURL(
        "https://html.spec.whatwg.org/multipage/history.html",
        "html.json",
        0
      );
      processSpecURL(
        "https://html.spec.whatwg.org/multipage/iframe-embed-object.html",
        "html.json",
        0
      );
      processSpecURL(
        "https://html.spec.whatwg.org/multipage/image-maps.html",
        "html.json",
        0
      );
      processSpecURL(
        "https://html.spec.whatwg.org/multipage/imagebitmap-and-animations.html",
        "html.json",
        0
      );
      processSpecURL(
        "https://html.spec.whatwg.org/multipage/indices.html",
        "html.json",
        0
      );
      processSpecURL(
        "https://html.spec.whatwg.org/multipage/infrastructure.html",
        "html.json",
        0
      );
      processSpecURL(
        "https://html.spec.whatwg.org/multipage/input.html",
        "html.json",
        0
      );
      processSpecURL(
        "https://html.spec.whatwg.org/multipage/interaction.html",
        "html.json",
        0
      );
      processSpecURL(
        "https://html.spec.whatwg.org/multipage/interactive-elements.html",
        "html.json",
        0
      );
      processSpecURL(
        "https://html.spec.whatwg.org/multipage/links.html",
        "html.json",
        0
      );
      processSpecURL(
        "https://html.spec.whatwg.org/multipage/media.html",
        "html.json",
        0
      );
      processSpecURL(
        "https://html.spec.whatwg.org/multipage/microdata.html",
        "html.json",
        0
      );
      processSpecURL(
        "https://html.spec.whatwg.org/multipage/obsolete.html",
        "html.json",
        0
      );
      processSpecURL(
        "https://html.spec.whatwg.org/multipage/origin.html",
        "html.json",
        0
      );
      processSpecURL(
        "https://html.spec.whatwg.org/multipage/parsing.html",
        "html.json",
        0
      );
      processSpecURL(
        "https://html.spec.whatwg.org/multipage/rendering.html",
        "html.json",
        0
      );
      processSpecURL(
        "https://html.spec.whatwg.org/multipage/scripting.html",
        "html.json",
        0
      );
      processSpecURL(
        "https://html.spec.whatwg.org/multipage/sections.html",
        "html.json",
        0
      );
      processSpecURL(
        "https://html.spec.whatwg.org/multipage/semantics-other.html",
        "html.json",
        0
      );
      processSpecURL(
        "https://html.spec.whatwg.org/multipage/semantics.html",
        "html.json",
        0
      );
      processSpecURL(
        "https://html.spec.whatwg.org/multipage/server-sent-events.html",
        "html.json",
        0
      );
      processSpecURL(
        "https://html.spec.whatwg.org/multipage/structured-data.html",
        "html.json",
        0
      );
      processSpecURL(
        "https://html.spec.whatwg.org/multipage/system-state.html",
        "html.json",
        0
      );
      processSpecURL(
        "https://html.spec.whatwg.org/multipage/tables.html",
        "html.json",
        0
      );
      processSpecURL(
        "https://html.spec.whatwg.org/multipage/text-level-semantics.html",
        "html.json",
        0
      );
      processSpecURL(
        "https://html.spec.whatwg.org/multipage/timers-and-user-prompts.html",
        "html.json",
        0
      );
      processSpecURL(
        "https://html.spec.whatwg.org/multipage/urls-and-fetching.html",
        "html.json",
        0
      );
      processSpecURL(
        "https://html.spec.whatwg.org/multipage/web-messaging.html",
        "html.json",
        0
      );
      processSpecURL(
        "https://html.spec.whatwg.org/multipage/web-sockets.html",
        "html.json",
        0
      );
      processSpecURL(
        "https://html.spec.whatwg.org/multipage/webappapis.html",
        "html.json",
        0
      );
      processSpecURL(
        "https://html.spec.whatwg.org/multipage/webstorage.html",
        "html.json",
        0
      );
      processSpecURL(
        "https://html.spec.whatwg.org/multipage/window-object.html",
        "html.json",
        0
      );
      processSpecURL(
        "https://html.spec.whatwg.org/multipage/workers.html",
        "html.json",
        0
      );
      processSpecURL(
        "https://html.spec.whatwg.org/multipage/worklets.html",
        "html.json",
        0
      );
      return data;
    }
    if ("ecmascript.json" === data) {
      processSpecURL(
        "https://tc39.es/ecma262/multipage/index.html",
        "ecmascript.json",
        0
      );
      processSpecURL(
        "https://tc39.es/ecma262/multipage/scope.html",
        "ecmascript.json",
        0
      );
      processSpecURL(
        "https://tc39.es/ecma262/multipage/conformance.html",
        "ecmascript.json",
        0
      );
      processSpecURL(
        "https://tc39.es/ecma262/multipage/normative-references.html",
        "ecmascript.json",
        0
      );
      processSpecURL(
        "https://tc39.es/ecma262/multipage/overview.html",
        "ecmascript.json",
        0
      );
      processSpecURL(
        "https://tc39.es/ecma262/multipage/notational-conventions.html",
        "ecmascript.json",
        0
      );
      processSpecURL(
        "https://tc39.es/ecma262/multipage/ecmascript-data-types-and-values.html",
        "ecmascript.json",
        0
      );
      processSpecURL(
        "https://tc39.es/ecma262/multipage/abstract-operations.html",
        "ecmascript.json",
        0
      );
      processSpecURL(
        "https://tc39.es/ecma262/multipage/syntax-directed-operations.html",
        "ecmascript.json",
        0
      );
      processSpecURL(
        "https://tc39.es/ecma262/multipage/executable-code-and-execution-contexts.html",
        "ecmascript.json",
        0
      );
      processSpecURL(
        "https://tc39.es/ecma262/multipage/ordinary-and-exotic-objects-behaviours.html",
        "ecmascript.json",
        0
      );
      processSpecURL(
        "https://tc39.es/ecma262/multipage/ecmascript-language-source-code.html",
        "ecmascript.json",
        0
      );
      processSpecURL(
        "https://tc39.es/ecma262/multipage/ecmascript-language-lexical-grammar.html",
        "ecmascript.json",
        0
      );
      processSpecURL(
        "https://tc39.es/ecma262/multipage/ecmascript-language-expressions.html",
        "ecmascript.json",
        0
      );
      processSpecURL(
        "https://tc39.es/ecma262/multipage/ecmascript-language-statements-and-declarations.html",
        "ecmascript.json",
        0
      );
      processSpecURL(
        "https://tc39.es/ecma262/multipage/ecmascript-language-functions-and-classes.html",
        "ecmascript.json",
        0
      );
      processSpecURL(
        "https://tc39.es/ecma262/multipage/ecmascript-language-scripts-and-modules.html",
        "ecmascript.json",
        0
      );
      processSpecURL(
        "https://tc39.es/ecma262/multipage/error-handling-and-language-extensions.html",
        "ecmascript.json",
        0
      );
      processSpecURL(
        "https://tc39.es/ecma262/multipage/ecmascript-standard-built-in-objects.html",
        "ecmascript.json",
        0
      );
      processSpecURL(
        "https://tc39.es/ecma262/multipage/global-object.html",
        "ecmascript.json",
        0
      );
      processSpecURL(
        "https://tc39.es/ecma262/multipage/fundamental-objects.html",
        "ecmascript.json",
        0
      );
      processSpecURL(
        "https://tc39.es/ecma262/multipage/numbers-and-dates.html",
        "ecmascript.json",
        0
      );
      processSpecURL(
        "https://tc39.es/ecma262/multipage/text-processing.html",
        "ecmascript.json",
        0
      );
      processSpecURL(
        "https://tc39.es/ecma262/multipage/indexed-collections.html",
        "ecmascript.json",
        0
      );
      processSpecURL(
        "https://tc39.es/ecma262/multipage/keyed-collections.html",
        "ecmascript.json",
        0
      );
      processSpecURL(
        "https://tc39.es/ecma262/multipage/structured-data.html",
        "ecmascript.json",
        0
      );
      processSpecURL(
        "https://tc39.es/ecma262/multipage/managing-memory.html",
        "ecmascript.json",
        0
      );
      processSpecURL(
        "https://tc39.es/ecma262/multipage/control-abstraction-objects.html",
        "ecmascript.json",
        0
      );
      processSpecURL(
        "https://tc39.es/ecma262/multipage/reflection.html",
        "ecmascript.json",
        0
      );
      processSpecURL(
        "https://tc39.es/ecma262/multipage/memory-model.html",
        "ecmascript.json",
        0
      );
      processSpecURL(
        "https://tc39.es/ecma262/multipage/grammar-summary.html",
        "ecmascript.json",
        0
      );
      processSpecURL(
        "https://tc39.es/ecma262/multipage/additional-ecmascript-features-for-web-browsers.html",
        "ecmascript.json",
        0
      );
      processSpecURL(
        "https://tc39.es/ecma262/multipage/strict-mode-of-ecmascript.html",
        "ecmascript.json",
        0
      );
      processSpecURL(
        "https://tc39.es/ecma262/multipage/host-layering-points.html",
        "ecmascript.json",
        0
      );
      processSpecURL(
        "https://tc39.es/ecma262/multipage/corrections-and-clarifications-in-ecmascript-2015-with-possible-compatibility-impact.html",
        "ecmascript.json",
        0
      );
      processSpecURL(
        "https://tc39.es/ecma262/multipage/additions-and-changes-that-introduce-incompatibilities-with-prior-editions.html",
        "ecmascript.json",
        0
      );
      processSpecURL(
        "https://tc39.es/ecma262/multipage/colophon.html",
        "ecmascript.json",
        0
      );
      processSpecURL(
        "https://tc39.es/ecma262/multipage/bibliography.html",
        "ecmascript.json",
        0
      );
      processSpecURL(
        "https://tc39.es/ecma262/multipage/copyright-and-software-license.html",
        "ecmascript.json",
        0
      );
      return data;
    }
    if (specURL === "https://svgwg.org/svg2-draft/") {
      otherSpecs.push("svg-2.json");
      processSVG2files(specURL);
      return data;
    }
    if ("proposal-hashbang.json" === data) {
      processSpecURL("https://tc39.es/proposal-hashbang/out.html");
      return data;
    }
    processSpecURL(specURL, specJSONfile, 0);
  }
  return data;
};

JSON.parse(specMap, processSpecMap);
const staticSpecURLs = JSON.parse(
  readFileSync(".spec-urls-stable.json", "utf-8").trim()
);
allURLs = allURLs.concat(staticSpecURLs);
allURLs = [...new Set(allURLs)];
allURLs.sort();
writeFileSync(allURLsFile, JSON.stringify(allURLs, null, 4) + "\n", "utf-8");
bikeshedSpecs.sort();
writeFileSync(bikeshedSpecsFile, bikeshedSpecs.join("\n"), "utf-8");
respecSpecs.sort();
writeFileSync(respecSpecsFile, respecSpecs.join("\n"), "utf-8");
otherSpecs.sort();
writeFileSync(otherSpecsFile, otherSpecs.join("\n"), "utf-8");

export default { processSpecURL };
