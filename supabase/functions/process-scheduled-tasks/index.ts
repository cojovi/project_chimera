```typescript
// Follow Deno Edge Function pattern to import dependencies
import { createClient } from "npm:@supabase/supabase-js@2.39.3";

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

// This function would be triggered by a scheduled job (pg_cron)
Deno.serve(async (req: Request) => {
  // Handle CORS preflight request
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    // Find tasks that need to be processed (expired)
    const now = new Date().toISOString();
    const { data: tasks, error } = await supabase
      .from("scheduled_tasks")
      .select("*")
      .eq("status", "pending")
      .lt("next_trigger_at", now);

    if (error) {
      throw error;
    }

    if (!tasks || tasks.length === 0) {
      return new Response(
        JSON.stringify({ message: "No tasks to process" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    // Process each expired task
    const results = await Promise.all(
      tasks.map(async (task) => {
        try {
          // Retrieve the encrypted payload from storage
          const { data: payloadData, error: downloadError } = await supabase
            .storage
            .from('payloads')
            .download(task.payload_path);

          if (downloadError) {
            throw new Error(`Error downloading payload: ${downloadError.message}`);
          }

          // Update task status to triggered
          const { error: updateError } = await supabase
            .from("scheduled_tasks")
            .update({
              status: "triggered",
            })
            .eq("id", task.id);

          if (updateError) {
            throw updateError;
          }

          return {
            taskId: task.id,
            status: "success",
            message: `Task processed successfully`,
          };
        } catch (taskError) {
          console.error(`Error processing task ${task.id}:`, taskError);
          return {
            taskId: task.id,
            status: "error",
            message: taskError.message,
          };
        }
      })
    );

    return new Response(
      JSON.stringify({
        message: `Processed ${tasks.length} tasks`,
        results,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (err) {
    console.error("Error processing scheduled tasks:", err);

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
```