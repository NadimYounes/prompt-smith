import React, { useState } from 'react';
import { RadialBarChart, RadialBar, PolarAngleAxis, ResponsiveContainer } from 'recharts';

interface ScoreChartProps {
  score: number;
  critique?: string;
}

const ScoreChart: React.FC<ScoreChartProps> = ({ score, critique }) => {
  const [isHovered, setIsHovered] = useState(false);

  const data = [
    {
      name: 'Score',
      value: score,
      fill: score >= 80 ? '#10b981' : score >= 50 ? '#f59e0b' : '#ef4444',
    },
  ];

  // Calculate color for text
  const colorClass = score >= 80 ? 'text-success' : score >= 50 ? 'text-warning' : 'text-error';

  return (
    <div 
      className="relative w-24 h-24 group cursor-help"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <ResponsiveContainer width="100%" height="100%">
        <RadialBarChart 
          innerRadius="75%" 
          outerRadius="100%" 
          barSize={8} 
          data={data} 
          startAngle={90} 
          endAngle={-270}
        >
          <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
          <RadialBar
            background={{ fill: '#2A2F3E' }}
            dataKey="value"
            cornerRadius={5}
          />
        </RadialBarChart>
      </ResponsiveContainer>
      
      {/* Centered Text - Adjusted to prevent overlap */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none pb-1">
        <span className={`text-3xl font-bold leading-none ${colorClass}`}>{score}</span>
        <span className="text-[9px] uppercase font-bold tracking-widest text-gray-500 mt-1">Quality</span>
      </div>

      {/* Hover Tooltip */}
      {isHovered && critique && (
        <div className="absolute z-50 right-[105%] top-0 mr-2 w-56 p-3 bg-[#151921] border border-gray-700 rounded-lg shadow-2xl text-xs text-gray-300 animate-fade-in">
          <div className="font-bold mb-1.5 text-gray-400 uppercase text-[10px] tracking-wider border-b border-gray-800 pb-1">Score Analysis</div>
          <p className="leading-relaxed text-gray-300">{critique}</p>
          <div className="absolute right-[-5px] top-6 w-2 h-2 bg-[#151921] border-t border-r border-gray-700 rotate-45 transform"></div>
        </div>
      )}
    </div>
  );
};

export default ScoreChart;