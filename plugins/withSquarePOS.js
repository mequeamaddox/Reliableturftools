const { withAndroidManifest } = require("@expo/config-plugins");

module.exports = function withSquarePOS(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;
    if (!manifest.queries) {
      manifest.queries = [];
    }
    const alreadyAdded = manifest.queries.some(
      (q) =>
        q.intent &&
        q.intent.some((i) =>
          i.data && i.data.some((d) => d.$["android:scheme"] === "square-commerce-v1")
        )
    );
    if (!alreadyAdded) {
      manifest.queries.push({
        intent: [
          {
            action: [{ $: { "android:name": "android.intent.action.VIEW" } }],
            data: [{ $: { "android:scheme": "square-commerce-v1" } }],
          },
        ],
      });
    }
    return config;
  });
};
