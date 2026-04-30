import React, { useState, useEffect } from 'react';
import mqtt from 'mqtt';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

function App() {
  const [globalPeso, setGlobalPeso] = useState(0);
  const [logs, setLogs] = useState([]);
  const [historicoGrafico, setHistoricoGrafico] = useState([]);
  const [statusConexao, setStatusConexao] = useState('Conectando...');
  const [sistemaOnline, setSistemaOnline] = useState(true);
  const [alertaSensor, setAlertaSensor] = useState(null); // Estado para o sensor que sumiu

  useEffect(() => {
    const client = mqtt.connect('wss://broker.emqx.io:8084/mqtt');

    client.on('connect', () => {
      setStatusConexao('✅ Conectado');
      client.subscribe('v1/enchente/pesos');
      client.subscribe('v1/enchente/global');
    });

    client.on('message', (topic, message) => {
      try {
        const data = JSON.parse(message.toString());

        // 1. Logs dos sensores individuais
        if (topic === 'v1/enchente/pesos') {
          setLogs(prev => [data, ...prev].slice(0, 5));
          // Se o sensor voltou a enviar, removemos o alerta dele
          setAlertaSensor(current => current === data.sensor_id ? null : current);
        }

        // 2. Lógica Global (Servidor e Monitoramento)
        if (topic === 'v1/enchente/global') {
          
          // CASO A: O Servidor Agregador caiu (LWT)
          if (data.status === 'OFFLINE') {
            setStatusConexao('❌ SERVIDOR FORA DO AR');
            setSistemaOnline(false);
            setGlobalPeso(0);
          } 
          
          // CASO B: Um sensor específico parou de responder
          else if (data.status === 'SENSOR_OFFLINE') {
            setAlertaSensor(data.sensor_id);
          }
          
          // CASO C: Sistema operando normalmente
          else if (data.status === 'ONLINE') {
            setStatusConexao('✅ Conectado');
            setSistemaOnline(true);
            const valor = Number(data.weight || data.peso) || 0;
            setGlobalPeso(valor);

            const novoPonto = {
              hora: new Date().toLocaleTimeString(),
              peso: valor
            };
            setHistoricoGrafico(prev => [...prev, novoPonto].slice(-15));
          }
        }
      } catch (e) { console.error("Erro no processamento:", e); }
    });

    return () => client.end();
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-white p-8 font-sans">
      
      {/* ALERTA DE SENSOR CAÍDO */}
      {alertaSensor && (
        <div className="max-w-6xl mx-auto mb-4 p-4 bg-orange-500/20 border border-orange-500 text-orange-500 rounded-lg flex justify-between items-center animate-pulse">
          <span className="font-bold">⚠️ ATENÇÃO: Perda de sinal do sensor [{alertaSensor}]</span>
          <button onClick={() => setAlertaSensor(null)} className="text-xs underline">Ignorar</button>
        </div>
      )}

      <header className="max-w-6xl mx-auto flex justify-between items-center mb-12">
        <div>
          <h1 className="text-3xl font-black tracking-tighter text-blue-500 uppercase">Enchente Guardian</h1>
          <p className="text-slate-400 text-sm italic">Mestrado: Monitoramento de Borda v3.0</p>
        </div>
        <div className={`px-4 py-2 rounded-full border text-xs font-mono transition-all ${
          statusConexao.includes('✅') ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-400' : 'bg-red-500/10 border-red-500/50 text-red-400'
        }`}>
          {statusConexao}
        </div>
      </header>

      <main className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          
          {/* CARD PRINCIPAL (Status do Rio) */}
          <div className="bg-slate-900 rounded-2xl p-8 border border-slate-800 shadow-2xl relative overflow-hidden">
            <h2 className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-2">Nível Agregado do Rio</h2>
            <div className="flex items-baseline gap-4">
              <span className="text-7xl font-black text-white tabular-nums">{globalPeso.toFixed(4)}</span>
              
              {sistemaOnline ? (
                <span className={`text-sm font-bold px-3 py-1 rounded-full ${
                  globalPeso > 4.0 ? 'bg-red-500 text-white' : 
                  globalPeso > 2.0 ? 'bg-amber-500 text-black' : 
                  'bg-emerald-500 text-white'
                }`}>
                  {globalPeso > 4.0 ? '🚨 RISCO DE ENCHENTE' : globalPeso > 2.0 ? '⚠️ ALERTA' : '✅ ESTÁVEL'}
                </span>
              ) : (
                <span className="text-sm font-bold px-3 py-1 rounded-full bg-slate-800 text-slate-500 italic">
                  SISTEMA OFFLINE
                </span>
              )}
            </div>

            {/* BARRA DE PROGRESSO */}
            <div className="mt-6 h-3 w-full bg-slate-800 rounded-full overflow-hidden">
              {sistemaOnline && (
                <div 
                  className={`h-full transition-all duration-1000 ${
                    globalPeso > 4.0 ? 'bg-red-600' : globalPeso > 2.0 ? 'bg-amber-500' : 'bg-emerald-500'
                  }`}
                  style={{ width: `${Math.min((globalPeso / 6) * 100, 100)}%` }} 
                ></div>
              )}
            </div>
            
            <div className="flex justify-between text-[10px] text-slate-500 mt-2 font-mono">
              <span>0.0 (SECO)</span>
              <span className={globalPeso > 2.0 ? 'text-amber-500' : ''}>ALERTA (2.0)</span>
              <span className={globalPeso > 4.0 ? 'text-red-500' : ''}>RISCO (4.0)</span>
              <span>MÁX (6.0)</span>
            </div>
          </div>

          {/* GRÁFICO */}
          <div className="bg-slate-900 rounded-2xl p-6 border border-slate-800 h-80 shadow-2xl">
            <h2 className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-6">Histórico de Tendência</h2>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={historicoGrafico}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="hora" stroke="#64748b" fontSize={10} />
                <YAxis stroke="#64748b" fontSize={10} domain={[0, 6]} />
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b' }} />
                <Line type="monotone" dataKey="peso" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4, fill: '#3b82f6' }} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* LOGS LATERAIS */}
        <div className="bg-slate-900 rounded-2xl p-6 border border-slate-800 shadow-xl overflow-hidden">
          <h2 className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-4 italic">Monitoramento Individual</h2>
          <div className="space-y-4">
            {logs.map((log, i) => (
              <div key={i} className={`flex justify-between items-center p-3 rounded-lg border transition-all ${
                alertaSensor === log.sensor_id ? 'bg-orange-500/10 border-orange-500/50' : 'bg-slate-800/50 border-slate-700/50'
              }`}>
                <div>
                  <p className="text-[10px] text-blue-400 font-mono font-bold uppercase">{log.sensor_id}</p>
                  <p className="text-xs text-slate-500">{new Date().toLocaleTimeString()}</p>
                </div>
                <p className="text-xl font-black text-white">{log.peso}</p>
              </div>
            ))}
            {logs.length === 0 && <p className="text-slate-600 text-xs italic text-center py-10">Aguardando dados...</p>}
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;