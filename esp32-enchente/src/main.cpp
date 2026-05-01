#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>

// --- CONFIGURAÇÕES DE PINOS ---
const int trigPin = 5;
const int echoPin = 18;

// --- CONFIGURAÇÕES DE REDE ---
const char* ssid = "NOME_DO_SEU_WIFI";
const char* password = "SENHA_DO_WIFI";
const char* mqtt_server = "broker.emqx.io";

WiFiClient espClient;
PubSubClient client(espClient);

// --- FUNÇÃO PARA LER O SENSOR (ULTRASSÔNICO) ---
float lerNivelAgua() {
  // Dispara o som
  digitalWrite(trigPin, LOW);
  delayMicroseconds(2);
  digitalWrite(trigPin, HIGH);
  delayMicroseconds(10);
  digitalWrite(trigPin, LOW);

  // Mede o tempo de resposta
  long duracao = pulseIn(echoPin, HIGH);
  
  // Calcula a distância em cm
  float distancia = duracao * 0.034 / 2; 
  
  return distancia;
}

void setup_wifi() {
  delay(10);
  Serial.println("\nConectando ao WiFi...");
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi Conectado!");
}

void reconnect() {
  while (!client.connected()) {
    Serial.print("Tentando conexão MQTT...");
    // ID único para o seu sensor
    if (client.connect("ESP32_Sensor_Mestrado_01")) {
      Serial.println("Conectado ao Broker!");
    } else {
      Serial.print("Falha, rc=");
      Serial.print(client.state());
      Serial.println(" Tentando novamente em 5s");
      delay(5000);
    }
  }
}

void setup() {
  Serial.begin(115200);
  
  // Configura os pinos do sensor
  pinMode(trigPin, OUTPUT);
  pinMode(echoPin, INPUT);

  setup_wifi();
  client.setServer(mqtt_server, 1883);
}

void loop() {
  if (!client.connected()) {
    reconnect();
  }
  client.loop();

  // 1. Lê a distância real do sensor
  float distanciaAtual = lerNivelAgua();
  
  // 2. Transforma a distância em um "Peso" para a IA
  // Exemplo simples: quanto menor a distância (água perto), maior o peso.
  float pesoIA = 100.0 / (distanciaAtual + 1); 

  Serial.print("Distancia: ");
  Serial.print(distanciaAtual);
  Serial.print("cm | Peso IA: ");
  Serial.println(pesoIA);

  // 3. Cria e envia o JSON para o Agregador Python
  StaticJsonDocument<200> doc;
  doc["sensor_id"] = "ESP32_Borda_01";
  doc["peso"] = pesoIA;

  char buffer[256];
  serializeJson(doc, buffer);

  client.publish("v1/enchente/pesos", buffer);

  delay(5000); // Envia a cada 5 segundos
}