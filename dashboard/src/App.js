import React, { useState, useEffect } from 'react';
import mqtt from 'mqtt';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

function App() {
  const [historicoBanco, setHistoricoBanco] = useState([]);
  const [mostrarModal, setMostrarModal] = useState(false);
  const [globalPeso, setGlobalPeso] = useState(0);
  const [logs, setLogs] = useState([]);
  const [historicoGrafico, setHistoricoGrafico] = useState([]);
  const [statusConexao, setStatusConexao] = useState('Conectando...');
  const [sistemaOnline, setSistemaOnline] = useState(true);
  const [alertaSensor, setAlertaSensor] = useState(null);
  const [iaDados, setIaDados] = useState({ previsao_5min: 0, tendencia: 'Carregando...', chuva: 0 });

  const buscarHistorico = async () => {
    try {
      const resposta = await fetch('http://127.0.0.1:5000/historico');
      const dados = await resposta.json();
      setHistoricoBanco(dados);
      setMostrarModal(true);
    } catch (error) {
      alert("Erro ao buscar histórico. O servidor Python está rodando?");
    }
  };

  const buscarPrevisaoIA = async () => {
    try {
      const response = await fetch('http://127.0.0.1:5000/ia-previsao');
      const data = await response.json();
      setIaDados(prev => ({
        ...prev,
        ...data
      }));
    } catch (error) {
      console.error("Erro ao buscar IA:", error);
    }
  };

  useEffect(() => {
    buscarPrevisaoIA();
    const intervalo = setInterval(buscarPrevisaoIA, 10000);
    return () => clearInterval(intervalo);
  }, []);

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
        if (topic === 'v1/enchente/pesos') {
          setLogs(prev => [data, ...prev].slice(0, 5));
          setAlertaSensor(current => current === data.sensor_id ? null : current);
        }
        if (topic === 'v1/enchente/global') {
          if (data.status === 'OFFLINE') {
            setStatusConexao('❌ SERVIDOR FORA DO AR');
            setSistemaOnline(false);
            setGlobalPeso(0);
          } else if (data.status === 'SENSOR_OFFLINE') {
            setAlertaSensor(data.sensor_id);
          } else if (data.status === 'ONLINE') {
            setStatusConexao('✅ Conectado');
            setSistemaOnline(true);
            const valorPeso = Number(data.weight || data.peso) || 0;
            const valorChuva = Number(data.chuva) || 0; // Captura a chuva do MQTT
            setGlobalPeso(valorPeso);
            
            const novoPonto = { 
              hora: new Date().toLocaleTimeString(), 
              peso: valorPeso,
              chuva: valorChuva
            };
            setHistoricoGrafico(prev => [...prev, novoPonto].slice(-15));
          }
        }
      } catch (e) { console.error("Erro no processamento:", e); }
    });
    return () => client.end();
  }, []);

  // Cores baseadas na tendência vinda da IA
  const corTendencia = iaDados.tendencia === 'SUBINDO' ? '#C53030' : (iaDados.tendencia === 'DESCENDO' ? '#276749' : '#B45309');
  const fundoCardIA = iaDados.tendencia === 'SUBINDO' ? '#FFF5F5' : (iaDados.tendencia === 'DESCENDO' ? '#F0F9F4' : '#FFFBEB');
  const bordaCardIA = iaDados.tendencia === 'SUBINDO' ? '#C53030' : (iaDados.tendencia === 'DESCENDO' ? '#2F855A' : '#D97706');

  return (
    <div className="min-h-screen bg-slate-950 text-white p-8 font-sans">
      {alertaSensor && (
        <div className="max-w-6xl mx-auto mb-4 p-4 bg-orange-500/20 border border-orange-500 text-orange-500 rounded-lg flex justify-between items-center animate-pulse">
          <span className="font-bold">⚠️ ATENÇÃO: Perda de sinal do sensor [{alertaSensor}]</span>
          <button onClick={() => setAlertaSensor(null)} className="text-xs underline">Ignorar</button>
        </div>
      )}

      <header className="max-w-6xl mx-auto flex justify-between items-center mb-12">
        <button onClick={buscarHistorico} className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg text-sm font-bold transition-all shadow-lg">
          📜 Ver Histórico do Banco
        </button>
        <div className="text-right">
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
          <div className="bg-slate-900 rounded-2xl p-8 border border-slate-800 shadow-2xl relative overflow-hidden">
            <h2 className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-2">Nível Agregado do Rio</h2>
            <div className="flex items-baseline gap-4">
              <span className="text-7xl font-black text-white tabular-nums">{globalPeso.toFixed(4)}</span>
              {sistemaOnline ? (
                <span className={`text-sm font-bold px-3 py-1 rounded-full ${
                  globalPeso > 4.0 ? 'bg-red-500 text-white' : globalPeso > 2.0 ? 'bg-amber-500 text-black' : 'bg-emerald-500 text-white'
                }`}>
                  {globalPeso > 4.0 ? '🚨 RISCO' : globalPeso > 2.0 ? '⚠️ ALERTA' : '✅ ESTÁVEL'}
                </span>
              ) : (
                <span className="text-sm font-bold px-3 py-1 rounded-full bg-slate-800 text-slate-500 italic">OFFLINE</span>
              )}
            </div>
            <div className="mt-6 h-3 w-full bg-slate-800 rounded-full overflow-hidden">
              {sistemaOnline && (
                <div className={`h-full transition-all duration-1000 ${
                  globalPeso > 4.0 ? 'bg-red-600' : globalPeso > 2.0 ? 'bg-amber-500' : 'bg-emerald-500'
                }`} style={{ width: `${Math.min((globalPeso / 6) * 100, 100)}%` }}></div>
              )}
            </div>
          </div>

          <div className="painel-ia" style={{
            padding: '20px', 
            borderRadius: '12px', 
            backgroundColor: fundoCardIA,
            borderLeft: `10px solid ${bordaCardIA}`,
            border: `1px solid ${bordaCardIA}50`,
            marginBottom: '25px',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
            transition: 'all 0.5s ease'
          }}>
            <h2 style={{ margin: '0 0 15px 0', color: '#2D3748', fontSize: '1.2rem' }}>🤖 Inteligência de Borda (Edge AI)</h2>
            <div style={{ display: 'flex', gap: '30px', flexWrap: 'wrap' }}>
              <div>
                <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#718096', letterSpacing: '0.05em' }}>PREVISÃO (5 MIN)</span>
                <p style={{ fontSize: '28px', fontWeight: '800', margin: 0, color: '#1A202C' }}>{iaDados.previsao_5min}m</p>
              </div>
              <div>
                <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#718096', letterSpacing: '0.05em' }}>TENDÊNCIA</span>
                <p style={{ fontSize: '22px', fontWeight: 'bold', margin: 0, color: corTendencia }}>
                  {iaDados.tendencia}
                </p>
              </div>
              <div style={{ backgroundColor: '#EDF2F7', padding: '10px', borderRadius: '8px' }}>
                <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#4A5568' }}>MODELO IA</span>
                <p style={{ fontSize: '16px', fontWeight: 'bold', margin: 0, color: '#2D3748' }}>LSTM Recorrente</p>
                <span style={{ fontSize: '10px', color: '#718096' }}>Status: Ativo</span>
              </div>
              <div style={{ backgroundColor: '#EBF8FF', padding: '10px', borderRadius: '8px' }}>
                <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#2C5282' }}>🌧️ CHUVA ATUAL</span>
                <p style={{ fontSize: '16px', fontWeight: 'bold', margin: 0, color: '#2A4365' }}>
                  {iaDados.chuva !== undefined ? iaDados.chuva : '0.0'} mm/h
                </p>
              </div>
            </div>
          </div>

          <div className="bg-slate-900 rounded-2xl p-6 border border-slate-800 h-96 shadow-2xl">
            <h2 className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-6">Correlação Nível x Chuva</h2>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={historicoGrafico}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="hora" stroke="#64748b" fontSize={10} tickMargin={10} />
                
                {/* Eixo Esquerdo: Nível do Rio */}
                <YAxis yAxisId="left" stroke="#3b82f6" fontSize={10} domain={[0, 6]} />
                
                {/* Eixo Direito: Chuva */}
                <YAxis yAxisId="right" orientation="right" stroke="#0ea5e9" fontSize={10} domain={[0, 100]} />
                
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px' }} />
                <Legend verticalAlign="top" height={36}/>

                {/* Linha 1: Nível (Eixo Esquerdo) */}
                <Line 
                  yAxisId="left" 
                  name="Nível (m)"
                  type="monotone" 
                  dataKey="peso" 
                  stroke="#3b82f6" 
                  strokeWidth={4} 
                  dot={false} 
                  isAnimationActive={false} 
                />

                {/* Linha 2: Chuva (Eixo Direito) */}
                <Line 
                  yAxisId="right" 
                  name="Chuva (mm)"
                  type="monotone" 
                  dataKey="chuva" 
                  stroke="#0ea5e9" 
                  strokeDasharray="5 5" 
                  strokeWidth={2} 
                  dot={false} 
                  isAnimationActive={false} 
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

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
          </div>
        </div>
      </main>

      {mostrarModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col shadow-2xl">
            <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900">
              <h2 className="text-xl font-bold text-blue-400">Histórico de Leituras (Banco)</h2>
              <button onClick={() => setMostrarModal(false)} className="text-slate-400 hover:text-white text-2xl">✕</button>
            </div>
            <div className="overflow-y-auto p-4 bg-slate-950/50">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-slate-900 sticky top-0 z-10">
                  <tr className="border-b border-slate-800">
                    <th className="p-4 text-left text-slate-500 uppercase text-[10px] font-bold">Data/Hora</th>
                    <th className="p-4 text-left text-slate-500 uppercase text-[10px] font-bold">Sensor</th>
                    <th className="p-4 text-center text-slate-500 uppercase text-[10px] font-bold">Nível</th>
                    <th className="p-4 text-right text-slate-500 uppercase text-[10px] font-bold">Status</th>
                    <th className="p-4 text-center text-slate-500 uppercase text-[10px] font-bold">Chuva</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {historicoBanco.map((item, i) => (
                    <tr key={i} className="hover:bg-slate-800/50 transition-colors">
                      <td className="py-3 p-2 font-mono text-blue-300">{item.hora}</td>
                      <td className="py-3 p-2">{item.sensor}</td>
                      <td className="py-3 p-2 text-center font-bold text-white">{item.nivel}m</td>
                      <td className="py-3 p-2 text-right">
                        <span className={`px-2 py-1 rounded text-[10px] font-bold ${
                          item.status.includes('OFFLINE') ? 'bg-red-500/20 text-red-500' : 'bg-emerald-500/20 text-emerald-500'
                        }`}>
                          {item.status}
                        </span>
                      </td>
                      <td className="py-3 p-2 text-center font-bold text-blue-400">{item.chuva}mm</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;