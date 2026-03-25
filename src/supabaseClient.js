import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://gjyqiaeuumnflzeftwgb.supabase.co";
const SUPABASE_PUBLIC_KEY = "sb_publishable_sISDA-DtQLl6pjHxt0XVdQ_8n8lsRKo";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLIC_KEY);
