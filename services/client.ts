
import { createClient } from '@supabase/supabase-js';

// ------------------------------------------------------------------
// CONFIGURACIÓN DE SUPABASE
// ------------------------------------------------------------------

// 1. Intenta leer variables de entorno de forma segura
let ENV_URL = '';
let ENV_KEY = '';

try {
    // Verificamos si existe import.meta.env antes de leer propiedades
    // @ts-ignore
    if (typeof import.meta !== 'undefined' && import.meta.env) {
        // @ts-ignore
        ENV_URL = import.meta.env.VITE_SUPABASE_URL;
        // @ts-ignore
        ENV_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
    }
} catch (e) {
    console.warn("No se pudo acceder a import.meta.env, usando valores por defecto.");
}

// 2. Variables manuales (Edita esto si no usas .env)
const HARDCODED_URL = ''; // Pega tu URL de Supabase aquí (ej: https://xyz.supabase.co)
const HARDCODED_KEY = ''; // Pega tu ANON KEY aquí

// Selección de credenciales
const targetUrl = ENV_URL || HARDCODED_URL || '';
const targetKey = ENV_KEY || HARDCODED_KEY || '';

// Validar formato de URL para evitar que la app explote al iniciar
const isValidUrl = (url: string) => {
    try {
        if (!url) return false;
        const u = new URL(url);
        return u.protocol === 'https:' || u.protocol === 'http:';
    } catch (e) {
        return false;
    }
};

// Determinamos si estamos listos para conectar
export const isConfigured = isValidUrl(targetUrl) && targetKey.length > 0;

if (isConfigured) {
    console.log("✅ Conexión Supabase: Configurada correctamente");
} else {
    console.log("⚠️ Conexión Supabase: No configurada o URL inválida. Usando MODO DEMO.");
}

// Inicializamos el cliente de forma segura.
// Si la configuración no es válida, usamos una URL dummy sintácticamente correcta
// para que createClient no lance una excepción y la app pueda arrancar en modo Mock.
export const supabase = createClient(
    isConfigured ? targetUrl : 'https://placeholder.supabase.co', 
    isConfigured ? targetKey : 'placeholder'
);
