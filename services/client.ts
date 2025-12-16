
import { createClient } from '@supabase/supabase-js';

// ============================================================================
// CONFIGURACIÓN DE CONEXIÓN A SUPABASE
// ============================================================================

// Intento seguro de leer variables de entorno (Vite / Vercel)
let envUrl = '';
let envKey = '';

try {
  // @ts-ignore
  envUrl = import.meta.env.VITE_SUPABASE_URL;
  // @ts-ignore
  envKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
} catch (e) {
  // Ignorar errores de entorno local
}

const targetUrl = envUrl || '';
const targetKey = envKey || '';

const isConfigured = targetUrl.startsWith('http') && targetKey.length > 0;

// Logging de estado para depuración en consola del navegador
if (isConfigured) {
    console.log("✅ Conectado a Supabase (Vercel/Local)");
} else {
    console.warn("⚠️ Credenciales Supabase NO encontradas.");
    console.warn("Si estás en Vercel, ve a Settings > Environment Variables y añade VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY");
}

// Crear cliente (usando valores dummy si no está configurado para evitar crashes del SDK)
export const supabase = createClient(
    isConfigured ? targetUrl : 'https://placeholder.supabase.co',
    isConfigured ? targetKey : 'placeholder'
);

export { isConfigured };

