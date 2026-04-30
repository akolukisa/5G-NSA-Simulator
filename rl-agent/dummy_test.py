import gymnasium as gym
from gymnasium import spaces
import numpy as np
from stable_baselines3 import PPO

class DummyNsaB1Env(gym.Env):
    """
    Bu sınıf ns-3 simülatörü derlenene kadar B1 eşik seçimi (Threshold Optimization)
    mantığını test etmek için yazdığımız "sanal" bir 5G NSA ortamıdır.
    """
    def __init__(self):
        super(DummyNsaB1Env, self).__init__()
        # 5 farklı aksiyon: B1 Threshold değerleri
        self.action_space = spaces.Discrete(5)
        self.b1_thresholds = [-120, -118, -116, -114, -112]
        
        # State: [lte_rsrp, nr_rsrp, lte_load, nr_load, ue_count]
        self.observation_space = spaces.Box(low=-150.0, high=100.0, shape=(5,), dtype=np.float32)
        
        self.step_count = 0
        self.connected_to_nr = False
        
    def reset(self, seed=None, options=None):
        super().reset(seed=seed)
        self.step_count = 0
        self.connected_to_nr = False
        
        # Başlangıç konumunda eNB'ye çok yakın (LTE RSRP yüksek), gNB'ye çok uzak (NR RSRP çok düşük)
        self.lte_rsrp = -70.0
        self.nr_rsrp = -135.0
        self.lte_load = 0.8
        self.nr_load = 0.1
        self.ue_count = 5.0
        
        return np.array([self.lte_rsrp, self.nr_rsrp, self.lte_load, self.nr_load, self.ue_count], dtype=np.float32), {}

    def step(self, action):
        self.step_count += 1
        chosen_threshold = self.b1_thresholds[action]
        
        # Kullanıcıların hareketini simüle edelim:
        # Zamanla (adım arttıkça) eNB'den uzaklaşıyorlar, gNB'ye yaklaşıyorlar.
        self.lte_rsrp -= 0.5   # LTE sinyali adım başı düşer
        self.nr_rsrp += 1.0    # 5G sinyali adım başı artar
        
        reward = 0.0
        
        # B1 Olayı Tetikleyicisi (Eğer NR RSRP seçilen eşik değerini aşarsa)
        if not self.connected_to_nr and self.nr_rsrp >= chosen_threshold:
            self.connected_to_nr = True
            # Yük 5G'ye kayar
            self.lte_load -= 0.4
            self.nr_load += 0.4
            
        # Ödül (Reward) Mekanizması
        if self.connected_to_nr:
            # Eğer 5G sinyali çok kötüyken (-115'ten küçükken) bağlanmışsak ping-pong/kopma cezası ver
            if self.nr_rsrp < -115.0:
                reward = -5.0 # Ceza
            else:
                reward = 20.0 # Harika! 5G'nin yüksek bant genişliğinden (Throughput) yararlanıyoruz
        else:
            reward = 5.0 # Sadece LTE'nin kısıtlı hızı
            
        # Eğer çok beklersen ve 5G'ye geçmezsen (LTE RSRP düştüğü için) throughput düşer
        if not self.connected_to_nr and self.lte_rsrp < -100.0:
            reward -= 2.0
            
        # Simülasyonun 100 adımda bir resetlenmesi
        terminated = bool(self.step_count >= 100)
        truncated = False
        
        obs = np.array([self.lte_rsrp, self.nr_rsrp, self.lte_load, self.nr_load, self.ue_count], dtype=np.float32)
        return obs, reward, terminated, truncated, {"threshold": chosen_threshold, "nr_connected": self.connected_to_nr}

if __name__ == "__main__":
    print("\n" + "="*50)
    print("Sanal 5G NSA B1 Optimizasyon Ortamı Başlatılıyor...")
    print("="*50)
    
    env = DummyNsaB1Env()
    
    # MLP Policy (Tam Bağlı Sinir Ağı) ile PPO Modelini Oluştur
    model = PPO("MlpPolicy", env, verbose=0, learning_rate=0.001)
    
    print("\n>>> PPO Ajanı Eğitiliyor (20.000 Timestep) ... Lütfen Bekleyin <<<")
    model.learn(total_timesteps=20000)
    print(">>> Eğitim Tamamlandı! <<<\n")
    
    # Eğitilen Modeli Canlı Test Edelim
    print("="*50)
    print("TEST AŞAMASI (Öğrenilen Kararlar)")
    print("="*50)
    
    obs, _ = env.reset()
    for i in range(25): # İlk 25 adımı gözlemleyelim
        action, _states = model.predict(obs, deterministic=True)
        obs, reward, terminated, truncated, info = env.step(action)
        
        status = "🟢 5G NSA Aktif" if info["nr_connected"] else "🔴 Sadece LTE"
        print(f"Adım: {i+1:02d} | LTE RSRP: {obs[0]:.1f} | NR RSRP: {obs[1]:.1f} | Seçilen B1 Eşiği: {info['threshold']} dBm | Ödül: {reward:5.1f} | Durum: {status}")
