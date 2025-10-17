import React from 'react';
import { motion } from 'framer-motion';
import { Clock, Mail } from 'lucide-react';
import { format } from 'date-fns';
import { useStore } from '../store';

const StatusInfo: React.FC = () => {
  const { task } = useStore();
  
  // Helper to format date for display
  const formatDate = (dateString: string): string => {
    try {
      return format(new Date(dateString), 'yyyy-MM-dd HH:mm:ss');
    } catch (e) {
      return 'Invalid Date';
    }
  };
  
  if (!task) return null;
  
  // Extract email domain for display
  const emailDomain = task.recipientEmail.split('@')[1] || 'unknown';

  return (
    <motion.div 
      className="w-full max-w-xl mt-6 bg-surface/50 border border-neutral-700 rounded p-4"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.3 }}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="flex items-center">
          <Clock size={16} className="text-neutral-400 mr-2" />
          <div>
            <div className="text-xs text-neutral-500 font-mono">NEXT TRIGGER</div>
            <div className="text-sm text-neutral-200 font-mono">{formatDate(task.nextTriggerAt)}</div>
          </div>
        </div>
        
        <div className="flex items-center">
          <Mail size={16} className="text-neutral-400 mr-2" />
          <div>
            <div className="text-xs text-neutral-500 font-mono">DESTINATION</div>
            <div className="text-sm text-neutral-200 font-mono">*****@{emailDomain}</div>
          </div>
        </div>
        
        <div className="col-span-1 md:col-span-2 mt-2 pt-2 border-t border-neutral-700">
          <div className="text-xs text-neutral-500 font-mono mb-1">SYSTEM STATUS</div>
          <div className="text-xs text-neutral-400 font-mono flex items-center">
            <div className="w-2 h-2 rounded-full bg-primary mr-2"></div>
            PAYLOAD ENCRYPTED AND SECURED
          </div>
          <div className="text-xs text-neutral-400 font-mono flex items-center mt-1">
            <div className="w-2 h-2 rounded-full bg-primary mr-2"></div>
            AUTO-POSTPONEMENT: {task.postponementInterval} DAYS
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default StatusInfo;