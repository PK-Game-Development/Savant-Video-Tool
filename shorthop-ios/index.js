// Patch URL.prototype properties to allow assignment before any module loads.
// React Native 0.81 defines URL.prototype.protocol (and others) as getter-only,
// but expo-auth-session / expo-linking try to assign to them during initialization.
if (typeof URL !== 'undefined' && URL.prototype) {
  ['protocol', 'hostname', 'port', 'pathname', 'search', 'hash', 'host'].forEach(prop => {
    const desc = Object.getOwnPropertyDescriptor(URL.prototype, prop);
    if (desc && desc.get && !desc.set) {
      Object.defineProperty(URL.prototype, prop, {
        ...desc,
        set: function () { /* allow assignment without throwing */ },
      });
    }
  });
}

const { registerRootComponent } = require('expo');
const App = require('./App').default;
registerRootComponent(App);
