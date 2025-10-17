// Follow Deno Edge Function pattern to import dependencies
import { createClient } from "npm:@supabase/supabase-js@2.39.3";

// Get environment variables
const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const mailgunApiKey = Deno.env.get("MAILGUN_API_KEY") || "";
const mailgunDomain = Deno.env.get("MAILGUN_DOMAIN") || "";
const fromEmail = Deno.env.get("FROM_EMAIL") || "Mailgun Sandbox <postmaster@sandbox97af3fd1e6064e988546703ef6938de6.mailgun.org";

// Create Supabase client with admin privileges
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
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
    const { record } = await req.json();

    if (!record || record.status !== "triggered") {
      return new Response(
        JSON.stringify({ message: "No task to process or task not triggered" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    // Download payload from Supabase Storage
    const { data: payloadData, error: downloadError } = await supabase
      .storage
      .from('payloads')
      .download(record.payload_path);

    if (downloadError) {
      throw new Error(`Error downloading payload: ${downloadError.message}`);
    }

    // Convert payload to text (assuming it's a text file)
    const payloadContent = await payloadData.text();

    // Send email using Mailgun
    const mailgunUrl = `https://api.mailgun.net/v3/${mailgunDomain}/messages`;
    const mailgunAuth = btoa(`api:${mailgunApiKey}`);

    const mailgunData = new URLSearchParams();
    mailgunData.append("from", fromEmail);
    mailgunData.append("to", record.recipient_email);
    mailgunData.append("subject", "Project Chimera: Scheduled Task Triggered");
    mailgunData.append("text", "The attached document has been automatically delivered as scheduled.");
    mailgunData.append("html", "<p>The attached document has been automatically delivered as scheduled.</p>");
    mailgunData.append("attachment", new File([payloadContent], "payload.txt").name);

    const mailgunResponse = await fetch(mailgunUrl, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${mailgunAuth}`,
      },
      body: mailgunData,
    });

    if (!mailgunResponse.ok) {
      throw new Error(`Mailgun error: ${mailgunResponse.status} ${mailgunResponse.statusText}`);
    }

    return new Response(
      JSON.stringify({ message: "Email sent successfully" }),
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