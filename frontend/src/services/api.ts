import axios from 'axios';

export const api = axios.create({
  baseURL: 'http://localhost:4000/api',
  headers: {
    'Content-Type': 'application/json',
    'x-tenant-id': '1', // ID del tenant actual (posteriormente se tomará del token JWT)
  },
});