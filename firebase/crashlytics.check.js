// Guards the exact breakage that silently killed Crashlytics: RNFirebase v26
// dropped the namespaced `default` export, so `require(...).default` became
// undefined and firebase/crashlytics.js no-opped without a single error.
// Can't import the ESM dist under Node (it pulls in react-native), so assert
// on the shipped source. Run: node firebase/crashlytics.check.js
const assert = require("assert");
const fs = require("fs");
const path = require("path");

const dist = path.join(
  path.dirname(require.resolve("@react-native-firebase/crashlytics/package.json")),
  "dist/module/index.js"
);
const src = fs.readFileSync(dist, "utf8");

for (const fn of ["getCrashlytics", "log", "recordError", "setUserId", "setAttributes", "setCrashlyticsCollectionEnabled", "crash"]) {
  assert(
    src.includes(`export function ${fn}(`),
    `@react-native-firebase/crashlytics no longer exports ${fn}() — firebase/crashlytics.js will silently report nothing`
  );
}

const wrapper = fs.readFileSync(path.join(__dirname, "crashlytics.js"), "utf8");
assert(
  !/require\("@react-native-firebase\/crashlytics"\)\.default/.test(wrapper),
  "crashlytics.js is back on the removed namespaced default export"
);

console.log("crashlytics API surface OK");
