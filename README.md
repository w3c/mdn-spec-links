# MDN Spec Links

This space holds JSON data for individual specs; the per-spec data maps fragment IDs from a particular spec to MDN articles which have *Specifications* sections that contain links to that spec and fragment ID.

- [`.mdn-spec-links.ts`][1] is a TypeScript declaration defining the datatypes and structure of the JSON data.<br>
- [`.mdn-spec-links.schema.json`][2], generated from the TypeScript, is a JSON Schema with the same definitions.

All data here is generated. So you don’t want to edit the data directly; rather, edit https://github.com/mdn/browser-compat-data data upstream, and https://developer.mozilla.org/docs/Web article content.

To regenerate the data, just type `make`. To build from local BCD and MDN clones:

```
BCD_REPO=/path/to/mdn/browser-compat-data MDN_REPO=/path/to/mdn/content make -e
```

[1]: https://github.com/w3c/mdn-spec-links/blob/HEAD/.mdn-spec-links.ts
[2]: https://github.com/w3c/mdn-spec-links/blob/HEAD/.mdn-spec-links.schema.json
