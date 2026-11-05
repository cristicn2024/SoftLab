import axios from 'axios';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api',
  headers: {
    'Content-Type': 'application/json',
    'x-tenant-id': import.meta.env.VITE_TENANT_ID ?? '1',
  },
});
