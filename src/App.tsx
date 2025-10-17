import React, { useEffect } from 'react';
import Header from './components/Header';
import Footer from './components/Footer';
import Home from './pages/Home';
import Background from './components/ui/Background';
import AudioControl from './components/ui/AudioControl';
import { useStore } from './store';

function App() {
  const { app, completeFirstVisit } = useStore();
  
  // Mark first visit as complete
  useEffect(() => {
    if (app.isFirstVisit) {
      completeFirstVisit();
    }
  }, [app.isFirstVisit, completeFirstVisit]);
  
  return (
    <div className="min-h-screen bg-background text-neutral-100 font-mono relative">
      <Background />
      <Header />
      <main>
        <Home />
      </main>
      <Footer />
      <AudioControl />
    </div>
  );
}

export default App;