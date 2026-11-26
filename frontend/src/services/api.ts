import axios from 'axios';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api',
  headers: {
    'Content-Type': 'application/json',
    'x-tenant-id': import.meta.env.VITE_TENANT_ID ?? '1',
    'x-user-name': 'Laura Mendez',
    'x-user-email': 'laura.mendez@santalucia.demo',
    'x-user-role': 'Administradora',
  },
});
