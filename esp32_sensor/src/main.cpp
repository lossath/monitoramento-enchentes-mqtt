#include <Arduino.h>
#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <esp_wifi.h>

// --- CONFIGURAÇÕES DO WI-FI E MQTT (MANTENDO O SEU ROTEADOR DO CELULAR) ---
const char* ssid = "augusta";       
const char* password = "12345678";       
const char* mqtt_broker = "broker.emqx.io";
const int mqtt_port = 1883;
const char* topic_pesos = "v1/enchente/pesos";

// Pinos seguros para evitar travamento de boot
const int PIN_TRIG = 25;
const int PIN_ECHO = 26;
const float ALTURA_DA_PONTE = 6.0; 

WiFiClient espClient;
PubSubClient client(espClient);

void setup_wifi() {
  delay(500);
  Serial.println();
  Serial.print("Tentando conectar na rede do celular: ");
  Serial.println(ssid);

  WiFi.disconnect(true);
  delay(1000);
  WiFi.mode(WIFI_STA);
  esp_wifi_set_protocol(WIFI_IF_STA, WIFI_PROTOCOL_11B | WIFI_PROTOCOL_11G | WIFI_PROTOCOL_11N);
  delay(1000);
  
  WiFi.begin(ssid, password);

  int tentativas = 0;
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
    tentativas++;
    
    if (tentativas > 30) {
      Serial.println("\n[RÁDIO] Reiniciando chip de comunicação...");
      WiFi.disconnect();
      delay(1000);
      WiFi.begin(ssid, password);
      tentativas = 0;
    }
  }

  Serial.println("\n🎉 CONECTADO COM SUCESSO NO CELULAR!");
  Serial.print("IP obtido: ");
  Serial.println(WiFi.localIP());
}

void reconnect() {
  while (!client.connected()) {
    Serial.print("Tentando conexão MQTT...");
    String clientId = "ESP32_GuardianAI_";
    clientId += String(random(0, 0xffff), HEX);
    
    if (client.connect(clientId.c_str())) {
      Serial.println("Conectado ao Broker MQTT Público!");
    } else {
      Serial.print("Falhou, rc=");
      Serial.print(client.state());
      Serial.println(" Tentando novamente em 5 segundos...");
      delay(5000);
    }
  }
}

void setup() {
  Serial.begin(115200);
  
  pinMode(PIN_TRIG, OUTPUT);
  pinMode(PIN_ECHO, INPUT);
  
  setup_wifi();
  client.setServer(mqtt_broker, mqtt_port);
}

void loop() {
  if (!client.connected()) {
    reconnect();
  }
  client.loop();

  // --- LEITURA DO SENSOR AJ-SR04M ---
  digitalWrite(PIN_TRIG, LOW);
  delayMicroseconds(2);
  digitalWrite(PIN_TRIG, HIGH);
  delayMicroseconds(10);
  digitalWrite(PIN_TRIG, LOW);

  long duration = pulseIn(PIN_ECHO, HIGH);
  float distancia_cm = duration * 0.0343 / 2.0;
  float distancia_metros = distancia_cm / 100.0;

  // Lógica reversa: quanto menor a distância do sensor, mais alto o rio
  float nivel_rio = ALTURA_DA_PONTE - distancia_metros;

  if (nivel_rio < 0.05 || distancia_cm == 0) nivel_rio = 0.5; 
  if (nivel_rio > 10.0) nivel_rio = 6.0; 

  float chuva_simulada = 0.0;
  if (nivel_rio > 3.0) chuva_simulada = (nivel_rio - 3.0) * 15.5; 

  nivel_rio = round(nivel_rio * 100.0) / 100.0;
  chuva_simulada = round(chuva_simulada * 100.0) / 100.0;

  // Montagem do JSON estruturado para o Servidor Flask / Aprendizado Federado
  StaticJsonDocument<200> doc;
  doc["sensor_id"] = "ESP32_MESTRADO";
  doc["peso"] = nivel_rio;
  doc["chuva"] = chuva_simulada;

  char buffer[256];
  serializeJson(doc, buffer);

  // Transmite para a nuvem
  client.publish(topic_pesos, buffer);
  
  Serial.print("📡 [Enviado via MQTT] -> Nível do Rio: ");
  Serial.print(nivel_rio);
  Serial.print("m | JSON: ");
  Serial.println(buffer);

  delay(2000); // Envia a cada 2 segundos
}