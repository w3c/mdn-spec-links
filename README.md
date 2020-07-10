# MDN Spec Links

This space holds JSON data for individual specs; the per-spec data maps
fragment IDs from a particular spec to MDN articles which have
*Specifications* sections that contain links to that spec and fragment ID.

All the data here is generated. So you don’t want to edit anything here
directly; instead you’d need to edit the upstream data at
https://github.com/mdn/browser-compat-data, and the content of
https://developer.mozilla.org/docs/Web articles.

https://github.com/w3c/mdn-spec-links/blob/master/.mdn-spec-links.ts
defines the datatypes and structure of the JSON data. The generated
https://github.com/w3c/mdn-spec-links/blob/master/.mdn-spec-links.schema.json
file is a JSON Schema that provides the same definitions.
