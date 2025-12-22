import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Trash2, ArrowLeft, RotateCcw } from 'lucide-react';

// --- 核心配置 (根据你的反馈调优) ---
const ROWS = 3;             // 3行轨道，保证厚度
const ROW_HEIGHT = 280;     // 行高 (大幅增加，彻底解决纵向堆叠)
const ARC_SPACING = 240;    // 弧长间距 (卡片宽度+间隙)，用于动态计算角度
const BASE_RADIUS = 520;    // 内圈半径，拉大半径让扇形更平缓，空间更大
const MAX_DONE_COLUMNS = 6; // 最多显示几列已完成任务，防止溢出屏幕或重叠

const CARD_W = 180;
const CARD_H = 220;

const PRIORITIES = {
  urgent: { 
    label: 'Urgent', 
    color: 'bg-rose-100 border-rose-200', 
    dot: 'bg-rose-500',
    // 显式定义按钮样式，防止自动计算导致的对比度问题
    btnActive: 'bg-rose-100 text-rose-600 ring-rose-500'
  },
  focus:  { 
    label: 'Focus',  
    color: 'bg-blue-100 border-blue-200', 
    dot: 'bg-blue-500',
    btnActive: 'bg-blue-100 text-blue-600 ring-blue-500'
  },
  normal: { 
    label: 'Normal', 
    color: 'bg-white border-white',       
    dot: 'bg-orange-400', 
    // 这里专门用 text-orange-600 加深文字颜色，背景用 100 变淡
    btnActive: 'bg-orange-100 text-orange-600 ring-orange-400'
  },
};

// --- 辅助工具 ---
const generateId = () => Math.random().toString(36).substr(2, 9);
const randomRange = (min, max) => Math.random() * (max - min) + min;

// 微小的随机扰动，让界面不那么死板，但绝不许乱飞
const createJitter = () => ({
  rot: randomRange(-2, 2),       // 旋转更微小
  x: randomRange(-3, 3),         // 横向更微小
  y: randomRange(-3, 3),         // 纵向更微小
  // 悬浮动画参数 (呼吸感)
  floatDuration: randomRange(5, 8), // 浮动周期 5-8秒
  floatDelay: randomRange(0, 5),    // 随机延迟
  floatY: randomRange(4, 8),        // 浮动幅度
});

// --- 初始数据 ---
const createSeedTasks = () => {
  const doneTitles = ['查阅文献', '整理桌面', '备份数据', '回复邮件'];
  const todoTitles = ['设计首页 UI', '阅读《认知觉醒》', '修复 Bug', '准备 PPT', '超市采购', '预约牙医', '洗衣服', '写周报', '规划下周'];
  
  // 生成数据：Done 在前，Todo 在后
  const dones = doneTitles.map((text, i) => ({
    id: generateId(), 
    text, 
    status: 'done', 
    createdAt: Date.now() - (100000 + i * 1000), 
    completedAt: Date.now() - (100000 + i * 1000), // 添加完成时间用于排序
    jitter: createJitter(),
    priority: 'normal',
  }));
  const todos = todoTitles.map((text, i) => ({
    id: generateId(), 
    text, 
    status: 'todo', 
    createdAt: Date.now() - i * 1000, 
    jitter: createJitter(),
    priority: i % 3 === 0 ? 'urgent' : i % 2 === 0 ? 'focus' : 'normal', // 随机分配演示用
  }));

  return [...dones, ...todos];
};

const STORAGE_KEY = 'horizon_todo_data_v1';

const SectorFinal = () => {
  // 初始化状态：尝试从 LocalStorage 读取，如果没有则使用种子数据
  const [tasks, setTasks] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error('Failed to load tasks from localStorage:', e);
    }
    return createSeedTasks();
  });

  const [inputValue, setInputValue] = useState('');
  const [inputPriority, setInputPriority] = useState('normal');

  // 监听 tasks 变化，自动同步到 LocalStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  }, [tasks]);

  // 分离数据并排序
  // Done: 按完成时间倒序 (最近完成的在最前面/最中心)
  const dones = tasks
    .filter(t => t.status === 'done')
    .sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0))
    .slice(0, ROWS * MAX_DONE_COLUMNS); // 限制显示数量，挤不下就不展示

  // Todo: 按创建时间顺序 (先创建的在最前面)
  const todos = tasks
    .filter(t => t.status === 'todo')
    .sort((a, b) => a.createdAt - b.createdAt);

  // --- 核心布局算法：统一坐标系 ---
  // 我们把所有卡片看作在一个巨大的 Grid 里
  // Grid 的 X轴是“列”（扇区角度），Y轴是“行”（半径距离）
  const getPosition = (task) => {
    let colIndex = 0; // 第几列
    let rowIndex = 0; // 第几行

    if (task.status === 'todo') {
      // --- 待办任务 (向右延伸) ---
      const index = todos.indexOf(task);
      // 算法：竖着填满3行，再往右移一列
      colIndex = Math.floor(index / ROWS); 
      rowIndex = index % ROWS;
    } else {
      // --- 已完成任务 (向左延伸) ---
      const index = dones.indexOf(task); // 0是最近完成的
      // 算法：也是竖着填，但是列号是负数
      // (colIndex + 1) 是为了让最近完成的任务出现在 -1 列，而不是 0 列（0列是当前任务）
      colIndex = -1 * (Math.floor(index / ROWS) + 1);
      rowIndex = index % ROWS;
    }

    // --- 坐标映射 ---
    // 2. 计算半径：基础半径 + (行号 * 行高)
    const radius = BASE_RADIUS + (rowIndex * ROW_HEIGHT);

    // 1. 计算角度：根据半径动态计算 step，保证每一行的视觉间距一致 (外层更紧凑)
    // ArcLength = Radius * Angle(rad) => Angle(deg) = (ArcLength / Radius) * (180/PI)
    const angleStep = (ARC_SPACING / radius) * (180 / Math.PI);
    
    // 修正：让 Todo 和 Done 对称分布
    // Todo (col 0) start at +step/2
    // Done (col -1) start at -step/2
    const angle = (colIndex * angleStep) + (angleStep / 2);

    // 3. 计算层级：
    // Todo: 越靠左(越近)层级越高
    // Done: 越靠右(越近)层级越高
    // 简单来说：离 0 列越近，层级越高
    const distFromCenter = Math.abs(colIndex);
    const zIndex = 1000 - distFromCenter * 10 - rowIndex;

    return { angle, radius, zIndex };
  };

  // --- 交互逻辑 ---

  const handleDragEnd = (task, info) => {
    // 向左拖动超过 80px 触发
    if (info.offset.x < -80) {
      toggleTaskStatus(task.id);
    }
  };

  const toggleTaskStatus = (id) => {
    setTasks(prev => {
        return prev.map(t => {
            if (t.id === id) {
                const isNowDone = t.status === 'todo';
                return { 
                    ...t, 
                    status: isNowDone ? 'done' : 'todo', 
                    completedAt: isNowDone ? Date.now() : undefined, // 更新完成时间
                    jitter: createJitter() 
                };
            }
            return t;
        });
    });
  };

  const addTask = (e) => {
    e.preventDefault();
    if (!inputValue.trim()) return;
    setTasks(prev => [...prev, {
      id: generateId(), 
      text: inputValue, 
      status: 'todo', 
      createdAt: Date.now(), 
      jitter: createJitter(),
      priority: inputPriority,
    }]);
    setInputValue('');
    setInputPriority('normal'); // 重置
  };

  const removeTask = (id, e) => {
    e && e.stopPropagation();
    setTasks(prev => prev.filter(t => t.id !== id));
  };

  return (
    <div className="relative w-full h-screen bg-[#F2F0E9] overflow-hidden flex flex-col items-center font-sans text-stone-700">
      
      <div className="absolute top-10 z-10 text-center opacity-40 select-none">
        <h1 className="text-sm font-bold tracking-[0.4em] uppercase">Sector Grid</h1>
      </div>

      {/* --- 扇形容器 --- */}
      {/* 这里的 bottom 决定了圆心的位置，越往下圆心越远，扇形越平 */}
      <div className="absolute w-full flex justify-center pointer-events-none" style={{ bottom: '-180px' }}>
        <div className="relative" style={{ width: 0, height: 0 }}>
            <AnimatePresence mode='popLayout'>
            {[...dones, ...todos].map((task) => {
                const pos = getPosition(task);
                const isTodo = task.status === 'todo';
                const priorityConfig = PRIORITIES[task.priority || 'normal']; // 获取优先级配置

                // --- 坐标转换：从极坐标 (angle, radius) 转为直角坐标 (x, y) ---
                // 目的：让外层容器只负责位置 (不旋转)，从而保证 drag="x" 是屏幕水平方向
                const distFromOrigin = pos.radius + CARD_H / 2; // 卡片中心到圆心的距离
                const rad = (pos.angle) * (Math.PI / 180); // 角度转弧度
                
                // 计算卡片中心相对于圆心的坐标 (注意：圆心是 (0,0))
                // X = R * sin(θ)
                // Y = -R * cos(θ) (向上为负)
                const layoutX = distFromOrigin * Math.sin(rad);
                const layoutY = -distFromOrigin * Math.cos(rad);

                return (
                <motion.div
                    layoutId={task.id}
                    key={task.id}
                    
                    // --- 拖拽设置 (在外层) ---
                    // 现在外层没有旋转，X轴就是屏幕水平方向！
                    drag={isTodo ? "x" : false}
                    dragConstraints={{ left: 0, right: 0 }} // 限制回弹
                    dragElastic={{ left: 0.6, right: 0.1 }} // 左滑轻松，右滑困难
                    onDragEnd={(e, info) => isTodo && handleDragEnd(task, info)}
                    whileDrag={{ scale: 1.05, cursor: 'grabbing', zIndex: 9999 }}
                    
                    // --- 动画状态 (位置在外层) ---
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{ 
                        opacity: isTodo ? 1 : 0.6, 
                        scale: isTodo ? 1 : 0.9,   
                        x: layoutX + task.jitter.x,
                        y: layoutY + task.jitter.y,
                        // 注意：这里不再旋转，只负责位置
                        rotate: 0, 
                    }}
                    exit={{ opacity: 0, scale: 0, transition: { duration: 0.2 } }}
                    transition={{ type: "spring", stiffness: 140, damping: 20 }}

                    className={`absolute ${isTodo ? 'cursor-grab active:cursor-grabbing pointer-events-auto' : 'pointer-events-auto cursor-pointer'}`}
                    style={{
                        left: -CARD_W / 2, 
                        top: -CARD_H / 2, // 这里的 top 配合 layoutY 实际上是把卡片中心放在了计算出的点上
                        zIndex: pos.zIndex,
                        // 移除 transformOrigin，因为我们现在用的是直角坐标绝对定位
                    }}
                    // 点击已完成的可以恢复
                    onClick={() => !isTodo && toggleTaskStatus(task.id)}
                >
                    {/* 内层容器：负责旋转 + 悬浮 */}
                    <motion.div 
                        className="w-full h-full"
                        animate={{ 
                            rotate: pos.angle + task.jitter.rot,
                            y: [0, -(task.jitter.floatY || 5), 0], // 呼吸悬浮 (缺省值防止旧数据报错)
                        }}
                        transition={{ 
                            rotate: { type: "spring", stiffness: 140, damping: 20 },
                            y: { 
                                duration: task.jitter.floatDuration || 6, 
                                repeat: Infinity, 
                                ease: "easeInOut",
                                delay: task.jitter.floatDelay || 0
                            }
                        }}
                    >
                    <div 
                        className={`
                            relative w-[180px] h-[220px] rounded-2xl p-6 flex flex-col justify-between 
                            transition-all duration-300 border backdrop-blur-sm select-none
                            ${isTodo 
                                ? `${priorityConfig.color} shadow-lg shadow-stone-200/50` 
                                : 'bg-stone-200/40 border-stone-200/20 grayscale'
                            }
                        `}
                    >
                        {/* 顶部按钮区 */}
                        <div className="flex justify-between items-start">
                            <div className={`w-2.5 h-2.5 rounded-full ${isTodo ? priorityConfig.dot : 'bg-stone-300'}`} />
                            {isTodo && (
                                <button 
                                    onPointerDown={(e) => e.stopPropagation()}
                                    onClick={(e) => removeTask(task.id, e)} 
                                    className="text-stone-300 hover:text-red-400"
                                >
                                    <Trash2 size={14} />
                                </button>
                            )}
                        </div>

                        {/* 任务文本 */}
                        <p className={`text-[15px] font-bold leading-snug break-words ${isTodo ? 'text-stone-800' : 'text-stone-400 line-through'}`}>
                            {task.text}
                        </p>

                        {/* 底部提示 */}
                        <div className="flex items-center gap-1 text-[10px] font-mono text-stone-400 opacity-60">
                             {isTodo ? (
                                <>
                                    <ArrowLeft size={10} /> 
                                    <span>SLIDE LEFT</span>
                                </>
                             ) : (
                                <>
                                    <RotateCcw size={10} />
                                    <span>RESTORE</span>
                                </>
                             )}
                        </div>
                    </div>
                    </motion.div>
                </motion.div>
                );
            })}
            </AnimatePresence>
        </div>
      </div>

      {/* --- 底部输入框 --- */}
      <form onSubmit={addTask} className="absolute bottom-10 z-50 w-full max-w-sm px-6 flex flex-col gap-3">
        
        {/* 优先级选择器 */}
        <div className="flex justify-center gap-3">
          {Object.entries(PRIORITIES).map(([key, config]) => (
            <button
              key={key}
              type="button"
              onClick={() => setInputPriority(key)}
              className={`
                px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all
                ${inputPriority === key 
                  ? `${config.btnActive} ring-2`
                  : 'bg-white/50 text-stone-400 hover:bg-white'
                }
              `}
            >
              {config.label}
            </button>
          ))}
        </div>

        <div className="relative group scale-100 focus-within:scale-105 transition-transform duration-300">
            <input 
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                placeholder="New Plan..."
                className={`
                    w-full bg-white/90 border-2 rounded-2xl py-4 px-6 pr-12 text-lg font-medium text-stone-800 placeholder:text-stone-300 shadow-2xl shadow-stone-200/50 outline-none 
                    transition-colors duration-300
                    ${inputPriority === 'urgent' ? 'border-rose-200 focus:border-rose-400' : 
                      inputPriority === 'focus' ? 'border-blue-200 focus:border-blue-400' : 
                      'border-stone-100 focus:border-orange-200'}
                `}
            />
            <button type="submit" disabled={!inputValue} className="absolute right-3 top-3 p-2 bg-stone-800 text-white rounded-xl hover:bg-black disabled:opacity-20 transition-all"><Plus size={20} /></button>
        </div>
      </form>
    </div>
  );
};

export default SectorFinal;
