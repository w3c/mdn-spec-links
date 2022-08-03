#!/usr/bin/env node
/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";
import chalk from "chalk";
import {
  readFileSync,
  existsSync,
  statSync,
  readdirSync,
  writeFileSync,
} from "fs";
import request from "sync-request";
import { dirname, basename, resolve, extname, join } from "path";
import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const log = (msg) => console.log(`${msg}`);
const note = (msg) => console.log(chalk`{cyanBright     ${msg}}`);
const warn = (msg) => console.warn(chalk`{yellowBright     ${msg}}`);
const error = (msg) => console.error(chalk`{redBright     ${msg}}`);
const success = (msg) => console.log(chalk`{greenBright     ${msg}}`);

let mdnOrigin = "http://localhost:5042";
if (process.env.MDN_ORIGIN) {
  mdnOrigin = process.env.MDN_ORIGIN;
}

log("loading SPECMAP.json...");
const SPECMAP = JSON.parse(readFileSync("SPECMAP.json", "utf-8"));
log("loading SPECURLS.json...");
const SPECURLS = JSON.parse(readFileSync("SPECURLS.json", "utf-8"));
const options = {
  headers: { "User-Agent": "bcd-migration-script" },
  gzip: true,
};
const response = request(
  "GET",
  "https://raw.githubusercontent.com/Fyrd/caniuse/master/data.json",
  options
);
const specs = Object.create(null);

let bcdJSONfilename = "";
let targetJSONfile = "";

chalk.level = 3;

const CANIUSE_SPECMAP = {};

const fixCanIUseSpecURLs = (key, data) => {
  const isObsolete = (url) => {
    const obsoleteBase = [
      "dev.w3.org/html5/spec",
      "dev.w3.org/2006/webapi/selectors-api2",
      "dvcs.w3.org/hg/domcore",
      "immersive-web.github.io/webvr/spec/1.1/",
      "www.ecma-international.org/",
      "www.w3.org/TR/cssom-1",
      "www.w3.org/TR/CSS1/",
      "www.w3.org/TR/REC-DOM-Level-1/",
      "www.w3.org/TR/DOM-Level-2-",
      "www.w3.org/TR/DOM-Level-3-Core/",
      "www.w3.org/TR/DOM-Level-3-Events/",
      "www.w3.org/TR/2000/REC-DOM-Level-2",
      "www.w3.org/TR/2009/REC-DOM-Level-2",
      "www.w3.org/TR/2014/WD-DOM-Level-3-Events-20140925/",
      "www.w3.org/TR/ElementTraversal/",
      "www.w3.org/TR/mixed-content/",
      "www.w3.org/TR/selectors-api/",
      "www.w3.org/TR/dom/",
      "www.w3.org/TR/WD-font",
      "www.w3.org/TR/html5",
      "www.w3.org/TR/2011/WD-html5-20110525",
      "www.w3.org/TR/2016/REC-html51-20161101",
      "www.w3.org/TR/MathML2",
      "www.w3.org/TR/resource-hints",
      "www.w3.org/TR/pointerevents1",
      "www.w3.org/TR/xml/",
      "w3c.github.io/editing/",
      "w3c.github.io/webcomponents/spec/shadow/",
      "w3c.github.io/staticrange/",
      "w3c.github.io/microdata/",
      "wiki.csswg.org",
    ];
    const obsoleteSubstrings = [
      "html40",
      "performancetiming",
      "performancenavigation",
      "/screen-orientation/published/",
      "developer.apple.com/library/safari",
    ];
    return (
      obsoleteBase.some((substring) => url.startsWith(substring)) ||
      obsoleteSubstrings.some((substring) => url.includes(substring))
    );
  };
  const getAdjustedSpecURL = (url) => {
    const urlAdjustmentMap = {
      // specBaseURL,
      //   [target, replacement]
      "https://tools.ietf.org/html/": [
        "tools.ietf.org",
        "datatracker.ietf.org/doc",
      ],
      "https://drafts.csswg.org/mediaqueries/#media0": ["media0", "media"],
      "https://drafts.csswg.org/css-conditional/#at-supports-ext": [
        "at-supports-ext",
        "at-supports",
      ],
      "https://drafts.csswg.org/web-animations-1/": [
        "web-animations-1",
        "web-animations",
      ],
      "https://drafts.csswg.org/css-color-3/#transparency": [
        "css-color-3",
        "css-color",
      ],
      "https://drafts.csswg.org/selectors/#gen-content": [
        "selectors",
        "selectors-3",
      ],
      "https://drafts.csswg.org/selectors/#first-letter": [
        "selectors",
        "selectors-3",
      ],
      "https://drafts.csswg.org/selectors/#first-line": [
        "selectors",
        "selectors-3",
      ],
      "https://drafts.csswg.org/selectors/#the-user-action-pseudo-classes-hover-act":
        ["selectors", "selectors-3"],
      "https://drafts.csswg.org/css-text-decor/#text-decoration-skip-ink-property":
        ["css-text-decor", "css-text-decor-4"],
      "https://drafts.csswg.org/css-text-decor/#text-decoration-skipping": [
        "css-text-decor",
        "css-text-decor-4",
      ],
      "https://drafts.csswg.org/css-text-decor/#text-decoration-width-property":
        ["css-text-decor", "css-text-decor-4"],
      "https://drafts.csswg.org/css-text-decor/#underline-offset": [
        "css-text-decor",
        "css-text-decor-4",
      ],
      "https://drafts.csswg.org/selectors/#target-pseudo": [
        "target-pseudo",
        "the-target-pseudo",
      ],
      "https://drafts.csswg.org/selectors/#last-child-pseudo": [
        "last-child-pseudo",
        "the-last-child-pseudo",
      ],
      "https://drafts.csswg.org/selectors/#empty-pseudo": [
        "empty-pseudo",
        "the-empty-pseudo",
      ],
      "https://drafts.csswg.org/selectors/#universal-selector": [
        "universal-selector",
        "the-universal-selector",
      ],
      "https://www.ecma-international.org/ecma-402/2.0/": [
        "https://www.ecma-international.org/ecma-402/2.0/",
        "https://tc39.es/ecma402/",
      ],
      "https://w3c.github.io/webappsec-csp/2/": [
        "https://w3c.github.io/webappsec-csp/2/",
        "https://www.w3.org/TR/CSP2/",
      ],
      "https://wicg.github.io/web-share/level-2/": ["wicg", "w3c"],
      "https://wicg.github.io/web-share/": ["wicg", "w3c"],
      "https://w3c.github.io/speech-api/speechapi.html": [
        "https://w3c.github.io/speech-api/speechapi.html",
        "https://wicg.github.io/speech-api/",
      ],
      "https://w3c.github.io/speech-api/": ["w3c", "wicg"],
      "https://w3c.github.io/keyboard-lock/": ["w3c", "wicg"],
      "https://w3c.github.io/netinfo/": ["w3c", "wicg"],
      "https://wicg.github.io/mediasession/": ["wicg", "w3c"],
      "https://wicg.github.io/media-playback-quality/": ["wicg", "w3c"],
      "https://wicg.github.io/media-capabilities/": ["wicg", "w3c"],
      "http://www.w3.org/TR/DOM-Level-3-XPath/": [
        "http://www.w3.org",
        "https://www.w3.org",
      ],
      "https://www.w3.org/TR/CSS21/": ["CSS21", "CSS2"],
      "https://www.w3.org/TR/uievents/": [
        "https://www.w3.org/TR/uievents/",
        "https://w3c.github.io/uievents/",
      ],
      "https://www.w3.org/TR/accelerometer/": [
        "https://www.w3.org/TR/accelerometer/",
        "https://w3c.github.io/accelerometer/",
      ],
      "https://www.w3.org/TR/WebCryptoAPI/": [
        "https://www.w3.org/TR/WebCryptoAPI/",
        "https://w3c.github.io/webcrypto/",
      ],
      "https://www.w3.org/TR/orientation-sensor/": [
        "https://www.w3.org/TR/orientation-sensor/",
        "https://w3c.github.io/orientation-sensor/",
      ],
      "https://www.w3.org/TR/DOM-Parsing/": [
        "https://www.w3.org/TR/DOM-Parsing/",
        "https://w3c.github.io/DOM-Parsing/",
      ],
      "https://www.w3.org/TR/FileAPI/": [
        "https://www.w3.org/TR/FileAPI/",
        "https://w3c.github.io/FileAPI/",
      ],
      "https://www.w3.org/TR/SVG/": [
        "https://www.w3.org/TR/SVG/",
        "https://www.w3.org/TR/SVG11/",
      ],
      "https://www.w3.org/TR/SVG2/": [
        "https://www.w3.org/TR/SVG2/",
        "https://svgwg.org/svg2-draft/",
      ],
      "http://w3.org/TR/css3-fonts/": [
        "http://w3.org/TR/css3-fonts/",
        "https://drafts.csswg.org/css-fonts-3/",
      ],
      "https://www.w3.org/TR/css4-images/": [
        "https://www.w3.org/TR/css4-images/",
        "https://drafts.csswg.org/css-images-4/",
      ],
      "https://www.w3.org/TR/mediaqueries-4/": [
        "https://www.w3.org/TR/mediaqueries-4/",
        "https://drafts.csswg.org/mediaqueries-4/",
      ],
      "https://www.w3.org/TR/pointerevents/": [
        "https://www.w3.org/TR/pointerevents/",
        "https://w3c.github.io/pointerevents/",
      ],
      "https://www.w3.org/TR/cssom/": [
        "https://www.w3.org/TR/cssom/",
        "https://drafts.csswg.org/cssom/",
      ],
      "https://www.w3.org/TR/css-variables-1/": [
        "https://www.w3.org/TR/css-variables-1/",
        "https://drafts.csswg.org/css-variables/",
      ],
      "https://www.w3.org/TR/cssom-view": [
        "https://www.w3.org/TR/cssom-view",
        "https://drafts.csswg.org/cssom-view",
      ],
      "http://w3.org/TR/css-fonts/": [
        "http://w3.org/TR/css3-fonts/",
        "https://drafts.csswg.org/css-fonts-3/",
      ],
      "http://drafts.csswg.org/css-scoping/": [
        "http://drafts.csswg",
        "https://drafts.csswg",
      ],
      "https://www.w3.org/TR/compositing-1/": [
        "https://www.w3.org/TR/compositing-1/",
        "https://drafts.fxtf.org/compositing-1/",
      ],
      "https://www.w3.org/TR/filter-effects/": [
        "https://www.w3.org/TR/filter-effects/",
        "https://drafts.fxtf.org/filter-effects/",
      ],
      "https://www.w3.org/TR/css-masking-1/": [
        "https://www.w3.org/TR/css-masking-1/",
        "https://drafts.fxtf.org/css-masking-1/",
      ],
      "https://drafts.csswg.org/css-timing-1/": ["timing", "easing"],
      "https://drafts.csswg.org/css-logical-props/": [
        "/css-logical-props/",
        "/css-logical/",
      ],
      "https://tc39.github.io/": [
        "https://tc39.github.io/",
        "https://tc39.es/",
      ],
      "https://www.w3.org/TR/xpath-20/": ["/TR/xpath-20/", "/TR/xpath20/"],
      "https://w3c.github.io/input-events/index.html": [
        "/input-events/index.html",
        "/input-events/",
      ],
      "https://tc39.es/proposal-array-find-from-last/index.html": [
        "/proposal-array-find-from-last/index.html",
        "/proposal-array-find-from-last/",
      ],
      "https://w3c.github.io/webappsec-csp/embedded/": [
        "/webappsec-csp/embedded/",
        "/webappsec-cspee/",
      ],
      "https://wicg.github.io/media-capabilities#": [
        "/media-capabilities#",
        "/media-capabilities/#",
      ],
      "https://w3c.github.io/keyboard-lock#": [
        "/keyboard-lock#",
        "/keyboard-lock/#",
      ],
      "https://dev.w3.org/geo/api/spec-source.html": [
        "https://dev.w3.org/geo/api/spec-source.html",
        "https://w3c.github.io/geolocation-api/",
      ],
      "https://w3c.github.io/dnt/drafts/tracking-dnt.html": [
        "https://w3c.github.io/dnt/drafts/tracking-dnt.html",
        "https://www.w3.org/TR/tracking-dnt/",
      ],
      "https://www.w3.org/TR/css-": [
        "https://www.w3.org/TR/css-",
        "https://drafts.csswg.org/css-",
      ],
      "https://w3c.github.io/hr-time/#sec-DOMHighResTimeStamp": [
        "#sec-DOMHighResTimeStamp",
        "#dom-domhighrestimestamp",
      ],
      "https://www.w3.org/TR/hr-time-1/": [
        "https://www.w3.org/TR/hr-time-1/hr-time-1",
        "hr-time",
      ],
      "https://w3c.github.io/hr-time/#performance": [
        "#performance",
        "#sec-performance",
      ],
      "https://w3c.github.io/webcrypto/#dfn-Crypto": [
        "#dfn-Crypto",
        "#crypto-interface",
      ],
      "https://w3c.github.io/webcrypto/#crypto-interface-attribute-subtle": [
        "#crypto-interface-attribute-subtle",
        "#Crypto-attribute-subtle",
      ],
      "https://w3c.github.io/webcrypto/#dfn-GlobalCrypto": [
        "#dfn-GlobalCrypto",
        "#crypto-interface",
      ],
      "https://w3c.github.io/webcrypto/#crypto-interfaceKey": [
        "#crypto-interfaceKey",
        "#cryptokey-interface",
      ],
      "https://w3c.github.io/webcrypto/#crypto-interfaceKeyPair": [
        "#crypto-interfaceKeyPair",
        "#keypair",
      ],
    };
    if (url.endsWith("#dom-csspropertyrule")) {
      return url.replace(
        "#dom-csspropertyrule",
        "#the-css-property-rule-interface"
      );
    }
    if (url.endsWith("#dom-csstransformvalue")) {
      return url.replace("#dom-csstransformvalue", "#transformvalue-objects");
    }
    if (url.includes("spec.whatwg.org#")) {
      return url.replace("spec.whatwg.org#", "spec.whatwg.org/#");
    }
    if (url.includes("/deviceorientation/spec-source-orientation.html")) {
      return url.slice(0, -28);
    }
    if (url.startsWith("https://w3c.github.io/touch-events/#widl-")) {
      return url
        .replace(/widl-([^-]+-.+)/, function ($0, $1) {
          return $0.replace($1, $1.toLowerCase());
        })
        .replace("widl", "dom");
    }
    if (url.includes("#dom-touchlist-item-getter-touch-unsigned-long-index")) {
      return url.replace(
        "#dom-touchlist-item-getter-touch-unsigned-long-index",
        "#dom-touchlist-item"
      );
    }
    if (
      url.startsWith(
        "https://encoding.spec.whatwg.org/#interface-TextDecoderStream"
      )
    ) {
      return url.replace(
        "#interface-TextDecoderStream",
        "#interface-textdecoderstream"
      );
    }
    if (
      url.startsWith(
        "https://drafts.css-houdini.org/css-properties-values-api/#the-css-property-rule-interface-inherits"
      )
    ) {
      return url.replace(
        "#the-css-property-rule-interface-inherits",
        "#dom-csspropertyrule-inherits"
      );
    }
    if (
      url.startsWith(
        "https://drafts.css-houdini.org/css-properties-values-api/#the-css-property-rule-interface-initialvalue"
      )
    ) {
      return url.replace(
        "#the-css-property-rule-interface-initialvalue",
        "#dom-csspropertyrule-initialvalue"
      );
    }
    if (
      url.startsWith(
        "https://drafts.css-houdini.org/css-properties-values-api/#the-css-property-rule-interface-syntax"
      )
    ) {
      return url.replace(
        "#the-css-property-rule-interface-syntax",
        "#dom-csspropertyrule-syntax"
      );
    }
    if (
      url.startsWith(
        "https://drafts.css-houdini.org/css-properties-values-api/#the-css-property-rule-interface-name"
      )
    ) {
      return url.replace(
        "#the-css-property-rule-interface-name",
        "#dom-csspropertyrule-name"
      );
    }
    if (
      url.startsWith(
        "https://drafts.css-houdini.org/css-typed-om/#transformvalue-objects-is2d"
      )
    ) {
      return url.replace(
        "#transformvalue-objects-is2d",
        "#dom-csstransformvalue-is2d"
      );
    }
    if (
      url.startsWith(
        "https://drafts.css-houdini.org/css-typed-om/#transformvalue-objects-length"
      )
    ) {
      return url.replace(
        "#transformvalue-objects-length",
        "#dom-csstransformvalue-length"
      );
    }
    if (
      url.startsWith(
        "https://drafts.css-houdini.org/css-typed-om/#transformvalue-objects-tomatrix"
      )
    ) {
      return url.replace(
        "#transformvalue-objects-tomatrix",
        "#dom-csstransformvalue-tomatrix"
      );
    }
    if (
      url.startsWith(
        "https://w3c.github.io/page-visibility/#dfn-visibilitychange"
      )
    ) {
      return url.replace(
        "#dfn-visibilitychange",
        "#reacting-to-visibilitychange"
      );
    }
    if (
      url.startsWith(
        "https://w3c.github.io/page-visibility/#visibility-states-and-the-visibilitystate-enum"
      )
    ) {
      return url.replace(
        "#visibility-states-and-the-visibilitystate-enum",
        "#visibilitystate-attribute"
      );
    }
    if (
      url.startsWith(
        "https://html.spec.whatwg.org/multipage/#dom-documentorshadowroot-fullscreenelement"
      )
    ) {
      return url.replace(
        "https://html.spec.whatwg.org/multipage/#dom-documentorshadowroot-fullscreenelement",
        "https://fullscreen.spec.whatwg.org/#dom-document-fullscreenelement"
      );
    }
    if (url.startsWith("https://www.w3.org/TR/css3-background/")) {
      return url.replace(
        "https://www.w3.org/TR/css3-background/",
        "https://drafts.csswg.org/css-backgrounds-3/"
      );
    }
    if (url.startsWith("https://www.w3.org/TR/css3-mediaqueries/")) {
      return url.replace(
        "https://www.w3.org/TR/css3-mediaqueries/",
        "https://drafts.csswg.org/mediaqueries-3/"
      );
    }
    if (url.startsWith("https://www.w3.org/TR/css3-selectors/")) {
      return url.replace(
        "https://www.w3.org/TR/css3-selectors/",
        "https://drafts.csswg.org/selectors-3/"
      );
    }
    if (url.startsWith("https://www.w3.org/TR/css3-")) {
      return url.replace(
        /https:\/\/www.w3.org\/TR\/css3-([^/]+)\//,
        "https://drafts.csswg.org/css-$1-3/"
      );
    }
    if (url.startsWith("https://www.w3.org/TR/selectors")) {
      return url.replace(
        /https:\/\/www.w3.org\/TR\/selectors(-)?4\//,
        "https://drafts.csswg.org/selectors-4/"
      );
    }
    if (url.includes("://www.ecma-international.org/ecma-262/")) {
      return url.replace(
        /http(s)?:\/\/www.ecma-international.org\/ecma-262\/[568]\.[01]\/(index.html)?/,
        "https://tc39.es/ecma262/"
      );
    }
    for (const specBaseURL in urlAdjustmentMap) {
      if (url.startsWith(specBaseURL)) {
        const [target, replacement] = urlAdjustmentMap[specBaseURL];
        return url.replace(target, replacement);
      }
    }
    return url;
  };
  const isBrokenSpecURL = (url, parsedURL, SPECURLS) => {
    if (url.startsWith("https://html.spec.whatwg.org/multipage/")) {
      url = "https://html.spec.whatwg.org/" + parsedURL.hash;
    }
    if (url.startsWith("https://html.spec.whatwg.org/dev/")) {
      url = "https://html.spec.whatwg.org/" + parsedURL.hash;
    }
    if (url.startsWith("https://www.rfc-editor.org/rfc/rfc2324")) {
      // "I'm a teapot" RFC; ignore
      return false;
    }
    if (url.startsWith("https://www.rfc-editor.org/rfc/rfc7168")) {
      // "I'm a teapot" RFC; ignore
      return false;
    }
    return !SPECURLS.includes(url);
  };
  if (data && data instanceof Object && "spec" in data) {
    let specURL = getAdjustedSpecURL(data.spec);
    if (specURL.startsWith("https://developer.apple.com/")) {
      return data;
    }
    specURL = specURL
      .replace(
        "https://www.w3.org/TR/DOM-Level-3-XPath/xpath.html#XPathEvaluator-evaluate",
        "https://dom.spec.whatwg.org/#interface-xpathevaluator"
      )
      .replace(/TR\/CSS2\/[^#]+#/, "")
      .replace("css-ui-4", "css-ui")
      .replace("css-align-3", "css-align")
      .replace("css-backgrounds-3", "css-backgrounds")
      .replace("css-break-3", "css-break")
      .replace("css-cascade-3", "css-cascade")
      .replace("css-cascade-4", "css-cascade")
      .replace("css-color-3", "css-color")
      .replace("css-color-4", "css-color")
      .replace("css-color/#currentcolor", "css-color/#currentcolor-color")
      .replace("css-color-adjust-1", "css-color-adjust")
      .replace("css-conditional-3", "css-conditional")
      .replace("css-display-3", "css-display")
      .replace("css-env-1", "css-env")
      .replace("css-fonts-3", "css-fonts")
      .replace("css-fonts-4", "css-fonts")
      .replace("css-grid-2", "css-grid")
      .replace("css-images-3", "css-images")
      .replace("mediaqueries-4", "mediaqueries")
      .replace("css-overflow-3", "css-overflow")
      .replace("css-pseudo-4", "css-pseudo")
      .replace("css-text-3", "css-text")
      .replace("css-text-decor-3", "css-text-decor")
      .replace("css-ui-3", "css-ui")
      .replace("css-values-3", "css-values")
      .replace("css-values-4", "css-values")
      .replace("css-writing-modes-3", "css-writing-modes")
      .replace("cssom-view-1", "cssom-view")
      .replace("mediaqueries-3", "mediaqueries")
      .replace("/selectors-3/", "/selectors/")
      .replace("/selectors-4/", "/selectors/")
      .replace("compositing-1", "compositing")
      .replace("css-masking-1", "css-masking")
      .replace("www.w3.org/TR/clipboard-apis", "w3c.github.io/clipboard-apis")
      .replace(
        "w3.org/TR/css3-fonts/#font-rend-props",
        "drafts.csswg.org/css-fonts/#font-rend-props"
      )
      .replace(
        "#widl-Element-insertAdjacentHTML-void-DOMString-position-DOMString-text",
        "#dom-element-insertadjacenthtml"
      )
      .replace("#image-orientation", "#the-image-orientation")
      .replace(
        "css-color-4/#color-adjust",
        "css-color-adjust-1/#propdef-color-adjust"
      )
      .replace(
        "css-fonts-3/#propdef-font-variant-alternates",
        "css-fonts-4/#propdef-font-variant-alternates"
      )
      .replace(
        "css-images-3/#cross-fade-function",
        "css-images-4/#cross-fade-function"
      )
      .replace(
        "css-lists-3/#marker-pseudo-element",
        "css-pseudo-4/#marker-pseudo"
      )
      .replace(
        "css-contain-1/#contain-property",
        "css-contain/#contain-property"
      )
      .replace(
        "css-contain-2/#content-visibility",
        "css-contain/#content-visibility"
      )
      .replace("selectors/#first-letter", "css-pseudo/#first-letter-pseudo")
      .replace("selectors/#first-line", "css-pseudo/#first-line-pseudo")
      .replace(
        "proposal-flatMap/#sec-Array.prototype.flat",
        "ecma262/#sec-array.prototype.flat"
      )
      .replace(
        "#sec-Date.prototype.toLocaleDateString",
        "#sup-date.prototype.tolocaledatestring"
      )
      .replace(
        "#RandomSource-method-getRandomValues",
        "#Crypto-method-getRandomValues"
      )
      .replace("#widl-KeyboardEvent-charCode", "#dom-keyboardevent-charcode")
      .replace("#widl-KeyboardEvent-code", "#dom-keyboardevent-code")
      .replace(
        "#widl-KeyboardEvent-getModifierState",
        "#dom-keyboardevent-getmodifierstate"
      )
      .replace("#widl-KeyboardEvent-location", "#dom-keyboardevent-location")
      .replace("#widl-KeyboardEvent-which", "#dom-uievent-which")
      .replace(
        "#unhandled-promise-rejections:event-unhandledrejection",
        "#unhandled-promise-rejections"
      )
      .replace(
        "https://www.w3.org/TR/SVG11/extend.html#ForeignObjectElement",
        "https://svgwg.org/svg2-draft/embedded.html#ForeignObjectElement"
      )
      .replace(
        "https://www.w3.org/TR/SVG11/linking.html#SVGFragmentIdentifiers",
        "https://svgwg.org/svg2-draft/linking.html#SVGFragmentIdentifiers"
      );
    specURL = specURL
      .replace(
        "ecma262/#sec-14.1",
        "ecma262/#sec-directive-prologues-and-the-use-strict-directive"
      )
      .replace("ecma262/#sec-15.12", "ecma262/#sec-json-object")
      .replace("ecma262/#sec-15.12", "ecma262/#sec-json-object")
      .replace(
        "ecma402/#sec-13.1.1",
        "ecma402/#sup-String.prototype.localeCompare"
      );
    if (specURL.endsWith("ecma262/#")) {
      specURL = "https://tc39.es/ecma262/#sec-generator-function-definitions";
    }
    const parsedURL = new URL(specURL);
    if (!parsedURL.hash) {
      return data;
    }
    if (
      !specURL.startsWith("https://html.spec.whatwg.org/") &&
      !specURL.startsWith("https://tc39.es/ecma262/")
    ) {
      const base = parsedURL.host + parsedURL.pathname;
      if (isObsolete(base)) {
        return data;
      }
      if (isBrokenSpecURL(specURL, parsedURL, SPECURLS)) {
        warn(`bad caniuse spec URL ${specURL}`);
        return data;
      }
    }
    note("caniuse spec URL: " + specURL);
    CANIUSE_SPECMAP[specURL] = {};
    CANIUSE_SPECMAP[specURL].feature = key;
    CANIUSE_SPECMAP[specURL].title = data.title;
  } else {
    return data;
  }
};

log("loading caniuse data...");
JSON.parse(response.getBody("utf8"), fixCanIUseSpecURLs);

const getAdjustedData = (locationkey, url, path, baseurl, host, fragment) => {
  if (host.includes("spec.whatwg.org")) {
    path = host.split(".")[0];
    locationkey = fragment;
    if (url.startsWith("https://html.spec.whatwg.org/multipage/")) {
      baseurl = "https://html.spec.whatwg.org/multipage/";
    }
  } else if (
    url.startsWith(
      "https://httpwg.org/http-extensions/draft-ietf-httpbis-rfc6265bis.html"
    )
  ) {
    path = "draft-ietf-httpbis-rfc6265bis";
    locationkey = fragment;
    baseurl =
      "https://httpwg.org/http-extensions/draft-ietf-httpbis-rfc6265bis.html";
  } else if (host.includes("httpwg.org")) {
    path = url.substring(25, 32);
    locationkey = fragment;
    baseurl = url.substring(0, 37);
  } else if (url.startsWith("https://tc39.es/ecma262/multipage/")) {
    path = "ecmascript";
    locationkey = fragment;
    baseurl = "https://tc39.es/ecma262/multipage/";
  } else if (url.includes("/gamepad/extensions.html")) {
    path = "gamepad-extensions";
    locationkey = fragment;
    baseurl = "https://w3c.github.io/gamepad/extensions.html";
  } else if (url.includes("/WebAssembly/design/blob/master/Web.md")) {
    path = "wasm-web-embedding";
    locationkey = fragment;
    baseurl = "https://webassembly.org/docs/web/";
  } else if (url.startsWith("https://datatracker.ietf.org/doc/html/")) {
    const name = locationkey.split("#")[0];
    path = name;
    locationkey = fragment;
    baseurl = "https://datatracker.ietf.org/doc/html/" + name;
  } else if (url.startsWith("https://www.rfc-editor.org/rfc/")) {
    const name = locationkey.split("#")[0];
    path = name;
    locationkey = fragment;
    baseurl = "https://www.rfc-editor.org/rfc/" + name;
  }
  return [locationkey, path, baseurl];
};

const getSpecShortnameAndLocationKey = (url, feature, mdnURL) => {
  if (url.includes("##")) {
    url = url.replace("##", "#");
  }
  let locationkey = "";
  let baseurl = "";
  let path = new URL(url).pathname;
  const host = new URL(url).host;
  let fragment = new URL(url).hash.slice(1);
  try {
    fragment = decodeURIComponent(fragment);
  } catch {
    warn(`${feature}: odd fragment: ${fragment}`);
  }
  const filename = path.split("/").slice(-1)[0];
  if (filename !== "") {
    locationkey = filename + "#" + fragment;
    baseurl = dirname(url.split("#")[0]);
  } else {
    locationkey = fragment;
    baseurl = url.split("#")[0];
  }
  if (baseurl.slice(-2) === "//") {
    // FIXME temporary https://github.com/mdn/browser-compat-data/pull/16527
    if (!url.startsWith("https://www.w3.org/TR/largest-contentful-paint")) {
      error(`${feature}: ${mdnURL} has bad spec URL ${url}`);
    }
    baseurl = baseurl.slice(0, -1);
  }
  baseurl = baseurl.slice(-1) !== "/" ? baseurl + "/" : baseurl;
  [locationkey, path, baseurl] = getAdjustedData(
    locationkey,
    url,
    path,
    baseurl,
    host,
    fragment
  );
  let shortname = basename(path).toLowerCase();
  if (filename !== "") {
    /* Get the second-to-last component of the path (the name of the parent
     * directory of the file). */
    shortname = path.split("/").slice(-2).reverse().pop().toLowerCase();
  }
  if (url.startsWith("https://sourcemaps.info/")) {
    baseurl = "https://sourcemaps.info/spec.html";
    shortname = "sourcemaps";
  }
  if (baseurl in SPECMAP) {
    shortname = SPECMAP[baseurl].slice(0, -5);
  } else {
    if (
      !(
        baseurl ===
          "https://tc39.es/proposal-intl-numberformat-v3/out/numberformat/" ||
        baseurl ===
          "https://tc39.es/proposal-intl-numberformat-v3/out/pluralrules/"
      )
    ) {
      SPECMAP[baseurl] = shortname + ".json";
    }
  }
  if (!(shortname in specs)) {
    specs[shortname] = Object.create(null);
  }
  return [shortname, baseurl, locationkey];
};

const getMdnSlug = (mdnURL, feature) => {
  if (
    mdnURL
      .toLowerCase()
      .startsWith("https://developer.mozilla.org/en-us/docs/web/")
  ) {
    mdnURL = mdnURL.substring(45);
  } else if (
    mdnURL
      .toLowerCase()
      .startsWith("https://developer.mozilla.org/en-us/docs/learn/")
  ) {
    mdnURL = mdnURL.substring(47);
  } else {
    warn(`${feature}: odd MDN URL: ${mdnURL}`);
  }
  return mdnURL;
};

const fixEdgeBlinkVersion = (versionAdded) => {
  if (typeof versionAdded === "string") {
    if (parseFloat(versionAdded) <= 79) {
      versionAdded = "79";
    }
  }
  return versionAdded;
};

const fixEdgeLegacyVersion = (versionAdded) => {
  if (typeof versionAdded === "string") {
    if (parseFloat(versionAdded) >= 79) {
      versionAdded = false;
    }
  }
  return versionAdded;
};

const getDataForEngine = (engineSupport) => {
  const engineData = {
    hasSupport: false,
    needsflag: false,
    partial: false,
    prefixed: false,
    altname: false,
  };
  if (engineSupport === "mirror") {
    return engineData;
  }
  if (engineSupport instanceof Array) {
    for (const versionDetails of engineSupport) {
      if (versionDetails === "mirror") {
        continue;
      }
      if ("version_removed" in versionDetails) {
        continue;
      }
      if ("version_added" in versionDetails) {
        if (versionDetails.version_added === false) {
          continue;
        }
        if (versionDetails.version_added === null) {
          continue;
        }
        if (
          "alternative_name" in versionDetails &&
          engineData.hasSupport !== true
        ) {
          engineData.altname = true;
          continue;
        }
        if ("prefix" in versionDetails && engineData.hasSupport !== true) {
          engineData.prefixed = true;
          continue;
        }
        if (
          "partial_implementation" in versionDetails &&
          engineData.hasSupport !== true
        ) {
          engineData.partial = true;
          continue;
        }
        if ("flags" in versionDetails) {
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
  } else if ("version_removed" in engineSupport) {
    return engineData;
  } else if ("version_added" in engineSupport) {
    if (engineSupport.version_added === false) {
      return engineData;
    }
    if (engineSupport.version_added === null) {
      return engineData;
    }
    if ("alternative_name" in engineSupport) {
      engineData.altname = true;
      return engineData;
    }
    if ("prefix" in engineSupport) {
      engineData.prefixed = true;
      return engineData;
    }
    if ("partial_implementation" in engineSupport) {
      engineData.partial = true;
      return engineData;
    }
    if ("flags" in engineSupport) {
      engineData.needsflag = true;
    }
    engineData.hasSupport = true;
    return engineData;
  }
  return engineData;
};

const getSupportData = (support) => {
  const supportData = {
    engines: [],
    needsflag: [],
    partial: [],
    prefixed: [],
    altname: [],
  };
  if (!support) {
    return supportData;
  }
  const updateSupportData = (engineData, engineName) => {
    if (engineData.hasSupport && !supportData.engines.includes(engineName)) {
      supportData.engines.push(engineName);
    }
    if (engineData.partial && !supportData.partial.includes(engineName)) {
      supportData.partial.push(engineName);
    }
    if (engineData.prefixed && !supportData.prefixed.includes(engineName)) {
      supportData.prefixed.push(engineName);
    }
    if (engineData.altname && !supportData.altname.includes(engineName)) {
      supportData.altname.push(engineName);
    }
    if (engineData.needsflag && !supportData.needsflag.includes(engineName)) {
      supportData.needsflag.push(engineName);
    }
  };
  if ("chrome" in support) {
    updateSupportData(getDataForEngine(support.chrome), "blink");
  }
  if ("chrome_android" in support) {
    updateSupportData(getDataForEngine(support.chrome_android), "blink");
  }
  if ("firefox" in support) {
    updateSupportData(getDataForEngine(support.firefox), "gecko");
  }
  if ("firefox_android" in support) {
    updateSupportData(getDataForEngine(support.firefox_android), "gecko");
  }
  if ("safari" in support) {
    updateSupportData(getDataForEngine(support.safari), "webkit");
  }
  if ("safari_ios" in support) {
    updateSupportData(getDataForEngine(support.safari_ios), "webkit");
  }
  return supportData;
};

const adjustSupport = (support) => {
  for (const browser in support) {
    if ("chrome" == browser) {
      const chromeSupport = support.chrome;
      support.edge_blink = JSON.parse(JSON.stringify(chromeSupport));
      if (chromeSupport instanceof Array) {
        for (let i = 0; i < chromeSupport.length; i++) {
          if (!("version_removed" in chromeSupport[i])) {
            support.edge_blink[i].version_added = fixEdgeBlinkVersion(
              chromeSupport[i].version_added
            );
          } else {
            support.edge_blink[i].version_added = false;
          }
        }
      } else {
        if (!("version_removed" in chromeSupport)) {
          support.edge_blink.version_added = fixEdgeBlinkVersion(
            chromeSupport.version_added
          );
        } else {
          support.edge_blink.version_added = false;
        }
      }
      continue;
    }
    if ("edge" == browser) {
      const edgeLegacySupport = support.edge;
      if (edgeLegacySupport === "mirror") {
        continue;
      }
      support.edge = Object.create(null);
      if (edgeLegacySupport instanceof Array) {
        if (!("version_removed" in edgeLegacySupport[0])) {
          support.edge.version_added = fixEdgeLegacyVersion(
            edgeLegacySupport[0].version_added
          );
        } else {
          support.edge.version_added = false;
        }
      } else {
        if (!("version_removed" in edgeLegacySupport)) {
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
  bcdData,
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
  const featureDetails = Object.create(null);
  const supportData = getSupportData(support);
  if (
    "status" in bcdData &&
    !bcdData.status.experimental &&
    supportData.engines.length < 2
  ) {
    warn(
      `${feature}: https://developer.mozilla.org/en-US/docs/Web/${slug}` +
        ` is implemented in one engine or less.`
    );
  }
  if (
    "status" in bcdData &&
    !bcdData.status.experimental &&
    supportData.engines.length < 1
  ) {
    warn(
      `${feature}: https://developer.mozilla.org/en-US/docs/Web/${slug}` +
        ` is implemented in zero engines.`
    );
  }
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
  if (filename && !filename.includes(".local")) {
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

const isBrokenURL = (url) => {
  const parsedURL = new URL(url);
  return (
    url.startsWith("https://www.khronos.org/registry/webgl/extensions/") ||
    !parsedURL.host ||
    !url.includes("#") ||
    parsedURL.pathname.includes("http://") ||
    parsedURL.hash.includes("http://")
  );
};

const isForTargetJSONfile = (specURL, feature, mdnURL) => {
  let [baseurl] = getSpecShortnameAndLocationKey(specURL, feature, mdnURL);
  if (baseurl.startsWith("https://html.spec.whatwg.org/")) {
    baseurl = "https://html.spec.whatwg.org/multipage/";
  }
  if (baseurl.startsWith("https://tc39.es/ecma262/")) {
    baseurl = "https://tc39.es/ecma262/multipage/";
  }
  if (SPECMAP[baseurl] === targetJSONfile) {
    return true;
  }
  return false;
};

const processSpecURL = (url, feature, bcdData, mdnURL, mdnData) => {
  const parsedURL = new URL(url);
  if (url.startsWith("https://w3c.github.io/device-memory/")) {
    return; // redirects to https://www.w3.org/TR/device-memory/
  }
  if (url.startsWith("https://www.rfc-editor.org/rfc/rfc2324")) {
    return; // 'I'm a teapot' RFC; ignore
  }
  if (url.startsWith("https://www.rfc-editor.org/rfc/rfc7168")) {
    return; // 'I'm a teapot' RFC; ignore
  }
  if (url.startsWith("/https://www.rfc-editor.org/rfc/rfc7469")) {
    return; // HTTP Public Key Pinning (obsolete)
  }
  if (url.startsWith("https://www.w3.org/TR/tracking-dnt/")) {
    return; // Obsolete
  }
  if (url.startsWith("https://www.khronos.org/registry/webgl/extensions/")) {
    return; // WebGL extension specs; ignore
  }
  if (url.startsWith("https://www.w3.org/TR/MathML3/")) {
    return; // Superseded
  }
  if (url.startsWith("https://w3c.github.io/mathml/")) {
    return; // Ignore; we only care about the MathML Core subset
  }
  if (url.startsWith("https://www.w3.org/TR/SVG11/")) {
    return; // Superseded; we only care about the SVG2 subset
  }
  if (isBrokenURL(url)) {
    error(`${feature}: broken spec URL ${url}`);
    return;
  }
  let caniuse = "caniuse" in bcdData ? bcdData.caniuse : null;
  let adjustedURL = url;
  if (url.startsWith("https://html.spec.whatwg.org/multipage/")) {
    adjustedURL = "https://html.spec.whatwg.org/" + parsedURL.hash;
  }
  if (url.startsWith("https://tc39.es/ecma262/multipage/")) {
    adjustedURL = "https://tc39.es/ecma262/" + parsedURL.hash;
  }
  if (!caniuse && adjustedURL in CANIUSE_SPECMAP) {
    caniuse = {};
    caniuse.feature = CANIUSE_SPECMAP[adjustedURL].feature;
    caniuse.title = CANIUSE_SPECMAP[adjustedURL].title;
  }
  const slug = getMdnSlug(mdnURL, feature);
  const title = mdnData.doc.title;
  const summary = mdnData.doc.summary
    .replace(/\u00A0/g, " ")
    .replaceAll("\n", " ")
    .replace(/\s+/g, " ");
  let filename = bcdJSONfilename.split("browser-compat-data/").pop();
  let support = "support" in bcdData ? bcdData.support : null;
  if (!support) {
    feature = mdnURL.split("/").pop();
    filename = null;
  }
  if ("support_from" in bcdData) {
    /* format:
     *   "support_from":
     *     ["html/elements/img.json", "html.elements.img.crossorigin"] */
    const data = JSON.parse(
      readFileSync("browser-compat-data/" + bcdData.support_from[0], "utf-8")
        .replace("≤", "")
        .trim()
    );
    support = `${bcdData.support_from[1]}.__compat.support`
      .split(".")
      .reduce((o, i) => o[i], data);
  }
  const [shortname, baseurl, locationkey] = getSpecShortnameAndLocationKey(
    url,
    feature,
    mdnURL
  );
  addSpecLink(
    feature,
    bcdData,
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

const processMdnURL = (mdnURL, feature) => {
  const mdnURLjson = mdnOrigin + new URL(mdnURL).pathname + "/index.json";
  const options = {
    headers: { "User-Agent": "mdn-spec-links-script" },
    gzip: false, // prevent Z_BUF_ERROR 'unexpected end of file'
    followRedirects: true, // default
    retry: false,
  };
  try {
    const response = request("GET", mdnURLjson, options);
    const statusCode = response.statusCode;
    if (statusCode === 404) {
      error(`${feature}: got 404 error response for ${mdnURLjson}`);
      return null;
    } else if (statusCode >= 300) {
      error(
        `${feature}: ${statusCode} ${mdnURLjson}` + ` (unexpected status code)`
      );
      return null;
    }
    return JSON.parse(response.getBody("utf8"));
  } catch (e) {
    error(`${feature}: error for ${mdnURLjson} ${e.message}.`);
    log(e);
  }
  return null;
};

const processBCD = (key, data) => {
  if (key === "version_added") {
    if (typeof data === "string" && data.startsWith("≤")) {
      data = data.substring(1);
    }
  }
  if (data && data instanceof Object && "__compat" in data) {
    const feature = key;
    const bcdData = data.__compat;
    note(`${feature}: getting BCD data`);
    if (!("spec_url" in bcdData)) {
      warn(`${feature}: no spec_url`);
      return data;
    }
    if ("status" in bcdData && bcdData.status.deprecated) {
      warn(`${feature}: deprecated`);
      return data;
    }
    if (!("mdn_url" in bcdData)) {
      warn(`${feature}: no mdn_url`);
      return data;
    }
    let mdnURL =
      "https://developer.mozilla.org/en-US" + new URL(bcdData.mdn_url).pathname;
    const specURLs = bcdData.spec_url;
    if (targetJSONfile !== "") {
      if (specURLs instanceof Array) {
        let hasAnchorForTargetJSONfile = false;
        for (let i = 0; i < specURLs.length; i++) {
          if (isForTargetJSONfile(specURLs[i], feature, mdnURL)) {
            hasAnchorForTargetJSONfile = true;
          }
        }
        if (!hasAnchorForTargetJSONfile) {
          return data;
        }
      } else if (typeof specURLs === "string") {
        if (!isForTargetJSONfile(specURLs, feature, mdnURL)) {
          warn(`${feature} not in ${targetJSONfile}`);
          return data;
        }
      }
    }
    if (new URL(bcdData.mdn_url).hash) {
      mdnURL += new URL(bcdData.mdn_url).hash;
    }
    const mdnData = processMdnURL(mdnURL, feature);
    if (mdnData === null) {
      return data;
    }
    if (specURLs instanceof Array) {
      specURLs.forEach((specURL) => {
        processSpecURL(specURL, feature, bcdData, mdnURL, mdnData);
      });
      return data;
    }
    if (typeof specURLs === "string") {
      processSpecURL(specURLs, feature, bcdData, mdnURL, mdnData);
      return data;
    }
  }
  return data;
};

/**
 * @param {Promise<void>} filename
 */
const processFile = (filename) => {
  log(`Processing ${filename}`);
  const bcdFile = readFileSync(filename, "utf-8").trim();
  bcdJSONfilename = filename;
  JSON.parse(bcdFile, processBCD);
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  /**
   * @param {string[]} files
   */
  const load = (dir, ...files) => {
    for (let file of files) {
      if (file.indexOf(__dirname) !== 0) {
        file = resolve(__dirname, dir, file);
      }

      if (!existsSync(file)) {
        continue; // Ignore non-existent files
      }

      if (statSync(file).isFile()) {
        if (extname(file) === ".json") {
          processFile(file);
        }

        continue;
      }

      load(dir, ...subFiles(file));
    }
  };
  const subFiles = (file) =>
    readdirSync(file).map((subfile) => {
      return join(file, subfile);
    });
  if (process.argv[2] && process.argv[2].includes(".json")) {
    targetJSONfile = process.argv[2];
  } else if (process.argv[3] && process.argv[3].includes(".json")) {
    targetJSONfile = process.argv[3];
  }
  if (
    process.argv[2] &&
    process.argv[2] &&
    !process.argv[2].includes(".json")
  ) {
    load("browser-compat-data", process.argv[2]);
  } else {
    load(
      "browser-compat-data",
      "api",
      "css",
      "html",
      "http",
      "javascript",
      "mathml",
      "svg",
      "webdriver"
    );
  }
  load(".local", ".");
  writeFileSync(
    "SPECMAP.json",
    JSON.stringify(SPECMAP, null, 4) + "\n",
    "utf-8"
  );
  for (const shortname in specs) {
    const filename = shortname + ".json";
    if ("" != targetJSONfile && filename !== targetJSONfile) {
      continue;
    }
    writeFileSync(
      filename,
      JSON.stringify(specs[shortname], null, 4) + "\n",
      "utf-8"
    );
  }
}

export default { processBCD, processFile };
