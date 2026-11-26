// Prints an ADMIN_PASSWORD_HASH for the password read from stdin (not from the command line, so it stays out of shell history).
// Usage: npm run admin:hash   (type the password, then Enter)
import {hashPassword} from '../lib/server/auth.mjs';
import {createInterface} from 'node:readline';
const rl=createInterface({input:process.stdin,output:process.stderr});
rl.question('Yönetici şifresi (en az 10 karakter): ',async password=>{rl.close();if(password.length<10){console.error('Şifre en az 10 karakter olmalı.');process.exit(1)}console.log(await hashPassword(password))});
