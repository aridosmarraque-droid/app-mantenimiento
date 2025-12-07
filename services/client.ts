import { createClient } from '@supabase/supabase-js';

// --- CONFIGURACIÓN SUPABASE ---
// REEMPLAZA ESTAS CADENAS CON TUS CREDENCIALES DE SUPABASE
const SUPABASE_URL = 'https://tdgyqgrzjkafxwfkqtix.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRkZ3lxZ3J6amthZnh3ZmtxdGl4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ5MjEyODQsImV4cCI6MjA4MDQ5NzI4NH0.qplUc1Dy1dUdQgijek-J0cA1aMOxwqia_8W7LhmbxiY';

// Detectar si las credenciales son las de por defecto o están vacías
export const isConfigured = 
  SUPABASE_URL && 
  SUPABASE_ANON_KEY && 
  SUPABASE_URL !== 'https://tu-proyecto.supabase.co' && 
  SUPABASE_ANON_KEY !== 'tu-anon-key-aqui';

if (!isConfigured) {
  console.warn("⚠️ MODO DEMO: No has configurado la URL y la KEY de Supabase. Usando datos de prueba.");
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
