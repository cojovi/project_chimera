/*
  # Setup monitored storage and rapid task processing
  
  1. Changes
    - Create 'monitored' storage bucket
    - Update task interval to 10 minutes
    - Add function for processing storage files
    - Add storage access policies
  
  2. Security
    - Enable RLS on storage bucket
    - Add policy for function access
*/

-- Create storage bucket if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM storage.buckets WHERE id = 'monitored'
  ) THEN
    INSERT INTO storage.buckets (id, name)
    VALUES ('monitored', 'monitored');
  END IF;
END $$;

-- Update default postponement interval to 10 minutes
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'scheduled_tasks' 
    AND column_name = 'postponement_interval'
  ) THEN
    ALTER TABLE scheduled_tasks 
    ALTER COLUMN postponement_interval SET DEFAULT 10;
  END IF;
END $$;

-- Function to process storage files
CREATE OR REPLACE FUNCTION process_storage_files()
RETURNS void AS $$
BEGIN
  -- Use pg_net to make an HTTP request to the Edge Function
  PERFORM net.http_post(
    url := current_setting('app.edge_function_url') || '/process-storage-files',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.edge_function_key')
    ),
    body := '{}'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enable RLS on storage bucket if not already enabled
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'objects' 
    AND schemaname = 'storage' 
    AND policyname = 'Function can access monitored files'
  ) THEN
    ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
    
    CREATE POLICY "Function can access monitored files"
      ON storage.objects
      FOR ALL
      TO postgres
      USING (bucket_id = 'monitored');
  END IF;
END $$;