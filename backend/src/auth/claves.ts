import { argon2, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const derivar = promisify(argon2);
const anterior = promisify(scrypt);
const prefijo = '$argon2id$v=19$m=19456,t=2,p=1$';
const formato = /^\$argon2id\$v=19\$m=19456,t=2,p=1\$([A-Za-z0-9+/]{22})\$([A-Za-z0-9+/]{43})$/;
const legado = /^scrypt\$([a-f0-9]{32})\$([a-f0-9]{64})$/;
const base64 = (valor: Buffer) => valor.toString('base64').replace(/=+$/, '');

function derivarClave(message: string, nonce: Buffer) {
  return derivar('argon2id', { message, nonce, memory: 19456, passes: 2, parallelism: 1, tagLength: 32 });
}

export async function hashClave(clave: string) {
  const sal = randomBytes(16);
  return prefijo + base64(sal) + '$' + base64(await derivarClave(clave, sal));
}

export async function verificarClave(clave: string, almacenada?: string) {
  const viejo = legado.exec(almacenada ?? '');
  if (viejo) {
    const calculada = await anterior(clave, viejo[1], 32) as Buffer;
    return timingSafeEqual(calculada, Buffer.from(viejo[2], 'hex'));
  }
  const campos = formato.exec(almacenada ?? '');
  // Una derivación de igual coste incluso cuando no existe el usuario o el hash.
  const calculada = await derivarClave(clave, campos ? Buffer.from(campos[1], 'base64') : Buffer.alloc(16));
  return !!campos && timingSafeEqual(calculada, Buffer.from(campos[2], 'base64'));
}
