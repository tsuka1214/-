import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface SplashScreenProps {
  onFinish: () => void;
  clubName?: string;
  memberPart?: string;
  duration?: number; // Total duration in milliseconds
}

export const SplashScreen: React.FC<SplashScreenProps> = ({
  onFinish,
  clubName = '吹奏楽部',
  memberPart = '',
  duration = 2000,
}) => {
  const [isVisible, setIsVisible] = useState(true);

  // 楽器名から絵文字を決定する
  const getInstrumentEmoji = (part: string) => {
    const p = part.toLowerCase();
    if (p.includes('サックス') || p.includes('sax')) return '🎷';
    if (p.includes('トランペット') || p.includes('tp') || p.includes('trumpet')) return '🎺';
    if (p.includes('トロンボーン') || p.includes('tb') || p.includes('trombone')) return '🎺';
    if (p.includes('ホルン') || p.includes('hr') || p.includes('horn')) return '📯';
    if (p.includes('パーカッション') || p.includes('打楽器') || p.includes('perc')) return '🥁';
    if (p.includes('コントラバス') || p.includes('弦バス') || p.includes('cb')) return '🎻';
    if (p.includes('フルート') || p.includes('fl')) return '🪄'; // フルートの絵文字がないため
    if (p.includes('クラリネット') || p.includes('cl')) return '🪄';
    if (p.includes('ユーフォ') || p.includes('euph')) return '🎺';
    if (p.includes('チューバ') || p.includes('tuba')) return '🎺';
    return '🎺'; // デフォルト
  };

  const instrumentEmoji = getInstrumentEmoji(memberPart);

  useEffect(() => {
    // 2秒間表示
    const timer = setTimeout(() => {
      setIsVisible(false);
    }, duration);

    // 安全策: アニメーション完了イベントが発火しなかった場合でも確実に終了させる
    const safetyTimer = setTimeout(() => {
      onFinish();
    }, duration + 600);

    return () => {
      clearTimeout(timer);
      clearTimeout(safetyTimer);
    };
  }, [duration, onFinish]);

  const handleExitComplete = () => {
    onFinish();
  };

  // 10 Particles data
  const particles = Array.from({ length: 10 }).map((_, i) => ({
    id: i,
    size: Math.random() * 5 + 3,
    left: `${Math.random() * 100}%`,
    top: `${Math.random() * 100}%`,
    duration: Math.random() * 4 + 3,
    delay: Math.random() * 2,
    opacity: Math.random() * 0.4 + 0.2,
  }));

  // Notes data for the staff animation
  const notes = [
    { symbol: '♪', delay: 0 },
    { symbol: '♫', delay: 0.8 },
    { symbol: '♩', delay: 1.6 },
    { symbol: '♬', delay: 2.4 },
    { symbol: '♪', delay: 3.2 },
  ];

  return (
    <AnimatePresence onExitComplete={handleExitComplete}>
      {isVisible && (
        <motion.div
          id="app-splash-screen"
          onClick={() => {
            setIsVisible(false);
            onFinish();
          }}
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5, ease: 'easeInOut' }}
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center overflow-hidden"
        >
          {/* Custom CSS Animations */}
          <style>
            {`
              @keyframes gradientFlow {
                0% { background-position: 0% 50%; }
                50% { background-position: 100% 50%; }
                100% { background-position: 0% 50%; }
              }
              .splash-bg-gradient {
                background: linear-gradient(135deg, #ffffff, #f0f9ff, #e0f2fe, #f0f9ff, #ffffff);
                background-size: 400% 400%;
                animation: gradientFlow 8s ease-in-out infinite;
              }
              .dark .splash-bg-gradient {
                background: linear-gradient(135deg, #0f172a, #020617, #0f172a);
                background-size: 400% 400%;
                animation: gradientFlow 8s ease-in-out infinite;
              }

              @keyframes particleDrift {
                0%, 100% { transform: translate(0, 0); }
                33% { transform: translate(15px, -15px); }
                66% { transform: translate(-10px, -25px); }
              }

              @keyframes staffNoteFlow {
                0% { transform: translateX(110vw); opacity: 0; }
                10% { opacity: 0.4; }
                90% { opacity: 0.4; }
                100% { transform: translateX(-20vw); opacity: 0; }
              }

              @keyframes shimmerSweep {
                0% { transform: translateX(-150%) skewX(-20deg); opacity: 0; }
                20% { opacity: 0.6; }
                80% { opacity: 0.6; }
                100% { transform: translateX(150%) skewX(-20deg); opacity: 0; }
              }

              @keyframes fadeInPop {
                0% { opacity: 0; transform: translateY(15px) scale(0.95); }
                100% { opacity: 1; transform: translateY(0) scale(1); }
              }

              .silhouette-blue {
                filter: grayscale(1) brightness(0.6) sepia(1) hue-rotate(185deg) saturate(4);
              }
            `}
          </style>

          {/* 1. Background */}
          <div className="absolute inset-0 splash-bg-gradient" />

          {/* 2. Light Particles */}
          <div className="absolute inset-0 pointer-events-none">
            {particles.map((p) => (
              <div
                key={p.id}
                className="absolute rounded-full bg-blue-300/40 dark:bg-blue-400/20"
                style={{
                  width: `${p.size}px`,
                  height: `${p.size}px`,
                  left: p.left,
                  top: p.top,
                  opacity: p.opacity,
                  animation: `particleDrift ${p.duration}s ease-in-out ${p.delay}s infinite`,
                }}
              />
            ))}
          </div>

          {/* 3. Staff and Notes */}
          <div className="absolute bottom-[20%] left-0 w-full flex flex-col justify-between h-10 px-0 opacity-15 dark:opacity-10 pointer-events-none">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="w-full h-[1px] bg-blue-600 dark:bg-blue-200" />
            ))}
            <div className="absolute inset-0 flex items-center">
              {notes.map((note, i) => (
                <span
                  key={i}
                  className="absolute text-xl sm:text-2xl"
                  style={{
                    top: `${Math.sin(i) * 10}px`,
                    animation: `staffNoteFlow 5s linear ${note.delay}s infinite`,
                  }}
                >
                  {note.symbol}
                </span>
              ))}
            </div>
          </div>

          {/* 4. App Name and Logo */}
          <div className="relative z-10 flex flex-col items-center text-center">
            {/* Logo Silhouette */}
            <div 
              className="text-6xl sm:text-7xl mb-5 silhouette-blue opacity-90"
              style={{ animation: 'fadeInPop 1s ease-out forwards' }}
            >
              {instrumentEmoji}
            </div>

            {/* App Name Container */}
            <div 
              className="relative overflow-hidden px-4 py-2"
              style={{ animation: 'fadeInPop 1s ease-out 0.2s forwards', opacity: 0 }}
            >
              <h1 className="text-2xl sm:text-3xl font-bold tracking-[0.15em] text-blue-900 dark:text-blue-100">
                {clubName} 出欠連絡
              </h1>
              
              {/* Shimmer Effect Overlay */}
              <div 
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent w-[50%] h-full pointer-events-none"
                style={{
                  animation: 'shimmerSweep 1.5s ease-in-out 1s forwards',
                }}
              />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

