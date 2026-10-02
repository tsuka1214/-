import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertCircle, CheckCircle2, Sparkles, X } from 'lucide-react';
import { PenaltyStage } from '../types';

interface PenaltyOverlayProps {
  stage: PenaltyStage;
  onConfirm: () => void;
}

export const PenaltyOverlay: React.FC<PenaltyOverlayProps> = ({ stage, onConfirm }) => {
  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    // 演出開始
    const timer = setTimeout(() => setShowConfetti(true), 500);
    
    // 背景スクロールを無効化
    document.body.style.overflow = 'hidden';
    
    return () => {
      document.body.style.overflow = 'auto';
      clearTimeout(timer);
    };
  }, []);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md overflow-hidden"
      >
        {/* 背景のキラキラ演出 */}
        <div className="absolute inset-0 pointer-events-none">
          {[...Array(20)].map((_, i) => (
            <motion.div
              key={i}
              initial={{ 
                opacity: 0, 
                scale: 0,
                x: Math.random() * window.innerWidth, 
                y: Math.random() * window.innerHeight 
              }}
              animate={{ 
                opacity: [0, 1, 0],
                scale: [0, 1.5, 0],
                rotate: [0, 180, 360]
              }}
              transition={{ 
                duration: 2 + Math.random() * 3,
                repeat: Infinity,
                delay: Math.random() * 2
              }}
              className="absolute text-amber-400"
            >
              <Sparkles className="w-6 h-6" />
            </motion.div>
          ))}
        </div>

        {/* メインコンテンツ */}
        <motion.div
          initial={{ scale: 0.5, opacity: 0, y: 50 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          transition={{ type: "spring", damping: 15, stiffness: 100 }}
          className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-[32px] border-4 border-blue-500 shadow-[0_0_50px_rgba(59,130,246,0.5)] overflow-hidden flex flex-col items-center text-center p-8 md:p-12"
        >
          {/* ヘッダー演出 */}
          <motion.div
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="mb-6"
          >
            <div className="inline-flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-full text-lg font-black tracking-widest shadow-lg">
              <AlertCircle className="w-6 h-6" />
              罰ゲーム発動！
            </div>
          </motion.div>

          <motion.h2
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.5, type: "spring" }}
            className="text-2xl md:text-3xl font-black text-slate-800 dark:text-slate-100 mb-8"
          >
            スタンプ{stage.threshold}個到達
            {stage.label && <span className="block text-blue-600 mt-2">【{stage.label}】</span>}
          </motion.h2>

          {/* 罰ゲーム内容の巨大表示 */}
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.8, duration: 0.6, type: "spring" }}
            className="w-full bg-rose-50 dark:bg-rose-950/30 rounded-3xl p-8 md:p-12 border-2 border-rose-200 dark:border-rose-900 mb-10 shadow-inner relative group"
          >
            <div className="absolute -top-4 -left-4 bg-rose-600 text-white p-2 rounded-xl rotate-[-12deg] shadow-md font-black text-sm">
              執行内容
            </div>
            
            <p 
              className="font-black text-rose-600 dark:text-rose-400 break-words leading-tight"
              style={{ fontSize: 'clamp(2rem, 10vw, 5rem)' }}
            >
              {stage.description || '内容未設定'}
            </p>
          </motion.div>

          {/* 確認ボタン */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onConfirm}
            className="w-full py-5 bg-slate-900 dark:bg-blue-600 text-white font-black text-xl rounded-2xl shadow-xl hover:bg-slate-800 dark:hover:bg-blue-500 transition-all flex items-center justify-center gap-3 group"
          >
            <CheckCircle2 className="w-7 h-7 group-hover:scale-110 transition-transform" />
            内容を確認しました
          </motion.button>

          {/* 装飾用背景パターン */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full -mr-16 -mt-16 blur-3xl" />
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-rose-500/5 rounded-full -ml-16 -mb-16 blur-3xl" />
        </motion.div>

        {/* 紙吹雪演出 (簡易版) */}
        {showConfetti && (
          <div className="absolute inset-0 pointer-events-none">
            {[...Array(50)].map((_, i) => (
              <motion.div
                key={`confetti-${i}`}
                initial={{ 
                  x: Math.random() * window.innerWidth, 
                  y: -20,
                  rotate: 0,
                  opacity: 1
                }}
                animate={{ 
                  y: window.innerHeight + 20,
                  rotate: 720,
                  opacity: 0
                }}
                transition={{ 
                  duration: 3 + Math.random() * 2,
                  ease: "linear",
                  delay: Math.random() * 0.5
                }}
                className={`absolute w-3 h-3 ${
                  ['bg-blue-500', 'bg-rose-500', 'bg-amber-400', 'bg-emerald-400'][i % 4]
                }`}
              />
            ))}
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
};
