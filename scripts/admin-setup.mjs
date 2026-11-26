// Sets the production admin e-mail and password on Cloudflare. The password is typed here,
// hashed locally and sent only as a hash; it never appears in files or chat.
// Usage: npm run admin:setup
import {createInterface} from 'node:readline';
import {spawnSync} from 'node:child_process';
import {hashPassword} from '../lib/server/auth.mjs';

const rl = createInterface({input: process.stdin, output: process.stdout});
const ask = (q, hidden = false) => new Promise(resolve => {
  if (!hidden) return rl.question(q, resolve);
  // Hide typed characters while the password is entered.
  const write = rl._writeToOutput;
  rl._writeToOutput = s => { if (s.includes(q)) write.call(rl, s); else write.call(rl, '*'); };
  rl.question(q, answer => { rl._writeToOutput = write; process.stdout.write('\n'); resolve(answer); });
});
function put(name, value) {
  const r = spawnSync('npx', ['wrangler', 'secret', 'put', name], {input: value, stdio: ['pipe', 'inherit', 'inherit'], shell: true});
  if (r.status !== 0) { console.error(name + ' kaydedilemedi.'); process.exit(1); }
}

const email = (await ask('Yönetici e-postası: ')).trim();
if (!/^\S+@\S+\.\S+$/.test(email)) { console.error('Geçerli bir e-posta girin.'); process.exit(1); }
const password = await ask('Yönetici şifresi (en az 10 karakter): ', true);
if (password.length < 10) { console.error('Şifre en az 10 karakter olmalı.'); process.exit(1); }
const again = await ask('Şifre (tekrar): ', true);
rl.close();
if (again !== password) { console.error('Şifreler aynı değil.'); process.exit(1); }
put('ADMIN_EMAIL', email);
put('ADMIN_PASSWORD_HASH', await hashPassword(password));
console.log('Tamam. /yonetim adresinden bu e-posta ve şifreyle giriş yapabilirsiniz.');
