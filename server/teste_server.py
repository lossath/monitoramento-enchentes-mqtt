import paho.mqtt.client as mqtt
import json
import time
import sqlite3
from datetime import datetime
from flask import Flask, jsonify
from flask_cors import CORS
from brain_edge import treinar_e_prever
import threading

# --- Configurações ---
BROKER = "broker.emqx.io"
TOPICO_PESOS = "v1/enchente/pesos"
TOPICO_GLOBAL = "v1/enchente/global"

app = Flask(__name__)
CORS(app)

pesos_recebidos = []
chuva_recente = 0.0  # Variável global
ultimas_leituras = {}
TEMPO_LIMITE_SENSOR = 15 

def salvar_no_banco(sensor, valor, chuva_valor=0.0, status_info="ONLINE"):
    try:
        conn = sqlite3.connect('dados_enchentes.db')
        cursor = conn.cursor()
        agora = datetime.now().strftime('%d/%m/%Y %H:%M:%S')
        cursor.execute('''
            INSERT INTO leituras (data_hora, sensor_name, nivel, chuva, status)
            VALUES (?, ?, ?, ?, ?)
        ''', (agora, sensor, valor, chuva_valor, status_info))
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"❌ Erro ao salvar no banco: {e}")

def ao_receber_mensagem(client, userdata, msg):
    global pesos_recebidos, chuva_recente 
    try:
        data = json.loads(msg.payload.decode())
        s_id = data.get("sensor_id")
        peso = float(data.get("peso", 0))
        chuva = float(data.get("chuva", 0.0))
        
        chuva_recente = chuva 
        
        print(f"📡 MQTT Recebido: Nível {peso} | Chuva {chuva_recente}")
        ultimas_leituras[s_id] = time.time()

        if 0.05 < peso < 10.0:
            pesos_recebidos.append(peso)
            salvar_no_banco(s_id, peso, chuva, "LEITURA_DIRETA")
            
            # AQUI ESTAVA O ERRO (Corrigido para pesos_recebidos)
            if len(pesos_recebidos) >= 3:
                media = round(sum(pesos_recebidos) / 3, 4)
                salvar_no_banco("AGREGADO_SISTEMA", media, chuva_recente, "AGREGACAO_OK")
                
                payload = json.dumps({
                    "peso": media, 
                    "chuva": chuva_recente, 
                    "status": "ONLINE",
                    "sensor_id": "SISTEMA_AGREGADO"
                })
                client.publish(TOPICO_GLOBAL, payload, retain=True)
                pesos_recebidos.clear()
                
    except Exception as e:
        print(f"⚠️ Erro no processamento: {e}")
        
# --- ROTAS API ---

@app.route('/historico', methods=['GET'])
def obter_historico():
    conn = sqlite3.connect('dados_enchentes.db')
    cursor = conn.cursor()
    cursor.execute("SELECT data_hora, sensor_name, nivel, chuva, status FROM leituras ORDER BY id DESC LIMIT 50")
    dados = cursor.fetchall()
    conn.close()
    
    retorno = []
    for d in dados:
        retorno.append({
            "hora": d[0],
            "sensor": d[1],
            "nivel": d[2],
            "chuva": d[3],
            "status": d[4]
        })
    return jsonify(retorno)

@app.route('/ia-previsao', methods=['GET'])
def get_ia_previsao():
    global chuva_recente 
    resultado = treinar_e_prever()
    if isinstance(resultado, str):
        resultado = {"erro": resultado}
    
    resultado["chuva"] = round(chuva_recente, 2)
    return jsonify(resultado), 200

# --- SETUP MQTT ---
def rodar_mqtt():
    cliente = mqtt.Client()
    cliente.on_message = ao_receber_mensagem
    
    # --- ADIÇÃO DO WILL SET (Testamento) ---
    # Se o Python cair, o Broker avisa o React enviando essa mensagem:
    payload_morte = json.dumps({"status": "SERVER_DOWN", "peso": 0, "chuva": 0})
    cliente.will_set(TOPICO_GLOBAL, payload_morte, qos=1, retain=True)
    
    cliente.connect(BROKER, 1883, 60)
    cliente.subscribe(TOPICO_PESOS)
    cliente.loop_forever()

thread_mqtt = threading.Thread(target=rodar_mqtt, daemon=True)
thread_mqtt.start()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=False, use_reloader=False)