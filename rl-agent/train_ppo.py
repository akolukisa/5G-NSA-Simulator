import gym
import argparse
from stable_baselines3 import PPO
from stable_baselines3.common.callbacks import EvalCallback
from ns3gym import ns3env

def main():
    parser = argparse.ArgumentParser(description='PPO for 5G NSA B1 Threshold Optimization')
    parser.add_argument('--port', type=int, default=5555, help='Port for ns3gym')
    parser.add_argument('--start', type=int, default=1, help='Start ns-3 simulation script automatically (1 or 0)')
    args = parser.parse_args()

    # ns3gym ortamını başlat
    # Bu kütüphane ns-3'teki OpenGymInterface'e ZMQ üzerinden bağlanır
    print("ns-3 ortamı başlatılıyor...")
    env = ns3env.Ns3Env(port=args.port, stepTime=0.5, startSim=bool(args.start), 
                        simSeed=1, simArgs={"simTime": 10}, debug=False)

    print("Ortam Bilgileri:")
    print("Action Space:", env.action_space)
    print("Observation Space:", env.observation_space)

    # PPO Modelini tanımla
    # MLP Policy (Tam bağlı sinir ağı) kullanıyoruz
    model = PPO("MlpPolicy", env, verbose=1, learning_rate=0.0003, n_steps=128)

    print("Eğitim başlıyor...")
    # Eğitim süreci
    # 1000 timestep (adım) için eğit
    model.learn(total_timesteps=1000)

    print("Eğitim tamamlandı. Model kaydediliyor...")
    model.save("ppo_nsa_b1_faz1")

    # Modeli test et
    print("Model test ediliyor...")
    obs = env.reset()
    for i in range(10):
        action, _states = model.predict(obs, deterministic=True)
        obs, reward, done, info = env.step(action)
        print(f"Step: {i}, Action (B1 Threshold Index): {action}, Reward: {reward}")
        if done:
            obs = env.reset()

    env.close()

if __name__ == '__main__':
    main()
