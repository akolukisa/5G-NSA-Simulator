# 5G NSA B1 Threshold Optimizer (Deep RL)

Bu proje, Derin Pekiştirmeli Öğrenme (PPO) kullanarak 5G Non-Standalone (NSA) ağlarında LTE'den NR'a (Event B1) geçiş eşiğini optimize etmeyi hedefler.

## Faz 1: Tek Saha, Tek Carrier
Bu fazda 1 Master eNB (LTE) ve 1 Secondary gNB (NR) bulunmaktadır. Ajan (Agent), UE sinyal seviyelerini (RSRP) ve hücre yüklerini gözlemleyerek en uygun B1 eşik değerini seçer.

### Dizin Yapısı
* `ns3-sim/`: C++ tabanlı ns-3 simülasyon kodlarını içerir.
* `rl-agent/`: Python tabanlı Stable-Baselines3 PPO ajanını içerir.

### Kurulum ve Çalıştırma

1. **Python Ortamının Kurulumu**
   ```bash
   cd rl-agent
   pip install -r requirements.txt
   # ns3gym kütüphanesini sisteminize kurduğunuzdan emin olun.
   ```

2. **ns-3 Simülasyonunun Hazırlanması**
   `ns3-sim/faz1_nsa_b1_env.cc` dosyasını ns-3 çalışma dizininizdeki `scratch/` klasörünün içine kopyalayın.

3. **Eğitimi Başlatma**
   ns-3 ve Python arasındaki bağlantı ns3-gym modülü (ZMQ üzerinden) ile sağlanır. Python scriptini çalıştırdığınızda simülasyon otomatik olarak dinlemeye başlayacaktır.
   
   ```bash
   python rl-agent/train_ppo.py --port 5555 --start 0
   ```
   *Not: `--start 0` kullanırsanız ns-3'ü farklı bir terminalden `ns3 run "scratch/faz1_nsa_b1_env --envPort=5555"` şeklinde manuel başlatmanız gerekir.*
