const { withDangerousMod } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

module.exports = function withSquarePOS(config) {
  return withDangerousMod(config, [
    "android",
    async (config) => {
      const manifestPath = path.join(
        config.modRequest.platformProjectRoot,
        "app",
        "src",
        "main",
        "AndroidManifest.xml"
      );

      let manifest = fs.readFileSync(manifestPath, "utf8");

      if (!manifest.includes('android:name="com.squareup"')) {
        const queriesBlock = `
    <queries>
        <package android:name="com.squareup" />
        <intent>
            <action android:name="android.intent.action.VIEW" />
            <data android:scheme="square-commerce-v1" />
        </intent>
    </queries>`;
        manifest = manifest.replace("</manifest>", queriesBlock + "\n</manifest>");
        fs.writeFileSync(manifestPath, manifest, "utf8");
      }

      return config;
    },
  ]);
};
