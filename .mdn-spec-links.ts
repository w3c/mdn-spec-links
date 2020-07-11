/**
 * Each top-level entry in our data is an object with a single key: A
 * fragment ID from a spec. Each top-level entry associates its spec
 * fragment ID with one or more objects holding data about a feature.
 */
export interface MDNSpecLink {
  [specLinkFragmentID: string]: Feature[];
}

/**
 * Each object for a feature has data from the MDN article for the feature,
 * along with data from BCD https://github.com/mdn/browser-compat-data/.
 */
export interface Feature {
    /**
     * Name of the feature (interface, method, or property name); from BCD.
     */
    name: string;
    /**
     * Filename of the BCD file containing the data for the feature.
     */
    filename: string | null;
    /**
     * Title of the MDN article for the feature.
     */
    title: string;
    /**
     * Slug (URL path) of the MDN article for the feature.
     */
    slug: string;
    /**
     * First paragraph or "seoSummary" of the MDN article for the feature.
     */
    summary: string;
    /**
     * Names of engines with support for the feature that conforms to the
     * spec (that is, un-prefixed and not under an alternative name —
     * though possibly requiring a runtime flag or preference to be set).
     */
    engines: Engines[];
    /**
     * Names of engines with support for the feature implemented under a
     * wholly different name (in contrast to just being prefixed).
     */
    altname?: Engines[];
    /**
     * Names of engines with support for the feature that requires setting
     * a runtime flag or preference.
     */
    needsflag?: Engines[];
    /**
     * Names of engines with support for the feature that differs from the
     * spec in a way that may cause compatibility problems.
     */
    partial?: Engines[];
    /**
     * Names of engines with support for the feature that requires adding
     * a prefix to the standard feature name defined in the spec.
     */
    prefixed?: Engines[];
    /**
     * Per-browser data about support for the feature.
     */
    support: Support | null;
    /**
     * The caniuse.com shortname for the feature, along with the title of
     * the caniuse.com table (page) for the feature.
     */
    caniuse?:  { feature: string, title: string };
}

export type Engines = "blink" | "gecko" | "webkit";

type Browsers =
    "chrome"
    | "chrome_android"
    | "edge"
    | "edge_blink"
    | "firefox"
    | "firefox_android"
    | "ie"
    | "nodejs"
    | "opera"
    | "opera_android"
    | "qq_android"
    | "safari"
    | "safari_ios"
    | "samsunginternet_android"
    | "uc_android"
    | "uc_chinese_android"
    | "webview_android";

export type Support = Partial<Record <Browsers, SupportData>>;

export type SupportData = SupportDetails | SupportDetails[]

export interface SupportDetails {
    /**
     * Either: (1) a browser version number (the first version of the
     * browser to add support for the feature), or (2) boolean true to
     * indicate just that the browser supports the feature (but the first
     * version to add support for it is unknown), or (3) boolean false to
     * indicate the browser doesn't support the feature, or else (4) null
     * to indicate it's unknown whether the browser supports the feature.
     */
    version_added: string | boolean | null;
    /**
     * Either: (1) a browser version number (the version of the browser
     * which dropped support for the feature), or (2) boolean true to
     * indicate just that the feature was dropped from the browser (but the
     * first version to drop support for it is unknown). (Boolean false and
     * null are also allowed as values, but the semantics are undefined.)
     */
    version_removed?: string | boolean | null;
    /**
     * Alternative name for the feature, for cases of a feature implemented
     * under a wholly different name (in contrast to just being prefixed).
     */
    alternative_name?: string;
    /**
     * Data about flags needed to enable support for the feature.
     */
    flags?: Flag[];
    /**
     * Additional/noteworthy information about support for the feature.
     */
    notes?: string | string[];
    /**
     * Boolean indicating whether support for the feature deviates from the
     * specification in a way that may cause compatibility problems.
     */
    partial_implementation?: boolean;
    /**
     * Prefix that must be added to the feature name defined in the spec in
     * order to enable support. Includes any leading/trailing dashes.
     */
    prefix?: string;
}

export interface Flag {
    /**
     * The name of the flag or preference that must be set in order to
     * enable support for the feature.
     */
    name: string;
    type: "preference" | "runtime_flag";
    /**
     * The value to which the specified flag must be set in order to enable
     * support for the feature.
     */
    value_to_set?: string;
}
