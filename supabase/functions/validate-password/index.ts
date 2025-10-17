// Follow Deno Edge Function pattern to import dependencies
import { createClient } from "npm:@supabase/supabase-js@2.39.3";
import { timingSafeEqual } from "npm:node:crypto";

// Get environment variables
const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

// Create Supabase client with admin privileges
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// Constant-time string comparison to prevent timing attacks
const compareStrings = (a: string, b: string): boolean => {
  try {
    // Convert strings to buffers for comparison
    const bufA = new TextEncoder().encode(a);
    const bufB = new TextEncoder().encode(b);

    // If lengths are different, return false (but in constant time)
    if (bufA.length !== bufB.length) {
      return false;
    }

    // Use timing-safe equal comparison
    return timingSafeEqual(bufA, bufB);
  } catch (error) {
    console.error("Error during string comparison:", error);
    return false;
  }
};

Deno.serve(async (req: Request) => {
  // Handle CORS preflight request
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    // Get the password from the request
    const { password, taskId } = await req.json();

    if (!password) {
      return new Response(
        JSON.stringify({ error: "Password is required" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        }
      );
    }

    // In a real app, we would retrieve the correct password from Vault
    // For this demo, we're using the hardcoded password
    const correctPassword = "bluemoon25";

    // Validate password (constant-time comparison to prevent timing attacks)
    const isValid = compareStrings(password, correctPassword);

    if (!isValid) {
      // Implement rate limiting here
      return new Response(
        JSON.stringify({ success: false, message: "Invalid password" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 401,
        }
      );
    }

    // If valid, postpone the task
    if (taskId) {
      // Get the task to get the postponement interval
      const { data: task, error: taskError } = await supabase
        .from("scheduled_tasks")
        .select("postponement_interval")
        .eq("id", taskId)
        .single();

      if (taskError) {
        throw taskError;
      }

      // Calculate new trigger date
      const nextTriggerAt = new Date();
      nextTriggerAt.setDate(
        nextTriggerAt.getDate() + (task?.postponement_interval || 5)
      );

      // Update the task
      const { error: updateError } = await supabase
        .from("scheduled_tasks")
        .update({
          next_trigger_at: nextTriggerAt.toISOString(),
          status: "pending",
        })
        .eq("id", taskId);

      if (updateError) {
        throw updateError;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Password validated successfully",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (err) {
    console.error("Error validating password:", err);

    return new Response(
      JSON.stringify({
        error: err.message,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});