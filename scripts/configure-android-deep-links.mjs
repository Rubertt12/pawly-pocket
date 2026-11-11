import { readFileSync, writeFileSync } from 'node:fs';

const manifestPath = 'android/app/src/main/AndroidManifest.xml';
let xml = readFileSync(manifestPath, 'utf8');
if (xml.includes('android:scheme="com.pawlypocket.app"') && xml.includes('android:host="login-callback"')) {
  console.log('Pawly OAuth deep link already configured.');
  process.exit(0);
}
const activityOpen = /<activity\b[^>]*>/s;
if (!activityOpen.test(xml)) throw new Error('Nenhuma activity encontrada no AndroidManifest.xml.');
const intentFilter = `\n            <intent-filter>\n                <action android:name="android.intent.action.VIEW" />\n                <category android:name="android.intent.category.DEFAULT" />\n                <category android:name="android.intent.category.BROWSABLE" />\n                <data android:scheme="com.pawlypocket.app" android:host="login-callback" />\n            </intent-filter>`;
xml = xml.replace(activityOpen, match => match + intentFilter);
writeFileSync(manifestPath, xml);
console.log('Pawly OAuth deep link configurado: com.pawlypocket.app://login-callback/');
