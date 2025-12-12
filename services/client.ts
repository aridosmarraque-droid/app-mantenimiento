
import { createClient } from '@supabase/supabase-js';

// ------------------------------------------------------------------
// CONFIGURACIÓN DIRECTA DE SUPABASE
// Pega aquí tus credenciales tal como las tenías antes.
// ------------------------------------------------------------------

const SUPABASE_URL = 'https://tdgyqgrzjkafxwfkqtix.supabase.co'; 
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRkZ3lxZ3J6amthZnh3ZmtxdGl4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ5MjEyODQsImV4cCI6MjA4MDQ5NzI4NH0.qplUc1Dy1dUdQgijek-J0cA1aMOxwqia_8W7LhmbxiY';

console.log("Iniciando conexión a Supabase:", SUPABASE_URL);

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Forzamos a true para que la app SIEMPRE intente conectar a la base de datos real
// y deje de usar los datos de prueba (Mock).
export const isConfigured = true;
