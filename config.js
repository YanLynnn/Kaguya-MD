import { watchFile, unwatchFile } from 'fs'
import chalk from 'chalk'
import { fileURLToPath } from 'url'

// Edit lalu simpan bot hot-reload otomatis

//——————————[ Identitas ]——————————//
global.owners = [""] //no owner, atau lewat wizard console
global.ownername = 'YannRzy Tech'
global.nomorbot = '' //no bot, atau lewat wizard console
global.namebot = "Kaguya MD"
global.nameSaluran = "YannRzy Ch."
global.idSaluran = "120363333401130891@newsletter"
global.creator = "@yannrzy"
global.versi = "1.0.0"
global.paircode = "YANNRZYY"

//——————————[ Platform ]——————————//
// Bisa ditimpa: node index.js --wa | --tg | --both
global.platforms = {
    whatsapp: true,
    telegram: false      // otomatis dilewati kalau token kosong
}

//——————————[ Mode Bot ]——————————//
global.public = true   // true = semua orang bisa pakai | false = hanya owner
global.pconly = false   // true = hanya layani private chat
global.gconly = false   // true = hanya layani grup (jangan aktif bersamaan dengan pconly)
global.anticall = "off" // off | tolak | block

//——————————[ QRIS ]——————————//
// Dipakai .qris, .beli, dan sewa. Salin utuh dari 000201 sampai akhir.
global.qrisStatic = "00020101021126570011ID.DANA.WWW011893600915302169795102090216979510303UMI51440014ID.CO.QRIS.WWW0215ID10265029601680303UMI5204549953033605802ID5923Toko Digital Store Iyan6013Kab. Kotabaru6105721626304048D"

//——————————[ Media Menu ]——————————//
global.audioMenu = "https://cdn.zass.in/6oq38T0HE4.mp3"
global.thumb = {
    utama: "https://www.yannrzy.web.id/1aBdJvBs.jpg",
    menu: "https://www.yannrzy.web.id/1aBdJvBs.jpg"
}

//——————————[ API Key ]——————————//
global.groqKey = 'gsk_...'     // .stt utama console.groq.com/keys
global.geminiKey = 'AIza...'   // .stt cadangan (opsional) aistudio.google.com/apikey
global.binderbyteKey = 'sk_gclklw8q7bs7k8g8fm37bzqmkpr5aowtajp9okvicetf52xp9amomi8ngiix9zvb' // .cekresi binderbyte.com

global.APIs = {
    yann: 'https://api.yannrzy.my.id'
}
global.APIKeys = {
    'https://api.yannrzy.my.id': 'YOUR-APIKEY'
}

//——————————[ Vercel ]——————————//
// Token: vercel.com/account/tokens | teamId hanya jika deploy ke Team
global.vercel = {
    token: process.env.VERCEL_TOKEN || "vcp_....",
    teamId: ""
}

//——————————[ GitHub ]——————————//
// Token: github.com/settings/tokens | bisa juga lewat chat: .setghtoken
global.tokengh = "ghp_...."

//——————————[ Telegram ]——————————//
global.telegram = {
    token: "",   // dari @BotFather (atau env TELEGRAM_TOKEN)
    owners: [7113158281],      // ID angka owner (kirim /myid ke bot)
    dropPending: true,         // abaikan pesan yang menumpuk saat bot mati
    maxAgeSec: 0,              // abaikan pesan lebih tua dari N detik (0 = tanpa batas)
    registerCommands: true     // daftarkan /menu, /myid, /ping
}

//——————————[ RPG & Prefix ]——————————//
global.multiplier = 38     // makin besar, makin berat naik level
global.prefix = ["", ".", "!", ","]

// Update script via .updatebot (opsional, isi link zip)
// global.updateUrl = ""
// global.updateToken = ""   // token GitHub jika repo private

global.extra = {
    // Hadiah ×pengali pada jam-jam ini (WIB). Manual: .jambahagia on 60 / off
    jamBahagia: { on: true, jam: [[12, 13], [19, 21]], pengali: 2 },

    // 3 misi acak per hari, reset 00:00 WIB
    misi: {
        on: true,
        hadiahBonus: { limit: 5, money: 3000, exp: 500 }   // bonus jika 3 misi selesai
    },

    gacha: { biaya: 5000, cooldownDetik: 20, maxPerHari: 15, pityTiap: 10 },

    menfess: { on: true, biayaLimit: 1, maxPerHari: 5, cooldownDetik: 60, maxPanjang: 500 },

    // .invite & .kodeinvite
    referral: {
        on: true,
        hadiahPengundang: { limit: 10, money: 2000 },
        hadiahTeman: { limit: 10, money: 2000 },
        maxUndangan: 50,
        milestone: { 5: { limit: 25 }, 10: { limit: 50, money: 20000 }, 25: { limit: 150, money: 100000 } }
    },

    kuis: { hadiah: { money: 500, exp: 300 }, waktuDetik: 30 }
}

//——————————[ Optimizer (VPS/panel kecil) ]——————————//
global.optimizer = {
    maxMsgAgeSec: 60,          // pesan lebih lama dari ini dilewati
    maxPendingPerChat: 3,      // maks pesan diproses bersamaan per chat
    memSoftRatio: 0.70,        // heap > 70% → bersihkan cache ringan
    memHardRatio: 0.85,        // heap > 85% → bersihkan semua cache
    rssHardRatio: 0.65,        // RAM server > 65% → bersihkan semua cache
    quiet: false               // true = sembunyikan log RAM/WATCHDOG
}

//——————————[ Anti-Ban ]——————————//
// Makin besar jeda, makin aman tapi makin lambat.
global.antiban = {
    minDelayMs: 1200,          // jeda minimum antar pesan
    maxDelayMs: 3200,          // jeda maksimum (acak min–max)
    perMinute: 20,             // maks pesan keluar per menit
    perChatPerMinute: 10       // maks pesan keluar per menit ke satu chat
}

//——————————[ Sewa Bot ]——————————//
global.sewamode = false        // true = grup wajib sewa untuk memakai bot
global.sewaAutoLeave = false   // true = bot keluar otomatis saat sewa habis
// hari: null = permanen | id dipakai di command, contoh: .sewa bulanan
global.sewaPlans = [
    { id: "harian", nama: "1 Hari", hari: 1, harga: 2000 },
    { id: "mingguan", nama: "7 Hari", hari: 7, harga: 10000 },
    { id: "bulanan", nama: "30 Hari", hari: 30, harga: 25000 },
    { id: "3bulan", nama: "90 Hari", hari: 90, harga: 60000 },
    { id: "permanen", nama: "Permanen", hari: null, harga: 100000 }
]

//——————————[ Panel Pterodactyl ]——————————//
// Command: .kaguyapanel
// plta = Application API (ptla_xxx) | pltc = Client API (ptlc_xxx)
global.panel = {
    // Server 1 (utama)
    domain: "",            // contoh: https://panel.domainmu.com (tanpa "/" di akhir)
    plta: "",
    pltc: "",
    egg: 15,
    nest: 5,
    node: 1,
    location: 1,
    docker: "ghcr.io/parkervcp/yolks:nodejs_22",

    // Server 2 (opsional, kosongkan domain2 jika tidak dipakai) → .srv21gb, .cadmin2
    domain2: "",
    plta2: "",
    pltc2: "",
    egg2: 15,
    nest2: 5,
    node2: 1,
    location2: 1,
    docker2: "ghcr.io/parkervcp/yolks:nodejs_22",

    // Info toko (tampil di kartu & struk)
    store: {
        name: "Kaguya Panel",
        web: "",
        contact: "",           // contoh: wa.me/628xxxxxxxxxx
        expired: "1 bulan",
        garansi: "15 hari",
        email: "panel.local",  // email akun: username@<ini>
        terms: [               // satu baris = satu poin S&K
            "Dilarang memakai script DDoS",
            "Dilarang menambah egg tanpa izin pemilik",
            "Dilarang menyalakan 2FA / membuat rusuh",
            "Dilarang menghapus akun admin",
            "Dilarang mengintip / mencuri / mengganti script",
            "Pelanggaran = blacklist dan hukuman lainnya",
            "Simpan data ini sebaik mungkin"
        ]
    },

    // Paket: nama = command (.1gb, .2gb, dst). RAM/disk dalam MB, CPU dalam %, 0 = unlimited.
    // Tambah baris = command baru (perlu restart).
    plans: {
        "1gb":  { ram: 1050,  disk: 3050,  cpu: 30 },
        "2gb":  { ram: 2070,  disk: 2070,  cpu: 60 },
        "3gb":  { ram: 3090,  disk: 3090,  cpu: 90 },
        "4gb":  { ram: 4110,  disk: 4110,  cpu: 120 },
        "5gb":  { ram: 5130,  disk: 5130,  cpu: 150 },
        "6gb":  { ram: 6050,  disk: 6050,  cpu: 180 },
        "7gb":  { ram: 7050,  disk: 7050,  cpu: 210 },
        "8gb":  { ram: 8050,  disk: 8050,  cpu: 240 },
        "9gb":  { ram: 9050,  disk: 9050,  cpu: 270 },
        "10gb": { ram: 10050, disk: 10050, cpu: 300 },
        "unli": { ram: 0,     disk: 0,     cpu: 0 }
    },

    onlyGroup: false       // true = jualan hanya di grup
}

//——————————[ Fitur Tambahan ]——————————//
global.fitur = {
    // ── Hadiah harian/mingguan/bulanan + streak ──
    // Command: .harian .claim .mingguan .weekly .bulanan
    reward: {
        harian:   { cooldownJam: 24,  free: { exp: 500,  money: 1000,  limit: 5 },  prem: { exp: 1000, money: 5000,   limit: 10 } },
        mingguan: { cooldownJam: 168, free: { exp: 2999, money: 7000,  limit: 15 }, prem: { exp: 4999, money: 14000,  limit: 30 } },
        bulanan:  { cooldownJam: 720, free: { exp: 4999, money: 50000, limit: 30 }, prem: { exp: 5999, money: 100000, limit: 50 } },
        streak: {
            on: true,
            toleransiJam: { harian: 48, mingguan: 336 },     // telat klaim lebih dari ini = streak putus
            // [minimal streak, bonus %] — dicek dari atas ke bawah
            tingkat: {
                harian:   [[30, 100], [14, 50], [7, 25], [3, 10]],
                mingguan: [[8, 50], [4, 25], [2, 10]]
            },
            // hadiah tambahan tiap kelipatan N streak
            milestone: {
                harian:   { setiap: 7, hadiah: { limit: 25, money: 25000, exp: 3000 } },
                mingguan: { setiap: 4, hadiah: { limit: 20 } }
            }
        }
    },

    // ── Event shop ── (.eventshop, .eventbuy)
    eventShop: {
        on: true,
        events: [
            { nama: "Jumat Berkah", hari: ["jumat"], diskon: 20, item: "semua" },
            {
                nama: "Event Contoh", mulai: "2026-10-23", selesai: "2026-10-31", diskon: 30, item: ["potion", "sword"],
                barang: {
                    paketevent: { nama: "Paket Event", harga: 50000, stok: 50, batasPerUser: 2, beri: { potion: 5, mythic: 1 } }
                }
            }
        ]
    },

    // ── Leaderboard mingguan berhadiah ──
    lbMingguan: {
        on: true,
        mode: "naik",
        kategori: ["exp", "money"],        // kolom data user
        hariReset: "minggu",
        jamReset: 20,                      // 0–23 WIB
        minNilai: 1,
        hadiah: [                          // urutan = peringkat 1, 2, 3, ...
            { money: 100000, exp: 5000, limit: 10 },
            { money: 50000,  exp: 3000, limit: 5 },
            { money: 25000,  exp: 1500, limit: 3 }
        ],
        umumkanKe: "semuaGrup"             // "semuaGrup" | ["jid@g.us"] | []
    },

    // ── Marketplace antar user ──
    marketplace: {
        on: true,
        pajakPersen: 5,                    // potongan dari hasil jual
        maxListing: 5,                     // maks listing aktif per user
        durasiHari: 7,                     // lewat ini listing hangus, barang dikembalikan
        hargaMin: 1,
        hargaMax: 100000000,
        itemBoleh: "semua",                // "semua" atau ["potion", "common", ...]
        itemDilarang: ["money", "exp", "level", "limit", "bank", "health", "stamina", "atm", "fullatm", "age", "regtime", "afk", "warn", "premiumtime", "sword", "pickaxe", "axe", "fishingrod", "armor"]
    },

    // ── Clan & clan war ──
    clan: {
        on: true,
        wajibGuild: true,                  // harus ikut .guild dulu
        biayaBuat: 100000,
        maxAnggota: 20,
        maxNama: 12,
        pesertaWar: 5,                     // jumlah anggota terkuat yang dihitung
        minAnggotaWar: 2,
        cooldownWarMenit: 60,
        expiredTantanganMenit: 10,
        acakPersen: 25,                    // faktor keberuntungan (0 = murni kekuatan)
        bobot: { level: 10, sword: 30, armor: 20, pickaxe: 5, potion: 2 },   // kekuatan = nilai item × bobot
        menang: { money: 50000, exp: 5000 },   // hadiah tiap peserta
        kalah:  { exp: 1000 },
        rampasKasPersen: 10                // % kas clan kalah → clan menang
    },

    // ── Anti-delete / anti-edit / anti-viewonce (berlaku global) ──
    antidelete: {
        on: false, grup: true, pribadi: true, kirimKe: "owner",
        media: true,                       // simpan foto/video/vn agar bisa dikirim ulang
        kecualiGrup: []
    },
    antiedit: {
        on: false, grup: true, pribadi: true, kirimKe: "owner",
        kecualiGrup: []
    },
    antiviewonce: {
        on: false, grup: true, pribadi: true, kirimKe: "owner",
        kecualiGrup: []
    },

    // ── Log command & laporan harian ke owner ──
    logCommand: {
        on: false,
        kirimKe: "owner",
        intervalMenit: 10,                 // 0 = kirim tiap command | >0 = dirangkum tiap N menit
        simpanFile: true,                  // simpan ke db/command.log
        abaikanOwner: true,
        abaikanCommand: ["menu", "ping"]
    },
    laporanHarian: { on: false, jam: 21 }, // statistik harian ke owner (WIB)

    // ── Blacklist global (owner selalu lolos) ──
    blacklist: {
        on: false,
        nomor: [],                         // ["6281234567890"]
        grup: [],                          // ["120363xxx@g.us"]
        command: [],                       // command yang dimatikan untuk semua
        kata: [],                          // pesan mengandung kata ini diabaikan
        balas: false,                      // true = beri tahu user (maks 1x / 6 jam)
        pesan: "Kamu masuk blacklist bot ini."
    }
}

//——————————[ Pesan Bot ]——————————//
global.mess = {
    wait: "🧃 Tunggu sebentar ya, lagi aku urus dulu...",
    owner: "🍅 Khusus owner. Yang ini nggak bisa aku bukain~",
    admin: "🍋 Khusus admin. Nanti aku kena omel kalau nekat!",
    premium: "🍰 Yang ini khusus premium. Menarik sih, tapi belum bisa~",
    group: "🍡 Fitur ini cuma jalan di dalam grup ya!",
    private: "🍡 Fitur ini cuma bisa dipakai di private chat ya!"
}

global.stickerPack = {
    packname: global.namebot,
    author: `\nMade By YannRzy Tech\nBot: ${global.nomorbot}\n\n\n\n\n\n${global.namebot}`
}

let file = fileURLToPath(import.meta.url)
watchFile(file, () => {
    unwatchFile(file)
    console.log(chalk.redBright("Update config.js"))
    import(`${file}?update=${Date.now()}`)
})
