/*
  # Create scheduled_tasks table

  1. New Tables
    - `scheduled_tasks`
      - `id` (uuid, primary key)
      - `created_at` (timestamp)
      - `next_trigger_at` (timestamp)
      - `payload_path` (text)
      - `recipient_email` (text)
      - `postponement_interval` (integer, days)
      - `status` (text)
  2. Security
    - Enable RLS on `scheduled_tasks` table
    - Add policy for authenticated users to read their own data
*/

CREATE TABLE IF NOT EXISTS scheduled_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  next_trigger_at timestamptz NOT NULL,
  payload_path text NOT NULL,
  recipient_email text NOT NULL,
  postponement_interval integer NOT NULL DEFAULT 5,
  status text NOT NULL CHECK (status IN ('pending', 'triggered', 'paused')) DEFAULT 'pending'
);

ALTER TABLE scheduled_tasks ENABLE ROW LEVEL SECURITY;

-- Allow users to read their own tasks
CREATE POLICY "Users can read their own scheduled tasks"
  ON scheduled_tasks
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Allow users to update their own tasks
CREATE POLICY "Users can update their own scheduled tasks"
  ON scheduled_tasks
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);