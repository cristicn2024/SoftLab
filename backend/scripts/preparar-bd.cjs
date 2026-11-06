const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const raiz = path.join(__dirname, '..');
const INTENTOS = 10;
const ESPERA_MS = 3000;

function correr(comando) {
  const resultado = spawnSync(comando, { cwd: raiz, stdio: 'inherit', shell: true });
  return resultado.status === 0;
}

function esperar(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function prepararEnv() {
  const destino = path.join(raiz, '.env');
  if (fs.existsSync(destino) || process.env.DATABASE_URL) {
    return;
  }
  fs.copyFileSync(path.join(raiz, '.env.example'), destino);
  console.log('Se creó backend/.env a partir de .env.example. Revisa DATABASE_URL si tu MySQL usa otra contraseña.');
}

function crearTablas() {
  for (let intento = 1; intento <= INTENTOS; intento++) {
    if (correr('npx prisma db push --skip-generate')) {
      return true;
    }
    if (intento < INTENTOS) {
      console.log(`No se pudo conectar o crear las tablas (intento ${intento} de ${INTENTOS}). Reintentando en ${ESPERA_MS / 1000} s...`);
      esperar(ESPERA_MS);
    }
  }
  return false;
}

prepararEnv();

if (!correr('npx prisma generate')) {
  process.exit(1);
}

if (!crearTablas()) {
  console.error('No se pudo preparar la base de datos. Revisa que MySQL esté corriendo (docker compose up -d db) y que DATABASE_URL en backend/.env sea correcta.');
  process.exit(1);
}

if (!correr('npx tsx prisma/seed.ts --si-vacia')) {
  process.exit(1);
}
