import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useStore, calculateCountdownState, determineVisualState } from '../store';
import CountdownTimer from '../components/ui/CountdownTimer';
import PasswordEntryForm from '../components/PasswordEntryForm';
import StatusInfo from '../components/StatusInfo';
import { getCurrentTask, postponeTask, testConnection } from '../services/supabase';
import { addMinutes } from 'date-fns';
import { useAudio } from '../hooks/useAudio';

const Home: React.FC = () => {
  const { task, setTask, setTargetDate, setVisualState } = useStore();
  const [isLoading, setIsLoading] = useState(true);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const { playSound } = useAudio();
  
  // Load task data on component mount
  useEffect(() => {
    const loadTaskData = async () => {
      try {
        console.log('Starting to load task data...');
        
        // First test the connection
        const isConnected = await testConnection();
        if (!isConnected) {
          setConnectionError('Unable to connect to database. Using demo mode.');
          console.log('Connection failed, switching to demo mode');
        } else {
          setConnectionError(null);
        }
        
        const task = await getCurrentTask();
        
        if (task) {
          console.log('Loaded task from database:', task);
          setTask(task);
          const targetDate = new Date(task.nextTriggerAt);
          setTargetDate(targetDate);
          
          // Set initial visual state
          const countdown = calculateCountdownState(targetDate);
          const visualState = determineVisualState(countdown.percentage);
          setVisualState(visualState);
        } else {
          console.log('No task found, setting up demo task');
          // Setup a demo task if none exists
          const demoTargetDate = addMinutes(new Date(), 10);
          setTargetDate(demoTargetDate);
          
          // Demo task
          setTask({
            id: 'demo',
            createdAt: new Date().toISOString(),
            nextTriggerAt: demoTargetDate.toISOString(),
            payloadPath: '/storage/payloads/demo.enc',
            recipientEmail: 'cody@cojovi.com',
            postponementInterval: 10,
            status: 'pending'
          });
        }
      } catch (error) {
        console.error('Error loading task data:', error);
        setConnectionError('Failed to load data. Using demo mode.');
        
        // Fallback to demo mode
        const demoTargetDate = addMinutes(new Date(), 10);
        setTargetDate(demoTargetDate);
        
        setTask({
          id: 'demo',
          createdAt: new Date().toISOString(),
          nextTriggerAt: demoTargetDate.toISOString(),
          payloadPath: '/storage/payloads/demo.enc',
          recipientEmail: 'cody@cojovi.com',
          postponementInterval: 10,
          status: 'pending'
        });
      } finally {
        setIsLoading(false);
      }
    };
    
    loadTaskData();
  }, [setTask, setTargetDate, setVisualState]);
  
  // Handle successful password entry
  const handleSuccessfulEntry = async () => {
    playSound('success');
    
    if (task) {
      try {
        const demoTargetDate = addMinutes(new Date(), 10);
        
        // Update local state
        setTargetDate(demoTargetDate);
        
        // Update task
        const updatedTask = {
          ...task,
          nextTriggerAt: demoTargetDate.toISOString()
        };
        
        setTask(updatedTask);
        
        // Call postponeTask for both demo and real tasks
        await postponeTask(task.id, task.postponementInterval);
      } catch (error) {
        console.error('Error postponing task:', error);
      }
    }
  };
  
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <motion.div 
          className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full"
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        />
      </div>
    );
  }
  
  return (
    <motion.div 
      className="min-h-screen pt-16 pb-16 flex flex-col items-center justify-center px-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 1 }}
    >
      {connectionError && (
        <motion.div 
          className="mb-4 p-3 bg-yellow-100 border border-yellow-400 text-yellow-700 rounded-lg text-sm"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {connectionError}
        </motion.div>
      )}
      
      <CountdownTimer />
      
      <motion.div 
        className="mt-8"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.5 }}
      >
        <PasswordEntryForm onSuccess={handleSuccessfulEntry} />
      </motion.div>
      
      <StatusInfo />
    </motion.div>
  );
};

export default Home;