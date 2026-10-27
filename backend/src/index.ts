import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// Ruta de prueba
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', message: 'API de Softlab funcionando' });
});

app.listen(PORT, () => {
  console.log(`Servidor de Softlab corriendo en http://localhost:${PORT}`);
});