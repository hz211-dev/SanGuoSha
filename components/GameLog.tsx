import React, { useEffect, useRef } from 'react';
import { LogEntry } from '../types';

interface GameLogProps {
  logs: LogEntry[];
}

const GameLog: React.FC<GameLogProps> = ({ logs }) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  return (
    <div className="w-full h-48 bg-stone-950/80 rounded-lg border border-stone-700 overflow-hidden flex flex-col">
      <div className="bg-stone-800 px-4 py-2 text-xs font-bold uppercase tracking-wider text-stone-400 border-b border-stone-700">
        Battle Log
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-2 font-mono text-sm">
        {logs.map((log) => (
          <div 
            key={log.id} 
            className={`
              px-2 py-1 rounded border-l-2
              ${log.type === 'info' ? 'border-blue-500 bg-blue-900/10 text-blue-200' : ''}
              ${log.type === 'danger' ? 'border-red-500 bg-red-900/10 text-red-300' : ''}
              ${log.type === 'success' ? 'border-green-500 bg-green-900/10 text-green-300' : ''}
              ${log.type === 'system' ? 'border-yellow-500 bg-yellow-900/10 text-yellow-200 italic' : ''}
            `}
          >
            <span className="opacity-50 text-[10px] mr-2">
              {log.id.split('-')[0]}
            </span>
            {log.text}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
};

export default GameLog;