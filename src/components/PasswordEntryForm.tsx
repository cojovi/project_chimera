import React, { useState } from 'react';
import { Lock, Loader } from 'lucide-react';
import Input from './ui/Input';
import Button from './ui/Button';
import { usePasswordValidation } from '../hooks/usePasswordValidation';
import { motion } from 'framer-motion';

interface PasswordEntryFormProps {
  onSuccess: () => void;
}

const PasswordEntryForm: React.FC<PasswordEntryFormProps> = ({ onSuccess }) => {
  const [password, setPassword] = useState('');
  const { validateInput, isValidating, error } = usePasswordValidation();
  
  const handleSubmit = async () => {
    if (!password.trim() || isValidating) return;
    
    const isValid = await validateInput(password);
    if (isValid) {
      onSuccess();
      setPassword('');
    }
  };
  
  return (
    <motion.div 
      className="flex flex-col w-full max-w-md px-6"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8 }}
    >
      <div className="font-mono text-xs text-neutral-500 mb-2 flex items-center">
        <Lock size={12} className="mr-1" />
        AUTHENTICATION REQUIRED
      </div>
      
      <div className="flex mb-6">
        <Input
          value={password}
          onChange={setPassword}
          onSubmit={handleSubmit}
          autoFocus
          type="password"
          className="flex-1"
        />
        
        <Button 
          onClick={handleSubmit}
          className="ml-2"
          disabled={isValidating || !password.trim()}
          glitchEffect
        >
          {isValidating ? <Loader size={18} className="animate-spin" /> : "EXECUTE"}
        </Button>
      </div>
      
      {error && (
        <motion.div 
          className="text-sm text-error font-mono mt-2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          {error}
        </motion.div>
      )}
      
      <div className="font-mono text-xs text-neutral-400 mt-4 text-center opacity-60">
        ENTER VERIFICATION KEY TO POSTPONE SCHEDULED OPERATION
      </div>
    </motion.div>
  );
};

export default PasswordEntryForm;