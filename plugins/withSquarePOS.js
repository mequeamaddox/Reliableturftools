const { withAndroidManifest } = require("@expo/config-plugins");

module.exports = function withSquarePOS(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;

    if (!manifest.queries) {
      manifest.queries = [{}];
    } else if (!Array.isArray(manifest.queries)) {
      manifest.queries = [manifest.queries];
    }

    const q = manifest.queries[0];

    // Declare Square POS package directly — more reliable than scheme-based query
    if (!q.package) {
      q.package = [];
    }
    const pkgAlreadyAdded = q.package.some(
      (p) => p.$ && p.$["android:name"] === "com.squareup"
    );
    if (!pkgAlreadyAdded) {
      q.package.push({ $: { "android:name": "com.squareup" } });
    }

    // Also declare the scheme for canOpenURL
    if (!q.intent) {
      q.intent = [];
    }
    const intentAlreadyAdded = q.intent.some(
      (i) => i.data && i.data.some((d) => d.$["android:scheme"] === "square-commerce-v1")
    );
    if (!intentAlreadyAdded) {
      q.intent.push({
        action: [{ $: { "android:name": "android.intent.action.VIEW" } }],
        data: [{ $: { "android:scheme": "square-commerce-v1" } }],
      });
    }

    return config;
  });
};
