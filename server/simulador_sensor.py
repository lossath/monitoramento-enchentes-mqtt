import paho.mqtt.client as mqtt
import json
import time
import random

# --- Configurações ---
BROKER = "broker.emqx.io"
TOPICO = "v1/enchente/pesos"
SENSOR_ID = "ESP32_SIMULADO"

client = mqtt.Client()
client.connect(BROKER, 1883, 60)

print("⛈️ Simulador Multi-modal (Nível + Chuva) iniciado.")

peso_atual = 1.5 
chuva_atual = 0.0
estado = "NORMAL"
contador_estado = 0

try:
    while True:
        contador_estado += 1
        
        # --- LÓGICA DE TRANSIÇÃO E CONTROLE DA CHUVA ---
        if estado == "NORMAL":
            chuva_atual = 0.0
            if contador_estado > 10:
                estado = "SUBINDO"
                contador_estado = 0
                print("\n⛈️ A chuva começou forte!")

        elif estado == "SUBINDO":
            chuva_atual = random.uniform(15.0, 35.0) # Chuva forte faz o nível subir
            if peso_atual >= 5.0:
                estado = "TOPO"
                contador_estado = 0
                print("\n🚨 Nível crítico atingido!")

        elif estado == "TOPO":
            chuva_atual = random.uniform(5.0, 15.0) # Chuva diminui mas continua
            if contador_estado > 15:
                estado = "BAIXANDO"
                contador_estado = 0
                print("\n🌤️ A chuva parou. O nível está baixando...")

        elif estado == "BAIXANDO":
            chuva_atual = 0.0
            if peso_atual <= 1.5:
                estado = "NORMAL"
                contador_estado = 0
                print("\n✅ Rio voltou ao leito normal.")

        # --- CÁLCULO DO PESO BASEADO NO ESTADO ---
        variacao_ruido = random.uniform(-0.05, 0.05)
        
        if estado == "NORMAL":
            peso_atual = 1.5 + variacao_ruido
        elif estado == "SUBINDO":
            peso_atual += 0.15 
        elif estado == "TOPO":
            peso_atual = 5.0 + random.uniform(-0.1, 0.1)
        elif estado == "BAIXANDO":
            peso_atual -= 0.10

        # Simulação de erro 999.0
        peso_envio = 999.0 if random.randint(1, 20) == 1 else round(peso_atual, 4)

        # --- PAYLOAD MULTI-MODAL ---
        payload = json.dumps({
            "sensor_id": SENSOR_ID,
            "peso": peso_envio,
            "chuva": round(chuva_atual, 2) # Agora a chuva varia conforme o estado!
        })
        
        client.publish(TOPICO, payload)
        
        status_msg = f"[{estado}] Nível: {peso_envio}m | Chuva: {round(chuva_atual, 2)}mm"
        if peso_envio == 999.0: status_msg += " ⚠️ (ANOMALIA)"
        print(status_msg)
        
        time.sleep(1)

except KeyboardInterrupt:
    print("\nSimulação encerrada.")