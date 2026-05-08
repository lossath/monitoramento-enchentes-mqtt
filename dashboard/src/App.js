import React, { useState, useEffect } from 'react';
import mqtt from 'mqtt';
import './App.css'; 
import { NivelCard, PainelIA, GraficoMonitoramento } from './Components';

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
      alert("Erro ao conectar com o servidor Python.");
    }
  };

  const buscarPrevisaoIA = async () => {
    try {
      const response = await fetch('http://127.0.0.1:5000/ia-previsao');
      const data = await response.json();
      setIaDados(prev => ({ ...prev, ...data }));
    } catch (error) {
      console.error("Erro IA:", error);
    }
  };

  useEffect(() => {
    buscarPrevisaoIA();
    const intervaloIA = setInterval(buscarPrevisaoIA, 10000);
    return () => clearInterval(intervaloIA);
  }, []);

  useEffect(() => {
    const client = mqtt.connect('wss://broker.emqx.io:8084/mqtt');

    // --- LÓGICA DE MONITORAMENTO DE FALHAS ---
    const checarSensoresInativos = setInterval(() => {
      const agora = Date.now();
      setLogs(currentLogs => {
        // Se houver logs, checamos o mais recente de cada sensor
        if (currentLogs.length > 0) {
          currentLogs.forEach(log => {
            if (log.timestamp && (agora - log.timestamp > 12000)) { // 12 segundos de tolerância
              setAlertaSensor(log.sensor_id);
            }
          });
        }
        return currentLogs;
      });
    }, 5000); // Checa a cada 5 segundos

    client.on('connect', () => {
      setStatusConexao('✅ Sistema Online');
      client.subscribe(['v1/enchente/pesos', 'v1/enchente/global']);
    });

    client.on('message', (topic, message) => {
      try {
        const data = JSON.parse(message.toString());
        const momentoRecebimento = Date.now();

        if (topic === 'v1/enchente/pesos') {
          // Adicionamos o timestamp para o monitor de falhas saber quando foi a última leitura
          const novoLog = { ...data, timestamp: momentoRecebimento };
          setLogs(prev => [novoLog, ...prev].slice(0, 5));
          
          // Se o sensor enviou algo, ele está vivo! Removemos o alerta.
          setAlertaSensor(current => current === data.sensor_id ? null : current);
        }

        if (topic === 'v1/enchente/global') {
          if (data.status === 'OFFLINE' || data.status === 'SERVER_DOWN') {
            setSistemaOnline(false);
            setStatusConexao('❌ SERVIDOR OFFLINE');
            setGlobalPeso(0);
          } else {
            setSistemaOnline(true);
            setStatusConexao('✅ Sistema Online');
            const peso = Number(data.peso) || 0;
            const chuva = Number(data.chuva) || 0;
            setGlobalPeso(peso);
            
            setHistoricoGrafico(prev => [...prev, { 
              hora: new Date().toLocaleTimeString(), 
              peso, 
              chuva 
            }].slice(-15));
          }
        }
      } catch (e) { console.error("Erro MQTT:", e); }
    });

    return () => {
      client.end();
      clearInterval(checarSensoresInativos);
    };
  }, []);

  return (
    <div className="dashboard-container">
      {/* Barra de Alerta Pulsante */}
      {alertaSensor && (
        <div className="max-w-6xl mx-auto mb-6 p-4 bg-orange-500/20 border border-orange-500 text-orange-500 rounded-xl flex justify-between items-center animate-pulse">
          <span className="font-bold font-mono">⚠️ ALERTA DE SEGURANÇA: SENSOR [{alertaSensor}] SEM RESPOSTA</span>
          <button onClick={() => setAlertaSensor(null)} className="text-xs underline uppercase tracking-widest">Ignorar</button>
        </div>
      )}

      <header className="max-w-6xl mx-auto flex justify-between items-center mb-12">
        <div>
          <h1 className="text-4xl font-black tracking-tighter text-blue-500 uppercase">Guardian AI</h1>
          <p className="text-slate-500 text-xs font-mono tracking-widest">SISTEMA DE MONITORAMENTO DE BORDA V3.0</p>
        </div>
        <div className="flex gap-4 items-center">
          <div className="text-right hidden md:block">
            <p className="text-[10px] text-slate-500 uppercase font-bold">Status da Unidade</p>
            <p className={`text-xs font-mono font-bold ${sistemaOnline ? 'text-emerald-400' : 'text-red-500'}`}>
              {statusConexao}
            </p>
          </div>
          <button onClick={buscarHistorico} className="bg-blue-600 hover:bg-blue-500 px-6 py-3 rounded-xl text-xs font-bold transition-all shadow-lg active:scale-95">
            LOGS DO BANCO
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-6">
          <NivelCard nivel={globalPeso} statusOnline={sistemaOnline} />
          <PainelIA dados={iaDados} />
          
          <div className="glass-card">
            <h2 className="text-slate-500 text-[10px] font-bold uppercase mb-4 tracking-widest">Monitor de Nós</h2>
            <div className="space-y-3">
              {logs.map((log, i) => (
                <div key={i} className={`flex justify-between items-center p-3 rounded-xl border transition-all ${
                  alertaSensor === log.sensor_id ? 'bg-orange-500/10 border-orange-500/50' : 'bg-slate-800/30 border-slate-700/50'
                }`}>
                  <span className="text-[10px] font-mono text-blue-400">{log.sensor_id}</span>
                  <span className="text-sm font-bold numero-cientifico">{log.peso}m</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="lg:col-span-2">
          <GraficoMonitoramento dados={historicoGrafico} />
        </div>
      </main>

      {mostrarModal && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="glass-card max-w-4xl w-full max-h-[80vh] overflow-hidden flex flex-col border-blue-500/30">
            <div className="p-6 border-b border-slate-800 flex justify-between items-center">
              <h2 className="text-xl font-bold text-blue-400 font-mono">ARQUIVO DE DADOS SQLITE</h2>
              <button onClick={() => setMostrarModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>
            <div className="overflow-y-auto p-4">
              <table className="w-full text-left text-xs font-mono text-slate-400">
                <thead>
                  <tr className="border-b border-slate-800 text-blue-500">
                    <th className="p-3">HORÁRIO</th>
                    <th className="p-3">ID SENSOR</th>
                    <th className="p-3">NÍVEL (M)</th>
                    <th className="p-3 text-center">CHUVA (MM)</th>
                  </tr>
                </thead>
                <tbody>
                  {historicoBanco.map((item, i) => (
                    <tr key={i} className="border-b border-slate-800/50 hover:bg-blue-500/5">
                      <td className="p-3 text-blue-300">{item.hora}</td>
                      <td className="p-3">{item.sensor}</td>
                      <td className="p-3 font-bold text-white">{item.nivel}m</td>
                      <td className="p-3 text-center">{item.chuva}mm</td>
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