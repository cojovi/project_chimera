import { createClient } from '@supabase/supabase-js';
import { TaskState } from '../types';

// These would normally be in environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://your-project.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'your-anon-key';

// Debug logging to verify environment variables
console.log('Supabase URL:', supabaseUrl);
console.log('Supabase Anon Key:', supabaseAnonKey ? `${supabaseAnonKey.substring(0, 20)}...` : 'NOT SET');

// Validate environment variables
if (!supabaseUrl || supabaseUrl === 'https://your-project.supabase.co') {
  console.error('VITE_SUPABASE_URL is not set or is using placeholder value');
}

if (!supabaseAnonKey || supabaseAnonKey === 'your-anon-key') {
  console.error('VITE_SUPABASE_ANON_KEY is not set or is using placeholder value');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Test connection function
export const testConnection = async (): Promise<boolean> => {
  try {
    const { data, error } = await supabase.from('scheduled_tasks').select('count').limit(1);
    if (error) {
      console.error('Supabase connection test failed:', error);
      return false;
    }
    console.log('Supabase connection test successful');
    return true;
  } catch (error) {
    console.error('Supabase connection test error:', error);
    return false;
  }
};

// Task functions
export const getCurrentTask = async (): Promise<TaskState | null> => {
  try {
    console.log('Attempting to fetch current task...');
    
    const { data, error } = await supabase
      .from('scheduled_tasks')
      .select('*')
      .eq('status', 'pending')
      .order('next_trigger_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('Error fetching task:', error);
      
      // Provide more specific error information
      if (error.message.includes('Failed to fetch')) {
        console.error('Network error: Unable to connect to Supabase. Please check:');
        console.error('1. Your internet connection');
        console.error('2. Supabase project status');
        console.error('3. Environment variables are correct');
        console.error('4. No firewall/VPN blocking the connection');
      }
      
      return null;
    }

    console.log('Task fetch successful:', data);
    return data as TaskState;
  } catch (error) {
    console.error('Unexpected error fetching task:', error);
    
    // Enhanced error reporting for fetch errors
    if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
      console.error('FETCH ERROR DETAILS:');
      console.error('- This usually indicates a network connectivity issue');
      console.error('- Check if Supabase URL is accessible:', supabaseUrl);
      console.error('- Verify your Supabase project is active and not paused');
      console.error('- Check browser network tab for more details');
    }
    
    return null;
  }
};

const isValidUUID = (uuid: string) => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
};

// This would be called after successful password validation
export const postponeTask = async (taskId: string, days: number): Promise<boolean> => {
  try {
    // Skip Supabase update for demo tasks or invalid UUIDs
    if (taskId === 'demo' || !isValidUUID(taskId)) {
      console.log('Skipping Supabase update for demo/invalid task');
      return true;
    }

    const nextTriggerAt = new Date();
    nextTriggerAt.setDate(nextTriggerAt.getDate() + days);

    const { error } = await supabase
      .from('scheduled_tasks')
      .update({ 
        next_trigger_at: nextTriggerAt.toISOString(),
        status: 'pending'
      })
      .eq('id', taskId);

    if (error) {
      console.error('Error postponing task:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Unexpected error postponing task:', error);
    return false;
  }
};

// Password validation would typically be done server-side
// This is a placeholder - in production, this would be an Edge Function
export const validatePassword = async (password: string): Promise<boolean> => {
  try {
    // In production, this would call a secure Edge Function
    // For demo purposes, we're validating client-side
    // IMPORTANT: THIS IS NOT SECURE FOR PRODUCTION
    return password === 'bluemoon25';
  } catch (error) {
    console.error('Error validating password:', error);
    return false;
  }
};