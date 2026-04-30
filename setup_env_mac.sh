#!/bin/bash
set -e

echo "=========================================================="
echo "5G NSA B1 Threshold Optimizer - macOS (Apple Silicon/Intel) Kurulum Betiği"
echo "=========================================================="

# 1. Homebrew Kontrolü
if ! command -v brew &> /dev/null; then
    echo "Hata: Homebrew kurulu değil. Lütfen önce Homebrew kurun: https://brew.sh/"
    exit 1
fi

echo "1. macOS bağımlılıkları (Homebrew) kontrol ediliyor/kuruluyor..."
# ns-3 ve ns3-gym için gerekli C++, Python ve ZMQ kütüphaneleri
brew install cmake ninja git python@3.11 pkg-config qt@5 zeromq

# 2. ns-3.37 İndirilmesi
echo "2. ns-3.37 indiriliyor..."
if [ ! -d "ns-allinone-3.37" ]; then
    curl -O https://www.nsnam.org/releases/ns-allinone-3.37.tar.bz2
    tar xfj ns-allinone-3.37.tar.bz2
    rm ns-allinone-3.37.tar.bz2
fi

cd ns-allinone-3.37/ns-3.37

# 3. 5G-LENA (nr) Modülünün İndirilmesi
echo "3. 5G-LENA (nr) modülü indiriliyor..."
if [ ! -d "contrib/nr" ]; then
    cd contrib
    git clone https://gitlab.com/cttc-lena/nr.git nr
    cd nr
    git checkout ns-3.37
    cd ../..
fi

# 4. ns3-gym Modülünün İndirilmesi
echo "4. ns3-gym modülü indiriliyor..."
if [ ! -d "src/opengym" ]; then
    git clone https://github.com/tkn-tub/ns3-gym.git src/opengym
fi

# 5. ns-3'ün Derlenmesi (macOS uyumlu yapılandırma)
echo "5. ns-3, 5G-LENA ve ns3-gym ile birlikte derleniyor..."
# macOS'te ZeroMQ yolunu derleyiciye açıkça belirtmek gerekebilir
export CXXFLAGS="-I$(brew --prefix zeromq)/include"
export LDFLAGS="-L$(brew --prefix zeromq)/lib"

./ns3 configure --enable-examples --enable-tests
./ns3 build

# 6. Python Sanal Ortamı ve RL Bağımlılıkları
echo "6. Python sanal ortamı ve RL bağımlılıkları kuruluyor..."
cd ../..
# macOS'te python3.11 kullanıyoruz
python3.11 -m venv venv
source venv/bin/activate

# pip'i güncelle ve kütüphaneleri kur
pip install --upgrade pip
pip install -r rl-agent/requirements.txt

# 7. ns3gym Python kütüphanesi
echo "7. ns3gym Python kütüphanesi kuruluyor..."
cd ns-allinone-3.37/ns-3.37/src/opengym/model/ns3gym
pip install -e .

echo "=========================================================="
echo "Kurulum Tamamlandı!"
echo "Sanal ortamı aktif etmek için: source venv/bin/activate"
echo "=========================================================="
