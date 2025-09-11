// Background job processor for robust queue management
// This runs as a Supabase Edge Function to process jobs reliably

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface JobProcessorConfig {
  batchSize: number;
  maxProcessingTime: number; // milliseconds
  enableNotifications: boolean;
  enableQueueRecalc: boolean;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const config: JobProcessorConfig = {
      batchSize: 10,
      maxProcessingTime: 45000, // 45 seconds (Edge Functions have 60s limit)
      enableNotifications: true,
      enableQueueRecalc: true,
    };

    const startTime = Date.now();
    const results = {
      jobsProcessed: 0,
      notificationsProcessed: 0,
      errors: [] as string[],
      processingTime: 0,
    };

    // Process job queue
    if (
      config.enableQueueRecalc &&
      Date.now() - startTime < config.maxProcessingTime
    ) {
      try {
        const { data: jobResult, error: jobError } = await supabaseClient.rpc(
          "process_job_queue",
          { p_batch_size: config.batchSize }
        );

        if (jobError) {
          results.errors.push(`Job processing error: ${jobError.message}`);
        } else {
          results.jobsProcessed = jobResult?.processed || 0;
        }
      } catch (error) {
        results.errors.push(`Job processing exception: ${error.message}`);
      }
    }

    // Process notification queue
    if (
      config.enableNotifications &&
      Date.now() - startTime < config.maxProcessingTime
    ) {
      try {
        const { data: notificationResult, error: notificationError } =
          await supabaseClient.rpc("process_notification_queue", {
            p_batch_size: config.batchSize,
          });

        if (notificationError) {
          results.errors.push(
            `Notification processing error: ${notificationError.message}`
          );
        } else {
          results.notificationsProcessed = notificationResult?.processed || 0;
        }
      } catch (error) {
        results.errors.push(
          `Notification processing exception: ${error.message}`
        );
      }
    }

    // Clean up old completed jobs (older than 7 days)
    try {
      await supabaseClient
        .from("job_queue")
        .delete()
        .eq("status", "COMPLETED")
        .lt(
          "completed_at",
          new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
        );
    } catch (error) {
      results.errors.push(`Cleanup error: ${error.message}`);
    }

    results.processingTime = Date.now() - startTime;

    return new Response(
      JSON.stringify({
        success: true,
        timestamp: new Date().toISOString(),
        results,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});

// Health check endpoint
export async function healthCheck() {
  return new Response(
    JSON.stringify({
      status: "healthy",
      timestamp: new Date().toISOString(),
    }),
    {
      headers: { "Content-Type": "application/json" },
      status: 200,
    }
  );
}
