/**
 * Host loader entry for the browser-only settings search plugin.
 *
 * The host half contributes nothing: all behavior lives in the client bundle
 * (`./client.js`), which adds the search field and candidate overlay to the
 * DSH Web Settings panel. This entry exists so the bundle row can mount under
 * the profile's cordis composition.
 */
export function apply(): void {}
