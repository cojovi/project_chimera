/*
  # Add email trigger functionality
  
  1. Changes
    - Add function to send email when task is triggered
    - Add trigger to execute the function when task status changes to 'triggered'
  
  2. Security
    - Function runs with SECURITY DEFINER to ensure proper permissions
    - Trigger only fires on status change to 'triggered'
*/

-- Create function to send email when task is triggered
CREATE OR REPLACE FUNCTION send_email_on_task_trigger()
RETURNS TRIGGER AS $$
BEGIN
  -- Use pg_net to make an HTTP request to the Edge Function
  PERFORM net.http_post(
    url := 'https://your-project.supabase.co/functions/v1/send-email-on-trigger', -- Replace with your function URL
    body := json_build_object('record', NEW)::text,
    headers := json_build_object('Content-Type', 'application/json')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to execute the function when task status is updated to 'triggered'
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'on_scheduled_tasks_triggered'
  ) THEN
    CREATE TRIGGER on_scheduled_tasks_triggered
    AFTER UPDATE ON scheduled_tasks
    FOR EACH ROW
    WHEN (NEW.status = 'triggered' AND OLD.status <> 'triggered')
    EXECUTE FUNCTION send_email_on_task_trigger();
  END IF;
END $$;