import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Cloud, TreePine, Award, Leaf } from 'lucide-react';

export default function EcoGame() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(() => parseInt(localStorage.getItem('eco-highscore') || '0'));
  const [gameOver, setGameOver] = useState(false);
  
  const gameAreaRef = useRef(null);
  const playerRef = useRef(null);
  const playerXRef = useRef(50);
  const cloudsRef = useRef([]);
  const keysRef = useRef({});
  const rafRef = useRef(null);
  const lastTimeRef = useRef(0);
  const spawnTimerRef = useRef(0);
  const scoreRef = useRef(0);

  useEffect(() => {
    const down = (e) => { keysRef.current[e.key] = true; };
    const up = (e) => { keysRef.current[e.key] = false; };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, []);

  const gameLoop = useCallback((timestamp) => {
    if (!lastTimeRef.current) lastTimeRef.current = timestamp;
    const dt = (timestamp - lastTimeRef.current) / 1000;
    lastTimeRef.current = timestamp;

    if (!isPlaying || gameOver) return;

    // 1. Move Player
    const speed = 120; // pixels per sec as %
    if (keysRef.current['ArrowLeft'] || keysRef.current['a']) {
      playerXRef.current = Math.max(3, playerXRef.current - speed * dt);
    }
    if (keysRef.current['ArrowRight'] || keysRef.current['d']) {
      playerXRef.current = Math.min(97, playerXRef.current + speed * dt);
    }
    
    // Update player DOM directly for 60fps
    if (playerRef.current) {
      playerRef.current.style.left = `${playerXRef.current}%`;
    }

    // 2. Spawn Clouds
    spawnTimerRef.current += dt;
    if (spawnTimerRef.current > 0.4) {
      spawnTimerRef.current = 0;
      const isGood = Math.random() > 0.3;
      
      // Create DOM element for cloud
      const cloudEl = document.createElement('div');
      cloudEl.className = 'absolute transition-none transform -translate-x-1/2 -translate-y-1/2';
      cloudEl.style.left = `${5 + Math.random() * 90}%`;
      cloudEl.style.top = '-5%';
      
      if (isGood) {
        cloudEl.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-green drop-shadow-[0_0_8px_rgba(0,255,178,0.6)]"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 22 12 12"/></svg>`;
      } else {
        cloudEl.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-red-400 drop-shadow-[0_0_8px_rgba(239,68,68,0.4)]"><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/></svg>`;
      }
      
      if (gameAreaRef.current) {
        gameAreaRef.current.appendChild(cloudEl);
      }

      cloudsRef.current.push({
        el: cloudEl,
        x: parseFloat(cloudEl.style.left),
        y: -5,
        isGood,
        speed: 25 + Math.random() * 15,
      });
    }

    // 3. Update Clouds & Check Collisions
    let hit = false;
    let newScore = scoreRef.current;
    
    for (let i = cloudsRef.current.length - 1; i >= 0; i--) {
      const c = cloudsRef.current[i];
      c.y += c.speed * dt;
      
      // Direct DOM update
      if (c.el) {
         c.el.style.top = `${c.y}%`;
      }

      // Collision detection (approximate Y 85-95)
      if (c.y >= 82 && c.y <= 95) {
        if (Math.abs(c.x - playerXRef.current) < 7) {
          if (c.isGood) {
            newScore += 10;
            if (c.el && c.el.parentNode) c.el.parentNode.removeChild(c.el);
            cloudsRef.current.splice(i, 1);
            continue;
          } else {
            hit = true;
          }
        }
      }
      
      // Cleanup offscreen
      if (c.y > 105) {
         if (c.el && c.el.parentNode) c.el.parentNode.removeChild(c.el);
         cloudsRef.current.splice(i, 1);
      }
    }

    // Sync score to React occasionally to avoid too many renders
    if (newScore !== scoreRef.current) {
      scoreRef.current = newScore;
      setScore(newScore);
    }

    if (hit) {
      const final = scoreRef.current;
      if (final > highScore) {
        setHighScore(final);
        localStorage.setItem('eco-highscore', String(final));
      }
      setGameOver(true);
      setIsPlaying(false);
      return;
    }

    rafRef.current = requestAnimationFrame(gameLoop);
  }, [isPlaying, gameOver, highScore]);

  useEffect(() => {
    if (isPlaying) {
      lastTimeRef.current = 0;
      rafRef.current = requestAnimationFrame(gameLoop);
    }
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [isPlaying, gameLoop]);

  const startGame = () => {
    // Cleanup old DOM nodes
    cloudsRef.current.forEach(c => {
      if (c.el && c.el.parentNode) c.el.parentNode.removeChild(c.el);
    });
    cloudsRef.current = [];
    scoreRef.current = 0;
    playerXRef.current = 50;
    spawnTimerRef.current = 0;
    if (playerRef.current) playerRef.current.style.left = '50%';
    
    setScore(0);
    setGameOver(false);
    setIsPlaying(true);
  };

  const handleTouch = (e) => {
    if (!isPlaying) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.touches[0].clientX - rect.left) / rect.width) * 100;
    playerXRef.current = Math.max(3, Math.min(97, x));
    if (playerRef.current) playerRef.current.style.left = `${playerXRef.current}%`;
  };

  return (
    <div className="max-w-4xl mx-auto pb-12 h-full flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-display font-bold">Carbon Catcher</h1>
          <p className="text-secondary mt-1">Catch leaves, dodge CO&#x2082; clouds! Use arrow keys or A/D.</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="bg-widget px-3 py-2 rounded-xl border border-glass-border text-center">
            <div className="text-xs text-secondary">Best</div>
            <div className="font-bold font-mono-data text-green">{highScore}</div>
          </div>
          <div className="bg-widget px-4 py-2 rounded-xl border border-glass-border flex items-center gap-2">
            <Award className="h-5 w-5 text-green" />
            <span className="font-bold font-mono-data text-xl text-green">{score} XP</span>
          </div>
        </div>
      </div>

      <div
        ref={gameAreaRef}
        className="flex-1 rounded-3xl border border-glass-border relative overflow-hidden min-h-[450px] bg-gradient-to-br from-panel to-widget shadow-inner"
        onTouchMove={handleTouch}
        onTouchStart={handleTouch}
      >
        {/* Ambient glow */}
        <div className="absolute inset-0 opacity-30 pointer-events-none z-0">
          <div className="absolute top-10 left-10 w-32 h-32 bg-green/30 rounded-full blur-3xl" />
          <div className="absolute top-40 right-20 w-48 h-48 bg-cyan/20 rounded-full blur-3xl" />
          <div className="absolute bottom-20 left-1/2 w-40 h-40 bg-green/10 rounded-full blur-3xl" />
        </div>

        {/* Start screen */}
        {!isPlaying && !gameOver && (
          <div className="absolute inset-0 flex flex-col items-center justify-center z-20 bg-app/40 backdrop-blur-sm">
            <Leaf className="h-16 w-16 text-green mb-4" />
            <h2 className="text-4xl font-bold text-green mb-2 font-display">Carbon Catcher</h2>
            <p className="text-secondary mb-2">Catch green leaves (+10 XP each)</p>
            <p className="text-secondary mb-8">Avoid red CO&#x2082; clouds!</p>
            <button
              onClick={startGame}
              className="bg-green text-app font-bold py-3 px-10 rounded-xl hover:bg-green/90 transition-transform hover:-translate-y-1 shadow-[0_0_20px_rgba(0,255,178,0.3)] text-lg"
            >
              Play Now
            </button>
          </div>
        )}

        {/* Game over */}
        {gameOver && (
          <div className="absolute inset-0 flex flex-col items-center justify-center z-20 bg-app/50 backdrop-blur-sm">
            <Cloud className="h-16 w-16 text-red-500 mb-4" />
            <h2 className="text-4xl font-bold text-red-500 mb-2 font-display">Game Over!</h2>
            <p className="text-xl text-main mb-2">Score: {score} XP</p>
            {score >= highScore && score > 0 && <p className="text-green font-bold mb-4">New High Score!</p>}
            <button
              onClick={startGame}
              className="bg-green text-app font-bold py-3 px-10 rounded-xl hover:bg-green/90 transition-transform hover:-translate-y-1 shadow-[0_0_20px_rgba(0,255,178,0.3)] text-lg"
            >
              Play Again
            </button>
          </div>
        )}

        {/* Player (Directly manipulated via DOM) */}
        <div
          ref={playerRef}
          className="absolute bottom-3 transform -translate-x-1/2 z-10"
          style={{ left: '50%', willChange: 'left' }}
        >
          <div className="p-3 rounded-full border-2 border-green bg-green/10 shadow-[0_0_25px_rgba(0,255,178,0.3)]">
            <TreePine className="h-10 w-10 text-green" />
          </div>
        </div>
      </div>
    </div>
  );
}
