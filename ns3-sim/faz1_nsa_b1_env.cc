#include "ns3/core-module.h"
#include "ns3/network-module.h"
#include "ns3/mobility-module.h"
#include "ns3/lte-module.h"
#include "ns3/nr-module.h"
#include "ns3/point-to-point-epc-helper.h"
#include "ns3/opengym-module.h"
#include "ns3/config-store-module.h"

using namespace ns3;

NS_LOG_COMPONENT_DEFINE ("Faz1NsaB1Optimization");

// ---------------------------------------------------------
// Global Değişkenler: Trace (İzleme) Verilerini Tutacaklar
// ---------------------------------------------------------
float g_lteRsrp = -140.0;
float g_nrRsrp = -140.0;
float g_lteLoad = 0.0;
float g_nrLoad = 0.0;
uint32_t g_ueCount = 5;
float g_totalThroughput = 0.0; // Mbps

// ---------------------------------------------------------
// Trace Sink (Geri Çağırma) Fonksiyonları
// ---------------------------------------------------------
void NotifyConnectionEstablishedUe (std::string context, uint64_t imsi, uint16_t cellid, uint16_t rnti) {
    NS_LOG_INFO ("UE " << imsi << " Cell " << cellid << " RNTI " << rnti << " Bağlandı.");
}

void NotifyMeasurementReport (std::string context, uint64_t imsi, uint16_t cellId, uint16_t rnti, LteRrcSap::MeasurementReport msg) {
    // Burada UE'nin gönderdiği ölçüm raporlarından RSRP değerlerini okuyoruz.
    // Gerçek projede bu kısımlar LteUePhy / NrUePhy trace'lerinden daha sık (milisaniye) çekilir.
    NS_LOG_INFO ("UE " << imsi << " Ölçüm Raporu Gönderdi.");
}

void NotifyMacTx (std::string context, Ptr<const Packet> p, Mac48Address src, Mac48Address dst) {
    // Toplam Throughput hesaplamak için gönderilen paket boyutlarını topla
    g_totalThroughput += p->GetSize () * 8.0; // Bit cinsinden
}

// ---------------------------------------------------------
// ns3-gym Ortamının (Environment) Tanımlanması
// ---------------------------------------------------------
class NsaB1GymEnv : public OpenGymEnv {
public:
    NsaB1GymEnv () {
        NS_LOG_FUNCTION (this);
        m_stepCount = 0;
    }

    Ptr<OpenGymSpace> GetActionSpace() override {
        // B1 eşik değerleri: 5 farklı seviye
        // [0: -120dBm, 1: -118dBm, 2: -116dBm, 3: -114dBm, 4: -112dBm]
        uint32_t numActions = 5;
        return CreateObject<OpenGymDiscreteSpace> (numActions);
    }

    Ptr<OpenGymSpace> GetObservationSpace() override {
        // State: [lte_rsrp, nr_rsrp, lte_load, nr_load, ue_count]
        std::vector<uint32_t> shape = {5};
        return CreateObject<OpenGymBoxSpace> (-150.0, 100.0, shape); 
    }

    Ptr<OpenGymDataContainer> GetObservation() override {
        Ptr<OpenGymBoxContainer<float>> box = CreateObject<OpenGymBoxContainer<float>> (std::vector<uint32_t>{5});
        
        // Gerçek Trace verilerini State'e ekle
        box->AddValue (g_lteRsrp);
        box->AddValue (g_nrRsrp);
        box->AddValue (g_lteLoad);
        box->AddValue (g_nrLoad);
        box->AddValue ((float)g_ueCount);

        m_stepCount++;
        return box;
    }

    float GetReward() override {
        // Ödül: Ajanı yüksek Throughput ve düşük ping-pong için teşvik et
        float throughputMbps = g_totalThroughput / (1000.0 * 1000.0); // Step başına Mbps (Yaklaşık)
        g_totalThroughput = 0.0; // Bir sonraki adım için sıfırla

        float reward = throughputMbps; 
        
        // B1 çok erken veya çok geç tetiklenirse oluşabilecek sinyal düşüşlerini cezalandır
        if (g_nrRsrp < -115.0 && g_nrLoad > 0.0) {
            reward -= 5.0; // Sinyal kötüyken 5G'ye geçilmiş (Ceza)
        }

        return reward;
    }

    bool GetGameOver() override {
        if (m_stepCount >= 200) { // 200 adımda bir episode bitsin
            m_stepCount = 0;
            return true;
        }
        return false;
    }

    std::string GetExtraInfo() override {
        return "Faz1_NSA_B1_Info";
    }

    bool ExecuteActions(Ptr<OpenGymDataContainer> actionContainer) override {
        Ptr<OpenGymDiscreteContainer> discreteAction = DynamicCast<OpenGymDiscreteContainer> (actionContainer);
        uint32_t action = discreteAction->GetValue ();

        int16_t b1_threshold_dbm;
        switch (action) {
            case 0: b1_threshold_dbm = -120; break;
            case 1: b1_threshold_dbm = -118; break;
            case 2: b1_threshold_dbm = -116; break;
            case 3: b1_threshold_dbm = -114; break;
            case 4: b1_threshold_dbm = -112; break;
            default: b1_threshold_dbm = -116; break;
        }

        NS_LOG_UNCOND ("RL Ajanı Yeni B1 Eşiğini Seçti: " << b1_threshold_dbm << " dBm");

        // Gerçek LteEnbRrc konfigürasyonu (Run-Time sırasında)
        Config::SetDefault ("ns3::LteEnbRrc::B1Threshold", IntegerValue (b1_threshold_dbm));
        
        return true;
    }

private:
    uint32_t m_stepCount;
};

// ---------------------------------------------------------
// 2. Ana Simülasyon Kurgusu (5G NSA - EN-DC)
// ---------------------------------------------------------
int main (int argc, char *argv[])
{
    uint32_t simTime = 10; // Simülasyon süresi
    uint16_t envPort = 5555;

    CommandLine cmd;
    cmd.AddValue ("simTime", "Simulation time in seconds", simTime);
    cmd.AddValue ("envPort", "Port for ns3-gym", envPort);
    cmd.Parse (argc, argv);

    // ns3-gym Arayüzünü Başlat
    Ptr<OpenGymInterface> openGymInterface = CreateObject<OpenGymInterface> (envPort);
    Ptr<NsaB1GymEnv> env = CreateObject<NsaB1GymEnv> ();
    openGymInterface->SetOpenGymEnv (env);

    // NSA Ağ Kurulumu
    NodeContainer epcNodes, enbNodes, gnbNodes, ueNodes;
    enbNodes.Create(1); // 1 LTE Master Node
    gnbNodes.Create(1); // 1 NR Secondary Node
    ueNodes.Create(g_ueCount);  // 5 UE

    // Hareketlilik (Mobility)
    MobilityHelper bsMobility;
    bsMobility.SetMobilityModel ("ns3::ConstantPositionMobilityModel");
    bsMobility.Install (enbNodes);
    
    // gNB'yi eNB'den 500 metre uzağa yerleştir (B1 event'i için hareket alanı)
    Ptr<ListPositionAllocator> gnbPositionAlloc = CreateObject<ListPositionAllocator> ();
    gnbPositionAlloc->Add (Vector (500.0, 0.0, 0.0));
    bsMobility.SetPositionAllocator (gnbPositionAlloc);
    bsMobility.Install (gnbNodes);

    // UE'ler eNB (0,0) konumundan gNB (500,0) konumuna doğru yürüsün
    MobilityHelper ueMobility;
    ueMobility.SetPositionAllocator ("ns3::GridPositionAllocator",
                                     "MinX", DoubleValue (0.0),
                                     "MinY", DoubleValue (0.0),
                                     "DeltaX", DoubleValue (5.0),
                                     "DeltaY", DoubleValue (5.0),
                                     "GridWidth", UintegerValue (3),
                                     "LayoutType", StringValue ("RowFirst"));
    ueMobility.SetMobilityModel ("ns3::ConstantVelocityMobilityModel");
    ueMobility.Install (ueNodes);
    
    for (uint32_t i = 0; i < ueNodes.GetN(); ++i) {
        Ptr<ConstantVelocityMobilityModel> mob = ueNodes.Get(i)->GetObject<ConstantVelocityMobilityModel>();
        mob->SetVelocity(Vector(20.0, 0.0, 0.0)); // Araç hızı (20 m/s) ile gNB'ye doğru gitsinler
    }

    NS_LOG_UNCOND ("Faz 1: 5G NSA (LTE+NR) Simülasyonu Kuruluyor...");
    
    // LENA NSA (EN-DC) Kurulumu (Gelecekte ns-3 derlendiğinde aktif edilecek)
    /*
    Ptr<LteHelper> lteHelper = CreateObject<LteHelper> ();
    Ptr<PointToPointEpcHelper> epcHelper = CreateObject<PointToPointEpcHelper> ();
    lteHelper->SetEpcHelper (epcHelper);
    
    // Trace Sink'leri bağla
    Config::Connect ("/NodeList/*/DeviceList/*/LteEnbRrc/ConnectionEstablished",
                     MakeCallback (&NotifyConnectionEstablishedUe));
    */

    Simulator::Stop (Seconds (simTime));
    Simulator::Run ();
    
    openGymInterface->NotifySimulationEnd();
    Simulator::Destroy ();

    return 0;
}
