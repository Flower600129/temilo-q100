# SDK 54 security compatibility packages

These local npm overrides are source packages, not edits to node_modules. They are included in source drafts and container build inputs before `npm ci`.

- `decode-uri-component`: upstream 0.5.1 (MIT), with its linear malformed-input fixes intact. Only its default export is converted to CommonJS, and 0.2.x's `+` → space normalization is retained. `upstream.json` records the original source hash. Query-string 7 / Router 6 keep their callable require contract. This is a maintained local adaptation, not an official 0.2.x upstream release.
- `image-size`: a small original CommonJS adapter using the **unmodified registry `image-size@2.0.4`**, installed under alias `image-size-upstream`. It restores the synchronous file-path and callback/Buffer interface Metro uses. File reads retain the old 512 KiB limit. All actual image parsing is performed by 2.0.4, which fixes the JXL/HEIF and ICNS infinite loops. The upstream copyright notice is retained.

The local version suffix identifies adaptations; vulnerability status must also be supported by algorithm and integration tests. Do not treat an audit count alone as proof of remediation. Remove these adapters when a compatible maintained SDK release supplies the fixes. No Expo/Router/React Native major upgrade is made here.
