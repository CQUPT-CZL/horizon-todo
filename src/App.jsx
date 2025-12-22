import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Plus, Trash2 } from 'lucide-react';

// --- 配置参数 (核心调优区) ---
const ROWS = 3;          // 【关键】设置有几行，3行能撑起你要的宽度
const BASE_RADIUS = 500; // 最内层轨道的半径
const ROW_STEP = 260;    // 每一层轨道之间的距离 (要大于卡片高度220，防止纵向重叠)
const ANGLE_STEP = 16;   // 每一列之间的角度间隔 (要足够大，防止横向重叠)
const GLOBAL_OFFSET = -50; // 【关键】全局往左旋转50度，把右边空出来

const CARD_W = 180;
const CARD_H = 220;

// --- 辅助函数 ---
const generateId = () => Math.random().toString(36).substr(2, 9);
const randomRange = (min, max) => Math.random() * (max - min) + min;

// 生成随机“扰动”，让它不整齐
// 包含旋转、水平(X轴即角度方向)、垂直(Y轴即半径方向)的微调
const createJitter = () => ({
  rot: randomRange(-3, 3),  // 随机歪斜 +/- 3度
  offsetX: randomRange(-5, 5), // 沿弧线随机偏移
  offsetY: randomRange(-10, 10), // 沿半径随机偏移
});

// --- 初始数据 ---
const createSeedTasks = () => {
  // 故意多搞点数据，撑满界面看看效果
  const doneTitles = ['晨间冥想', '整理桌面', '查阅文献', '备份数据', '回复邮件', '支付账单'];
  const todoTitles = ['设计首页 UI', '阅读《认知觉醒》', '修复 Bug', '准备 PPT', '超市采购', '预约牙医', '洗衣服', '写周报', '规划下周'];
  
  const dones = doneTitles.map((text, i) => ({
    id: generateId(), text, status: 'done', createdAt: Date.now() - (100000 + i * 1000), jitter: createJitter(),
  }));

  const todos = todoTitles.map((text, i) => ({
    id: generateId(), text, status: 'todo', createdAt: Date.now() - i * 1000, jitter: createJitter(),
  }));

  // 重要：把 Done 放前面，Todo 放后面，形成连续的流
  return [...dones, ...todos];
};

const SectorMultiRow = () => {
  const [tasks, setTasks] = useState(createSeedTasks);
  const [inputValue, setInputValue] = useState('');

  // --- 核心布局算法 (Grid to Polar Mapping) ---
  const getTaskLayout = (index) => {
    // 1. 计算网格坐标 (Column & Row)
    // col 代表第几列（扇区切片）
    const col = Math.floor(index / ROWS); 
    // row 代表第几行（轨道），取模运算实现循环填充 (0, 1, 2, 0, 1, 2...)
    // 这里用 ROWS - 1 - (index % ROWS) 是为了让第一个元素在最外层，视觉上更符合直觉（可选）
    const row = index % ROWS;

    // 2. 映射到极坐标 (Angle & Radius)
    // 角度 = 全局左移 + 列数 * 每列间隔
    const baseAngle = GLOBAL_OFFSET + (col * ANGLE_STEP);
    // 半径 = 基础半径 + 行数 * 每行间距
    const baseRadius = BASE_RADIUS + (row * ROW_STEP);

    // 3. 计算层级 (Z-Index)
    // 确保后面的不挡前面的，下层的不挡上层的。简单用 index 即可，因为我们预留了足够间距。
    const zIndex = index; 

    return {
      angle: baseAngle,
      radius: baseRadius,
      zIndex,
      // 已完成的任务稍微淡一点，区分度
      opacity: tasks[index].status === 'done' ? 0.85 : 1,
      scale: tasks[index].status === 'done' ? 0.95 : 1,
    };
  };

  // --- 交互 ---
  const addTask = (e) => {
    e.preventDefault();
    if (!inputValue.trim()) return;
    setTasks(prev => [...prev, { // 新任务加到最后
      id: generateId(), text: inputValue, status: 'todo', createdAt: Date.now(), jitter: createJitter(),
    }]);
    setInputValue('');
  };

  const toggleTask = (id) => {
    setTasks(prev => {
        const newList = prev.map(t => 
            t.id === id 
            ? { ...t, status: t.status === 'todo' ? 'done' : 'todo', jitter: createJitter() } 
            : t
        );
        // 重新排序：Done的在左边，Todo的在右边，保持流转顺序
        const dones = newList.filter(t => t.status === 'done');
        const todos = newList.filter(t => t.status === 'todo');
        return [...dones, ...todos];
    });
  };

  const removeTask = (id, e) => {
    e.stopPropagation();
    setTasks(prev => prev.filter(t => t.id !== id));
  };

  return (
    <div className="relative w-full h-screen bg-[#F2F0E9] overflow-hidden flex flex-col items-center font-sans text-stone-700">
      <div className="absolute top-10 z-10 text-center opacity-40 select-none">
        <h1 className="text-sm font-bold tracking-[0.4em] uppercase">Sector Grid</h1>
      </div>

      {/* --- 扇形容器 --- */}
      {/* bottom往下降，把圆心藏深一点 */}
      <div className="absolute w-full flex justify-center pointer-events-none" style={{ bottom: '-200px' }}>
        <div className="relative" style={{ width: 0, height: 0 }}>
            <AnimatePresence mode='popLayout'>
            {tasks.map((task, index) => {
                const layout = getTaskLayout(index);
                const isTodo = task.status === 'todo';

                // 最终角度 = 布局角度 + 随机旋转扰动
                const finalAngle = layout.angle + task.jitter.rot;
                // 最终半径推移 Y = 负半径 + 随机半径扰动
                const finalTranslateY = -layout.radius + task.jitter.offsetY;
                // 最终横向推移 X = 随机横向扰动 (稍微错开一点点)
                const finalTranslateX = task.jitter.offsetX;

                return (
                <motion.div
                    layoutId={task.id}
                    key={task.id}
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{ 
                        opacity: layout.opacity,
                        scale: layout.scale,
                        rotate: finalAngle, 
                        y: finalTranslateY,
                        x: finalTranslateX,
                    }}
                    exit={{ opacity: 0, scale: 0, transition: { duration: 0.2 } }}
                    transition={{ type: "spring", stiffness: 140, damping: 22, mass: 1 }}
                    className="absolute pointer-events-auto cursor-pointer"
                    style={{
                        // 旋转轴心设置在很远的圆心处
                        transformOrigin: `50% ${layout.radius + CARD_H/2 - task.jitter.offsetY}px`,
                        left: -CARD_W / 2, 
                        top: -CARD_H / 2,
                        zIndex: layout.zIndex,
                    }}
                    onClick={() => toggleTask(task.id)}
                >
                    <div 
                        className={`
                            relative w-[180px] h-[220px] rounded-2xl p-6 flex flex-col justify-between 
                            transition-all duration-300 border backdrop-blur-sm
                            ${isTodo 
                                ? 'bg-white shadow-lg shadow-stone-200/40 border-white hover:-translate-y-1 hover:shadow-xl' 
                                : 'bg-stone-100/80 border-stone-200/50 grayscale-[0.3] hover:grayscale-0'
                            }
                        `}
                    >
                        <div className="flex justify-between items-start">
                            <div className={`w-2.5 h-2.5 rounded-full ${isTodo ? 'bg-orange-400' : 'bg-stone-300'}`} />
                            {isTodo && <button onClick={(e) => removeTask(task.id, e)} className="text-stone-300 hover:text-red-400"><Trash2 size={14} /></button>}
                        </div>
                        <p className={`text-[15px] font-bold leading-snug break-words ${isTodo ? 'text-stone-800' : 'text-stone-500 line-through'}`}>{task.text}</p>
                        <div className="text-[10px] font-mono text-stone-400">{isTodo ? 'TAP TO DONE' : 'ARCHIVED'}</div>
                    </div>
                </motion.div>
                );
            })}
            </AnimatePresence>
        </div>
      </div>

      {/* --- 底部输入框 --- */}
      <form onSubmit={addTask} className="absolute bottom-10 z-50 w-full max-w-sm px-6">
        <div className="relative group scale-100 focus-within:scale-105 transition-transform duration-300">
            <input 
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                placeholder="Add new task..."
                className="w-full bg-white/90 border border-stone-100 rounded-2xl py-4 px-6 pr-12 text-lg font-medium text-stone-800 placeholder:text-stone-300 shadow-2xl shadow-stone-200/50 outline-none focus:ring-2 focus:ring-orange-200"
            />
            <button type="submit" disabled={!inputValue} className="absolute right-3 top-3 p-2 bg-stone-800 text-white rounded-xl hover:bg-black disabled:opacity-20 transition-all"><Plus size={20} /></button>
        </div>
      </form>
    </div>
  );
};

export default SectorMultiRow;