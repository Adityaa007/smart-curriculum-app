/**
 * API Configuration — resolves backend URL from environment.
 *
 * In development:  VITE_API_URL defaults to http://127.0.0.1:5000
 * In production:   VITE_API_URL should be set to your Render URL
 *                  e.g. https://smart-curriculum-api.onrender.com
 */
const API_BASE = (import.meta.env.VITE_API_URL || "http://127.0.0.1:5000").replace(/\/$/, "");

export default API_BASE;
