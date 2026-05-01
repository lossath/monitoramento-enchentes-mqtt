import paho.mqtt.client as mqtt
import json
import time
import os
import sqlite3
from datetime import datetime
from flask import Flask, jsonify
from flask_cors import CORS
import threading

# --- Configurações ---
BROKER = "broker.emqx.io"
TOPICO_PESOS = "v1/enchente/pesos"
TOPICO_GLOBAL = "v1/enchente/global"

app = Flask(__name__)
CORS(app) # Isso permite que o React acesse o Python


pesos_recebidos = []
sensores_ativos = set()
limiar_agregacao = 3
ultimas_leituras = {}
TEMPO_LIMITE_SENSOR = 15 

# === FUNÇÃO DO BANCO DE DADOS ===
def init_db():
    conn = sqlite3.connect('dados_enchentes.db')
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS leituras (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            data_hora TEXT,
            sensor_name TEXT,
            nivel REAL,
            status TEXT
        )
    ''')
    conn.commit()
    conn.close()

def salvar_no_banco(sensor, valor, status_info="ONLINE"):
    try:
        conn = sqlite3.connect('dados_enchentes.db')
        cursor = conn.cursor()
        agora = datetime.now().strftime('%d/%m/%Y %H:%M:%S')
        
        cursor.execute('''
            INSERT INTO leituras (data_hora, sensor_name, nivel, status)
            VALUES (?, ?, ?, ?)
        ''', (agora, sensor, valor, status_info))
        
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"❌ Erro ao salvar no banco: {e}")

# Inicializa o banco ao rodar o script
init_db()

def ao_conectar(client, userdata, flags, rc):
    if rc == 0:
        print("✅ CONECTADO AO BROKER COM SUCESSO!")
        client.subscribe(TOPICO_PESOS)
    else:
        print(f"❌ FALHA NA CONEXÃO. Código: {rc}")

def ao_receber_mensagem(client, userdata, msg):
    global pesos_recebidos, sensores_ativos
    try:
        data = json.loads(msg.payload.decode())
        s_id = data.get("sensor_id")
        peso = float(data.get("peso", 0))

        # Registrar presença do sensor
        ultimas_leituras[s_id] = time.time()

        if 0.05 < peso < 10.0:
            pesos_recebidos.append(peso)
            sensores_ativos.add(s_id)
            
            # --- 💾 SALVAMENTO 1: Salva o dado individual do sensor ---
            salvar_no_banco(s_id, peso, "LEITURA_DIRETA")
            
            print(f"📥 {s_id}: {peso} | Buffer: {len(pesos_recebidos)}/3 | 💾 Salvo!")

            if len(pesos_recebidos) >= limiar_agregacao:
                media = sum(pesos_recebidos) / 3
                media_redonda = round(media, 4)
                
                # --- 💾 SALVAMENTO 2: Salva a média agregada ---
                salvar_no_banco("AGREGADO_SISTEMA", media_redonda, "AGREGACAO_OK")
                
                payload = json.dumps({"peso": media_redonda, "status": "ONLINE"})
                client.publish(TOPICO_GLOBAL, payload, retain=True)
                
                print(f"--- 🧠 AGREGAÇÃO: {media_redonda} --- 💾 Salvo!")
                pesos_recebidos.clear()
                sensores_ativos.clear()
        else:
            if peso != 999: print(f"⚠️ Dado fora da faixa: {peso}")

    except Exception as e:
        print(f"⚠️ Erro no processamento: {e}")

@app.route('/historico', methods=['GET'])
def obter_historico():
    conn = sqlite3.connect('dados_enchentes.db')
    cursor = conn.cursor()
    # Pega as últimas 50 leituras
    cursor.execute("SELECT data_hora, sensor_name, nivel, status FROM leituras ORDER BY id DESC LIMIT 50")
    dados = cursor.fetchall()
    conn.close()
    
    # Formata para o React entender
    retorno = []
    for d in dados:
        retorno.append({
            "hora": d[0],
            "sensor": d[1],
            "nivel": d[2],
            "status": d[3]
        })
    return jsonify(retorno)

# Função para rodar o Flask sem travar o MQTT
def rodar_api():
    # O host="0.0.0.0" ajuda o Windows a liberar o acesso
    app.run(host="0.0.0.0", port=5000, debug=False, use_reloader=False)

# Inicia a API em uma "thread" separada
threading.Thread(target=rodar_api, daemon=True).start()

# --- SETUP DO CLIENTE ---
cliente = mqtt.Client()
cliente.on_connect = ao_conectar
cliente.on_message = ao_receber_mensagem

# Vontade de morrer (LWT)
cliente.will_set(TOPICO_GLOBAL, json.dumps({"status": "OFFLINE", "peso": 0}), qos=1, retain=True)

print("🔄 Tentando conectar...")
cliente.connect(BROKER, 1883, 60)

# Iniciando o loop
cliente.loop_start()

try:
    while True:
        agora = time.time()
        for s_id, last_time in list(ultimas_leituras.items()):
            if agora - last_time > TEMPO_LIMITE_SENSOR:
                print(f"⚠️ Sensor {s_id} sumiu!")
                
                # registra a queda do sensor no banco:
                salvar_no_banco(s_id, 0.0, "SENSOR_OFFLINE")
                
                cliente.publish(TOPICO_GLOBAL, json.dumps({"status": "SENSOR_OFFLINE", "sensor_id": s_id}))
                del ultimas_leituras[s_id]
        
        time.sleep(5)

except KeyboardInterrupt:
    print("Finalizando...")    
    cliente.loop_stop()