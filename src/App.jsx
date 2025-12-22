import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform, useAnimation } from 'framer-motion';
import { Check, History, Sparkles, ChevronUp, ChevronRight } from 'lucide-react';

// --- 布局配置参数 ---
const PIVOT_DIST = 1500; // 屏幕底部到圆心的距离
const ROW_GAP = 140;     // 每一行扇形之间的间距（半径差）
const CARDS_PER_ROW = 5; // 每一行放多少张卡片
const ANGLE_START = -12; // 历史记录的第一张卡片角度（偏左）
const ANGLE_STEP = 10;   // 每张卡片之间的角度差

// --- 颜色/紧急程度配置 ---
const PRIORITIES = [
  { id: 'urgent', color: '#EF4444', bg: 'bg-red-500', border: 'border-red-200', text: 'text-red-600', label: '紧急' },
  { id: 'high', color: '#F97316', bg: 'bg-orange-500', border: 'border-orange-200', text: 'text-orange-600', label: '重要' },
  { id: 'normal', color: '#3B82F6', bg: 'bg-blue-500', border: 'border-blue-200', text: 'text-blue-600', label: '日常' },
  { id: 'low', color: '#10B981', bg: 'bg-emerald-500', border: 'border-emerald-200', text: 'text-emerald-600', label: '轻松' },
];

const TaskFlow = () => {
  // 状态管理
  const [history, setHistory] = useState([
    { id: 'h1', text: '晨间冥想', completedAt: new Date(), priority: 'low' },
    { id: 'h2', text: '项目进度汇报 PPT', completedAt: new Date(), priority: 'urgent' },
    { id: 'h3', text: '阅读设计心理学', completedAt: new Date(), priority: 'normal' },
    { id: 'h4', text: '整理桌面', completedAt: new Date(), priority: 'low' },
    { id: 'h5', text: '回复客户邮件', completedAt: new Date(), priority: 'high' },
    { id: 'h6', text: '健身房打卡', completedAt: new Date(), priority: 'normal' },
  ]);
  
  const [currentTask, setCurrentTask] = useState({
    id: 'c-init',
    text: '',
    createdAt: new Date(),
    priority: 'normal'
  });

  const generateId = () => Math.random().toString(36).substr(2, 9);

  const handleComplete = () => {
    if (!currentTask.text.trim()) return;

    const completedTask = { ...currentTask, completedAt: new Date() };
    // 新完成的任务加入历史头部 (index 0)
    setHistory(prev => [completedTask, ...prev]);

    // 重置当前任务
    setCurrentTask({
      id: generateId(),
      text: '',
      createdAt: new Date(),
      priority: 'normal'
    });
  };

  const handleRestore = (task) => {
    if(!currentTask.text) {
        setCurrentTask({ ...task, id: generateId() });
        setHistory(prev => prev.filter(t => t.id !== task.id));
    }
  };

  /**
   * 核心布局算法：计算历史卡片位置
   * 采用“贪吃蛇”式的填充逻辑，或者简单的多行左滑逻辑
   */
  const getCardStyle = (index) => {
    // 0 -> Row 0, Col 0
    // 4 -> Row 0, Col 4
    // 5 -> Row 1, Col 0 (换行)
    const row = Math.floor(index / CARDS_PER_ROW);
    const col = index % CARDS_PER_ROW;

    // 角度向左递增 (负值更大)
    const angle = ANGLE_START - (col * ANGLE_STEP);
    
    // 半径随行数增加 (离屏幕底部更远/更高)
    // 为了保持同心圆效果，我们需要调整 bottom 位置和 transformOrigin
    const yOffset = -1 * (row * ROW_GAP); 
    const originDistance = PIVOT_DIST + (row * ROW_GAP);

    return { angle, yOffset, originDistance, row, col };
  };

  return (
    <div className="relative w-full h-screen overflow-hidden bg-[#F2F0E9] text-stone-800 font-sans selection:bg-orange-100">
      {/* 装饰：同心圆轨迹线 */}
      <div className="absolute inset-0 pointer-events-none flex justify-center items-end overflow-hidden">
        {/* 绘制几条淡淡的轨道线，暗示扇形结构 */}
        {[0, 1, 2].map(i => (
            <div 
                key={i}
                className="absolute border border-stone-300/30 rounded-full"
                style={{
                    width: (PIVOT_DIST + i * ROW_GAP) * 2,
                    height: (PIVOT_DIST + i * ROW_GAP) * 2,
                    bottom: -(PIVOT_DIST + i * ROW_GAP),
                }}
            />
        ))}
        {/* 背景光 */}
        <div className="absolute top-0 left-0 w-full h-64 bg-gradient-to-b from-white/60 to-transparent" />
      </div>

      <header className="absolute top-8 left-0 w-full flex justify-center z-10 opacity-60">
        <div className="flex items-center space-x-2 text-stone-500 tracking-widest uppercase text-xs font-semibold">
          <Sparkles size={14} />
          <span>Task Radar</span>
        </div>
      </header>

      {/* 核心交互区域 */}
      <div className="absolute bottom-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="relative w-full h-full flex justify-center items-end">
            
            <div className="relative w-0 h-0 flex justify-center items-center pointer-events-auto">

                <AnimatePresence mode='popLayout'>
                    {/* --- 历史卡片 --- */}
                    {history.map((task, index) => {
                        const style = getCardStyle(index);
                        // 只显示前 3 行，避免太乱
                        if (style.row > 2) return null;

                        return (
                            <HistoryCard 
                                key={task.id} 
                                task={task} 
                                styleConfig={style}
                                onClick={() => handleRestore(task)}
                            />
                        );
                    })}
                </AnimatePresence>

                {/* --- 当前任务卡片 --- */}
                <CurrentCard 
                    key={currentTask.id}
                    task={currentTask} 
                    setTask={setCurrentTask}
                    onComplete={handleComplete}
                />

            </div>
        </div>
      </div>
    </div>
  );
};

// --- 子组件：当前任务卡片 ---
const CurrentCard = ({ task, setTask, onComplete }) => {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 0, 200], [-10, 0, 10]);
  const opacity = useTransform(x, [-300, -100, 0], [0, 0.5, 1]);
  const controls = useAnimation();
  
  const currentPriority = PRIORITIES.find(p => p.id === task.priority) || PRIORITIES[2];

  const handleDragEnd = (event, info) => {
    // 增加向左拖拽完成的逻辑 (x < -100)，同时也保留向上拖拽 (y < -100)
    if (info.offset.x < -100 || info.offset.y < -100) {
      onComplete();
    } else {
      controls.start({ x: 0, y: 0 });
    }
  };

  return (
    <motion.div
      className="absolute"
      style={{
        transformOrigin: `50% ${PIVOT_DIST}px`, 
        bottom: 0, 
        x,
        rotate,
        opacity,
        zIndex: 100
      }}
      initial={{ x: 300, opacity: 0, rotate: 20 }} // 从右侧滑入
      animate={{ x: 0, opacity: 1, rotate: 0 }}    // 归位
      exit={{ 
        x: -200, // 向左滑出，配合 rotate 形成圆弧运动感
        rotate: -15, 
        opacity: 0, 
        transition: { duration: 0.3 } 
      }}
      transition={{ type: "spring", stiffness: 280, damping: 24 }}
      drag
      dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
      dragElastic={0.2}
      onDragEnd={handleDragEnd}
    >
      <div className="relative -top-[120px] sm:-top-[160px]"> 
        <div className={`w-[85vw] max-w-[320px] aspect-[5/6] bg-white rounded-[2rem] shadow-2xl shadow-stone-300/60 flex flex-col p-6 transition-colors duration-500 border-[3px] ${currentPriority.border}`}>
          
          {/* 优先级选择 */}
          <div className="flex justify-between items-center mb-6">
            <span className="text-[10px] font-bold tracking-widest text-stone-400 uppercase">Current Focus</span>
            <div className="flex gap-1 bg-stone-50 p-1.5 rounded-full border border-stone-100">
              {PRIORITIES.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setTask(prev => ({ ...prev, priority: p.id }))}
                  className={`w-3.5 h-3.5 rounded-full transition-all duration-300 ${p.bg} ${
                    task.priority === p.id ? 'scale-125 ring-2 ring-offset-1 ring-stone-300' : 'opacity-30 hover:opacity-100'
                  }`}
                />
              ))}
            </div>
          </div>

          <div className="flex-1 flex flex-col justify-center">
             <textarea
              value={task.text}
              onChange={(e) => setTask(prev => ({ ...prev, text: e.target.value }))}
              placeholder="What's next?"
              className={`w-full bg-transparent resize-none text-3xl font-semibold text-stone-800 placeholder:text-stone-200 text-center outline-none`}
              onPointerDown={(e) => e.stopPropagation()} 
              autoFocus
            />
          </div>

          <div className="mt-4 flex flex-col items-center gap-2 text-stone-300">
             <div className="flex items-center text-xs animate-pulse space-x-1">
                <ChevronUp size={14} />
                <span>Drag to Complete</span>
             </div>
          </div>
        </div>
        
        {/* 高优光晕 */}
        {task.priority === 'urgent' && (
            <div className="absolute inset-0 bg-red-500/10 blur-3xl -z-10 rounded-full" />
        )}
      </div>
    </motion.div>
  );
};

// --- 子组件：历史任务卡片 ---
const HistoryCard = React.forwardRef(({ task, styleConfig, onClick }, ref) => {
  const priorityConfig = PRIORITIES.find(p => p.id === task.priority) || PRIORITIES[2];

  return (
    <motion.div
      ref={ref}
      className="absolute bottom-0 cursor-pointer"
      // 初始状态：假装自己在 Current 位置 (0度, Row 0)
      initial={{ 
        rotate: 0, 
        y: 0, 
        scale: 1,
        opacity: 0.8 
      }} 
      animate={{ 
        rotate: styleConfig.angle, 
        y: styleConfig.yOffset, // 向上移动到对应的轨道
        scale: 1 - (styleConfig.row * 0.1) - (styleConfig.col * 0.02), // 稍微变小一点
        opacity: 1,
        filter: styleConfig.row > 0 ? 'blur(1px)' : 'none', // 后排稍微虚化
      }}
      transition={{ 
        type: "spring", 
        stiffness: 180, 
        damping: 24,
      }}
      style={{
        // 关键：动态改变旋转中心，确保同心圆效果
        // 原始 Pivot 是 1500。如果卡片向上移了 140 (yOffset = -140)，
        // 那么相对该卡片的 Pivot 应该变成 1500 + 140 = 1640。
        transformOrigin: `50% ${styleConfig.originDistance}px`, 
        zIndex: 50 - styleConfig.row * 10 - styleConfig.col, 
        left: 0, // 确保居中定位
        right: 0,
        margin: '0 auto',
        width: 0, // 容器宽0，内容靠 overflow visible 显示，保证精准定位
      }}
      onClick={onClick}
    >
       {/* 内容容器 */}
       <div className="relative -top-[120px] sm:-top-[160px] -left-[110px]"> {/* 左移一半宽度以居中 */}
          <div className={`w-[220px] aspect-square rounded-3xl shadow-lg border-2 ${priorityConfig.border} p-5 flex flex-col justify-between transition-all hover:scale-105 hover:shadow-xl bg-white/95 backdrop-blur-sm`}>
            
            <div className="flex justify-between items-start">
                 <div className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${priorityConfig.bg} text-white`}>
                    {priorityConfig.label}
                 </div>
                 <span className="text-[10px] text-stone-400">{new Date(task.completedAt).getHours()}:{String(new Date(task.completedAt).getMinutes()).padStart(2,'0')}</span>
            </div>

            <p className={`text-sm font-medium leading-relaxed line-clamp-3 text-stone-600`}>
                {task.text}
            </p>
            
            {task.priority === 'urgent' && (
                <div className="absolute -bottom-2 -right-2 p-4 opacity-10 rotate-12">
                    <Sparkles className="text-red-500 w-12 h-12" />
                </div>
            )}
          </div>
       </div>
    </motion.div>
  );
});

export default TaskFlow;