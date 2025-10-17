import { createClient } from "npm:@supabase/supabase-js@2.39.3";
import { Buffer } from "node:buffer";

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const mailgunApiKey = Deno.env.get("MAILGUN_API_KEY") || "";
const mailgunDomain = Deno.env.get("MAILGUN_DOMAIN") || "";
const fromEmail = Deno.env.get("FROM_EMAIL") || "Mailgun Sandbox <postmaster@sandbox97af3fd1e6064e988546703ef6938de6.mailgun.org";
const targetEmail = "cojovi@icloud.com";

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// Helper function to send email with retry logic
async function sendEmailWithRetry(formData: FormData, retries = 3): Promise<boolean> {
  const mailgunUrl = `https://api.mailgun.net/v3/${mailgunDomain}/messages`;
  const mailgunAuth = btoa(`api:${mailgunApiKey}`);

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const emailResponse = await fetch(mailgunUrl, {
        method: "POST",
        headers: {
          "Authorization": `Basic ${mailgunAuth}`,
        },
        body: formData,
      });

      if (emailResponse.ok) {
        return true;
      }

      console.error(`Email send attempt ${attempt} failed:`, await emailResponse.text());
      
      if (attempt < retries) {
        // Wait for 1 minute before retrying
        await new Promise(resolve => setTimeout(resolve, 60000));
      }
    } catch (error) {
      console.error(`Email send attempt ${attempt} error:`, error);
      
      if (attempt < retries) {
        await new Promise(resolve => setTimeout(resolve, 60000));
      }
    }
  }

  return false;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    // List files in the monitored bucket
    const { data: files, error: listError } = await supabase
      .storage
      .from('monitored')
      .list();

    if (listError) {
      throw new Error(`Error listing files: ${listError.message}`);
    }

    if (!files || files.length === 0) {
      return new Response(
        JSON.stringify({ message: "No files to process" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    // Download all files
    const attachments = await Promise.all(
      files.map(async (file) => {
        const { data, error: downloadError } = await supabase
          .storage
          .from('monitored')
          .download(file.name);

        if (downloadError) {
          throw new Error(`Error downloading ${file.name}: ${downloadError.message}`);
        }

        return {
          filename: file.name,
          data: await data.arrayBuffer(),
        };
      })
    );

    // Prepare Mailgun request
    const formData = new FormData();
    formData.append("from", fromEmail);
    formData.append("to", targetEmail);
    formData.append("subject", "Project Chimera: Timer Expired - Files Attached");
    formData.append("text", `The 10-minute timer has expired at ${new Date().toISOString()}.\n\n${files.length} file(s) have been retrieved from storage.`);

    // Attach files
    attachments.forEach((attachment) => {
      formData.append("attachment", 
        new Blob([attachment.data], { type: "application/octet-stream" }), 
        attachment.filename
      );
    });

    // Send email with retry logic
    const emailSent = await sendEmailWithRetry(formData);

    if (!emailSent) {
      throw new Error("Failed to send email after multiple attempts");
    }

    // Clean up processed files
    await Promise.all(
      files.map((file) => 
        supabase.storage.from('monitored').remove([file.name])
      )
    );

    return new Response(
      JSON.stringify({ 
        message: `Processed and sent ${files.length} files`,
        files: files.map(f => f.name)
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (err) {
    console.error("Error processing storage files:", err);

    return new Response(
      JSON.stringify({ error: err.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});