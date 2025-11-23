import axios from 'axios';

// Determine API base URL
// If VITE_API_BASE is set, use it
// Otherwise, in production use the backend Railway URL
// In development, default to localhost:4000
let API_BASE = import.meta.env.VITE_API_BASE;

if (!API_BASE) {
  if (import.meta.env.PROD) {
    // In production, use the backend Railway URL
    // Frontend: https://mini-project-production-d8d2.up.railway.app
    // Backend: https://mini-project-production-f4fc.up.railway.app
    API_BASE = 'https://mini-project-production-f4fc.up.railway.app';
  } else {
    // In development, default to localhost backend
    API_BASE = 'http://localhost:4000';
  }
} else if (import.meta.env.PROD && API_BASE.includes('localhost')) {
  // Safety check: if in production and API_BASE contains localhost, use backend URL instead
  console.warn('API_BASE contains localhost in production, using backend Railway URL instead');
  API_BASE = 'https://mini-project-production-f4fc.up.railway.app';
}

const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' }
});

export default api;
