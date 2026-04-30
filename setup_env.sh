#!/bin/bash
set -e

echo "=========================================================="
echo "5G NSA B1 Threshold Optimizer - Ortam Kurulum Betiği"
echo "=========================================================="

# Bağımlılıkların Kurulumu (Ubuntu/Debian için)
echo "1. Sistem bağımlılıkları kontrol ediliyor/kuruluyor..."
if [ -f /etc/os-release ]; then
    . /etc/os-release
    if [ "$ID" == "ubuntu" ] || [ "$ID" == "debian" ]; then
        sudo apt update
        sudo apt install -y g++ python3 python3-pip cmake ninja-build git \
            python3-dev python3-setuptools sqlite3 \
            libsqlite3-dev qtbase5-dev qtchooser qt5-qmake qtbase5-dev-tools \
            gir1.2-qt5-core gir1.2-qt5-gui gir1.2-qt5-widgets \
            libzmq3-dev
    fi
fi

# ns-3'ün İndirilmesi
echo "2. ns-3.37 indiriliyor..."
if [ ! -d "ns-allinone-3.37" ]; then
    wget https://www.nsnam.org/releases/ns-allinone-3.37.tar.bz2
    tar xfj ns-allinone-3.37.tar.bz2
    rm ns-allinone-3.37.tar.bz2
fi

cd ns-allinone-3.37/ns-3.37

# 5G-LENA (nr) Modülünün İndirilmesi
echo "3. 5G-LENA (nr) modülü indiriliyor..."
if [ ! -d "src/nr" ]; then
    git clone https://gitlab.com/cttc-ena/ns3-5g-lena.git src/nr
    cd src/nr
    # ns-3.37 ile uyumlu branch'e geç
    git checkout ns-3.37
    cd ../..
fi

# ns3-gym Modülünün İndirilmesi
echo "4. ns3-gym modülü indiriliyor..."
if [ ! -d "src/opengym" ]; then
    git clone https://github.com/tkn-tub/ns3-gym.git src/opengym
fi

# ns-3'ün Derlenmesi
echo "5. ns-3, 5G-LENA ve ns3-gym ile birlikte derleniyor..."
./ns3 configure --enable-examples --enable-tests
./ns3 build

# Python Bağımlılıkları ve ns3gym Kurulumu
echo "6. Python sanal ortamı ve RL bağımlılıkları kuruluyor..."
cd ../..
python3 -m venv venv
source venv/bin/activate
pip install -r rl-agent/requirements.txt

echo "7. ns3gym Python kütüphanesi kuruluyor..."
cd ns-allinone-3.37/ns-3.37/src/opengym/model/ns3gym
pip install -e .

echo "=========================================================="
echo "Kurulum Tamamlandı!"
echo "Sanal ortamı aktif etmek için: source venv/bin/activate"
echo "=========================================================="
