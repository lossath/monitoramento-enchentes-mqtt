import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

// 1. Componente do Card de Nível Atual
export const NivelCard = ({ nivel, statusOnline }) => (
  <div className={`glass-card ${nivel > 4 ? 'alerta-risco' : ''}`}>
    <span className="text-slate-400 text-xs font-bold uppercase tracking-widest">Nível do Rio</span>
    <div className="flex items-baseline gap-2">
      <h1 className="text-6xl numero-cientifico">{nivel.toFixed(3)}</h1>
      <span className="text-2xl font-light text-slate-500">m</span>
    </div>
    <div className="mt-4 flex gap-2">
      <div className={`h-2 flex-1 rounded-full ${nivel > 4 ? 'bg-red-500' : 'bg-blue-500'}`} 
           style={{ width: `${(nivel/6)*100}%`, transition: 'width 1s ease' }} />
    </div>
  </div>
);

// 2. Componente do Painel de IA
export const PainelIA = ({ dados }) => {
  const isSubindo = dados.tendencia === 'SUBINDO';
  return (
    <div className="glass-card border-l-8" style={{ borderLeftColor: isSubindo ? '#ef4444' : '#10b981' }}>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <span className="text-[10px] font-bold text-slate-500 uppercase">Previsão (+5min)</span>
          <p className="text-2xl numero-cientifico text-blue-400">{dados.previsao_5min}m</p>
        </div>
        <div>
          <span className="text-[10px] font-bold text-slate-500 uppercase">Tendência</span>
          <p className={`text-lg font-bold ${isSubindo ? 'text-red-500' : 'text-emerald-500'}`}>
            {isSubindo ? '↑ ' : '↓ '} {dados.tendencia}
          </p>
        </div>
      </div>
      <div className="mt-4 pt-4 border-t border-slate-700/50 flex justify-between items-center">
        <span className="text-[10px] text-slate-500 font-mono">MODELO: LSTM-RECORRENTE</span>
        <span className="text-blue-500 text-[10px] font-bold">💧 {dados.chuva} mm/h</span>
      </div>
    </div>
  );
};

// 3. Componente do Gráfico
export const GraficoMonitoramento = ({ dados }) => (
  <div className="glass-card" style={{ height: '400px' }}>
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={dados}>
        <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
        <XAxis dataKey="hora" stroke="#64748b" fontSize={10} tickMargin={10} />
        <YAxis yAxisId="left" stroke="#3b82f6" fontSize={10} domain={[0, 6]} />
        <YAxis yAxisId="right" orientation="right" stroke="#0ea5e9" fontSize={10} domain={[0, 100]} />
        <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '12px' }} />
        <Legend verticalAlign="top" align="right" iconType="circle" />
        <Line yAxisId="left" name="Nível (m)" type="monotone" dataKey="peso" stroke="#3b82f6" strokeWidth={4} dot={false} />
        <Line yAxisId="right" name="Chuva (mm)" type="monotone" dataKey="chuva" stroke="#0ea5e9" strokeDasharray="5 5" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  </div>
);