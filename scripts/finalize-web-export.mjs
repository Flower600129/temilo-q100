import { copyFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const server = fileURLToPath(new URL('../mobile/dist/web/server/', import.meta.url));
if (!existsSync(`${server}/_expo/routes.json`)) throw new Error('Missing Expo server export.');
// SDK 54 exports CommonJS API bundles. Keep them CommonJS even though the
// source repository uses type:module; this file belongs only to the build.
writeFileSync(`${server}/package.json`, JSON.stringify({ private: true, type: 'commonjs' }) + '\n');
console.log('Expo server export finalized with a CommonJS package boundary.');

const licenses = fileURLToPath(new URL('../mobile/dist/web/client/licenses/', import.meta.url));
mkdirSync(licenses, { recursive: true });
for (const [source, name] of [
  ['mobile/assets/fonts/OFL-LibreCaslonDisplay.txt', 'Libre-Caslon-Display-OFL.txt'],
  ['LICENSE', 'TEMILO-MIT.txt'],
  ['mobile/assets/licenses/Feather-MIT.txt', 'Feather-MIT.txt'],
  ['mobile/assets/licenses/Ionicons-MIT.txt', 'Ionicons-MIT.txt'],
  ['vendor/decode-uri-component/LICENSE', 'Decode-URI-Component-MIT.txt'],
  ['node_modules/query-string/license', 'Query-String-MIT.txt'],
  ['mobile/assets/licenses/Expo-MIT.txt', 'Expo-MIT.txt'],
  ['node_modules/react/LICENSE', 'React-LICENSE.txt'],
  ['node_modules/react-native/LICENSE', 'React-Native-LICENSE.txt'],
  ['node_modules/@expo/vector-icons/LICENSE', 'Expo-Vector-Icons-LICENSE.txt'],
  ['node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/LICENSE', 'React-Native-Vector-Icons-LICENSE.txt'],
]) copyFileSync(fileURLToPath(new URL('../' + source, import.meta.url)), licenses + name);
console.log('Bundled font and library notices copied to the client licenses directory.');
