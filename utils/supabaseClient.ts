
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://myzbkbqkjykdsaymujvl.supabase.co';
const supabaseAnonKey = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im15emJrYnFranlrZHNheW11anZsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQwMzk1NjcsImV4cCI6MjA3OTYxNTU2N30.LFFKlGHjC6hfCQynUDCZp_2XdZLDrxAuK9D4NNFYbKI`;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
