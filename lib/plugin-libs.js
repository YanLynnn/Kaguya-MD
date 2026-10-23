/**

* Kaguya Multi Device — WhatsApp & Tele Bot
* 
* Library      : whiskeysockets baileys
* Type         : Plugins | ESM Modules
* Creator      : YannRzy Tech
* Recode       : (Your Name)
* 
* Official Channels:
* • https://whatsapp.com/channel/0029VaoMGuLA89MbfGh62V16
* 
* Copyright © YannRzy Tech 2026
* All Rights Reserved.
  */


import { dioSave, dioStore, dioWib, ffmpegBin, persist, rpgUser } from './plugin-engine.js'

const dioLibs = {
    // gaya teks: huruf tebal serif. Emoji dibiarkan apa adanya.
    style: (module) => {
        const B = (t) => String(t ?? '').replace(/[A-Za-z0-9]/g, (c) => {
            const k = c.charCodeAt(0)
            return String.fromCodePoint(k >= 97 ? 0x1D41A + k - 97 : k >= 65 ? 0x1D400 + k - 65 : 0x1D7CE + k - 48)
        })
        const plain = (t) => String(t ?? '').normalize('NFKC').replace(/[\u{13000}-\u{1342F}]/gu, '').replace(/\s+/g, ' ').trim()
        const cut = (t, n) => { const a = Array.from(String(t ?? '')); return a.length > n ? a.slice(0, n - 1).join('') + '…' : a.join('') }
        module.exports = { B, plain, cut, fx: (t) => t, ancientize: (t) => t, content: (c) => c, on: () => false }
    },
    // penyimpanan ringan per user (global.db.dio.praktis)
    praktis: (module) => {
        const get = (jid, key, fb) => { const d = dioStore().praktis[jid]; return d && d[key] !== undefined ? d[key] : fb }
        const set = (jid, key, val) => { const s = dioStore().praktis; (s[jid] ||= {})[key] = val; dioSave(); return val }
        const all = () => dioStore().praktis
        const TZ = 'Asia/Jakarta'
        const dayKey = (d = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)
        const addDays = (k, n) => { const d = new Date(k + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10) }
        const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
        const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']
        const fmtTanggal = (k) => { const d = new Date(k + 'T00:00:00Z'); return `${HARI[d.getUTCDay()]}, ${d.getUTCDate()} ${BULAN[d.getUTCMonth()]} ${d.getUTCFullYear()}` }
        const rupiah = (n) => 'Rp' + Math.round(n).toLocaleString('id-ID')
        const bar = (f, len = 10) => { const on = Math.round(Math.max(0, Math.min(1, f)) * len); return '█'.repeat(on) + '░'.repeat(len - on) }
        const quotedText = (m) => ((m.quoted && (m.quoted.text || m.quoted.caption)) || '').trim()
        const mentions = (m) => [...new Set([...(m.msg?.contextInfo?.mentionedJid || []), ...(m.mentionedJid || [])])]
        module.exports = { get, set, all, dayKey, addDays, fmtTanggal, rupiah, bar, quotedText, mentions, BULAN, HARI }
    },
    // profil ringan: kota & tanggal lahir (global.db.dio.profile)
    profiledb: (module) => {
        module.exports = {
            get: (j) => dioStore().profile[j] || {},
            set: (j, k, v) => { (dioStore().profile[j] ||= {})[k] = v; dioSave() },
            del: (j, k) => { const p = dioStore().profile[j]; if (p) { delete p[k]; dioSave() } }
        }
    },
    rpg: (module) => {
        const fmt = (n) => Math.floor(n).toLocaleString('id-ID')
        const user = (jid) => rpgUser(jid)
        module.exports = {
            fmt, today: dioWib, save: () => persist(),
            get: (jid) => (jid ? user(jid) : null),
            addGold: (u, n) => { const v = Math.floor(Number(n) || 0); u.money = (Number(u.money) || 0) + v; return v },
            addExp: (u, n) => { const v = Math.floor(Number(n) || 0); u.exp = (Number(u.exp) || 0) + v; return { amt: v, up: false, lvl: u.level || 1 } }
        }
    },
    // header karakter layanan (tanpa sistem hubungan NPC)
    npcutil: (module) => {
        const NPC = {
            alma: ['📒', 'Alma', 'Sekretaris Pribadi'], bilal: ['🕌', 'Pak Bilal', 'Penjaga Waktu Salat'],
            chrona: ['📅', 'Chrona', 'Penjaga Kalender'], zora: ['🔮', 'Madam Zora', 'Peramal Kota']
        }
        module.exports = {
            head: (id) => { const n = NPC[id]; return n ? `${n[0]} *${n[1]}* — ${n[2]}` : '' },
            bump: () => ''
        }
    },
    // target dari @mention / reply / nomor di teks
    grouputil: (module) => {
        const clean = (s) => String(s || '').replace(/[^0-9]/g, '')
        const targets = (m, text) => {
            const set = new Set()
            for (const j of m.mentionedJid || []) set.add(j)
            if (m.quoted && m.quoted.sender) set.add(m.quoted.sender)
            for (const w of String(text || '').split(/[\s,]+/)) {
                const n = clean(w)
                if (n.length >= 8 && n.length <= 15) set.add(n + '@s.whatsapp.net')
            }
            return [...set]
        }
        module.exports = { targets, tag: (jid) => '@' + String(jid).split('@')[0], clean }
    },
    "daily": (module, exports, require) => {
        // MESIN KEHIDUPAN SEHARI-HARI: tanggal, Hijriah, weton, zodiak, shio, libur nasional, salat, kiblat
        const tzOf = () => global.settingsDefault?.timezone || 'Asia/Jakarta'
        const DAYS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']
        const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
        const HMONTHS = ['Muharam', 'Safar', 'Rabiulawal', 'Rabiulakhir', 'Jumadilawal', 'Jumadilakhir', 'Rajab', 'Syaban', 'Ramadan', 'Syawal', 'Zulkaidah', 'Zulhijah']
        const pad = (n) => String(n).padStart(2, '0')

        // ── waktu sekarang di zona waktu tertentu ──
        function parts(date, tz) {
          const p = {}; new Intl.DateTimeFormat('en-GB', { timeZone: tz || tzOf(), hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric', weekday: 'short' }).formatToParts(date).forEach(x => { p[x.type] = x.value })
          return { y: +p.year, m: +p.month, d: +p.day, hh: +p.hour, mm: +p.minute, ss: +p.second, dow: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(p.weekday) }
        }
        const now = (tz) => parts(new Date(), tz)
        // selisih UTC (ms) zona waktu pada saat tertentu
        const offsetMs = (tz, date) => { const p = parts(date, tz); return Date.UTC(p.y, p.m - 1, p.d, p.hh, p.mm, p.ss) - Math.floor(date.getTime() / 1000) * 1000 }
        // jam dinding (y,m,d,hh,mm) di zona tz -> epoch ms
        function zonedToUtc(y, m, d, hh, mm, tz) { let t = Date.UTC(y, m - 1, d, hh, mm) - offsetMs(tz || tzOf(), new Date(Date.UTC(y, m - 1, d, hh, mm))); t = Date.UTC(y, m - 1, d, hh, mm) - offsetMs(tz || tzOf(), new Date(t)); return t }

        const dayNum = (y, m, d) => Math.round(Date.UTC(y, m - 1, d) / 864e5)           // nomor hari (tanpa jam)
        const diffDays = (a, b) => dayNum(b.y, b.m, b.d) - dayNum(a.y, a.m, a.d)
        const addDays = (o, n) => { const t = new Date(Date.UTC(o.y, o.m - 1, o.d + n)); return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate(), dow: t.getUTCDay() } }
        const dowOf = (y, m, d) => new Date(Date.UTC(y, m - 1, d)).getUTCDay()
        const fmtDate = (o, withDow = true) => `${withDow ? DAYS[o.dow ?? dowOf(o.y, o.m, o.d)] + ', ' : ''}${o.d} ${MONTHS[o.m - 1]} ${o.y}`
        const iso = (o) => `${o.y}-${pad(o.m)}-${pad(o.d)}`
        const isLeap = (y) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0
        const dayOfYear = (o) => diffDays({ y: o.y, m: 1, d: 1 }, o) + 1
        function isoWeek(o) { const t = new Date(Date.UTC(o.y, o.m - 1, o.d)), dn = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - dn); const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1)); return Math.ceil(((t - y0) / 864e5 + 1) / 7) }

        // ── parser tanggal: 17-08-2027, 17/8/27, 2027-08-17, "17 agustus 2027", "17 agu" ──
        const MON_ALIAS = { jan: 1, januari: 1, feb: 2, februari: 2, mar: 3, maret: 3, apr: 4, april: 4, mei: 5, may: 5, jun: 6, juni: 6, jul: 7, juli: 7, agu: 8, agt: 8, agustus: 8, aug: 8, sep: 9, sept: 9, september: 9, okt: 10, oktober: 10, oct: 10, nov: 11, november: 11, des: 12, desember: 12, dec: 12 }
        function parseDate(str, ref) {
          const s = String(str || '').toLowerCase().trim().replace(/,/g, ' '); if (!s) return null
          const cur = ref || now(); let m
          const ok = (y, mo, d) => { if (y < 1000) y += y < 50 ? 2000 : 1900; const t = new Date(Date.UTC(y, mo - 1, d)); return t.getUTCFullYear() === y && t.getUTCMonth() === mo - 1 && t.getUTCDate() === d ? { y, m: mo, d, dow: t.getUTCDay() } : null }
          if ((m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/))) return ok(+m[1], +m[2], +m[3])
          if ((m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/))) return ok(+m[3], +m[2], +m[1])
          if ((m = s.match(/^(\d{1,2})[-/.](\d{1,2})$/))) return ok(cur.y, +m[2], +m[1])
          if ((m = s.match(/^(\d{1,2})\s+([a-z]+)\s*(\d{2,4})?$/)) && MON_ALIAS[m[2]]) return ok(m[3] ? +m[3] : cur.y, MON_ALIAS[m[2]], +m[1])
          return null
        }
        // ambil tanggal dari awal teks (1-3 kata) -> {date, rest}
        function takeDate(text, ref) {
          const w = String(text || '').trim().split(/\s+/)
          for (const n of [3, 2, 1]) { const d = parseDate(w.slice(0, n).join(' '), ref); if (d) return { date: d, rest: w.slice(n).join(' ') } }
          return { date: null, rest: text }
        }

        // ── Hijriah (kalender sipil; resmi ditetapkan Kemenag, bisa ±1 hari) ──
        function hijri(o) {
          const p = {}; new Intl.DateTimeFormat('en-u-ca-islamic-civil', { day: 'numeric', month: 'numeric', year: 'numeric', timeZone: 'UTC' }).formatToParts(new Date(Date.UTC(o.y, o.m - 1, o.d, 12))).forEach(x => { p[x.type] = x.value })
          return { d: +p.day, m: +p.month, y: parseInt(p.year), name: HMONTHS[+p.month - 1], text: `${+p.day} ${HMONTHS[+p.month - 1]} ${parseInt(p.year)} H` }
        }

        // ── Weton Jawa ──
        const PASARAN = ['Legi', 'Pahing', 'Pon', 'Wage', 'Kliwon'], NEPTU_HARI = [5, 4, 3, 7, 8, 6, 9], NEPTU_PASARAN = [5, 9, 7, 4, 8]
        const pasaranOf = (o) => PASARAN[(((dayNum(o.y, o.m, o.d) - dayNum(1945, 8, 17)) % 5) + 5) % 5]   // 17-8-1945 = Jumat Legi
        function weton(o) { const dow = dowOf(o.y, o.m, o.d), ps = pasaranOf(o), pi = PASARAN.indexOf(ps); return { hari: DAYS[dow], pasaran: ps, neptu: NEPTU_HARI[dow] + NEPTU_PASARAN[pi], nh: NEPTU_HARI[dow], np: NEPTU_PASARAN[pi] } }
        const PASARAN_SIFAT = { Legi: 'ramah, murah hati, mudah bergaul', Pahing: 'tegas, ambisius, pekerja keras', Pon: 'tenang, bijaksana, penuh pertimbangan', Wage: 'teguh, mandiri, setia pada prinsip', Kliwon: 'intuitif, peka, punya daya tarik tersendiri' }
        const NEPTU_ARTI = (n) => n <= 9 ? 'sederhana dan rendah hati; rezeki mengalir lewat ketekunan' : n <= 12 ? 'seimbang dan tenang; hidup stabil bila sabar' : n <= 15 ? 'penuh semangat dan kepemimpinan; pandai memanfaatkan peluang' : 'berwibawa dan beruntung; hati-hati dengan ego sendiri'

        // ── Zodiak & Shio (hiburan) ──
        const ZODIAK = [['Capricorn', 12, 22, 'ambisius, disiplin, dan bertanggung jawab'], ['Aquarius', 1, 20, 'mandiri, kreatif, dan visioner'], ['Pisces', 2, 19, 'empatik, imajinatif, dan lembut'], ['Aries', 3, 21, 'berani, energik, dan pemimpin alami'], ['Taurus', 4, 20, 'setia, sabar, dan menyukai kenyamanan'], ['Gemini', 5, 21, 'cerdas, luwes, dan banyak ide'], ['Cancer', 6, 21, 'penyayang, protektif, dan intuitif'], ['Leo', 7, 23, 'percaya diri, hangat, dan dermawan'], ['Virgo', 8, 23, 'teliti, analitis, dan membantu'], ['Libra', 9, 23, 'adil, diplomatis, dan menyukai harmoni'], ['Scorpio', 10, 23, 'gigih, misterius, dan penuh tekad'], ['Sagitarius', 11, 22, 'optimis, bebas, dan suka petualangan']]
        function zodiak(o) { let z = ZODIAK[0]; for (const x of ZODIAK) if (o.m > x[1] || (o.m === x[1] && o.d >= x[2])) z = x; if (o.m === 1 && o.d < 20) z = ZODIAK[0]; return { name: z[0], sifat: z[3] } }
        const SHIO = [['Tikus', 'cerdik, adaptif, dan pandai melihat peluang'], ['Kerbau', 'tekun, jujur, dan pekerja keras'], ['Macan', 'berani, kharismatik, dan kompetitif'], ['Kelinci', 'lembut, diplomatis, dan artistik'], ['Naga', 'berwibawa, penuh semangat, dan ambisius'], ['Ular', 'bijak, tenang, dan analitis'], ['Kuda', 'bebas, enerjik, dan supel'], ['Kambing', 'kreatif, penyayang, dan cinta damai'], ['Monyet', 'jenaka, cerdas, dan inovatif'], ['Ayam', 'rajin, teliti, dan percaya diri'], ['Anjing', 'setia, jujur, dan melindungi'], ['Babi', 'dermawan, tulus, dan penuh kasih']]
        function shio(o) { const y = (o.m < 2 || (o.m === 2 && o.d < 5)) ? o.y - 1 : o.y, i = (((y - 2020) % 12) + 12) % 12, s = SHIO[i]; return { name: s[0], sifat: s[1], year: y, edge: o.m === 1 || (o.m === 2 && o.d < 20) } }

        // ── Libur nasional & cuti bersama (SKB 3 Menteri). Update tiap tahun! ──
        const L = (d, n, t = 'libur') => ({ d, n, t })
        const HOLIDAYS = [
          L('2026-01-01', 'Tahun Baru 2026 Masehi'), L('2026-01-16', 'Isra Mikraj Nabi Muhammad SAW'), L('2026-02-16', 'Cuti Bersama Tahun Baru Imlek', 'cuti'), L('2026-02-17', 'Tahun Baru Imlek 2577'),
          L('2026-03-18', 'Cuti Bersama Hari Suci Nyepi', 'cuti'), L('2026-03-19', 'Hari Suci Nyepi (Tahun Baru Saka 1948)'), L('2026-03-20', 'Cuti Bersama Idulfitri', 'cuti'), L('2026-03-21', 'Hari Raya Idulfitri 1447 H'), L('2026-03-22', 'Hari Raya Idulfitri 1447 H'),
          L('2026-03-23', 'Cuti Bersama Idulfitri', 'cuti'), L('2026-03-24', 'Cuti Bersama Idulfitri', 'cuti'), L('2026-04-03', 'Wafat Yesus Kristus'), L('2026-04-05', 'Kebangkitan Yesus Kristus (Paskah)'),
          L('2026-05-01', 'Hari Buruh Internasional'), L('2026-05-14', 'Kenaikan Yesus Kristus'), L('2026-05-15', 'Cuti Bersama Kenaikan Yesus Kristus', 'cuti'), L('2026-05-27', 'Hari Raya Iduladha 1447 H'), L('2026-05-28', 'Cuti Bersama Iduladha', 'cuti'),
          L('2026-05-31', 'Hari Raya Waisak 2570 BE'), L('2026-06-01', 'Hari Lahir Pancasila'), L('2026-06-16', '1 Muharam Tahun Baru Islam 1448 H'), L('2026-08-17', 'Proklamasi Kemerdekaan RI'), L('2026-08-25', 'Maulid Nabi Muhammad SAW'),
          L('2026-12-24', 'Cuti Bersama Natal', 'cuti'), L('2026-12-25', 'Kelahiran Yesus Kristus (Natal)'),
          L('2027-01-01', 'Tahun Baru 2027 Masehi'), L('2027-01-05', 'Isra Mikraj Nabi Muhammad SAW 1448 H'), L('2027-02-05', 'Cuti Bersama Tahun Baru Imlek', 'cuti'), L('2027-02-06', 'Tahun Baru Imlek 2578 Kongzili'),
          L('2027-03-08', 'Hari Suci Nyepi (Tahun Baru Saka 1949)'), L('2027-03-09', 'Cuti Bersama Idulfitri', 'cuti'), L('2027-03-10', 'Hari Raya Idulfitri 1448 H'), L('2027-03-11', 'Hari Raya Idulfitri 1448 H'),
          L('2027-03-12', 'Cuti Bersama Idulfitri', 'cuti'), L('2027-03-15', 'Cuti Bersama Idulfitri', 'cuti'), L('2027-03-25', 'Cuti Bersama Wafat Yesus Kristus', 'cuti'), L('2027-03-26', 'Wafat Yesus Kristus'), L('2027-03-28', 'Kebangkitan Yesus Kristus (Paskah)'),
          L('2027-05-01', 'Hari Buruh Internasional'), L('2027-05-06', 'Kenaikan Yesus Kristus'), L('2027-05-17', 'Hari Raya Iduladha 1448 H'), L('2027-05-18', 'Cuti Bersama Iduladha', 'cuti'), L('2027-05-19', 'Cuti Bersama Waisak', 'cuti'),
          L('2027-05-20', 'Hari Raya Waisak 2571 BE'), L('2027-06-01', 'Hari Lahir Pancasila'), L('2027-06-06', '1 Muharam Tahun Baru Islam 1449 H'), L('2027-08-15', 'Maulid Nabi Muhammad SAW'), L('2027-08-17', 'Proklamasi Kemerdekaan RI'),
          L('2027-12-24', 'Cuti Bersama Natal', 'cuti'), L('2027-12-25', 'Kelahiran Yesus Kristus (Natal)'), L('2027-12-26', 'Isra Mikraj Nabi Muhammad SAW 1449 H'),
        ]
        const HOL_MAP = Object.fromEntries(HOLIDAYS.map(h => [h.d, h]))
        const HOL_LAST = HOLIDAYS[HOLIDAYS.length - 1].d.slice(0, 4)
        const holidayOn = (o) => HOL_MAP[iso(o)] || null
        const isWorkday = (o) => { const dw = o.dow ?? dowOf(o.y, o.m, o.d); return dw !== 0 && dw !== 6 && !(holidayOn(o) && holidayOn(o).t === 'libur') && !(holidayOn(o) && holidayOn(o).t === 'cuti') }
        function nextHolidays(from, n = 5, type = 'libur') {
          const f = iso(from); return HOLIDAYS.filter(h => h.d >= f && (type === 'all' || h.t === type)).slice(0, n).map(h => { const [y, m, d] = h.d.split('-').map(Number); return { ...h, date: h.d, y, m, d, dow: dowOf(y, m, d), in: diffDays(from, { y, m, d }) } })
        }

        // ── Kota (lat, lng, UTC offset) ──
        const C = (name, lat, lng, tz) => ({ name, lat, lng, tz })
        const CITIES = { jakarta: C('Jakarta', -6.2088, 106.8456, 7), bandung: C('Bandung', -6.9175, 107.6191, 7), surabaya: C('Surabaya', -7.2575, 112.7521, 7), semarang: C('Semarang', -6.9667, 110.4167, 7), yogyakarta: C('Yogyakarta', -7.7956, 110.3695, 7),
          medan: C('Medan', 3.5952, 98.6722, 7), palembang: C('Palembang', -2.9761, 104.7754, 7), makassar: C('Makassar', -5.1477, 119.4327, 8), denpasar: C('Denpasar', -8.6705, 115.2126, 8), balikpapan: C('Balikpapan', -1.2379, 116.8529, 8),
          pontianak: C('Pontianak', -0.0263, 109.3425, 7), banjarmasin: C('Banjarmasin', -3.3194, 114.5908, 8), manado: C('Manado', 1.4748, 124.8421, 8), padang: C('Padang', -0.9471, 100.4172, 7), pekanbaru: C('Pekanbaru', 0.5071, 101.4478, 7),
          batam: C('Batam', 1.0456, 104.0305, 7), bandarlampung: C('Bandar Lampung', -5.4294, 105.261, 7), malang: C('Malang', -7.9666, 112.6326, 7), bogor: C('Bogor', -6.5971, 106.806, 7), depok: C('Depok', -6.4025, 106.7942, 7),
          tangerang: C('Tangerang', -6.1783, 106.6319, 7), bekasi: C('Bekasi', -6.2383, 106.9756, 7), surakarta: C('Surakarta (Solo)', -7.5755, 110.8243, 7), cirebon: C('Cirebon', -6.732, 108.5523, 7), tasikmalaya: C('Tasikmalaya', -7.3274, 108.2207, 7),
          serang: C('Serang', -6.1201, 106.1503, 7), jambi: C('Jambi', -1.6101, 103.6131, 7), bengkulu: C('Bengkulu', -3.8004, 102.2655, 7), bandaaceh: C('Banda Aceh', 5.5483, 95.3238, 7), mataram: C('Mataram', -8.5833, 116.1167, 8),
          kupang: C('Kupang', -10.1772, 123.607, 8), ambon: C('Ambon', -3.6954, 128.1814, 9), jayapura: C('Jayapura', -2.5337, 140.7181, 9), palu: C('Palu', -0.9003, 119.878, 8), kendari: C('Kendari', -3.9985, 122.513, 8),
          samarinda: C('Samarinda', -0.5022, 117.1536, 8), pangkalpinang: C('Pangkalpinang', -2.1316, 106.1169, 7), tanjungpinang: C('Tanjungpinang', 0.9186, 104.4666, 7), gorontalo: C('Gorontalo', 0.5435, 123.0568, 8), ternate: C('Ternate', 0.7833, 127.3667, 9),
          sorong: C('Sorong', -0.8762, 131.2558, 9), merauke: C('Merauke', -8.4932, 140.4018, 9), palangkaraya: C('Palangkaraya', -2.2161, 113.9135, 7), jember: C('Jember', -8.1845, 113.6681, 7), kediri: C('Kediri', -7.848, 112.0178, 7),
          purwokerto: C('Purwokerto', -7.4242, 109.2393, 7), tegal: C('Tegal', -6.8694, 109.1402, 7), sukabumi: C('Sukabumi', -6.9277, 106.93, 7), cilegon: C('Cilegon', -6.0025, 106.0111, 7), tarakan: C('Tarakan', 3.3, 117.6333, 8),
          bukittinggi: C('Bukittinggi', -0.3055, 100.3692, 7), pematangsiantar: C('Pematangsiantar', 2.9595, 99.0687, 7), lhokseumawe: C('Lhokseumawe', 5.1801, 97.1507, 7), kudus: C('Kudus', -6.8048, 110.8405, 7), madiun: C('Madiun', -7.6298, 111.5239, 7) }
        const CITY_ALIAS = { solo: 'surakarta', jogja: 'yogyakarta', jogjakarta: 'yogyakarta', yogya: 'yogyakarta', lampung: 'bandarlampung', bdl: 'bandarlampung', banda: 'bandaaceh', aceh: 'bandaaceh', jkt: 'jakarta', sby: 'surabaya', bali: 'denpasar', ujungpandang: 'makassar' }
        function findCity(q) {
          let k = String(q || '').toLowerCase().replace(/^(kota|kab\.?|kabupaten)\s+/, '').replace(/[^a-z]/g, ''); if (!k) return null
          k = CITY_ALIAS[k] || k; if (CITIES[k]) return { key: k, ...CITIES[k] }
          const m = Object.keys(CITIES).find(x => x.startsWith(k) || (k.length >= 4 && x.includes(k))); return m ? { key: m, ...CITIES[m] } : null
        }

        // ── Jadwal salat (algoritma astronomi; metode Kemenag RI: Subuh 20°, Isya 18°, ihtiyath +2 menit) ──
        const R = Math.PI / 180, dsin = d => Math.sin(d * R), dcos = d => Math.cos(d * R), dtan = d => Math.tan(d * R)
        const darcsin = x => Math.asin(x) / R, darccos = x => Math.acos(Math.max(-1, Math.min(1, x))) / R, darctan2 = (y, x) => Math.atan2(y, x) / R, darccot = x => Math.atan(1 / x) / R
        const fixA = a => a - 360 * Math.floor(a / 360), fixH = a => a - 24 * Math.floor(a / 24)
        function julian(y, m, d) { if (m <= 2) { y -= 1; m += 12 } const A = Math.floor(y / 100), B = 2 - A + Math.floor(A / 4); return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + d + B - 1524.5 }
        function sunPos(jd) { const D = jd - 2451545.0, g = fixA(357.529 + 0.98560028 * D), q = fixA(280.459 + 0.98564736 * D), L = fixA(q + 1.915 * dsin(g) + 0.02 * dsin(2 * g)), e = 23.439 - 0.00000036 * D, RA = darctan2(dcos(e) * dsin(L), dcos(L)) / 15; return { decl: darcsin(dsin(e) * dsin(L)), eqt: q / 15 - fixH(RA) } }
        function prayerTimes(o, lat, lng, tz) {
          const jd = julian(o.y, o.m, o.d) - lng / (15 * 24), mid = (t) => fixH(12 - sunPos(jd + t).eqt)
          const ang = (angle, t, ccw) => { const decl = sunPos(jd + t).decl, v = darccos((-dsin(angle) - dsin(decl) * dsin(lat)) / (dcos(decl) * dcos(lat))) / 15; return mid(t) + (ccw ? -v : v) }
          const asr = (f, t) => { const decl = sunPos(jd + t).decl; return ang(-darccot(f + dtan(Math.abs(lat - decl))), t) }
          let T = { fajr: 5, sunrise: 6, dhuhr: 12, asr: 13, sunset: 18, isha: 18 }
          for (let i = 0; i < 2; i++) { const t = Object.fromEntries(Object.entries(T).map(([k, v]) => [k, v / 24])); T = { fajr: ang(20, t.fajr, true), sunrise: ang(0.833, t.sunrise, true), dhuhr: mid(t.dhuhr), asr: asr(1, t.asr), sunset: ang(0.833, t.sunset), isha: ang(18, t.isha) } }
          const adj = tz - lng / 15, IH = 2 / 60, out = {}
          out.imsak = T.fajr + adj + IH - 10 / 60; out.subuh = T.fajr + adj + IH; out.terbit = T.sunrise + adj - IH; out.dhuha = T.sunrise + adj + 20 / 60
          out.dzuhur = T.dhuhr + adj + IH; out.ashar = T.asr + adj + IH; out.maghrib = T.sunset + adj + IH; out.isya = T.isha + adj + IH
          return out
        }
        const hm = (h) => { h = fixH(h + 0.5 / 60); return `${pad(Math.floor(h))}:${pad(Math.floor((h % 1) * 60))}` }
        function qibla(lat, lng) {
          const k = [21.4225, 39.8262], dl = (k[1] - lng) * R, b = fixA(darctan2(Math.sin(dl) * dcos(k[0]), dcos(lat) * dsin(k[0]) - dsin(lat) * dcos(k[0]) * Math.cos(dl)))
          const dirs = ['Utara', 'Timur Laut', 'Timur', 'Tenggara', 'Selatan', 'Barat Daya', 'Barat', 'Barat Laut'], p1 = lat * R, p2 = k[0] * R
          const a = Math.sin((p2 - p1) / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2
          return { deg: b, dir: dirs[Math.round(b / 45) % 8], km: Math.round(6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))) }
        }
        // zona waktu IANA -> offset jam (untuk kota hasil pencarian internet)
        const tzHours = (tz, date) => offsetMs(tz, date || new Date()) / 3600000

        const QUOTES = ['Mulailah dari yang kecil, tapi mulailah hari ini.', 'Konsisten mengalahkan motivasi yang naik-turun.', 'Istirahat bukan tanda menyerah, itu bagian dari perjalanan.', 'Hari yang buruk tidak berarti hidup yang buruk.',
          'Fokus pada progres, bukan kesempurnaan.', 'Kerjakan yang bisa kamu kendalikan, lepaskan sisanya.', 'Satu langkah kecil hari ini lebih baik dari seribu rencana.', 'Bersyukur membuat yang cukup terasa lebih dari cukup.',
          'Tidak ada kata terlambat untuk belajar hal baru.', 'Orang sabar dan tekun selalu menemukan jalannya.', 'Jaga kesehatanmu, dia investasi paling berharga.', 'Kebaikan kecil yang konsisten mengubah banyak hal.',
          'Berani salah adalah syarat untuk jadi benar.', 'Air yang tenang pun bisa menghanyutkan, tetaplah rendah hati dan kuat.', 'Percayalah pada prosesmu sendiri.', 'Hari ini adalah halaman baru, tulislah dengan baik.',
          'Waktu tidak bisa dibeli, gunakan dengan bijak.', 'Jangan bandingkan bab awalmu dengan bab tengah orang lain.', 'Senyummu bisa jadi alasan orang lain bertahan hari ini.', 'Disiplin adalah bentuk cinta pada diri di masa depan.',
          'Belajar dari kemarin, hidup untuk hari ini, berharap untuk esok.', 'Lelah itu wajar, menyerah itu pilihan.', 'Mulai dengan alasan, bertahan dengan kebiasaan.', 'Teman baik membuat beban terasa ringan.', 'Rezeki datang pada yang berusaha dan berdoa.',
          'Jangan tunda: hari ini akan jadi "kemarin" besok.', 'Mimpi besar butuh jadwal kecil yang rutin.', 'Sedikit demi sedikit, lama-lama menjadi bukit.', 'Tenangkan pikiran, jawabannya sering muncul saat hening.', 'Hargai prosesnya, nikmati perjalanannya.']
        const quoteOf = (o) => QUOTES[dayNum(o.y, o.m, o.d) % QUOTES.length]
        const greet = (hh) => hh < 4 ? 'Selamat dini hari' : hh < 11 ? 'Selamat pagi' : hh < 15 ? 'Selamat siang' : hh < 18 ? 'Selamat sore' : 'Selamat malam'
        const dur = (min) => { min = Math.max(0, Math.round(min)); const d = Math.floor(min / 1440), h = Math.floor((min % 1440) / 60), m = min % 60; return [d && d + 'h', h && h + 'j', (m || (!d && !h)) && m + 'm'].filter(Boolean).join(' ') }

        module.exports = { tzOf, DAYS, MONTHS, pad, parts, now, offsetMs, zonedToUtc, dayNum, diffDays, addDays, dowOf, fmtDate, iso, isLeap, dayOfYear, isoWeek, parseDate, takeDate,
          hijri, weton, pasaranOf, PASARAN_SIFAT, NEPTU_ARTI, zodiak, shio, HOLIDAYS, HOL_LAST, holidayOn, isWorkday, nextHolidays, CITIES, findCity, prayerTimes, hm, qibla, tzHours, quoteOf, greet, dur }
    },
    "geo": (module, exports, require) => {
        // Pencarian kota: database lokal dulu, lalu Open-Meteo geocoding (gratis, tanpa key)
        const axios = require('axios'), D = require('./daily')
        const cache = new Map()
        async function geocode(q) {
          const key = String(q).toLowerCase().trim(); if (cache.has(key)) return cache.get(key)
          const r = await axios.get('https://geocoding-api.open-meteo.com/v1/search', { params: { name: q, count: 1, language: 'id', format: 'json' }, timeout: 10000 })
          const x = r.data && r.data.results && r.data.results[0]; if (!x) return null
          const out = { name: [x.name, x.admin1, x.country].filter((v, i, a) => v && a.indexOf(v) === i).slice(0, 2).join(', '), lat: x.latitude, lng: x.longitude, tzName: x.timezone, tz: D.tzHours(x.timezone || D.tzOf()) }
          cache.set(key, out); return out
        }
        // -> { name, lat, lng, tz (jam dari UTC) } atau null
        async function resolve(q) {
          const c = D.findCity(q); if (c) return { name: c.name, lat: c.lat, lng: c.lng, tz: c.tz, local: true }
          try { return await geocode(q) } catch (e) { console.log('[geo]', e.message); return null }
        }
        // waktu setempat pada offset jam tertentu
        const nowAt = (tzHours) => D.parts(new Date(Date.now() + tzHours * 3600000), 'UTC')
        module.exports = { resolve, geocode, nowAt }
    },
    "ekstra": (module, exports, require) => {
        // Pembantu fitur Ekstra: skor game global, acak, normalisasi teks, jam WIB
        const K = require('./praktis')
        const rnd = (a) => a[Math.floor(Math.random() * a.length)]
        const shuffle = (a) => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]] } return b }
        const norm = (s) => String(s || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]/g, '')
        const hourWIB = () => Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jakarta', hour: '2-digit', hour12: false }).format(new Date())) % 24
        const timeWIB = (t = Date.now()) => new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(t)).replace('.', ':')

        // skor game dipakai bersama (anagram, kuis, mathrush, sambungkata) -> .topgame
        function addScore(jid, name, pts, game) {
          const g = K.get(jid, 'game', { pts: 0, win: 0, by: {} })
          g.pts += pts; g.win += 1; g.name = name || g.name || String(jid).split('@')[0]; g.by = g.by || {}; g.by[game] = (g.by[game] || 0) + 1
          K.set(jid, 'game', g); return g
        }
        const top = (n = 10) => Object.entries(K.all()).filter(([, v]) => v && v.game && v.game.pts > 0).map(([jid, v]) => ({ jid, ...v.game })).sort((a, b) => b.pts - a.pts).slice(0, n)
        const medal = (i) => ['𝐈', '𝐈𝐈', '𝐈𝐈𝐈'][i] || `${i + 1}.`
        const num = (s) => { const n = parseFloat(String(s).replace(',', '.')); return Number.isFinite(n) ? n : NaN }
        const isAdmin = (c) => c.isAdmins || c.isCreator || c.m.key.fromMe
        module.exports = { rnd, shuffle, norm, hourWIB, timeWIB, addScore, top, medal, num, isAdmin }
    },

    // ───────── live cards: port lib Kaguya (htmlcard, cards/*, livenet/*, musik, igstalk) ─────────
    "htmlcard": (module, exports, require) => {
// Pengirim kartu HTML (rich response) untuk Kaguya.
// Kartu statis: semua data ditanam di HTML, tanpa fetch (sandbox WA memblokir jaringan).
const DEFAULT_BOT_JID = "867051314767696@bot"
const KAPABILITAS = [34, 58, 29, 1, 67, 60, 55, 8]
const hex = (n) => Array.from({ length: n }, () => Math.floor(Math.random() * 16).toString(16)).join("")
const randomResponseId = () => `${hex(8)}-${hex(4)}-4${hex(3)}-a${hex(3)}-${hex(12)}`

function buildRichHtmlPayload(html, title = "Card", opts = {}) {
  // opts.quoted = objek pesan (m) yang mau di-reply: kutipannya tampil di dalam kartu, seperti balasan biasa
  const q = require('./dquote').quoteOf(opts.quoted), qCtx = q && q.message ? { stanzaId: q.key.id, participant: q.key.participant || q.sender, remoteJid: q.chat, quotedMessage: q.message } : {}
  return {
    messageContextInfo: { deviceListMetadata: {}, deviceListMetadataVersion: 2, botMetadata: { capabilityMetadata: { capabilities: KAPABILITAS } } },
    botForwardedMessage: { message: { richResponseMessage: {
      messageType: 1,
      submessages: [{ messageType: 2, messageText: title }],
      unifiedResponse: { data: Buffer.from(JSON.stringify({
        response_id: randomResponseId(),
        sections: [{ view_model: { primitive: { __typename: "GenAIaeacdsnwHtmlPrimitive", payload: html, trusted_sources: [] }, __typename: "GenAISingleLayoutViewModel" } }],
      })).toString("base64") },
      contextInfo: { forwardingScore: 1, isForwarded: true, forwardedAiBotMessageInfo: { botJid: DEFAULT_BOT_JID }, forwardOrigin: 4, ...qCtx },
    } } },
  }
}

async function sendHtmlCard(sock, m, html, title, emoji = "✨", opts = {}) {
  try {
    await sock.relayMessage(m.chat, buildRichHtmlPayload(html, title, opts), {})
    try { await sock.sendMessage(m.chat, { react: { text: emoji, key: m.key } }) } catch {}
    return true
  } catch (err) {
    console.error(`[HTMLCARD:${title}] gagal kirim:`, err.message)
    await sock.sendMessage(m.chat, { text: "❌ Kartu gagal dikirim. Fitur ini butuh WhatsApp versi terbaru." }, { quoted: m })
    return false
  }
}

const safeJson = (obj) => JSON.stringify(obj).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026").replace(/\u2028|\u2029/g, "")
const escapeHtml = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]))

const BASE_CSS = String.raw`
:root{--bg:#0f1115;--card:#181b22;--card2:#20242d;--ink:#fff;--soft:#a3aab8;--line:#2b303b;--acc:#22c55e;--acc2:#16a34a;--warn:#f59e0b;--red:#ef4444;--blue:#3b82f6;--sys:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;}
*{margin:0;padding:0;box-sizing:border-box;-webkit-tap-highlight-color:transparent;}
html,body{background:transparent;color:var(--ink);font-family:var(--sys);min-height:100vh;overflow-x:hidden;-webkit-font-smoothing:antialiased;}
.stage{min-height:100vh;display:flex;align-items:flex-start;justify-content:center;padding:14px 10px;}
.app{width:100%;max-width:380px;border-radius:16px;overflow:hidden;position:relative;background:linear-gradient(180deg,#232733 0%,#171a21 30%,var(--bg) 70%);box-shadow:0 18px 40px rgba(0,0,0,.55);padding:14px 12px 16px;}
.top{display:flex;align-items:center;gap:9px;margin-bottom:12px;}
.logo{width:30px;height:30px;border-radius:9px;background:var(--acc);flex:none;display:flex;align-items:center;justify-content:center;font-size:16px;}
.meta{min-width:0;flex:1;}
.title{font-size:14px;font-weight:800;}
.sub{font-size:10.5px;color:var(--soft);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:2px;}
.chips{display:flex;gap:6px;overflow-x:auto;padding-bottom:8px;margin-bottom:8px;scrollbar-width:none;}
.chips::-webkit-scrollbar{display:none;}
.chip{flex:none;border:1px solid var(--line);background:var(--card);color:var(--soft);border-radius:20px;padding:6px 12px;font-size:12px;font-weight:700;cursor:pointer;}
.chip.on{background:var(--acc);border-color:var(--acc);color:#04130a;}
.btn{border:0;border-radius:10px;padding:10px 12px;font-size:13px;font-weight:800;cursor:pointer;background:var(--acc);color:#04130a;}
.btn.alt{background:var(--card2);color:var(--ink);border:1px solid var(--line);}
.btn.red{background:var(--red);color:#fff;}
.inp{width:100%;background:var(--card);border:1px solid var(--line);border-radius:10px;padding:10px 12px;color:var(--ink);font-size:14px;outline:none;font-family:var(--sys);}
.inp:focus{border-color:var(--acc);}
.box{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:10px 12px;}
.row{display:flex;gap:8px;align-items:center;}
.muted{color:var(--soft);font-size:11px;}
.hide{display:none!important;}
`;

module.exports = { buildRichHtmlPayload, sendHtmlCard, safeJson, escapeHtml, BASE_CSS }
    },
    "dquote": (module, exports, require) => {
// kutipan untuk kartu HTML: pakai pesan user apa adanya (header palsu bisnis tidak dipakai)
const quoteOf = (q) => { try { return q && q.key && q.message && q.chat ? q : null } catch { return null } }
module.exports = { quoteOf, apply: (o) => o, enabled: () => false }
    },
    "musik": (module, exports, require) => {
// Mesin Kaguya MUSIK: daftar lagu dari folder Google Drive, gambar thumbnail (di-embed base64), dan unduh lagu.
// Folder Drive HARUS dibagikan "Siapa saja yang memiliki link" (Anyone with the link).
const fs = require('fs')
const path = require('path')
const axios = require('axios')

const FOLDER_ID = '124tvFzGBgAmcZ0KxVyl2-T_2As3WRQ4X'
const IMG = {
  thumb: 'https://i.ibb.co.com/k6rtzVL9/Proyek-Baru-65-F00-DEE2.png', // thumbnail musik + thumbnail fitur
  bg: 'https://i.ibb.co.com/whrprzJQ/Proyek-Baru-66-F2-FA53-D.png',   // background kartu
}
const UA = 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36'
const DB = path.join(process.cwd(), 'database', 'musik.json')      // { tracks:[...cache scan], manual:[...tambahan owner] }
const MEDIA = path.join(process.cwd(), 'tmp', 'musik-media')
const TTL = 10 * 60 * 1000
const AUDIO_EXT = /\.(mp3|m4a|wav|ogg|opus|aac|flac|wma)$/i

const readDb = () => { try { return JSON.parse(fs.readFileSync(DB, 'utf8')) } catch { return { tracks: [], manual: [] } } }
const writeDb = (d) => { try { fs.mkdirSync(path.dirname(DB), { recursive: true }); fs.writeFileSync(DB, JSON.stringify(d, null, 2)) } catch (e) { console.log('[musik] gagal simpan db:', e.message) } }

const decode = (s) => String(s || '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&#x27;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n)).trim()

// buang watermark situs unduhan & sampah penamaan: "spotdown.org", "(Official Video)", "[320kbps]", dst.
const JUNK = [
  /\b[\w-]+\.(?:org|com|net|co|id|io|me|cc|xyz|app|to|ru)\b/gi,            // spotdown.org, y2mate.com, dst.
  /[\(\[\{]\s*(?:official|lyrics?|lirik|video|audio|music|mv|hd|hq|4k|remix video|visuali[sz]er|download|free)[^\)\]\}]*[\)\]\}]/gi,
  /[\(\[]\s*\d{2,3}\s*kbps\s*[\)\]]/gi,
  /\b(?:official\s+(?:music\s+)?(?:video|audio)|lyric\s+video|free\s+download|full\s+song)\b/gi,
]
const cleanName = (x) => {
  let t = String(x || '')
  for (const re of JUNK) t = t.replace(re, ' ')
  return t.replace(/[_]+/g, ' ').replace(/\s*[-–—|•·]\s*$/g, '').replace(/^\s*[-–—|•·]\s*/g, '').replace(/\s{2,}/g, ' ').trim()
}
// "Artis - Judul.mp3" -> { title, artist }
function parseName(file) {
  const base = cleanName(decode(file).replace(AUDIO_EXT, '')) || 'Tanpa judul'
  const i = base.indexOf(' - ')
  if (i > 0) return { artist: base.slice(0, i).trim(), title: base.slice(i + 3).trim() || base }
  return { artist: (global.namebot || 'Kaguya') + ' Musik', title: base || 'Tanpa judul' }
}
const mk = (id, file) => ({ id, file: decode(file), ...parseName(file) })

// id Drive dari tautan/ID mentah
function driveId(s) {
  const t = String(s || '')
  return (t.match(/\/d\/([\w-]{15,})/) || t.match(/[?&]id=([\w-]{15,})/) || t.match(/^([\w-]{25,})$/) || [])[1] || null
}

// scan folder publik Drive tanpa API key
async function scanFolder() {
  const r = await axios.get(`https://drive.google.com/embeddedfolderview?id=${FOLDER_ID}`, { timeout: 30000, headers: { 'User-Agent': UA, 'Accept-Language': 'id,en;q=0.8' } })
  const html = String(r.data || ''), out = [], seen = new Set()
  const re = /<div class="flip-entry"[^>]*id="entry-([\w-]+)"[\s\S]*?<div class="flip-entry-title">([^<]*)<\/div>/g
  let x
  while ((x = re.exec(html))) { if (!seen.has(x[1])) { seen.add(x[1]); out.push(mk(x[1], x[2])) } }
  if (!out.length) { // cadangan: pola lain
    const re2 = /\/file\/d\/([\w-]{15,})\/view[^>]*>[\s\S]{0,400}?<div[^>]*class="[^"]*title[^"]*"[^>]*>([^<]+)</g
    while ((x = re2.exec(html))) { if (!seen.has(x[1])) { seen.add(x[1]); out.push(mk(x[1], x[2])) } }
  }
  if (!out.length) { // cadangan 2: halaman folder biasa (data file ada di JSON tertanam)
    try {
      const r2 = await axios.get(`https://drive.google.com/drive/folders/${FOLDER_ID}?hl=id`, { timeout: 30000, headers: { 'User-Agent': UA, 'Accept-Language': 'id,en;q=0.8' } })
      const h2 = String(r2.data || '').replace(/\\x22/g, '"').replace(/\\\//g, '/')
      const re3 = /\["([\w-]{25,})",\["[\w-]+"\],"([^"]+?)","(?:audio\/[^"]*|application\/octet-stream)"/g
      while ((x = re3.exec(h2))) { if (!seen.has(x[1])) { seen.add(x[1]); out.push(mk(x[1], x[2].replace(/\\u([0-9a-f]{4})/gi, (_, h) => String.fromCharCode(parseInt(h, 16))))) } }
    } catch (e) { console.log('[musik] scan cadangan gagal:', e.message) }
  }
  return out.filter(t => AUDIO_EXT.test(t.file) || !/\.[a-z0-9]{2,4}$/i.test(t.file)).sort((a, b) => a.file.localeCompare(b.file, 'id', { numeric: true }))
}

let memo = { at: 0, list: null }
async function getTracks(force) {
  if (!force && memo.list && Date.now() - memo.at < TTL) return memo.list
  const db = readDb()
  let scanned = db.tracks || []
  try { const s = await scanFolder(); if (s.length) { scanned = s; db.tracks = s; writeDb(db) } else console.log('[musik] scan folder kosong (pastikan folder publik)') }
  catch (e) { console.log('[musik] scan gagal, pakai cache:', e.message) }
  const ids = new Set(scanned.map(t => t.id))
  const list = scanned.concat((db.manual || []).filter(t => !ids.has(t.id)))
  memo = { at: Date.now(), list }
  return list
}

function addManual(link, nameRaw) {
  const id = driveId(link); if (!id) return null
  const db = readDb(); db.manual = db.manual || []
  const t = mk(id, nameRaw || 'Tanpa judul')
  db.manual = db.manual.filter(x => x.id !== id).concat(t); writeDb(db); memo.at = 0
  return t
}
function removeManual(id) { const db = readDb(), n = (db.manual || []).length; db.manual = (db.manual || []).filter(x => x.id !== id); writeDb(db); memo.at = 0; return n !== db.manual.length }

// cari lagu: nomor (1-based) atau potongan judul/artis
function find(list, q) {
  const s = String(q || '').trim().toLowerCase(); if (!s) return null
  if (/^\d+$/.test(s)) return list[+s - 1] || null
  return list.find(t => `${t.artist} ${t.title}`.toLowerCase().includes(s)) || null
}

// ── gambar: unduh sekali, kecilkan, simpan ke lib/media, lalu embed sebagai data URI (kartu WA tanpa jaringan) ──
// Anti gagal: coba beberapa host (i.ibb.co.com <-> i.ibb.co), lalu cadangan file lokal (lib/media/thumb.jpg),
// dan kalau tetap gagal jangan mencoba lagi selama 5 menit supaya perintah tidak menunggu timeout berulang.
const imgCache = {}, imgFail = {}
const IMG_RETRY = 5 * 60 * 1000
const urlVariants = (u) => {
  const out = [u]
  if (/\/\/i\.ibb\.co\.com\//.test(u)) out.push(u.replace('//i.ibb.co.com/', '//i.ibb.co/'))
  else if (/\/\/i\.ibb\.co\//.test(u)) out.push(u.replace('//i.ibb.co/', '//i.ibb.co.com/'))
  return out
}
async function fetchImage(url) {
  let last
  for (const u of urlVariants(url)) {
    try { return Buffer.from((await axios.get(u, { responseType: 'arraybuffer', timeout: 15000, headers: { 'User-Agent': UA } })).data) }
    catch (e) { last = e }
  }
  throw last
}
async function getImage(kind) {
  if (imgCache[kind]) return imgCache[kind]
  if (imgFail[kind] && Date.now() - imgFail[kind] < IMG_RETRY) return null
  let sharp; try { sharp = require('sharp') } catch (e) { console.log('[musik] sharp tidak tersedia:', e.message); imgFail[kind] = Date.now(); return null }
  const px = kind === 'thumb' ? 128 : 420
  const shrink = (b) => sharp(b).resize(px, px, { fit: kind === 'thumb' ? 'cover' : 'inside', withoutEnlargement: true }).jpeg({ quality: kind === 'thumb' ? 72 : 55 }).toBuffer()
  const file = path.join(MEDIA, `musik_${kind}.jpg`)
  let buf = null
  try { buf = fs.readFileSync(file) } catch {}
  if (!buf) {
    try {
      buf = await shrink(await fetchImage(IMG[kind]))
      fs.mkdirSync(MEDIA, { recursive: true }); fs.writeFileSync(file, buf)
    } catch (e) {
      console.log(`[musik] gambar ${kind} gagal: ${e.message}`)
      // cadangan lokal: thumb -> lib/media/thumb.jpg (bg tidak punya cadangan, kartu memakai gradasi bawaan)
      if (kind === 'thumb') { try { buf = await shrink(fs.readFileSync(path.join(MEDIA, 'thumb.jpg'))) } catch {} }
      if (!buf) { imgFail[kind] = Date.now(); return null }
    }
  }
  return (imgCache[kind] = { buf, uri: 'data:image/jpeg;base64,' + buf.toString('base64') })
}

// ── unduh lagu dari Drive ke file ──
// Drive kadang membalas halaman HTML "tidak bisa scan virus" untuk file besar: formnya berisi uuid/confirm yang harus dikirim ulang.
function confirmUrl(html, id) {
  const form = String(html).match(/<form[^>]+action="([^"]+)"[^>]*>([\s\S]*?)<\/form>/i)
  if (form) {
    const q = new URLSearchParams()
    for (const m of form[2].matchAll(/<input[^>]+name="([^"]+)"[^>]*value="([^"]*)"/gi)) q.set(m[1], decode(m[2]))
    if (q.has('id')) return decode(form[1]) + '?' + q.toString()
  }
  const uuid = (String(html).match(/uuid=([\w-]+)/) || [])[1]
  return uuid ? `https://drive.usercontent.google.com/download?id=${id}&export=download&confirm=t&uuid=${uuid}` : null
}
async function openStream(u) {
  return axios.get(u, { responseType: 'stream', timeout: 120000, maxRedirects: 8, headers: { 'User-Agent': UA }, validateStatus: s => s < 500 })
}
async function download(id, dir, nameHint) {
  const urls = [`https://drive.usercontent.google.com/download?id=${id}&export=download&confirm=t`, `https://drive.google.com/uc?export=download&confirm=t&id=${id}`]
  let last
  for (const u0 of urls) {
    try {
      let res = await openStream(u0)
      let type = String(res.headers['content-type'] || '')
      if (/text\/html/i.test(type)) {   // coba lewati halaman konfirmasi sekali
        const html = await new Promise((ok, no) => { let b = ''; res.data.on('data', c => { b += c; if (b.length > 300000) res.data.destroy() }); res.data.on('end', () => ok(b)); res.data.on('close', () => ok(b)); res.data.on('error', no) })
        const next = confirmUrl(html, id)
        if (!next) throw new Error('Drive menolak (file belum publik atau kuota unduh habis)')
        res = await openStream(next); type = String(res.headers['content-type'] || '')
        if (/text\/html/i.test(type)) { res.data.destroy(); throw new Error('Drive menolak (file belum publik atau kuota unduh habis)') }
      }
      if (res.status >= 400) { res.data.destroy(); throw new Error('Drive membalas ' + res.status) }
      const cd = String(res.headers['content-disposition'] || '')
      let ext = (cd.match(/filename\*?=(?:UTF-8'')?"?([^";]+)/i) || [])[1]; ext = ext ? path.extname(decodeURIComponent(ext)) : ''
      if (!ext) ext = /mpeg|mp3/.test(type) ? '.mp3' : /mp4|m4a|aac/.test(type) ? '.m4a' : /ogg/.test(type) ? '.ogg' : /wav/.test(type) ? '.wav' : '.mp3'
      const safe = String(nameHint || id).replace(/[\\/:*?"<>|]+/g, ' ').slice(0, 80).trim() || id
      const dest = path.join(dir, safe + ext.toLowerCase())
      let got = 0
      await new Promise((ok, no) => {
        const w = fs.createWriteStream(dest)
        res.data.on('data', c => { got += c.length; if (got > 60 * 1048576) res.data.destroy(new Error('file lebih dari 60 MB')) })
        res.data.on('error', no); w.on('error', no); w.on('finish', ok); res.data.pipe(w)
      })
      if (got < 2048) throw new Error('berkas kosong')
      return dest
    } catch (e) { last = e }
  }
  throw last || new Error('gagal mengunduh dari Drive')
}

// ── audio untuk diputar LANGSUNG di dalam kartu: ubah ke mp3 mono kecil lalu embed sebagai data URI ──
// Kartu WA tidak punya akses jaringan, jadi lagu harus ditanam di HTML. Total ukuran dibatasi (BUDGET) agar pesan tetap terkirim.
const { execFile } = require('child_process')
const AUDIO_DIR = path.join(MEDIA, 'musik')
const BUDGET = Math.max(300, Number(process.env.MUSIK_BUDGET_KB) || 420) * 1024   // total audio per kartu (byte, sebelum base64)
const KBPS = Math.max(16, Number(process.env.MUSIK_KBPS) || 24)                      // bitrate mp3 mono
const CLIP = Math.max(8, Number(process.env.MUSIK_CLIP_SEC) || 20)                   // lama preview per lagu (detik); diambil dari bagian tengah lagu
const ffmpeg = () => { return ffmpegBin }
const safeId = (id) => String(id).replace(/[^\w-]/g, '')
const cachePath = (id) => path.join(AUDIO_DIR, 'v2_' + safeId(id) + '.mp3')   // v2 = klip preview (cache lama lagu penuh diabaikan)
const inflight = new Map()

const run = (bin, a, o) => new Promise((ok, no) => execFile(bin, a, { timeout: 240000, maxBuffer: 8 * 1048576, ...o }, (e, out, err) => e ? no(e) : ok(String(err || '') + String(out || ''))))
// durasi (detik) dari keluaran ffmpeg -i; 0 bila gagal
async function probe(src) {
  let out = ''; try { out = await run(ffmpeg(), ['-i', src]) } catch (e) { out = String(e.stderr || e.message || '') }
  const m = out.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/)
  return m ? +m[1] * 3600 + +m[2] * 60 + +m[3] : 0
}
async function encode(src, dest) {
  const dur = await probe(src)
  const ss = dur > CLIP * 2 ? Math.max(0, Math.floor(dur * 0.35)) : 0   // lewati intro: mulai di ±35% lagu
  const args = ['-y', ...(ss ? ['-ss', String(ss)] : []), '-i', src, '-t', String(CLIP), '-vn', '-map_metadata', '-1', '-ac', '1', '-ar', '24000', '-af', 'afade=t=in:d=0.4,afade=t=out:st=' + Math.max(0, CLIP - 1.2) + ':d=1.2', '-c:a', 'libmp3lame', '-b:a', KBPS + 'k', dest]
  await run(ffmpeg(), args)
  try { fs.writeFileSync(dest + '.json', JSON.stringify({ dur: Math.round(dur) })) } catch {}
  return dest
}
const durOf = (id) => { try { return JSON.parse(fs.readFileSync(cachePath(id) + '.json', 'utf8')).dur || 0 } catch { return 0 } }
// ambil mp3 kecil (dari cache, atau unduh dari Drive lalu ubah). Mengembalikan Buffer.
function ensureAudio(t) {
  const f = cachePath(t.id)
  if (fs.existsSync(f) && fs.statSync(f).size > 2048) return Promise.resolve(fs.readFileSync(f))
  if (inflight.has(t.id)) return inflight.get(t.id)
  const job = (async () => {
    const tmp = fs.mkdtempSync(path.join(require('os').tmpdir(), 'dmusik-'))
    try {
      fs.mkdirSync(AUDIO_DIR, { recursive: true })
      const raw = await download(t.id, tmp, 'src')
      await encode(raw, f)
      return fs.readFileSync(f)
    } finally { try { fs.rmSync(tmp, { recursive: true, force: true }) } catch {} inflight.delete(t.id) }
  })()
  inflight.set(t.id, job); return job
}
// mp3 kualitas bagus (128k stereo) untuk DIKIRIM sebagai pesan audio WhatsApp asli. Mengembalikan path file.
const HQ_DIR = path.join(AUDIO_DIR, 'hq')
const hqJobs = new Map()
function ensureHq(t) {
  const f = path.join(HQ_DIR, safeId(t.id) + '.mp3')
  if (fs.existsSync(f) && fs.statSync(f).size > 4096) return Promise.resolve(f)
  if (hqJobs.has(t.id)) return hqJobs.get(t.id)
  const job = (async () => {
    const tmp = fs.mkdtempSync(path.join(require('os').tmpdir(), 'dmusikhq-'))
    try {
      fs.mkdirSync(HQ_DIR, { recursive: true })
      const raw = await download(t.id, tmp, 'src')
      await new Promise((ok, no) => execFile(ffmpeg(), ['-y', '-i', raw, '-vn', '-map_metadata', '-1', '-ac', '2', '-ar', '44100', '-c:a', 'libmp3lame', '-b:a', '128k', f], { timeout: 300000 }, (e) => e ? no(e) : ok()))
      return f
    } finally { try { fs.rmSync(tmp, { recursive: true, force: true }) } catch {} hqJobs.delete(t.id) }
  })()
  hqJobs.set(t.id, job); return job
}
// susun playlist mulai dari lagu ke-start (urutan berputar) sampai anggaran ukuran habis
async function buildPlaylist(tracks, start = 0, prefer = []) {
  const n = tracks.length, base = Array.from({ length: n }, (_, i) => (start + i) % n), pf = prefer.filter(k => k >= 0 && k < n)
  const order = pf.length ? [...new Set([...pf, ...base])] : base   // lagu pilihan (mis. favorit) didahulukan
  const got = new Map(); let used = 0
  for (let i = 0; i < n && used < BUDGET; i += 3) {
    const batch = order.slice(i, i + 3)
    const res = await Promise.all(batch.map(k => ensureAudio(tracks[k]).then(b => [k, b], e => { console.log('[musik] lagu gagal:', tracks[k].title, '-', e.message); return null })))
    for (const r of res) {
      if (!r) continue
      let [k, b] = r
      const left = BUDGET - used
      if (b.length > left) { if (got.size) continue; b = b.subarray(0, left) }   // lagu pertama terlalu besar -> dipotong (preview)
      got.set(k, b.toString('base64')); used += b.length
    }
  }
  return { audio: got, bytes: used }
}
// unduh & ubah semua lagu di belakang layar supaya kartu berikutnya cepat
let warming = false
async function warm(tracks) {
  if (warming) return; warming = true
  try { for (const t of tracks) { try { await ensureAudio(t) } catch (e) { console.log('[musik] warm gagal:', t.title, e.message) } } } finally { warming = false }
}

// ── favorit per user & statistik putar ──
const SDB = path.join(process.cwd(), 'database', 'musikuser.json')   // { fav:{jid:[id]}, plays:{id:n}, last:{jid:id} }
const sRead = () => { try { return JSON.parse(fs.readFileSync(SDB, 'utf8')) } catch { return { fav: {}, plays: {}, last: {} } } }
const sWrite = (d) => { try { fs.writeFileSync(SDB, JSON.stringify(d)) } catch (e) { console.log('[musik] gagal simpan statistik:', e.message) } }
const favs = (jid) => (sRead().fav || {})[jid] || []
function toggleFav(jid, id) {
  const d = sRead(); d.fav = d.fav || {}; const a = d.fav[jid] || []
  const has = a.includes(id); d.fav[jid] = has ? a.filter(x => x !== id) : a.concat(id).slice(-100); sWrite(d); return !has
}
function countPlay(jid, id) { const d = sRead(); d.plays = d.plays || {}; d.last = d.last || {}; d.plays[id] = (d.plays[id] || 0) + 1; d.last[jid] = id; sWrite(d) }
const topPlays = (n = 10) => Object.entries(sRead().plays || {}).sort((a, b) => b[1] - a[1]).slice(0, n)
const lastPlayed = (jid) => (sRead().last || {})[jid] || null
// cari beberapa lagu sekaligus (judul/artis mengandung semua kata)
function search(list, q) {
  const w = String(q || '').toLowerCase().split(/\s+/).filter(Boolean); if (!w.length) return []
  return list.map((t, i) => ({ t, i })).filter(({ t }) => { const h = `${t.artist} ${t.title}`.toLowerCase(); return w.every(x => h.includes(x)) })
}
const fmtDur = (x) => x ? `${Math.floor(x / 60)}:${String(Math.round(x % 60)).padStart(2, '0')}` : '-'

module.exports = { search, favs, toggleFav, countPlay, topPlays, lastPlayed, durOf, fmtDur, cleanName, probe, FOLDER_ID, IMG, BUDGET, getTracks, addManual, removeManual, find, getImage, download, driveId, ensureAudio, ensureHq, buildPlaylist, warm }
    },
    "cards/musik": (module, exports, require) => {
const NB = () => String(global.namebot || 'Kaguya').replace(/[<>&'"`$\\]/g, '')
// Kartu HTML statis: Kaguya MUSIK (daftar lagu bisa di-scroll pakai tombol ▲ ▼, cari, pilih lagu).
// Semua data & gambar ditanam di HTML (data URI), tanpa fetch/jaringan. By PIX.
const { BASE_CSS, safeJson, escapeHtml } = require("../htmlcard");

const BODY = String.raw`
<style>
__BASECSS__
.app{padding:0;background:#10121a}
.bgl{position:absolute;inset:0;background-size:cover;background-position:center;opacity:.5;pointer-events:none}
.shade{position:absolute;inset:0;background:linear-gradient(180deg,rgba(10,12,18,.35) 0%,rgba(10,12,18,.82) 45%,#0b0d13 100%);pointer-events:none}
.in{position:relative;padding:14px 12px 14px}
.th{background-color:#2a2f3c;background-size:cover;background-position:center;background-image:__THUMB__}
.hd{display:flex;gap:11px;align-items:center;margin-bottom:12px}
.hd .th{width:58px;height:58px;border-radius:14px;flex:none;box-shadow:0 6px 16px rgba(0,0,0,.5);border:1px solid #ffffff22}
.hd .t1{font-size:17px;font-weight:900;letter-spacing:.3px}
.hd .t2{font-size:11px;color:var(--soft);margin-top:3px}
.pill{display:inline-block;margin-top:5px;background:#ffffff14;border:1px solid #ffffff1f;border-radius:20px;padding:2px 9px;font-size:10px;font-weight:700;color:#e8d9a8}
.selx{display:flex;gap:10px;align-items:center;background:#ffffff10;border:1px solid #ffffff1c;border-radius:14px;padding:9px;margin-bottom:10px;backdrop-filter:blur(6px)}
.nm{font-size:13px;font-weight:800;line-height:1.25;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
.ar{font-size:11px;color:var(--soft);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cmd{margin-top:5px;font-family:ui-monospace,Menlo,monospace;font-size:11px;color:#04130a;background:var(--acc);display:inline-block;border-radius:6px;padding:2px 8px;font-weight:800;cursor:pointer}
.srch{margin-bottom:8px;font-size:13px;padding:8px 12px}
.lw{display:flex;gap:8px;align-items:stretch}
.list{flex:1;min-width:0;height:276px;overflow-y:auto;scroll-behavior:smooth;scrollbar-width:none;border-radius:12px;background:#0b0d1388;border:1px solid #ffffff14}
.list::-webkit-scrollbar{display:none}
.it{display:flex;gap:10px;align-items:center;height:62px;padding:7px 9px;border-bottom:1px solid #ffffff0d;cursor:pointer}
.it.on{background:linear-gradient(90deg,#22c55e33,#22c55e08);box-shadow:inset 3px 0 0 var(--acc)}
.it .no{width:22px;flex:none;text-align:center;font-size:11px;font-weight:800;color:var(--soft)}
.it .th{width:44px;height:44px;border-radius:9px;flex:none}
.it .tx{min-width:0;flex:1}
.it .a{font-size:12.5px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.it .b{font-size:10.5px;color:var(--soft);margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.nav{width:42px;flex:none;display:flex;flex-direction:column;gap:6px;align-items:center;justify-content:space-between}
.nb{width:42px;height:42px;border-radius:12px;border:1px solid #ffffff26;background:#ffffff14;color:#fff;font-size:17px;font-weight:900;cursor:pointer;display:flex;align-items:center;justify-content:center}
.nb:active{background:var(--acc);color:#04130a}
.nb[disabled]{opacity:.28;pointer-events:none}
.pos{flex:1;width:6px;border-radius:6px;background:#ffffff18;position:relative;margin:2px 0}
.pos i{position:absolute;left:0;right:0;top:0;height:30%;background:var(--acc);border-radius:6px;transition:top .15s}
.cnt{font-size:10.5px;color:var(--soft);text-align:center;margin-top:8px}
.empty{padding:26px 14px;text-align:center;color:var(--soft);font-size:12px;line-height:1.5}
.pl{background:#ffffff10;border:1px solid #ffffff1c;border-radius:14px;padding:10px;margin-bottom:10px;backdrop-filter:blur(6px)}
.pl .top2{display:flex;gap:10px;align-items:center}
.pl .th{width:54px;height:54px;border-radius:11px;flex:none}
.pl.go .th{animation:sp 6s linear infinite;border-radius:50%}
@keyframes sp{to{transform:rotate(360deg)}}
.seek{width:100%;margin:9px 0 2px;accent-color:#22c55e;height:18px}
.tm{display:flex;justify-content:space-between;font-size:10px;color:var(--soft)}
.ctl2{display:flex;align-items:center;justify-content:center;gap:14px;margin-top:6px}
.cb{width:40px;height:40px;border-radius:50%;border:1px solid #ffffff26;background:#ffffff14;color:#fff;font-size:15px;cursor:pointer;display:flex;align-items:center;justify-content:center}
.cb.big{width:52px;height:52px;background:var(--acc);color:#04130a;font-size:20px;border-color:var(--acc)}
.cb:active{transform:scale(.92)}
.vol{display:flex;align-items:center;gap:8px;margin-top:9px;font-size:11px;color:var(--soft)}
.vol input{flex:1;accent-color:#22c55e}
.vol b{width:34px;text-align:right;color:#fff}
.eq{display:inline-flex;gap:2px;align-items:flex-end;height:11px;width:14px;flex:none}
.eq i{width:3px;background:var(--acc);border-radius:1px;animation:eq .8s ease-in-out infinite}
.eq i:nth-child(2){animation-delay:.2s}.eq i:nth-child(3){animation-delay:.4s}
@keyframes eq{0%,100%{height:3px}50%{height:11px}}
.it.lock{opacity:.5}
.it.lock .no:after{content:'🔒';font-size:9px;display:block}
.mode{display:flex;justify-content:center;gap:8px;margin-top:8px}
.mb{border:1px solid #ffffff26;background:#ffffff10;color:#cfd5e2;border-radius:16px;padding:4px 10px;font-size:11px;font-weight:800;cursor:pointer}
.mb.on{background:var(--acc);color:#04130a;border-color:var(--acc)}
.st{min-height:14px;text-align:center;font-size:10.5px;color:#e8d9a8;margin-top:6px}
.st.err{color:#fca5a5}
.it .hot{color:#f87171;font-size:11px;flex:none}
.it .dur{font-size:10px;color:var(--soft);flex:none}
.toast{position:fixed;left:50%;bottom:18px;transform:translateX(-50%);background:#000c;color:#fff;padding:8px 14px;border-radius:20px;font-size:12px;opacity:0;transition:opacity .2s;pointer-events:none}.toast.on{opacity:1}
</style>
<div class="stage"><div class="app">
 <div class="bgl" style="background-image:__BG__"></div><div class="shade"></div>
 <div class="in">
  <div class="hd"><div class="th"></div><div class="meta"><div class="t1">${NB().toUpperCase()} MUSIK</div><div class="t2" id="who"></div><span class="pill" id="tot"></span></div></div>
  <div class="pl" id="pl"><div class="top2"><div class="th"></div><div style="min-width:0;flex:1"><div class="nm" id="snm">Pilih lagu lalu tekan ▶</div><div class="ar" id="sar">Preview di kartu • lagu penuh dikirim sebagai audio</div></div></div>
   <input class="seek" id="seek" type="range" min="0" max="1000" value="0"><div class="tm"><span id="t1">0:00</span><span id="t2">0:00</span></div>
   <div class="ctl2"><button class="cb" id="pv" aria-label="Sebelumnya">⏮</button><button class="cb big" id="pp" aria-label="Putar">▶</button><button class="cb" id="nx" aria-label="Berikutnya">⏭</button></div>
   <div class="st" id="st"></div>
   <div class="mode"><button class="mb" id="shf">🔀 Acak</button><button class="mb" id="rpt">🔁 Ulang: mati</button><button class="mb" id="spd">⚡ 1x</button><button class="mb" id="onl">🎧 Preview saja</button></div>
   <div class="vol"><span>🔈</span><input id="vol" type="range" min="0" max="100" value="100"><span>🔊</span><b id="vp">100%</b></div>
   <span class="cmd hide" id="scmd"></span></div>
  <input class="inp srch" id="q" placeholder="Cari judul / artis...">
  <div class="lw">
   <div class="list" id="list"></div>
   <div class="nav"><button class="nb" id="up" aria-label="Naik">▲</button><div class="pos"><i id="bar"></i></div><button class="nb" id="dn" aria-label="Turun">▼</button></div>
  </div>
  <div class="cnt" id="cnt"></div>
  <div class="muted" style="text-align:center;margin-top:6px">Tekan lagu untuk memutar • ▲ ▼ untuk menggulir • 🔒 = ketik .musikbot &lt;no&gt; • ♥ = favoritmu • .dmp3 &lt;no&gt; kirim audio penuh</div>
 </div>
</div><div class="toast" id="toast"></div></div>
<script>var AUD=__AUD__;</script>
<script>
(function(){
var CFG=__CFG__,AUD_=AUD;
var $=function(i){return document.getElementById(i)};
$('who').textContent='Untuk: '+CFG.nama;
var nPlay=CFG.tracks.filter(function(t){return t.p}).length;
$('tot').textContent='♫ '+CFG.tracks.length+' lagu • '+nPlay+' preview di kartu';
var all=CFG.tracks.map(function(t,i){return {n:i+1,a:t.a,b:t.b,p:t.p,f:t.f,d:t.d}});
var shuffle=false,repeat=0,speeds=[1,1.25,1.5,0.75],spi=0,only=false,blobUrl=null,wd=null,q0='';
var view=all.slice(),cur=-1,loaded=-1,H=62,au=new Audio();au.preload='auto';
function esc(s){return String(s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
function fmt(x){if(!isFinite(x))return '0:00';x=Math.floor(x);return Math.floor(x/60)+':'+('0'+(x%60)).slice(-2)}
function toast(s){var t=$('toast');t.textContent=s;t.classList.add('on');setTimeout(function(){t.classList.remove('on');},2000);}
function render(){
 var L=$('list');
 if(!view.length){L.innerHTML='<div class="empty">'+(all.length?'Tidak ada lagu yang cocok.':'Belum ada lagu terbaca dari Google Drive.<br>Pastikan folder dibagikan ke "Siapa saja yang memiliki link", lalu ketik <b>.musikbot refresh</b>.')+'</div>';upd();return;}
 L.innerHTML=view.map(function(t){var on=t.n-1===cur;return '<div class="it'+(on?' on':'')+(t.p?'':' lock')+'" data-n="'+t.n+'"><div class="no">'+(on&&!au.paused?'<span class="eq"><i></i><i></i><i></i></span>':t.n)+'</div><div class="th"></div><div class="tx"><div class="a">'+esc(t.a)+'</div><div class="b">'+esc(t.b)+'</div></div>'+(t.f?'<span class="hot">♥</span>':'')+(t.d?'<span class="dur">'+esc(t.d)+'</span>':'')+'</div>';}).join('');
 upd();
}
function upd(){
 var L=$('list'),max=L.scrollHeight-L.clientHeight,p=max>0?L.scrollTop/max:0;
 $('up').disabled=L.scrollTop<=2;$('dn').disabled=max<=2||L.scrollTop>=max-2;
 var f=Math.max(1,Math.min(view.length,Math.floor(L.scrollTop/H)+1)),l=Math.min(view.length,Math.ceil((L.scrollTop+L.clientHeight)/H));
 $('cnt').textContent=view.length?('Menampilkan '+f+'–'+l+' dari '+view.length):'';
 var bar=$('bar'),h=view.length?Math.min(100,Math.max(12,L.clientHeight/(view.length*H)*100)):100;bar.style.height=h+'%';bar.style.top=(p*(100-h))+'%';
}
function step(d){var L=$('list');L.scrollTop=L.scrollTop+d*H*3;setTimeout(upd,350);}
$('up').onclick=function(){step(-1)};$('dn').onclick=function(){step(1)};
$('list').addEventListener('scroll',upd);
document.addEventListener('keydown',function(e){if(e.target&&e.target.id==='q')return;if(e.key==='ArrowDown'){e.preventDefault();step(1);}if(e.key==='ArrowUp'){e.preventDefault();step(-1);}if((e.key==='ArrowRight'||e.key==='ArrowLeft')&&au.duration){au.currentTime=Math.max(0,Math.min(au.duration,au.currentTime+(e.key==='ArrowRight'?5:-5)));}if(e.key===' '&&cur>=0){e.preventDefault();toggle();}});
function setUi(){var on=!au.paused&&!au.error;$('pp').textContent=on?'⏸':'▶';$('pl').classList.toggle('go',on);render();}
function stat(x,err){var e=$('st');e.textContent=x||'';e.classList.toggle('err',!!err);}
function srcOf(i){
 var d=AUD_[String(i)];
 try{var k=d.indexOf(','),bin=atob(d.slice(k+1)),u=new Uint8Array(bin.length);for(var j=0;j<bin.length;j++)u[j]=bin.charCodeAt(j);
  if(blobUrl)URL.revokeObjectURL(blobUrl);blobUrl=URL.createObjectURL(new Blob([u],{type:'audio/mpeg'}));return blobUrl;}catch(x){return d;}
}
function play(i,tryData){
 var t=CFG.tracks[i];if(!t)return;
 if(!t.p){var c=$('scmd');c.textContent=CFG.prefix+'musikbot '+(i+1);c.classList.remove('hide');$('snm').textContent=t.a;$('sar').textContent=t.b;stat('Lagu ini belum punya preview di kartu',1);toast('Ketik '+c.textContent+' untuk menerima lagunya sebagai audio');return;}
 $('scmd').classList.add('hide');cur=i;$('snm').textContent=t.a;$('sar').textContent=t.b;
 clearTimeout(wd);stat('Memuat preview...');
 au.src=tryData?AUD_[String(i)]:srcOf(i);loaded=i;au.volume=$('vol').value/100;au.playbackRate=speeds[spi];
 // pengawal: bila 5 detik belum ada suara, coba cara lain (data URI), lalu beri tahu pemakai dengan jelas
 wd=setTimeout(function(){if(loaded!==i)return;if(!au.duration||au.currentTime===0&&au.paused===false&&au.readyState<3){
   if(!tryData){play(i,true);return;}
   try{au.pause();}catch(x){}setUi();stat('Pemutar kartu tidak didukung di perangkat ini. Ketik '+CFG.prefix+'dmp3 '+(i+1)+' untuk menerima audionya',1);}},5000);
 var pr=au.play();if(pr&&pr.catch)pr.catch(function(){if(!tryData){play(i,true);return;}stat('Audio tidak bisa diputar. Ketik '+CFG.prefix+'dmp3 '+(i+1)+' untuk audionya',1);setUi();});
 setUi();
}
function nextIdx(d){
 var n=CFG.tracks.length,ok=[],j;for(j=0;j<n;j++)if(CFG.tracks[j].p)ok.push(j);if(!ok.length)return -1;
 if(shuffle&&ok.length>1){var r;do{r=ok[Math.floor(Math.random()*ok.length)];}while(r===cur);return r;}
 var k=cur<0?(d>0?-1:0):cur;for(j=1;j<=n;j++){var x=((k+d*j)%n+n)%n;if(CFG.tracks[x].p)return x;}return -1;
}
function toggle(){if(cur<0||loaded!==cur){var f=(cur>=0&&CFG.tracks[cur].p)?cur:nextIdx(1);if(f>=0)play(f);else toast('Belum ada lagu siap putar');return;}if(au.paused){var pr=au.play();if(pr&&pr.catch)pr.catch(function(){});}else au.pause();}
$('pp').onclick=toggle;
$('nx').onclick=function(){var x=nextIdx(1);if(x>=0)play(x);};
$('pv').onclick=function(){if(au.currentTime>4){au.currentTime=0;return;}var x=nextIdx(-1);if(x>=0)play(x);};
au.addEventListener('play',setUi);au.addEventListener('pause',setUi);au.addEventListener('playing',function(){clearTimeout(wd);stat('');setUi();});au.addEventListener('waiting',function(){stat('Memuat...');});au.addEventListener('loadedmetadata',function(){$('t2').textContent=fmt(au.duration);});
au.addEventListener('ended',function(){if(repeat===2){au.currentTime=0;au.play();return;}var x=nextIdx(1);if(repeat===0&&!shuffle&&x<=cur&&x>=0){setUi();stat('Playlist selesai');return;}if(x>=0)play(x);});
au.addEventListener('error',function(){if(loaded>=0&&au.src.indexOf('blob:')===0){play(loaded,true);return;}clearTimeout(wd);stat('Audio gagal dimuat. Ketik '+CFG.prefix+'dmp3 '+(loaded+1)+' untuk menerima audionya',1);setUi();});
var seeking=false;
au.addEventListener('timeupdate',function(){if(!seeking&&au.duration)$('seek').value=Math.round(au.currentTime/au.duration*1000);$('t1').textContent=fmt(au.currentTime);$('t2').textContent=fmt(au.duration);});
$('seek').addEventListener('input',function(){seeking=true;if(au.duration)$('t1').textContent=fmt(this.value/1000*au.duration);});
$('seek').addEventListener('change',function(){if(au.duration)au.currentTime=this.value/1000*au.duration;seeking=false;});
$('vol').addEventListener('input',function(){au.volume=this.value/100;$('vp').textContent=this.value+'%';});
function applyView(){var s=q0;view=all.filter(function(t){return (!only||t.p)&&(!s||(t.a+' '+t.b).toLowerCase().indexOf(s)>=0);});$('list').scrollTop=0;render();}
$('shf').onclick=function(){shuffle=!shuffle;this.classList.toggle('on',shuffle);toast(shuffle?'Acak: nyala':'Acak: mati');};
$('rpt').onclick=function(){repeat=(repeat+1)%3;this.textContent=['🔁 Ulang: mati','🔁 Ulang: semua','🔂 Ulang: satu'][repeat];this.classList.toggle('on',repeat>0);};
$('spd').onclick=function(){spi=(spi+1)%speeds.length;au.playbackRate=speeds[spi];this.textContent='⚡ '+speeds[spi]+'x';this.classList.toggle('on',spi>0);};
$('onl').onclick=function(){only=!only;this.classList.toggle('on',only);applyView();};
$('scmd').onclick=function(){var s=this.textContent;try{navigator.clipboard.writeText(s).then(function(){toast('Disalin: '+s)},function(){toast('Ketik: '+s)});}catch(x){toast('Ketik: '+s);}};
$('list').addEventListener('click',function(e){var el=e.target;while(el&&el!==this&&!(el.dataset&&el.dataset.n))el=el.parentNode;if(!el||el===this)return;var i=+el.dataset.n-1;if(i===cur&&CFG.tracks[i].p){toggle();return;}play(i);});
$('q').addEventListener('input',function(){q0=this.value.trim().toLowerCase();applyView();});
var first=CFG.start>=0?CFG.start:-1;if(first>=0){cur=first;$('snm').textContent=CFG.tracks[first].a;$('sar').textContent=CFG.tracks[first].b;}
render();
})();
</script>
`;

function buildMusikHtml({ playerName = "Kamu", tracks = [], prefix = ".", thumbUri = null, bgUri = null, audio = new Map(), start = -1, favIds = [] } = {}) {
  const fav = new Set(favIds), data = tracks.map((t, i) => ({ a: t.title, b: t.artist, p: audio.has(i) ? 1 : 0, f: fav.has(t.id) ? 1 : 0, d: t.dur || "" }));
  const aud = {};
  for (const [i, b64] of audio) aud[i] = "data:audio/mpeg;base64," + b64;
  const css = (u) => (u ? `url('${u}')` : "linear-gradient(135deg,#3a3f52,#1b1e29)");
  return BODY
    .replace("__BASECSS__", () => BASE_CSS)
    .replace("__THUMB__", () => css(thumbUri))
    .replace("__BG__", () => css(bgUri))
    .replace("__AUD__", () => safeJson(aud))
    .replace("__CFG__", () => safeJson({ nama: String(playerName), prefix: String(prefix), start, tracks: data }));
}

module.exports = { buildMusikHtml, escapeHtml };
    },
    "livenet/cloudflared": (module, exports, require) => {
// ===========================================================================
// AUTO CLOUDFLARED — Download & install cloudflared otomatis
// Dipakai oleh semua tunnel (ytlive, spotifylive, pinlive)
// Tidak perlu wget/curl manual — download pakai https bawaan Node.js
// ===========================================================================

const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');


// Lokasi cloudflared yang akan didownload
const CLOUDFLARED_PATH = path.join(process.cwd(), 'cloudflared');

// URL download cloudflared linux amd64
const CLOUDFLARED_ARCH = process.arch === 'arm64' ? 'arm64' : process.arch === 'arm' ? 'arm' : 'amd64';
const CLOUDFLARED_URL = 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-' + CLOUDFLARED_ARCH;

function sudahAda() {
    try {
        if (!fs.existsSync(CLOUDFLARED_PATH)) return false;
        fs.accessSync(CLOUDFLARED_PATH, fs.constants.X_OK);
        return true;
    } catch (e) {
        return false;
    }
}

function downloadFile(url, tujuan, redirect = 0) {
    return new Promise((selesai, gagal) => {
        if (redirect > 5) return gagal(new Error('Terlalu banyak redirect'));

        https.get(url, { headers: { 'User-Agent': 'cloudflared-installer/1.0' } }, (res) => {
            // Ikuti redirect
            if (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307 || res.statusCode === 308) {
                const loc = res.headers.location;
                res.resume();
                if (!loc) return gagal(new Error('Redirect tanpa Location header'));
                return downloadFile(loc, tujuan, redirect + 1).then(selesai).catch(gagal);
            }

            if (res.statusCode !== 200) {
                res.resume();
                return gagal(new Error('HTTP ' + res.statusCode));
            }

            const file = fs.createWriteStream(tujuan);
            let total = 0;
            res.on('data', (d) => { total += d.length; });
            res.pipe(file);
            file.on('finish', () => {
                file.close();
                selesai(total);
            });
            file.on('error', (e) => {
                try { fs.unlinkSync(tujuan); } catch (x) { }
                gagal(e);
            });
        }).on('error', gagal);
    });
}

async function pastikanCloudflared() {
    if (process.platform !== 'linux') {
        console.log('ℹ️ [AUTO-CF] auto-download hanya untuk Linux. Pasang cloudflared manual atau isi environment variable CLOUDFLARED_BIN.');
        return null;
    }
    if (sudahAda()) {
        console.log('✅ [AUTO-CF] cloudflared sudah ada di ' + CLOUDFLARED_PATH);
        return CLOUDFLARED_PATH;
    }

    console.log('⬇️  [AUTO-CF] cloudflared tidak ketemu, download otomatis...');
    try {
        const bytes = await downloadFile(CLOUDFLARED_URL, CLOUDFLARED_PATH);
        fs.chmodSync(CLOUDFLARED_PATH, 0o755);
        console.log('✅ [AUTO-CF] cloudflared berhasil didownload (' + Math.round(bytes / 1048576) + ' MB)');
        return CLOUDFLARED_PATH;
    } catch (e) {
        console.error('❌ [AUTO-CF] gagal download cloudflared:', e.message);
        return null;
    }
}

module.exports = { pastikanCloudflared, CLOUDFLARED_PATH };
    },
    "livenet/pinterest": (module, exports, require) => {
/*
 * Module scraping khusus untuk pencarian Pin di Pinterest.
 * Dipakai untuk command WhatsApp: .pin <query>
 *
 * Cara kerja: ambil cookie awal dari halaman Pinterest, lalu panggil
 * endpoint internal "BaseSearchResource" milik Pinterest (dipakai oleh
 * fitur search di web mereka sendiri) buat dapetin hasil pencarian pin.
 */

const { CookieJar } = require('tough-cookie');

const PINTEREST_HOST = 'https://id.pinterest.com';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:152.0) Gecko/20100101 Firefox/152.0';

// Urutan varian video yang lebih disukai - semuanya MP4 langsung (bukan
// manifest HLS). Diurutkan dari resolusi paling tinggi ke rendah supaya
// kualitasnya bagus tapi tetap wajar buat dikirim lewat WebSocket.
const VIDEO_KEY_PREFERENSI = ['V_720P', 'V_EXP7', 'V_EXP6', 'V_EXP5', 'V_EXP4', 'V_EXP3', 'V_EXP2', 'V_EXP1'];

function bukanManifestHls(key, url) {
    if (!url) return false;
    if (/hls/i.test(key)) return false;
    if (/\.m3u8(\?|$)/i.test(url)) return false;
    return true;
}

/**
 * Pilih URL video MP4 terbaik dari daftar varian video Pinterest.
 * Sengaja MENGHINDARI varian HLS (mis. V_HLSV4/V_HLSV3) karena itu manifest
 * (.m3u8) yang isinya daftar segmen - bukan file video utuh, jadi tidak bisa
 * diputar langsung dari data URI base64 seperti yang dipakai pinlive-relay.
 * @param {object|null|undefined} videoList - pin.videos.video_list dari Pinterest.
 * @returns {string|null}
 */
function pickBestVideoUrl(videoList) {
    if (!videoList || typeof videoList !== 'object') return null;

    for (const key of VIDEO_KEY_PREFERENSI) {
        const v = videoList[key];
        if (v && v.url && bukanManifestHls(key, v.url)) return v.url;
    }
    // Fallback: cari varian lain apa saja yang bukan HLS.
    for (const key of Object.keys(videoList)) {
        const v = videoList[key];
        if (v && v.url && bukanManifestHls(key, v.url)) return v.url;
    }
    return null;
}

/**
 * Cari pin di Pinterest berdasarkan kata kunci.
 * @param {string} query - Kata kunci pencarian.
 * @param {object} [opts]
 * @param {number} [opts.limit=20] - Maksimal jumlah hasil yang dikembalikan.
 * @param {string|null} [opts.bookmark=null] - Token halaman lanjutan dari
 *   panggilan sebelumnya (lihat field `bookmark` di hasil kembalian). Kirim
 *   ulang token ini buat dapat batch pin BERIKUTNYA dari kata kunci yang
 *   sama, bukan hasil yang sama diulang - dipakai buat "gulir tanpa habis"
 *   di kartu Pinlive. Kosongkan (default) buat halaman pertama.
 * @returns {Promise<{status:string, code:number, input:string, total:number, result:object[], bookmark:string|null}>}
 */
async function searchPinterest(query, { limit = 20, bookmark = null } = {}) {
    const q = String(query || '').trim();
    if (!q) throw new Error("Query pencarian wajib diisi.");

    const jar = new CookieJar();

    // 1. Ambil cookie awal dari halaman utama Pinterest (dibutuhkan biar request search dianggap valid)
    const initRes = await fetch(`${PINTEREST_HOST}/`, {
        method: 'GET',
        headers: {
            'user-agent': UA,
            'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
            'accept-language': 'en-US,en;q=0.9',
        },
    });

    const setCookies = typeof initRes.headers.getSetCookie === 'function' ? initRes.headers.getSetCookie() : [];
    if (setCookies && setCookies.length) {
        for (const c of setCookies) {
            try { await jar.setCookie(c, PINTEREST_HOST); } catch (e) { /* cookie invalid, skip */ }
        }
    }

    const cookieString = await jar.getCookieString(PINTEREST_HOST);

    // 2. Susun payload sesuai format request search resource Pinterest
    const sourceUrl = '/search/pins/?q=' + encodeURIComponent(q) + '&rs=typed';
    const dataPayload = JSON.stringify({
        options: {
            query: q,
            scope: 'pins',
            appliedProductFilters: '---',
            domains: null,
            user: null,
            seoDrawerEnabled: false,
            applied_unified_filters: null,
            auto_correction_disabled: false,
            journey_depth: null,
            source_id: null,
            source_module_id: null,
            source_url: sourceUrl,
            static_feed: false,
            selected_one_bar_modules: null,
            query_pin_sigs: null,
            page_size: null,
            price_max: null,
            price_min: null,
            query_image_pins: null,
            request_params: null,
            top_pin_ids: null,
            article: null,
            corpus: null,
            customized_rerank_type: null,
            filters: null,
            rs: 'typed',
            redux_normalize_feed: true,
            // Endpoint internal ini (BaseSearchResource) sama seperti yang dipakai
            // Pinterest sendiri buat "muat lagi" waktu kamu gulir ke bawah di web -
            // token bookmark dari respons sebelumnya dikirim balik lewat array ini
            // supaya dapat batch pin BERIKUTNYA. Array kosong = halaman pertama.
            bookmarks: bookmark ? [bookmark] : []
        },
        context: {}
    });

    const url = `${PINTEREST_HOST}/resource/BaseSearchResource/get/?source_url=${encodeURIComponent(sourceUrl)}&data=${encodeURIComponent(dataPayload)}&_=${Date.now()}`;

    // 3. Panggil endpoint pencarian
    const res = await fetch(url, {
        method: 'GET',
        headers: {
            'user-agent': UA,
            'accept': 'application/json, text/javascript, */*; q=0.01',
            'accept-language': 'en-US,en;q=0.9',
            'accept-encoding': 'gzip, deflate, br, zstd',
            'referer': `${PINTEREST_HOST}/`,
            'x-requested-with': 'XMLHttpRequest',
            'x-app-version': '8048c97',
            'x-pinterest-appstate': 'active',
            'x-pinterest-source-url': '/',
            'x-pinterest-pws-handler': 'www/index.js',
            'screen-dpr': '1.25',
            'sec-fetch-dest': 'empty',
            'sec-fetch-mode': 'cors',
            'sec-fetch-site': 'same-origin',
            'cookie': cookieString
        },
    });

    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch (e) { data = null; }

    const status = data && data.resource_response && data.resource_response.status === 'success' ? 'success' : 'failed';
    const rawResults = (data && data.resource_response && data.resource_response.data && data.resource_response.data.results) || [];

    // Token buat batch berikutnya. Pinterest naruhnya di beberapa lokasi
    // tergantung versi endpoint - dicoba berurutan. Waktu hasil BENAR-BENAR
    // habis, Pinterest balikin string "-end-" (bukan null/kosong), jadi itu
    // sengaja disamakan dengan "tidak ada lagi".
    const bookmarkMentah =
        (data && data.resource_response && data.resource_response.bookmark) ||
        (data && data.resource_response && data.resource_response.data && data.resource_response.data.bookmark) ||
        null;
    const bookmarkLanjut = (bookmarkMentah && bookmarkMentah !== '-end-') ? bookmarkMentah : null;

    const result = rawResults
        .map((pin) => ({
            id: pin.id,
            title: pin.grid_title || pin.title || null,
            description: pin.description || null,
            // "orig" dipakai buat unduhan/tampilan penuh (bisa beberapa MB).
            image: (pin.images && pin.images.orig && pin.images.orig.url) || null,
            // "thumb" khusus buat grid pencarian - jauh lebih kecil, supaya kartu
            // Pinlive tidak perlu menarik gambar orig cuma buat kotak kecil.
            // Pinterest biasanya punya beberapa varian ukuran; ambil yang paling
            // kecil yang tersedia, baru naik kalau tidak ada.
            thumb: (pin.images && (
                (pin.images['236x'] && pin.images['236x'].url) ||
                (pin.images['474x'] && pin.images['474x'].url) ||
                (pin.images['170x'] && pin.images['170x'].url) ||
                (pin.images.orig && pin.images.orig.url)
            )) || null,
            link: pin.link || null,
            domain: pin.domain || null,
            pinner: (pin.pinner && pin.pinner.full_name) || null,
            username: (pin.pinner && pin.pinner.username) || null,
            likes: (pin.reaction_counts && pin.reaction_counts['1']) || 0,
            created_at: pin.created_at || null,
            // Sebagian pin punya video (pin.videos.video_list, beberapa resolusi).
            // Dipakai buat fitur .pinlive video - lihat pickBestVideoUrl() di
            // bawah. PENTING: harus MP4 langsung, BUKAN manifest HLS (.m3u8),
            // karena videonya dikirim lewat WebSocket sebagai data URI
            // (base64 utuh) - <video> tidak bisa memutar manifest HLS dari
            // data URI (butuh hls.js/native HLS Safari buat streaming
            // segmen), jadi kalau kepilih HLS video-nya kelihatan "ga bisa"
            // diputar sama sekali.
            video: pickBestVideoUrl(pin.videos && pin.videos.video_list) || null,
        }))
        .filter((r) => r.image)
        .slice(0, limit);

    return {
        status,
        code: res.status,
        input: q,
        total: result.length,
        result,
        // null artinya jangan diminta lagi (query ini sudah tidak punya
        // halaman lanjutan) - pemanggil (pinlive-relay.js) memakai ini buat
        // tahu kapan harus berhenti auto-muat & bilang "sudah habis".
        bookmark: bookmarkLanjut,
    };
}

module.exports = { searchPinterest, pickBestVideoUrl };
    },
    "livenet/spotify": (module, exports, require) => {
// ===========================================================================
// SPOTIFY SCRAPER — diambil PERSIS dari scrape/spotify.js sairi
// Hanya ganti: require('axios') -> import axios
//              module.exports -> export
// Logika TIDAK DIUBAH SAMA SEKALI
// ===========================================================================

const axios = require('axios');

// --- SEARCH (Spotify Web API - Client Credentials Flow) ---
const CLIENT_ID = 'd0b7f73c049d4f079d2c42e15f10568f';
const CLIENT_SECRET = '63a72d79d7744e33906c6fb0c048cb82';

let accessToken = null;
let tokenExpiry = 0;

async function getAccessToken() {
    if (accessToken && Date.now() < tokenExpiry) return accessToken;

    const auth = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
    const { data } = await axios.post(
        'https://accounts.spotify.com/api/token',
        'grant_type=client_credentials',
        {
            headers: {
                'Authorization': `Basic ${auth}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            timeout: 20000
        }
    );

    accessToken = data.access_token;
    tokenExpiry = Date.now() + (data.expires_in * 1000) - 5000;
    return accessToken;
}

function formatTrack(track) {
    return {
        name: track.name,
        id: track.id,
        duration_ms: track.duration_ms,
        explicit: track.explicit,
        popularity: track.popularity,
        artists: (track.artists || []).map((a) => a.name),
        album: {
            name: track.album && track.album.name,
            release_date: track.album && track.album.release_date,
            image: (track.album && track.album.images && track.album.images[0] && track.album.images[0].url) || null,
            imageSmall: (track.album && track.album.images && track.album.images.length
                ? track.album.images[track.album.images.length - 1].url
                : null) || null
        },
        url: track.external_urls && track.external_urls.spotify
    };
}

async function searchTrack(query, limit = 8) {
    const q = String(query || '').trim();
    if (!q) throw new Error("Query pencarian wajib diisi.");

    const token = await getAccessToken();
    const { data } = await axios.get('https://api.spotify.com/v1/search', {
        params: { q, type: 'track', market: 'US', limit },
        headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' },
        timeout: 20000
    });

    const items = (data && data.tracks && data.tracks.items) || [];
    return items.map(formatTrack);
}

// --- DOWNLOAD (dlapi.app converter) ---
class SpotifyDL {
    constructor() {
        this.api = {
            meta: "https://spotify.dlapi.app/api/Gettrack",
            convert: "https://master.dlapi.app/api/v1/convert",
            task: "https://master.dlapi.app/api/v1/tasks"
        };
        this.client = axios.create({
            headers: {
                Authorization: "Bearer pGLXoCsVu0hcstAecIDwlrlbcrUzv0e1cWBJ0yuB",
                "Content-Type": "application/json",
                "User-Agent": "Spotmate/1.0"
            },
            timeout: 30000
        });
    }

    valid(url) {
        return /^(https?:\/\/)?(open\.)?spotify\.com\/(track|album|playlist|artist)\/[a-zA-Z0-9]+/.test(url || '');
    }

    async meta(url) {
        const { data } = await this.client.get(this.api.meta, { params: { spotify_url: url } });
        if (!data) throw new Error("API Data Empty");
        return data;
    }

    async convert(url, format = "mp3") {
        const { data: init } = await this.client.post(this.api.convert, { url, format });
        if (init && init.download_url) return init.download_url;
        const taskId = (init && (init.task_id || init.id));
        if (!taskId) throw new Error("No Task ID received");
        for (let i = 0; i < 60; i++) {
            await new Promise((r) => setTimeout(r, 3000));
            const { data: status } = await this.client.get(`${this.api.task}/${taskId}`);
            if (status && (status.status === "finished" || status.status === "completed")) {
                return (status.result && status.result.download_url) || status.download_url;
            }
            if (status && status.status === "failed") throw new Error("Server-side processing failed");
        }
        throw new Error("Task Timeout");
    }

    async download({ url, format = "mp3" }) {
        if (!this.valid(url)) throw new Error("Invalid Spotify URL");
        const data = await this.meta(url);
        const targetUrl = (data.external_urls && data.external_urls.spotify) || url;
        const downloadUrl = await this.convert(targetUrl, format);
        return {
            title: data.name,
            artist: data.artists ? data.artists.map((a) => a.name).join(", ") : null,
            album: data.album && data.album.name,
            duration: data.duration_ms,
            cover: data.album && data.album.images && data.album.images[0] && data.album.images[0].url,
            download: downloadUrl
        };
    }
}

const dlInstance = new SpotifyDL();

async function downloadTrack(url, format = 'mp3') {
    return await dlInstance.download({ url, format });
}

function isSpotifyUrl(url) {
    return dlInstance.valid(url);
}

module.exports = { searchTrack, downloadTrack, isSpotifyUrl };
    },
    "livenet/youtube-search": (module, exports, require) => {
// ===========================================================================
// PENCARIAN YOUTUBE — diambil PERSIS dari scrape/youtube.js sairi
// Hanya ganti: require('axios') -> import axios
//              module.exports -> export
// Logika, body, header, parser: TIDAK DIUBAH SAMA SEKALI
// ===========================================================================

const axios = require('axios');
const cheerio = require('cheerio');

// ---------------------------------------------------------------------------
// 1. PENCARIAN
// ---------------------------------------------------------------------------

async function searchYoutube(query) {
    if (typeof query !== 'string' || !query.trim()) throw new Error('Kata kunci pencarian kosong.');

    const body = {
        context: {
            client: {
                hl: 'id',
                gl: 'ID',
                clientName: 'WEB',
                clientVersion: '2.20250701.09.00'
            }
        },
        params: 'EgIQAQ%3D%3D',
        query
    };

    const res = await axios.post(
        'https://www.youtube.com/youtubei/v1/search?prettyPrint=false',
        body,
        {
            timeout: 20000,
            headers: {
                'Content-Type': 'application/json',
                'Accept-Encoding': 'gzip, deflate, br'
            }
        }
    );

    const json = res.data;
    const kontenAwal = json && json.contents && json.contents.twoColumnSearchResultsRenderer &&
        json.contents.twoColumnSearchResultsRenderer.primaryContents &&
        json.contents.twoColumnSearchResultsRenderer.primaryContents.sectionListRenderer &&
        json.contents.twoColumnSearchResultsRenderer.primaryContents.sectionListRenderer.contents;

    const daftarMentah = (kontenAwal && kontenAwal[0] && kontenAwal[0].itemSectionRenderer &&
        kontenAwal[0].itemSectionRenderer.contents) || [];

    const result = daftarMentah
        .filter((v) => v && v.videoRenderer && v.videoRenderer.lengthText && v.videoRenderer.lengthText.simpleText)
        .map((v) => {
            const vr = v.videoRenderer;
            const videoId = vr.videoId;
            const thumbs = (vr.thumbnail && vr.thumbnail.thumbnails) || [];
            return {
                videoId,
                title: (vr.title && vr.title.runs && vr.title.runs[0] && vr.title.runs[0].text) || '(tanpa judul)',
                channel: (vr.ownerText && vr.ownerText.runs && vr.ownerText.runs[0] && vr.ownerText.runs[0].text) || '-',
                url: `https://youtu.be/${videoId}`,
                thumbnail: (thumbs[1] && thumbs[1].url) || (thumbs[0] && thumbs[0].url) || null,
                duration: vr.lengthText.simpleText,
                datePassed: (vr.publishedTimeText && vr.publishedTimeText.simpleText) || null,
                views: (vr.shortViewCountText && vr.shortViewCountText.simpleText) || '-'
            };
        });

    if (!result.length) throw new Error(`Tidak ada video ditemukan untuk "${query}".`);
    return result;
}

// ---------------------------------------------------------------------------
// 2. DOWNLOAD — 3 sumber berjenjang (ANDROID player → youtubemp4.to → flvto)
// ---------------------------------------------------------------------------

function convertid(url) {
    const regex = /(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|embed|watch|shorts)\/|.*[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})(?:[&?]|$)/;
    const match = url.match(regex);
    return match ? match[1] : null;
}

const YT_ANDROID_KEY = 'AIzaSyA8eiZmM1FaDVjRy-df2KTyQ_vz_yYM39w';

async function ambilFormatAndroid(youtube_id) {
    const res = await axios.post(
        `https://www.youtube.com/youtubei/v1/player?key=${YT_ANDROID_KEY}&prettyPrint=false`,
        {
            videoId: youtube_id,
            context: {
                client: {
                    clientName: 'ANDROID',
                    clientVersion: '19.09.37',
                    androidSdkVersion: 30,
                    hl: 'en',
                    gl: 'US'
                }
            },
            contentCheckOk: true,
            racyCheckOk: true
        },
        {
            timeout: 20000,
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'com.google.android.youtube/19.09.37 (Linux; U; Android 11) gzip'
            }
        }
    );

    const data = res.data;
    const status = data && data.playabilityStatus && data.playabilityStatus.status;
    if (status !== 'OK') {
        const alasan = (data && data.playabilityStatus && data.playabilityStatus.reason) || `status: ${status || 'tidak diketahui'}`;
        throw new Error(`Video tidak bisa diputar (${alasan}).`);
    }

    const formats = (data.streamingData && data.streamingData.formats) || [];
    const siapPakai = formats.filter((f) => f && typeof f.url === 'string' && /^video\/mp4/.test(f.mimeType || ''));
    if (!siapPakai.length) throw new Error('Tidak ada format mp4 progresif siap-pakai dari client Android.');

    siapPakai.sort((a, b) => (a.height || 0) - (b.height || 0));
    const pilihan = siapPakai[0];

    return {
        title: (data.videoDetails && data.videoDetails.title) || null,
        quality: pilihan.qualityLabel || (pilihan.height ? `${pilihan.height}p` : '-'),
        width: pilihan.width,
        height: pilihan.height,
        fps: pilihan.fps,
        download_url: pilihan.url
    };
}

async function ambilDariYoutubeMp4To(url) {
    const baseUrl = 'https://youtubemp4.to';
    const headersDasar = {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',
        'Accept-Language': 'id-ID,id;q=0.9',
        Referer: `${baseUrl}/HAOT/`,
        Origin: baseUrl
    };

    let cookies = '';
    try {
        const cek = await axios.head(`${baseUrl}/HAOT/`, { headers: headersDasar, timeout: 15000 });
        cookies = cek.headers['set-cookie'] ? cek.headers['set-cookie'].join('; ') : '';
    } catch (e) { }

    const { data } = await axios.post(
        `${baseUrl}/download_ajax/`,
        new URLSearchParams({ url }).toString(),
        {
            timeout: 30000,
            headers: {
                ...headersDasar,
                Cookie: cookies,
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                'X-Requested-With': 'XMLHttpRequest'
            }
        }
    );

    const $ = cheerio.load((data && data.result) || '');
    const title = $('.meta h2').text().trim() || null;

    const semuaFormat = [];
    $('.results-other table tbody tr').each((_, el) => {
        const kualitas = $(el).find('td').eq(0).text().trim();
        const link = $(el).find('td a').attr('href') || '';
        if (link) semuaFormat.push({ kualitas, link });
    });

    const formatVideo = semuaFormat
        .filter((f) => !/audio|mp3|kbps|kbit/i.test(f.kualitas))
        .map((f) => ({ ...f, angka: parseInt((f.kualitas.match(/\d+/) || [])[0] || '0', 10) }))
        .filter((f) => f.angka > 0)
        .sort((a, b) => a.angka - b.angka);

    if (!formatVideo.length) throw new Error('Situs tidak mengembalikan link video mp4 yang bisa dipakai.');

    const pilihan = formatVideo[0];
    return { title, quality: pilihan.kualitas, download_url: pilihan.link };
}

async function ambilDariFlvto(youtube_id, cleanFormat, customQuality) {
    const converter = await axios.post(
        'https://ht.flvto.online/converter',
        { id: youtube_id, fileType: cleanFormat },
        {
            timeout: 45000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:152.0) Gecko/20100101 Firefox/152.0',
                'Content-Type': 'application/json',
                origin: 'https://ht.flvto.online',
                referer: `https://ht.flvto.online/button?url=https://www.youtube.com/watch?v=${youtube_id}&fileType=${cleanFormat}`
            }
        }
    );

    const data = converter.data;
    if (!data || (data.status !== 'ok' && data.status !== 'success')) {
        throw new Error((data && data.msg) || 'Server converter gagal memproses video ini.');
    }

    if (cleanFormat === 'mp3') {
        const targetQuality = customQuality ? String(customQuality).toLowerCase().replace('kbps', '') : '320';
        return {
            status: true,
            result: {
                videoId: youtube_id,
                title: data.title,
                type: 'mp3',
                quality: `${targetQuality}kbps`,
                filesize: data.filesize || 0,
                duration: data.duration || 0,
                download_url: data.link
            }
        };
    }

    if (cleanFormat === 'mp4') {
        if (!Array.isArray(data.formats) || !data.formats.length) {
            throw new Error('Gagal mengekstrak daftar format resolusi video.');
        }
        const targetQuality = customQuality ? String(customQuality).toLowerCase().replace('p', '') + 'p' : '720p';
        let selected = data.formats.find((v) => v.qualityLabel === targetQuality);
        if (!selected) {
            const urut = data.formats.slice().sort((a, b) => (a.height || 0) - (b.height || 0));
            selected = urut[0];
        }
        return {
            status: true,
            result: {
                videoId: youtube_id,
                title: data.title,
                type: 'mp4',
                quality: selected.qualityLabel,
                resolution: `${selected.width}x${selected.height}`,
                fps: selected.fps || 30,
                download_url: selected.url
            }
        };
    }

    throw new Error("Format tidak didukung, gunakan 'mp3' atau 'mp4'.");
}

async function downloadYoutube(url, format = 'mp4', customQuality = null) {
    try {
        const youtube_id = convertid(url) || (/^[a-zA-Z0-9_-]{11}$/.test(String(url || '').trim()) ? String(url).trim() : null);
        if (!youtube_id) throw new Error('URL/ID YouTube tidak valid.');

        const cleanFormat = String(format || 'mp4').toLowerCase().trim();

        if (cleanFormat === 'mp4') {
            const kesalahan = [];

            try {
                const hasil = await ambilFormatAndroid(youtube_id);
                return {
                    status: true,
                    result: {
                        videoId: youtube_id,
                        title: hasil.title,
                        type: 'mp4',
                        quality: hasil.quality,
                        resolution: (hasil.width && hasil.height) ? `${hasil.width}x${hasil.height}` : undefined,
                        fps: hasil.fps || 30,
                        download_url: hasil.download_url
                    }
                };
            } catch (e) {
                kesalahan.push(`client Android: ${e.message}`);
                console.error('[YTLIVE] SUMBER 1 (client Android) gagal, coba SUMBER 2 (youtubemp4.to):', e && e.message);
            }

            try {
                const hasil2 = await ambilDariYoutubeMp4To(url);
                return {
                    status: true,
                    result: {
                        videoId: youtube_id,
                        title: hasil2.title,
                        type: 'mp4',
                        quality: hasil2.quality,
                        download_url: hasil2.download_url
                    }
                };
            } catch (e2) {
                kesalahan.push(`youtubemp4.to: ${e2.message}`);
                console.error('[YTLIVE] SUMBER 2 (youtubemp4.to) gagal, coba SUMBER 3 (converter cadangan):', e2 && e2.message);
            }

            try {
                return await ambilDariFlvto(youtube_id, 'mp4', customQuality);
            } catch (e3) {
                kesalahan.push(`converter cadangan: ${e3.message}`);
                throw new Error(kesalahan.join(' | '));
            }
        }

        return await ambilDariFlvto(youtube_id, cleanFormat, customQuality);
    } catch (error) {
        return { status: false, message: error.message };
    }
}

module.exports = { searchYoutube, downloadYoutube, convertid };
    },
    "livenet/yt-padat": (module, exports, require) => {
// ===========================================================================
// YT-PADAT — diambil PERSIS dari lib/yt-padat.js sairi
// Hanya ganti: require -> import, module.exports -> export
// Logika TIDAK DIUBAH SAMA SEKALI
// ===========================================================================

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

function pathFfmpeg() {
    try {
        const p = require('ffmpeg-static');
        if (p && fs.existsSync(p)) return p;
    } catch (e) { }
    try {
        const p = require('@ffmpeg-installer/ffmpeg').path;
        if (p && fs.existsSync(p)) return p;
    } catch (e) { }
    return 'ffmpeg';
}

function durasiKeDetik(teks) {
    const bersih = String(teks || '')
        .replace(/[\u00a0\u200b-\u200f\u2066-\u2069]/g, ' ')
        .trim();

    const cocok = bersih.match(/(\d{1,3})\s*[:.](\s*\d{1,2})(?:\s*[:.](\s*\d{1,2}))?/);
    if (!cocok) return null;

    const a = parseInt(cocok[1], 10);
    const b = parseInt(cocok[2], 10);
    const c = cocok[3] === undefined ? null : parseInt(cocok[3], 10);
    if (![a, b].every(Number.isFinite)) return null;

    const detik = c === null ? (a * 60 + b) : (a * 3600 + b * 60 + c);
    return detik > 0 ? detik : null;
}

function durasiDariBerkas(berkas) {
    return new Promise((selesai) => {
        const anak = spawn(pathFfmpeg(), ['-i', berkas], { stdio: ['ignore', 'ignore', 'pipe'] });

        let galat = '';
        anak.stderr.on('data', (d) => { galat += d.toString(); if (galat.length > 20000) galat = galat.slice(-20000); });

        const jamPasir = setTimeout(() => { try { anak.kill('SIGKILL'); } catch (e) { } }, 30000);

        anak.on('error', () => { clearTimeout(jamPasir); selesai(null); });
        anak.on('close', () => {
            clearTimeout(jamPasir);
            const m = galat.match(/Duration:\s*(\d+):(\d{2}):(\d{2})(?:\.(\d+))?/);
            if (!m) return selesai(null);
            const detik = (+m[1]) * 3600 + (+m[2]) * 60 + (+m[3]) + (m[4] ? parseFloat('0.' + m[4]) : 0);
            selesai(detik > 0 ? detik : null);
        });
    });
}

function detikKeTeks(detik) {
    const m = Math.floor(detik / 60);
    const s = Math.round(detik % 60);
    return `${m} menit ${s} detik`;
}

async function padatkanVideo(bufferMasuk, detik, targetByte, opts = {}) {
    const timeoutMs = opts.timeoutMs || 600000;

    const akar = path.join(process.cwd(), '.ytlive-tmp');
    fs.mkdirSync(akar, { recursive: true });
    const dir = fs.mkdtempSync(path.join(akar, 'p-'));
    const masuk = path.join(dir, 'masuk.mp4');
    const keluar = path.join(dir, 'keluar.mp4');
    const bersihkan = () => { try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) { } };

    try {
        fs.writeFileSync(masuk, bufferMasuk);

        if (!detik || detik <= 0) {
            detik = await durasiDariBerkas(masuk);
        }
        if (!detik || detik <= 0) {
            throw new Error('Durasi video tidak terbaca dari berkasnya, tidak bisa hitung bitrate.');
        }

        return await jalankanPadat(masuk, keluar, detik, targetByte, timeoutMs);
    } finally {
        bersihkan();
    }
}

async function jalankanPadat(masuk, keluar, detik, targetByte, timeoutMs) {
    const totalKbps = Math.floor((targetByte * 8 * 0.90) / detik / 1000);
    const audioKbps = 56;
    const videoKbps = totalKbps - audioKbps;

    if (videoKbps < 100) {
        throw new Error('Video ini terlalu panjang untuk dipadatkan tanpa merusak kualitasnya.');
    }

    const tinggi = videoKbps >= 400 ? 360 : 240;

    await new Promise((selesai, gagal) => {
        const anak = spawn(pathFfmpeg(), [
            '-y',
            '-i', masuk,
            '-c:v', 'libx264',
            '-preset', 'veryfast',
            '-b:v', `${videoKbps}k`,
            '-maxrate', `${Math.round(videoKbps * 1.4)}k`,
            '-bufsize', `${videoKbps * 2}k`,
            '-vf', `scale=-2:${tinggi}`,
            '-r', '24',
            '-c:a', 'aac',
            '-b:a', `${audioKbps}k`,
            '-ac', '1',
            '-ar', '44100',
            '-movflags', '+faststart',
            keluar
        ], { stdio: ['ignore', 'ignore', 'pipe'] });

        let galat = '';
        anak.stderr.on('data', (d) => { galat += d.toString(); if (galat.length > 4000) galat = galat.slice(-4000); });

        const jamPasir = setTimeout(() => {
            try { anak.kill('SIGKILL'); } catch (e) { }
            gagal(new Error(`ffmpeg timeout setelah ${Math.round(timeoutMs / 1000)} detik.`));
        }, timeoutMs);

        anak.on('error', (e) => { clearTimeout(jamPasir); gagal(new Error(`ffmpeg tidak bisa dijalankan: ${e.message}`)); });
        anak.on('close', (kode) => {
            clearTimeout(jamPasir);
            if (kode !== 0) {
                const baris = galat.trim().split('\n').filter(Boolean).pop() || `kode ${kode}`;
                return gagal(new Error(`ffmpeg gagal: ${baris}`));
            }
            selesai();
        });
    });

    const hasil = fs.readFileSync(keluar);
    return { buffer: hasil, quality: `${tinggi}p` };
}

function alirkanFmp4(masuk, opsi = {}) {
    const wadah = [
        '-movflags', 'frag_keyframe+empty_moov+default_base_moof',
        '-f', 'mp4',
        'pipe:1'
    ];

    let args;
    if (opsi.salin) {
        args = ['-y', '-i', masuk, '-c', 'copy'].concat(wadah);
    } else {
        const audioKbps = opsi.audioKbps || 56;
        args = [
            '-y', '-i', masuk,
            '-c:v', 'libx264',
            '-preset', 'veryfast',
            '-g', '48', '-keyint_min', '48', '-sc_threshold', '0',
            '-b:v', `${opsi.videoKbps}k`,
            '-maxrate', `${Math.round(opsi.videoKbps * 1.4)}k`,
            '-bufsize', `${opsi.videoKbps * 2}k`,
            '-vf', `scale=-2:${opsi.tinggi}`,
            '-r', '24',
            '-c:a', 'aac', '-b:a', `${audioKbps}k`, '-ac', '1', '-ar', '44100'
        ].concat(wadah);
    }

    return spawn(pathFfmpeg(), args, { stdio: ['ignore', 'pipe', 'pipe'] });
}

const FFMPEG_MAKS = Math.max(1, parseInt(process.env.FFMPEG_MAKS_SERENTAK || '2', 10));
let ffmpegJalan = 0;
const ffmpegAntre = [];

function ambilSlotFfmpeg() {
    return new Promise((selesai) => {
        const beri = () => {
            let sudahLepas = false;
            selesai(() => {
                if (sudahLepas) return;
                sudahLepas = true;
                ffmpegJalan--;
                const berikutnya = ffmpegAntre.shift();
                if (berikutnya) { ffmpegJalan++; berikutnya(); }
            });
        };
        if (ffmpegJalan < FFMPEG_MAKS) { ffmpegJalan++; beri(); }
        else ffmpegAntre.push(beri);
    });
}

function statusFfmpeg() {
    return { jalan: ffmpegJalan, antre: ffmpegAntre.length, maks: FFMPEG_MAKS };
}

function hitungAnggaran(detik, targetByte) {
    const totalKbps = Math.floor((targetByte * 8 * 0.90) / detik / 1000);
    const audioKbps = 56;
    const videoKbps = totalKbps - audioKbps;
    if (videoKbps < 100) {
        throw new Error('Video ini terlalu panjang untuk dipadatkan tanpa merusak kualitasnya.');
    }
    return { videoKbps, tinggi: videoKbps >= 400 ? 360 : 240 };
}

module.exports = {
    durasiKeDetik, detikKeTeks, durasiDariBerkas,
    padatkanVideo, alirkanFmp4, hitungAnggaran, pathFfmpeg,
    ambilSlotFfmpeg, statusFfmpeg, FFMPEG_MAKS
};
    },
    "livenet/ytneoxr": (module, exports, require) => {
// ===========================================================================
// YTNEOXR — diambil PERSIS dari scrape/ytneoxr.js sairi
// Hanya ganti: require('axios') -> import axios
//              module.exports -> export
// Logika TIDAK DIUBAH SAMA SEKALI
// ===========================================================================

const axios = require('axios');

const NEOXR_BASE = 'https://api.neoxr.eu';

async function youtubeNeoxr(url, opts = {}) {
    if (!url) throw new Error('URL YouTube wajib diisi.');

    const apikey = opts.apikey || (Array.isArray(global.apikey && global.apikey.neoxr) ? global.apikey.neoxr[0] : global.apikey && global.apikey.neoxr);
    if (!apikey) throw new Error('API key neoxr belum diisi (apikey.neoxr di config.js).');

    const quality = opts.quality || '360p';

    const apiUrl = `${NEOXR_BASE}/api/youtube?url=${encodeURIComponent(url)}` +
        `&type=video&quality=${encodeURIComponent(quality)}&apikey=${encodeURIComponent(apikey)}`;

    const res = await axios.get(apiUrl, {
        timeout: opts.timeout || 120000,
        validateStatus: () => true
    });

    if (res.status !== 200) throw new Error(`HTTP ${res.status} dari api.neoxr.eu`);

    const body = res.data;
    if (!body || body.status !== true) {
        throw new Error(`ditolak: ${(body && (body.message || body.msg)) || 'tanpa keterangan'}`);
    }

    const link = (body.data && body.data.url) || body.url;
    if (!link) throw new Error('tidak mengembalikan link video.');

    return {
        title: body.title || (body.data && body.data.title) || null,
        quality: (body.data && body.data.quality) || quality,
        download_url: link
    };
}

module.exports = { youtubeNeoxr };
    },
    "livenet/ytlive-relay": (module, exports, require) => {
// ===========================================================================
// YTLIVE RELAY — diambil PERSIS dari lib/ytlive-relay.js sairi
// Hanya ganti: require -> import, module.exports -> export
// Logika TIDAK DIUBAH SAMA SEKALI
// ===========================================================================

const fs = require('fs');
const path = require('path');
const http = require('http');
const crypto = require('crypto');
const { EventEmitter } = require('events');
const axios = require('axios');
const { searchYoutube } = require('livenet/youtube-search');
const { youtubeNeoxr } = require('livenet/ytneoxr');
const { durasiKeDetik, detikKeTeks, durasiDariBerkas, alirkanFmp4, hitungAnggaran, ambilSlotFfmpeg, statusFfmpeg } = require('livenet/yt-padat');

// Baca key neoxr dari config.js (global.apikey.neoxr)
let _neoxrKey = null;
async function getNeoxrKey() {
    if (_neoxrKey) return _neoxrKey;
    try {
        let k = (global.apikey && global.apikey.neoxr) || '';
        if (Array.isArray(k)) k = k[0] || '';
        k = String(k).trim();
        if (k) { _neoxrKey = k; return k; }
    } catch (e) { }
    return '';
}


const YTLIVE_PORT = parseInt(process.env.YTLIVE_PORT || '3942', 10);
const YT_MAKS_PESAN = 400 * 1024;
const YT_BONGKAH = 120 * 1024;
const YT_MAKS_DETIK = parseInt(process.env.YTLIVE_MAKS_MENIT || '30', 10) * 60;
const YT_MAKS_UNDUH = 250 * 1024 * 1024;
const YT_MAKS_KIRIM = 60 * 1024 * 1024;
const YT_AMBANG_PADAT = 30 * 1024 * 1024;
const YT_MAKS_HASIL = 20;

// ---------------------------------------------------------------------------
// 1. SERVER WEBSOCKET MINIMAL (RFC 6455)
// ---------------------------------------------------------------------------
const WS_MAGIC = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

function ytBingkai(opcode, payload) {
    const len = payload.length;
    let head;
    if (len < 126) {
        head = Buffer.allocUnsafe(2);
        head[1] = len;
    } else if (len < 65536) {
        head = Buffer.allocUnsafe(4);
        head[1] = 126;
        head.writeUInt16BE(len, 2);
    } else {
        head = Buffer.allocUnsafe(10);
        head[1] = 127;
        head.writeUInt32BE(0, 2);
        head.writeUInt32BE(len, 6);
    }
    head[0] = 0x80 | opcode;
    return Buffer.concat([head, payload]);
}

function ytSoket(socket) {
    const ws = new EventEmitter();
    ws.readyState = 1;
    ws.alive = true;

    let sisa = Buffer.alloc(0);
    let fragOp = 0;
    let fragBuf = [];
    let fragLen = 0;

    const tulis = (buf) => { try { if (!socket.destroyed) socket.write(buf); } catch (e) { } };

    ws.send = (teks) => {
        if (ws.readyState !== 1) return;
        tulis(ytBingkai(1, Buffer.from(String(teks), 'utf8')));
    };

    ws.soket = socket;
    ws.antreanTulis = () => (socket.destroyed ? 0 : socket.writableLength || 0);
    ws.ping = () => { if (ws.readyState === 1) tulis(ytBingkai(9, Buffer.alloc(0))); };
    ws.close = (kode) => {
        if (ws.readyState !== 1) return;
        const p = Buffer.allocUnsafe(2);
        p.writeUInt16BE(kode || 1000, 0);
        tulis(ytBingkai(8, p));
        ws.readyState = 3;
        try { socket.end(); } catch (e) { }
    };
    ws.terminate = () => { ws.readyState = 3; try { socket.destroy(); } catch (e) { } };

    const tutupPaksa = (kode) => { try { ws.close(kode); } catch (e) { } ws.terminate(); };

    const pesanUtuh = (opcode, data) => {
        if (opcode === 1) ws.emit('message', data.toString('utf8'));
    };

    socket.on('data', (chunk) => {
        sisa = sisa.length ? Buffer.concat([sisa, chunk]) : chunk;
        while (true) {
            if (sisa.length < 2) break;
            const b0 = sisa[0], b1 = sisa[1];
            const fin = (b0 & 0x80) !== 0;
            const opcode = b0 & 0x0f;
            const bermask = (b1 & 0x80) !== 0;
            let len = b1 & 0x7f;
            let off = 2;

            if (len === 126) {
                if (sisa.length < 4) break;
                len = sisa.readUInt16BE(2); off = 4;
            } else if (len === 127) {
                if (sisa.length < 10) break;
                if (sisa.readUInt32BE(2) !== 0) return tutupPaksa(1009);
                len = sisa.readUInt32BE(6); off = 10;
            }

            if (len > YT_MAKS_PESAN) return tutupPaksa(1009);
            if (!bermask) return tutupPaksa(1002);
            if (sisa.length < off + 4) break;

            const total = off + 4 + len;
            if (sisa.length < total) break;

            const mask = sisa.slice(off, off + 4);
            const mentah = sisa.slice(off + 4, total);
            const data = Buffer.allocUnsafe(len);
            for (let i = 0; i < len; i++) data[i] = mentah[i] ^ mask[i & 3];
            sisa = sisa.slice(total);

            if (opcode === 8) return tutupPaksa(1000);
            if (opcode === 9) { tulis(ytBingkai(10, data)); continue; }
            if (opcode === 10) { ws.alive = true; continue; }

            if (opcode === 0) {
                if (!fragOp) return tutupPaksa(1002);
                fragLen += len;
                if (fragLen > YT_MAKS_PESAN) return tutupPaksa(1009);
                fragBuf.push(data);
                if (fin) {
                    const gabung = Buffer.concat(fragBuf, fragLen);
                    const op = fragOp;
                    fragOp = 0; fragBuf = []; fragLen = 0;
                    pesanUtuh(op, gabung);
                }
                continue;
            }

            if (opcode === 1 || opcode === 2) {
                if (fin) { pesanUtuh(opcode, data); continue; }
                fragOp = opcode; fragBuf = [data]; fragLen = len;
                continue;
            }

            return tutupPaksa(1002);
        }
    });

    const selesai = () => {
        if (ws.readyState === 3 && ws.sudahTutup) return;
        ws.sudahTutup = true;
        ws.readyState = 3;
        ws.emit('close');
    };
    socket.on('close', selesai);
    socket.on('end', selesai);
    socket.on('error', () => { try { socket.destroy(); } catch (e) { } selesai(); });

    return ws;
}

function ytKirim(ws, obj) {
    try { ws.send(JSON.stringify(obj)); } catch (e) { }
}

// ---------------------------------------------------------------------------
// 1b. JATAH UNDUH VIDEO PER NOMOR BOT
// ---------------------------------------------------------------------------
let ytHookJatah = null;

function ytPasangJatah(hook) {
    ytHookJatah = (hook && typeof hook.cek === 'function') ? hook : null;
}

const YT_JATAH_BEBAS = { bebas: true, sisa: Infinity, batas: Infinity, nama: '' };

function ytCekJatah(bot) {
    if (!ytHookJatah) return YT_JATAH_BEBAS;
    try {
        const j = ytHookJatah.cek(String(bot || ''));
        if (!j || j.bebas) return YT_JATAH_BEBAS;
        return {
            bebas: false,
            sisa: Math.max(0, Number(j.sisa) || 0),
            batas: Math.max(0, Number(j.batas) || 0),
            nama: String(j.nama || 'Free')
        };
    } catch (e) {
        console.error('[YTLIVE] hook cek jatah gagal:', e && e.message);
        return YT_JATAH_BEBAS;
    }
}

function ytPakaiJatah(bot) {
    if (!ytHookJatah || typeof ytHookJatah.pakai !== 'function') return;
    try { ytHookJatah.pakai(String(bot || '')); }
    catch (e) { console.error('[YTLIVE] hook pakai jatah gagal:', e && e.message); }
}

function ytKirimJatah(ws) {
    const j = ytCekJatah(ws.ytBot);
    ytKirim(ws, {
        t: 'yl_jatah',
        bebas: j.bebas,
        sisa: j.bebas ? -1 : j.sisa,
        batas: j.bebas ? -1 : j.batas,
        nama: j.nama
    });
}

// ---------------------------------------------------------------------------
// 2. PENCARIAN & PENGAMBILAN VIDEO
// ---------------------------------------------------------------------------
async function ytAmbilBytes(url, batasByte) {
    const res = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 60000,
        maxContentLength: batasByte,
        maxBodyLength: batasByte,
        headers: { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    });
    return Buffer.from(res.data);
}

const ytThumbCache = new Map();
const YT_THUMB_CACHE_MAKS = 400;

async function ytAmbilThumb(url) {
    if (!url) return null;
    if (ytThumbCache.has(url)) return ytThumbCache.get(url);
    try {
        const buf = await ytAmbilBytes(url, 1.5 * 1024 * 1024);
        const b64 = 'data:image/jpeg;base64,' + buf.toString('base64');
        if (ytThumbCache.size >= YT_THUMB_CACHE_MAKS) ytThumbCache.delete(ytThumbCache.keys().next().value);
        ytThumbCache.set(url, b64);
        return b64;
    } catch (e) {
        ytThumbCache.set(url, null);
        return null;
    }
}

async function ytTanganiCari(ws, q) {
    const query = String(q || '').trim();
    if (!query) return ytKirim(ws, { t: 'yl_err', m: 'Ketik kata kunci dulu.' });
    try {
        const hasil = await searchYoutube(query);
        const list = hasil.slice(0, YT_MAKS_HASIL);
        ws.ytHasil = list;
        ws.ytQuery = query;

        const thumbs = await Promise.all(list.map((v) => ytAmbilThumb(v.thumbnail)));

        ytKirim(ws, {
            t: 'yl_hasil',
            q: query,
            list: list.map((v, i) => ({
                i,
                title: v.title,
                channel: v.channel,
                duration: v.duration,
                views: v.views,
                datePassed: v.datePassed,
                thumb: thumbs[i] || null
            }))
        });
    } catch (e) {
        console.error('[YTLIVE] gagal cari:', e && e.message);
        ytKirim(ws, { t: 'yl_err', m: 'Pencarian gagal. Coba kata kunci lain.' });
    }
}

async function ytAmbilKeBerkas(video, tujuan) {
    const neoxrKey = await getNeoxrKey();
    if (!neoxrKey) {
        throw new Error('API key neoxr belum diisi (apikey.neoxr di config.js).');
    }
    const neo = await youtubeNeoxr(video.url, { quality: '360p', apikey: neoxrKey });
    await ytUnduhUrlKeBerkas(neo.download_url, tujuan, YT_MAKS_UNDUH);
    return { title: neo.title || video.title, sumber: 'neoxr' };
}

function ytUnduhUrlKeBerkas(url, tujuan, maksByte) {
    return new Promise((selesai, gagal) => {
        axios.get(url, {
            responseType: 'stream',
            timeout: 60000,
            headers: { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
        }).then((res) => {
            let total = 0;
            let batal = false;
            const keluar = fs.createWriteStream(tujuan);
            res.data.on('data', (d) => {
                total += d.length;
                if (total > maksByte && !batal) {
                    batal = true;
                    try { res.data.destroy(); } catch (e) { }
                    keluar.destroy();
                    gagal(new Error('maxContentLength: sumber melebihi batas ukuran.'));
                }
            });
            res.data.on('error', (e) => { if (!batal) { batal = true; gagal(e); } });
            keluar.on('error', (e) => { if (!batal) { batal = true; gagal(e); } });
            keluar.on('finish', () => { if (!batal) selesai({ bytes: total }); });
            res.data.pipe(keluar);
        }).catch(gagal);
    });
}

const YT_DIR_TMP = path.join(process.cwd(), '.ytlive-tmp');

function ytBersihkanSisa() {
    try {
        if (!fs.existsSync(YT_DIR_TMP)) return;
        let n = 0;
        for (const nama of fs.readdirSync(YT_DIR_TMP)) {
            fs.rmSync(path.join(YT_DIR_TMP, nama), { recursive: true, force: true });
            n++;
        }
        if (n) console.log(`[YTLIVE] ${n} sisa berkas sementara dibersihkan.`);
    } catch (e) { }
}

const YT_BONGKAH_MENTAH = 90 * 1024;
const YT_ANTREAN_MAKS = 2 * 1024 * 1024;

function ytAlirkan(ws, idx, q, anak, batasByte) {
    return new Promise((selesai, gagal) => {
        let sisa = Buffer.alloc(0);
        let nomor = 0;
        let total = 0;
        let beres = false;
        let dijeda = false;
        let galat = '';

        const tutup = (err) => {
            if (beres) return;
            beres = true;
            try { anak.kill('SIGKILL'); } catch (e) { }
            err ? gagal(err) : selesai({ potongan: nomor, bytes: total });
        };

        const kirimPotongan = (buf) => {
            ytKirim(ws, { t: 'yl_media_bongkah', i: idx, c: nomor++, data: buf.toString('base64'), q });
        };

        anak.stdout.on('data', (d) => {
            if (beres) return;
            if (ws.readyState !== 1) return tutup(new Error('Kartu menutup sambungan.'));

            total += d.length;
            if (total > batasByte) return tutup(new Error('maxContentLength: aliran melebihi batas ukuran.'));

            sisa = sisa.length ? Buffer.concat([sisa, d]) : d;

            while (sisa.length >= YT_BONGKAH_MENTAH) {
                const ambil = Math.floor(YT_BONGKAH_MENTAH / 3) * 3;
                kirimPotongan(sisa.subarray(0, ambil));
                sisa = sisa.subarray(ambil);
            }

            if (ws.antreanTulis && !dijeda && ws.antreanTulis() > YT_ANTREAN_MAKS) {
                dijeda = true;
                anak.stdout.pause();
                const periksa = () => {
                    if (beres) return;
                    if (ws.readyState !== 1) return tutup(new Error('Kartu menutup sambungan.'));
                    if (ws.antreanTulis() <= YT_ANTREAN_MAKS / 2) {
                        dijeda = false;
                        anak.stdout.resume();
                    } else {
                        setTimeout(periksa, 30);
                    }
                };
                setTimeout(periksa, 30);
            }
        });

        anak.stderr.on('data', (d) => { galat += d.toString(); if (galat.length > 4000) galat = galat.slice(-4000); });
        anak.on('error', (e) => tutup(new Error(`ffmpeg tidak bisa dijalankan: ${e.message}`)));
        anak.on('close', (kode) => {
            if (beres) return;
            if (kode !== 0) {
                const baris = galat.trim().split('\n').filter(Boolean).pop() || `kode ${kode}`;
                return tutup(new Error(`ffmpeg gagal: ${baris}`));
            }
            if (sisa.length) kirimPotongan(sisa);
            if (!total) return tutup(new Error('ffmpeg tidak mengeluarkan data apa pun.'));
            tutup(null);
        });
    });
}

async function ytTanganiMedia(ws, i, q) {
    const idx = Number(i);
    const daftar = ws.ytHasil || [];
    const video = daftar[idx];
    if (!video) return ytKirim(ws, { t: 'yl_err', m: 'Video tidak ditemukan, coba cari ulang.' });

    if (ws.ytSibuk) {
        return ytKirim(ws, { t: 'yl_err', i: idx, q, m: 'Masih ada video yang sedang diunduh. Tunggu sampai selesai.' });
    }

    const kunciVideo = String(video.url || ('#' + idx));
    const sudahDibayar = !!(ws.ytDibayar && ws.ytDibayar.has(kunciVideo));

    const jatah = ytCekJatah(ws.ytBot);
    if (!jatah.bebas && !sudahDibayar && jatah.sisa <= 0) {
        return ytKirim(ws, { t: 'yl_limit', i: idx, q, batas: jatah.batas, nama: jatah.nama });
    }

    ws.ytSibuk = true;
    fs.mkdirSync(YT_DIR_TMP, { recursive: true });
    const dir = fs.mkdtempSync(path.join(YT_DIR_TMP, 'v-'));
    const berkas = path.join(dir, 'sumber.mp4');
    const bersihkan = () => { try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) { } };

    ytKirim(ws, { t: 'yl_media_proses', i: idx, q });
    try {
        let detik = durasiKeDetik(video.duration);
        if (detik && detik > YT_MAKS_DETIK) {
            bersihkan();
            return ytKirim(ws, {
                t: 'yl_err',
                i: idx,
                m: `Video ${detikKeTeks(detik)} - batasnya ${Math.round(YT_MAKS_DETIK / 60)} menit. Coba video lain.`
            });
        }

        const sumber = await ytAmbilKeBerkas(video, berkas);
        const ukuran = fs.statSync(berkas).size;

        if (!jatah.bebas && !sudahDibayar) {
            ytPakaiJatah(ws.ytBot);
            if (!ws.ytDibayar) ws.ytDibayar = new Set();
            ws.ytDibayar.add(kunciVideo);
            ytKirimJatah(ws);
        }

        let opsi, mutu;
        if (ukuran <= YT_AMBANG_PADAT) {
            opsi = { salin: true };
            mutu = '360p';
        } else {
            if (!detik) {
                console.log(`[YTLIVE] durasi "${video.duration}" tidak terbaca, dibaca dari berkasnya.`);
                detik = await durasiDariBerkas(berkas);
            }
            if (!detik) throw new Error('Durasi video tidak terbaca dari berkasnya, tidak bisa hitung bitrate.');
            const anggaran = hitungAnggaran(detik, YT_MAKS_KIRIM);
            opsi = { salin: false, videoKbps: anggaran.videoKbps, tinggi: anggaran.tinggi };
            mutu = `${anggaran.tinggi}p`;
            console.log(`[YTLIVE] ${Math.round(ukuran / 1048576)} MB (${sumber.sumber}), dialirkan sambil dipadatkan ke ${anggaran.tinggi}p @ ${anggaran.videoKbps}kbps ...`);
        }

        ytKirim(ws, {
            t: 'yl_media_meta',
            i: idx,
            mime: 'video/mp4; codecs="avc1.42E01E,mp4a.40.2"',
            title: sumber.title || video.title,
            channel: video.channel,
            quality: mutu,
            alir: true,
            q
        });

        let lepasSlot = null;
        if (!opsi.salin) {
            const antrean = statusFfmpeg();
            if (antrean.jalan >= antrean.maks) {
                console.log(`[YTLIVE] menunggu slot encode (${antrean.jalan}/${antrean.maks} jalan, ${antrean.antre} mengantre) ...`);
            }
            lepasSlot = await ambilSlotFfmpeg();
        }

        try {
            const anak = alirkanFmp4(berkas, opsi);
            const hasil = await ytAlirkan(ws, idx, q, anak, YT_MAKS_KIRIM);
            ytKirim(ws, { t: 'yl_media_selesai', i: idx, total: hasil.potongan, q });
            console.log(`[YTLIVE] selesai: ${hasil.potongan} potongan, ${Math.round(hasil.bytes / 1048576)} MB`);
        } finally {
            if (lepasSlot) lepasSlot();
        }
    } catch (e) {
        console.error('[YTLIVE] gagal ambil video:', e && e.message);
        const kelewatBatas = /maxContentLength|maxBodyLength|terlalu panjang/i.test(String(e && e.message));
        ytKirim(ws, {
            t: 'yl_err',
            i: idx,
            m: kelewatBatas ? 'Video ini kepanjangan/kebesaran buat diputar di kartu. Coba video lain.' : 'Video gagal diambil. Coba video lain.'
        });
    } finally {
        ws.ytSibuk = false;
        bersihkan();
    }
}

// ---------------------------------------------------------------------------
// 3. KUNCI SESI
// ---------------------------------------------------------------------------
const YT_UMUR_KUNCI = 30 * 60 * 1000;
const YT_UMUR_KUNCI_BEBAS = 24 * 60 * 60 * 1000;
const ytKunci = new Map();

function ytBuatKunci(botNumber, opts) {
    ytBersihkanKunci();
    const bebas = !!(opts && opts.bebas);
    const kunci = crypto.randomBytes(9).toString('base64url');
    ytKunci.set(kunci, {
        bot: String(botNumber || ''),
        sampai: bebas ? 0 : Date.now() + YT_UMUR_KUNCI,
        buang: Date.now() + (bebas ? YT_UMUR_KUNCI_BEBAS : YT_UMUR_KUNCI)
    });
    return kunci;
}

function ytBersihkanKunci() {
    const now = Date.now();
    for (const [k, v] of ytKunci) if ((v.buang || v.sampai) < now) ytKunci.delete(k);
}

function ytPakaiKunci(ws, kunci) {
    const v = ytKunci.get(String(kunci || ''));
    if (!v || (v.sampai && v.sampai < Date.now())) {
        ytKirim(ws, { t: 'yl_kunci_habis' });
        try { ws.close(); } catch (e) { }
        return;
    }
    ws.ytBot = v.bot;
    ws.ytSampai = v.sampai;
    ytKirim(ws, { t: 'yl_kunci_ok', sampai: v.sampai });
    ytKirimJatah(ws);
}

// ---------------------------------------------------------------------------
// 4. PENERUS PESAN
// ---------------------------------------------------------------------------
function ytTangani(ws, d) {
    if (d.t === 'yl_kunci') return ytPakaiKunci(ws, d.kunci);
    if (d.t === 'yl_cari') return void ytTanganiCari(ws, d.q);
    if (d.t === 'yl_media') return void ytTanganiMedia(ws, d.i, d.q);
    if (d.t === 'yl_ping') return ytKirim(ws, { t: 'yl_pong', ts: d.ts });
}

// ---------------------------------------------------------------------------
// 5. NYALAKAN SERVER
// ---------------------------------------------------------------------------
let ytAktifFlag = false;
let ytStatus = 'belum';
let ytAntreSiap = [];
const ytSemuaSoket = new Set();

function ytTetapkanStatus(st) {
    if (ytStatus !== 'belum') return;
    ytStatus = st;
    ytAktifFlag = (st === 'aktif');
    const antre = ytAntreSiap;
    ytAntreSiap = [];
    for (const fn of antre) { try { fn(ytAktifFlag); } catch (e) { } }
}

function ytNyalakanServer() {
    const srv = http.createServer((req, res) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        if (String(req.url || '/').split('?')[0] === '/ytlive/ping') {
            res.writeHead(200, { 'Content-Type': 'text/plain' });
            res.end('YTLIVE ok');
        } else { res.writeHead(404); res.end(); }
    });

    srv.on('upgrade', (req, socket) => {
        const kunci = req.headers['sec-websocket-key'];
        if (!kunci || String(req.headers['upgrade'] || '').toLowerCase() !== 'websocket') {
            try { socket.destroy(); } catch (e) { }
            return;
        }
        const terima = crypto.createHash('sha1').update(kunci + WS_MAGIC).digest('base64');
        socket.write(
            'HTTP/1.1 101 Switching Protocols\r\n' +
            'Upgrade: websocket\r\n' +
            'Connection: Upgrade\r\n' +
            'Sec-WebSocket-Accept: ' + terima + '\r\n\r\n'
        );
        socket.setNoDelay(true);

        const ws = ytSoket(socket);
        ytSemuaSoket.add(ws);
        ws.pesanPerDetik = 0;

        ws.on('message', (teks) => {
            ws.pesanPerDetik++;
            let d;
            try { d = JSON.parse(teks); } catch (e) { return; }
            if (!d || typeof d.t !== 'string' || d.t.slice(0, 3) !== 'yl_') return;
            try { ytTangani(ws, d); }
            catch (e) {
                console.error('[YTLIVE] error:', e && e.message);
                ytKirim(ws, { t: 'yl_err', m: 'Ada yang salah di server. Coba lagi.' });
            }
        });

        ws.on('close', () => { ytSemuaSoket.delete(ws); });
    });

    srv.on('error', (e) => {
        if (e && e.code === 'EADDRINUSE') {
            console.log('⚠️ [YTLIVE] port ' + YTLIVE_PORT + ' sudah dipakai — fitur ytlive mati, fitur lain tetap jalan.');
        } else {
            console.log('⚠️ [YTLIVE] server gagal:', e && e.message);
        }
        ytTetapkanStatus('gagal');
    });

    srv.listen(YTLIVE_PORT, () => {
        console.log('▶️ [YTLIVE] server online siap di port ' + YTLIVE_PORT);
        ytTetapkanStatus('aktif');
    });
    return srv;
}

function ytDetak() {
    const jantung = setInterval(() => {
        for (const ws of ytSemuaSoket) {
            if (ws.alive === false) { ws.terminate(); ytSemuaSoket.delete(ws); continue; }
            ws.alive = false;
            ws.ping();
        }
    }, 30000);

    const perDetik = setInterval(() => {
        const now = Date.now();
        for (const ws of ytSemuaSoket) {
            if (ws.pesanPerDetik > 200) { ws.close(1008); ytSemuaSoket.delete(ws); }
            ws.pesanPerDetik = 0;
        }
        for (const ws of ytSemuaSoket) {
            if (ws.ytSampai && ws.ytSampai < now) {
                ytKirim(ws, { t: 'yl_kunci_habis' });
                try { ws.close(); } catch (e) { }
                ytSemuaSoket.delete(ws);
            }
        }
        ytBersihkanKunci();
    }, 1000);

    if (jantung.unref) jantung.unref();
    if (perDetik.unref) perDetik.unref();
}

let ytSudahNyala = false;

function nyalakan() {
    if (ytSudahNyala) return;
    ytSudahNyala = true;
    ytNyalakanServer();
    ytDetak();
    ytBersihkanSisa();

    getNeoxrKey().then(key => {
        if (!key) console.error('[YTLIVE] apikey.neoxr belum diisi di config.js - .ytlive tidak bisa mengambil video.');
        else console.log('[YTLIVE] apikey.neoxr terbaca dari config.js');
    }).catch(() => {});
}

function saatSiap(fn) {
    if (ytStatus !== 'belum') return fn(ytAktifFlag);
    ytAntreSiap.push(fn);
}

module.exports = {
    nyalakan,
    buatKunci: ytBuatKunci,
    pasangJatah: ytPasangJatah,
    saatSiap,
    aktif: () => ytAktifFlag,
    PORT: YTLIVE_PORT
};
    },
    "livenet/ytlive-tunnel": (module, exports, require) => {
// ===========================================================================
// YTLIVE TUNNEL — diambil PERSIS dari lib/ytlive-tunnel.js sairi
// Hanya ganti: require -> import, module.exports -> export
// Logika TIDAK DIUBAH SAMA SEKALI
// ===========================================================================

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');
const { pastikanCloudflared } = require('livenet/cloudflared');
const relay = require('livenet/ytlive-relay');


const URL_FILE = path.join(process.cwd(), 'database', 'livenet-ytlive-tunnel-url.txt');

let proses = null;
let sudahNyala = false;
let gagalBeruntun = 0;
const MAKS_GAGAL = 3;

function jadwalUlang() {
    if (gagalBeruntun >= MAKS_GAGAL) {
        console.log('⛔ [YTLIVE] tunnel gagal ' + MAKS_GAGAL + ' kali beruntun — menyerah. ' +
            'Perbaiki cloudflared lalu restart bot.');
        return;
    }
    setTimeout(jalankanCloudflared, 5000);
}

async function cariCloudflared() {
    const kandidat = [
        process.env.CLOUDFLARED_BIN,
        path.join(os.homedir(), 'cloudflared'),
        path.join(os.homedir(), '.local', 'bin', 'cloudflared'),
        path.join(process.cwd(), 'cloudflared'),
        path.join(process.cwd(), 'bin', 'cloudflared'),
        '/usr/local/bin/cloudflared',
        '/usr/bin/cloudflared',
        '/usr/sbin/cloudflared',
        '/snap/bin/cloudflared',
        '/opt/cloudflared/cloudflared',
        '/opt/homebrew/bin/cloudflared'
    ].filter(Boolean);

    for (const j of kandidat) {
        try { if (fs.existsSync(j)) return j; } catch (e) { }
    }
    for (const dir of String(process.env.PATH || '').split(path.delimiter)) {
        if (!dir) continue;
        const j = path.join(dir, 'cloudflared');
        try { if (fs.existsSync(j)) return j; } catch (e) { }
    }
    // Auto-download jika tidak ketemu
    return await pastikanCloudflared();
}

function tempatDicari() {
    return [
        'CLOUDFLARED_BIN (env)',
        '~/cloudflared', '~/.local/bin/cloudflared',
        './cloudflared', './bin/cloudflared',
        '/usr/local/bin', '/usr/bin', '/usr/sbin', '/snap/bin', '/opt/cloudflared', '/opt/homebrew/bin',
        'semua folder di PATH'
    ].join(', ');
}

function pastikanBisaDieksekusi(bin) {
    try { fs.accessSync(bin, fs.constants.X_OK); return true; } catch (e) { }
    try {
        fs.chmodSync(bin, 0o755);
        fs.accessSync(bin, fs.constants.X_OK);
        console.log('🔧 [YTLIVE] izin eksekusi cloudflared diperbaiki (chmod +x)');
        return true;
    } catch (e) {
        console.log('⚠️ [YTLIVE] cloudflared ada di ' + bin + ' tapi tidak bisa dieksekusi (' +
            (e && e.code || 'EACCES') + '). Jalankan: chmod +x ' + bin);
        return false;
    }
}

async function jalankanCloudflared() {
    if (proses) return;

    const bin = await cariCloudflared();
    if (!bin) {
        console.log('ℹ️ [YTLIVE] cloudflared tidak ketemu di mesin ini. Dicari di: ' + tempatDicari() + '.\n' +
            '   Pasang cloudflared di node ini, atau tunjuk lokasinya lewat CLOUDFLARED_BIN=/path/ke/cloudflared (environment variable).');
        return;
    }
    if (!pastikanBisaDieksekusi(bin)) return;

    let dapat = false, buf = '';
    const mulai = Date.now();
    try {
        proses = spawn(bin, ['tunnel', '--no-autoupdate', '--url', 'http://localhost:' + relay.PORT]);
    } catch (e) {
        console.log('⚠️ [YTLIVE] tunnel gagal dijalankan:', e && e.message);
        proses = null;
        return;
    }

    proses.on('error', (e) => {
        proses = null;
        console.log('⚠️ [YTLIVE] cloudflared gagal dijalankan: ' + (e && e.code || '') + ' ' + (e && e.message || ''));
        if (e && e.code === 'EACCES') console.log('   Perbaiki dengan: chmod +x ' + bin);
        jadwalUlang();
    });

    const baca = (chunk) => {
        buf += chunk.toString();
        if (buf.length > 40000) buf = buf.slice(-8000);
        const m = buf.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/);
        if (m && !dapat) {
            dapat = true;
            const u = 'wss://' + m[0].slice('https://'.length);
            try {
                fs.mkdirSync(path.dirname(URL_FILE), { recursive: true });
                fs.writeFileSync(URL_FILE, u);
            } catch (e) { }
            console.log('✅ [YTLIVE] tunnel aktif: ' + u);
        }
    };
    proses.stdout.on('data', baca);
    proses.stderr.on('data', baca);

    proses.on('exit', () => {
        proses = null;
        if (dapat) gagalBeruntun = 0;
        else if (Date.now() - mulai < 5000) gagalBeruntun++;
        try { fs.unlinkSync(URL_FILE); } catch (e) { }
        console.log('🔁 [YTLIVE] tunnel mati.');
        jadwalUlang();
    });

    setTimeout(() => {
        if (proses && !dapat) { try { proses.kill(); } catch (e) { } }
    }, 60000);
}

function nyalakan() {
    if (sudahNyala) return;
    sudahNyala = true;
    if (String(process.env.YTLIVE_TUNNEL || '').toLowerCase() === 'off') {
        console.log('ℹ️ [YTLIVE] YTLIVE_TUNNEL=off — tunnel tidak dinyalakan dari sini');
        return;
    }
    relay.saatSiap((aktif) => {
        if (!aktif) {
            console.log('⚠️ [YTLIVE] server ytlive tidak jalan — tunnel dilewati');
            return;
        }
        jalankanCloudflared();
    });
}

function bacaRelayYt() {
    if (!relay.aktif()) return '';
    try {
        const u = fs.readFileSync(URL_FILE, 'utf8').trim();
        return /^wss?:\/\//.test(u) ? u : '';
    } catch (e) { return ''; }
}

module.exports = { nyalakan, bacaRelayYt, URL_FILE };
    },
    "livenet/pinlive-relay": (module, exports, require) => {
// ===========================================================================
// PINLIVE — server relay
//
// Pola dan mesin WebSocket-nya SENGAJA disalin dari lib/catur-relay.js dan
// lib/musiklive-relay.js (server HTTP+WS tulisan sendiri di atas modul bawaan
// Node, tanpa paket "ws") supaya konsisten dengan cara kartu game lain di bot
// ini menembus sandbox WhatsApp: kartu HTML richResponseMessage TIDAK BISA
// fetch/<img>/<video> ke URL luar (lihat catatan di scrape/richhtml.js) —
// satu-satunya jalan keluar yang terbukti jalan adalah WebSocket. Makanya
// thumbnail & gambar penuh Pinterest di sini TIDAK dikirim sebagai link,
// tapi dipompa sebagai potongan base64 lewat socket yang sama, lalu dirakit
// jadi Blob di kartunya sendiri.
//
// Beda dengan Spotifylive: tidak ada ruangan "dengerin bareng" - Pinlive
// murni sesi pencarian+lihat gambar sendirian, jadi bagian broadcast/room
// dari musiklive-relay.js sengaja tidak disalin ke sini.
//
// Kalau port-nya bentrok, fitur ini mati sendiri dan bot tetap jalan normal —
// modul ini tidak pernah melempar error ke pemanggilnya.
//
// Dipakai index.js:  require('./lib/pinlive-relay').nyalakan();
// ===========================================================================

const http = require('http');
const pinHttp = http;
const crypto = require('crypto');
const pinCrypto = crypto;
const { EventEmitter: pinEventsEmitter } = require('events');
const pinEvents = { EventEmitter: pinEventsEmitter };
const axios = require('axios');
const { searchPinterest } = require('livenet/pinterest');

const PINLIVE_PORT = parseInt(process.env.PINLIVE_PORT || '3941', 10);
const PIN_MAKS_PESAN = 400 * 1024;
const PIN_BONGKAH = 120 * 1024;              // ukuran satu potongan base64 gambar/video
const PIN_MAKS_GAMBAR = 8 * 1024 * 1024;     // batas ukuran gambar "orig" yang mau diambil
const PIN_MAKS_VIDEO = 20 * 1024 * 1024;     // batas ukuran video pin yang mau diambil
const PIN_MAKS_HASIL = 20;                   // sama dengan limit dipakai command .pin biasa
const PIN_BATAS_TOTAL_SESI = 200;            // batas atas total pin yang boleh ditumpuk per sesi gulir tanpa henti

// ---------------------------------------------------------------------------
// 1. SERVER WEBSOCKET MINIMAL (RFC 6455) — identik pola dengan catur-relay.js
// ---------------------------------------------------------------------------

const WS_MAGIC = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

function pinBingkai(opcode, payload) {
    const len = payload.length;
    let head;
    if (len < 126) {
        head = Buffer.allocUnsafe(2);
        head[1] = len;
    } else if (len < 65536) {
        head = Buffer.allocUnsafe(4);
        head[1] = 126;
        head.writeUInt16BE(len, 2);
    } else {
        head = Buffer.allocUnsafe(10);
        head[1] = 127;
        head.writeUInt32BE(0, 2);
        head.writeUInt32BE(len, 6);
    }
    head[0] = 0x80 | opcode;
    return Buffer.concat([head, payload]);
}

/** Bungkus satu koneksi TCP jadi objek mirip soket ws: .send/.close/.on */
function pinSoket(socket) {
    const ws = new pinEvents.EventEmitter();
    ws.readyState = 1;
    ws.alive = true;

    let sisa = Buffer.alloc(0);
    let fragOp = 0;
    let fragBuf = [];
    let fragLen = 0;

    const tulis = (buf) => { try { if (!socket.destroyed) socket.write(buf); } catch (e) { } };

    ws.send = (teks) => {
        if (ws.readyState !== 1) return;
        tulis(pinBingkai(1, Buffer.from(String(teks), 'utf8')));
    };
    ws.ping = () => { if (ws.readyState === 1) tulis(pinBingkai(9, Buffer.alloc(0))); };
    ws.close = (kode) => {
        if (ws.readyState !== 1) return;
        const p = Buffer.allocUnsafe(2);
        p.writeUInt16BE(kode || 1000, 0);
        tulis(pinBingkai(8, p));
        ws.readyState = 3;
        try { socket.end(); } catch (e) { }
    };
    ws.terminate = () => { ws.readyState = 3; try { socket.destroy(); } catch (e) { } };

    const tutupPaksa = (kode) => { try { ws.close(kode); } catch (e) { } ws.terminate(); };

    const pesanUtuh = (opcode, data) => {
        if (opcode === 1) ws.emit('message', data.toString('utf8'));
    };

    socket.on('data', (chunk) => {
        sisa = sisa.length ? Buffer.concat([sisa, chunk]) : chunk;

        while (true) {
            if (sisa.length < 2) break;
            const b0 = sisa[0], b1 = sisa[1];
            const fin = (b0 & 0x80) !== 0;
            const opcode = b0 & 0x0f;
            const bermask = (b1 & 0x80) !== 0;
            let len = b1 & 0x7f;
            let off = 2;

            if (len === 126) {
                if (sisa.length < 4) break;
                len = sisa.readUInt16BE(2); off = 4;
            } else if (len === 127) {
                if (sisa.length < 10) break;
                if (sisa.readUInt32BE(2) !== 0) return tutupPaksa(1009);
                len = sisa.readUInt32BE(6); off = 10;
            }

            if (len > PIN_MAKS_PESAN) return tutupPaksa(1009);
            if (!bermask) return tutupPaksa(1002);
            if (sisa.length < off + 4) break;

            const total = off + 4 + len;
            if (sisa.length < total) break;

            const mask = sisa.slice(off, off + 4);
            const mentah = sisa.slice(off + 4, total);
            const data = Buffer.allocUnsafe(len);
            for (let i = 0; i < len; i++) data[i] = mentah[i] ^ mask[i & 3];
            sisa = sisa.slice(total);

            if (opcode === 8) return tutupPaksa(1000);
            if (opcode === 9) { tulis(pinBingkai(10, data)); continue; }
            if (opcode === 10) { ws.alive = true; continue; }

            if (opcode === 0) {
                if (!fragOp) return tutupPaksa(1002);
                fragLen += len;
                if (fragLen > PIN_MAKS_PESAN) return tutupPaksa(1009);
                fragBuf.push(data);
                if (fin) {
                    const gabung = Buffer.concat(fragBuf, fragLen);
                    const op = fragOp;
                    fragOp = 0; fragBuf = []; fragLen = 0;
                    pesanUtuh(op, gabung);
                }
                continue;
            }

            if (opcode === 1 || opcode === 2) {
                if (fin) { pesanUtuh(opcode, data); continue; }
                fragOp = opcode; fragBuf = [data]; fragLen = len;
                continue;
            }

            return tutupPaksa(1002);
        }
    });

    const selesai = () => {
        if (ws.readyState === 3 && ws.sudahTutup) return;
        ws.sudahTutup = true;
        ws.readyState = 3;
        ws.emit('close');
    };
    socket.on('close', selesai);
    socket.on('end', selesai);
    socket.on('error', () => { try { socket.destroy(); } catch (e) { } selesai(); });

    return ws;
}

function pinKirim(ws, obj) {
    try { ws.send(JSON.stringify(obj)); } catch (e) { }
}

// ---------------------------------------------------------------------------
// 2. PENCARIAN & PENGAMBILAN GAMBAR
// ---------------------------------------------------------------------------

async function pinAmbilBytes(url, batasByte) {
    const res = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 45000,
        maxContentLength: batasByte,
        maxBodyLength: batasByte,
        headers: { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    });
    return Buffer.from(res.data);
}

// Thumbnail grid dikirim langsung sebagai data URI (kecil, ~236px) - tidak
// perlu dipotong-potong seperti gambar penuh. Dicache per URL biar pencarian
// ulang kata kunci yang sama tidak menarik ulang gambar yang sudah pernah
// diambil.
const pinThumbCache = new Map();
const PIN_THUMB_CACHE_MAKS = 400;

async function pinAmbilThumb(url) {
    if (!url) return null;
    if (pinThumbCache.has(url)) return pinThumbCache.get(url);
    try {
        const buf = await pinAmbilBytes(url, 1.5 * 1024 * 1024);
        const b64 = 'data:image/jpeg;base64,' + buf.toString('base64');
        if (pinThumbCache.size >= PIN_THUMB_CACHE_MAKS) pinThumbCache.delete(pinThumbCache.keys().next().value);
        pinThumbCache.set(url, b64);
        return b64;
    } catch (e) {
        pinThumbCache.set(url, null);
        return null;
    }
}

// Saran tag di bawah kolom cari. Pinterest tidak selalu membocorkan daftar
// "related searches" yang stabil lewat endpoint yang dipakai di sini, jadi
// dibikin heuristik dari kata kuncinya sendiri - bukan hasil scrape asli.
function pinSaranTag(query) {
    const q = String(query || '').trim();
    if (!q) return [];
    const dasar = q.split(/\s+/)[0];
    return [`${q} aesthetic`, `${q} wallpaper`, `${q} hd`, `${dasar} art`].slice(0, 4);
}

async function pinTanganiCari(ws, q) {
    const query = String(q || '').trim();
    if (!query) return pinKirim(ws, { t: 'pl_err', m: 'Ketik kata kunci dulu.' });
    try {
        const hasil = await searchPinterest(query, { limit: PIN_MAKS_HASIL });
        if (!hasil.result.length) {
            return pinKirim(ws, { t: 'pl_kosong', q: query });
        }

        // Simpan hasil mentah di soket ini - dipakai lagi waktu kartu minta
        // gambar penuh/unduh berdasarkan index, tanpa perlu cari ulang.
        ws.pinHasil = hasil.result;
        ws.pinQuery = query;
        // Token halaman lanjutan + daftar id yang sudah pernah dikirim -
        // keduanya dipakai pinTanganiLanjut() di bawah waktu kartu gulir
        // sampai bawah dan minta batch pin berikutnya buat kata kunci yang
        // sama (lihat pl_lanjut).
        ws.pinBookmark = hasil.bookmark || null;
        ws.pinIdSet = new Set(hasil.result.map((p) => p.id).filter(Boolean));

        const thumbs = await Promise.all(hasil.result.map((p) => pinAmbilThumb(p.thumb)));

        pinKirim(ws, {
            t: 'pl_hasil',
            q: query,
            tags: pinSaranTag(query),
            // Kartu pakai ini buat tahu boleh tidaknya auto-muat lagi waktu
            // gulir sampai bawah tanpa perlu nunggu satu percobaan pl_lanjut
            // gagal dulu.
            habis: !ws.pinBookmark,
            list: hasil.result.map((p, i) => ({
                i,
                title: p.title,
                pinner: p.pinner,
                link: p.link,
                domain: p.domain,
                thumb: thumbs[i] || null,
                // Cuma penanda ada/tidaknya video (boolean) - URL video
                // aslinya TIDAK dikirim ke kartu, tetap disimpan di
                // ws.pinHasil server-side, baru diambil pas kartu minta
                // media index ini (sama pola dengan gambar "orig").
                video: !!p.video
            }))
        });
    } catch (e) {
        console.error('[PINLIVE] gagal cari:', e && e.message);
        pinKirim(ws, { t: 'pl_err', m: 'Pencarian gagal. Coba kata kunci lain.' });
    }
}

// Dipanggil waktu kartu gulir grid sampai (hampir) bawah dan minta batch pin
// BERIKUTNYA buat kata kunci yang sedang aktif, supaya orangnya tidak
// mentok cuma dapat PIN_MAKS_HASIL foto pertama - persis pola "muat lagi"
// feed Pinterest asli, tapi dipicu otomatis dari gulir kartu (lihat
// cobaMuatLanjut() di sisi HTML/JS kartunya).
async function pinTanganiLanjut(ws, q) {
    const query = String(q || '').trim();
    // Kartu sudah ganti kata kunci lain (atau belum pernah cari sama
    // sekali) selagi pesan ini di jalan - abaikan diam-diam, jangan
    // dianggap error. Sama polanya dengan pemeriksaan d.q di pinTanganiMedia.
    if (!query || query !== ws.pinQuery) return;

    if (!ws.pinBookmark || (ws.pinHasil || []).length >= PIN_BATAS_TOTAL_SESI) {
        return pinKirim(ws, { t: 'pl_habis', q: query });
    }

    try {
        const hasil = await searchPinterest(query, { limit: PIN_MAKS_HASIL, bookmark: ws.pinBookmark });
        // Balasan Pinterest baru sampai setelah kata kuncinya berganti lagi -
        // buang, jangan disentuh ke ws.pinHasil/ws.pinBookmark sama sekali.
        if (query !== ws.pinQuery) return;

        ws.pinBookmark = hasil.bookmark || null;

        const baru = hasil.result.filter((p) => p.id && !ws.pinIdSet.has(p.id));
        if (!baru.length) {
            // Pinterest kadang balikin isinya pin yang sudah pernah dikirim
            // waktu bookmark-nya sudah mepet ujung daftar - dianggap sudah
            // habis daripada kartu nampilin "memuat" terus tanpa hasil baru.
            return pinKirim(ws, { t: 'pl_habis', q: query });
        }

        const offsetMulai = ws.pinHasil.length;
        baru.forEach((p) => ws.pinIdSet.add(p.id));
        ws.pinHasil = ws.pinHasil.concat(baru);

        const thumbs = await Promise.all(baru.map((p) => pinAmbilThumb(p.thumb)));

        pinKirim(ws, {
            t: 'pl_hasil_tambahan',
            q: query,
            habis: !ws.pinBookmark,
            list: baru.map((p, k) => ({
                i: offsetMulai + k,
                title: p.title,
                pinner: p.pinner,
                link: p.link,
                domain: p.domain,
                thumb: thumbs[k] || null,
                video: !!p.video
            }))
        });
    } catch (e) {
        console.error('[PINLIVE] gagal muat lanjutan:', e && e.message);
        pinKirim(ws, { t: 'pl_err', m: 'Gagal memuat foto berikutnya. Coba gulir lagi.' });
    }
}

// Ambil & kirim media (gambar ATAU video) penuh punya satu pin, dipotong
// jadi bongkahan base64 kayak gambar sebelumnya - videonya juga dikirim data
// URI lewat WebSocket yang sama (sandbox kartu WhatsApp tidak bisa <video
// src="https://...">, lihat catatan di kepala file ini).
//
// kind: 'image' | 'video'. Kalau kind video tapi pin ini ternyata tidak
// punya video (atau gagal diambil), otomatis balik ke gambarnya (fallback)
// supaya kartu tetap nampilin sesuatu daripada mentok error - dan kartu
// dikasih tahu lewat flag `fallback:true` biar bisa kasih pesan yang jujur.
async function pinTanganiMedia(ws, i, kind, karenaGagal, q) {
    const idx = Number(i);
    const daftar = ws.pinHasil || [];
    const pin = daftar[idx];
    if (!pin) return pinKirim(ws, { t: 'pl_err', m: 'Pin tidak ditemukan, coba cari ulang.' });

    const mauVideo = kind === 'video' && !!pin.video;
    const fallbackDariVideo = !!karenaGagal || (kind === 'video' && !pin.video);

    if (!mauVideo && !pin.image) {
        return pinKirim(ws, { t: 'pl_err', m: 'Pin ini tidak punya media yang bisa ditampilkan.' });
    }

    const sumber = mauVideo ? pin.video : pin.image;
    const kindAkhir = mauVideo ? 'video' : 'image';
    const mime = mauVideo ? 'video/mp4' : 'image/jpeg';
    const batas = mauVideo ? PIN_MAKS_VIDEO : PIN_MAKS_GAMBAR;

    pinKirim(ws, { t: 'pl_media_proses', i: idx, kind: kindAkhir, q });
    try {
        const buf = await pinAmbilBytes(sumber, batas);
        const b64 = buf.toString('base64');
        const totalBongkah = Math.ceil(b64.length / PIN_BONGKAH) || 1;

        pinKirim(ws, {
            t: 'pl_media_meta',
            i: idx,
            kind: kindAkhir,
            mime,
            title: pin.title,
            pinner: pin.pinner,
            link: pin.link,
            // URL media aslinya, supaya tombol Salin di kartu bisa menyalin
            // alamat foto/video yang SEDANG ditampilkan - bukan cuma link
            // halaman Pinterest-nya. Kalau pin ini jatuh balik dari video ke
            // gambar, yang terkirim otomatis URL gambarnya (ikut `sumber`).
            media: sumber,
            fallback: fallbackDariVideo,
            totalBongkah,
            q
        });

        for (let c = 0; c < totalBongkah; c++) {
            if (ws.readyState !== 1) return;
            pinKirim(ws, { t: 'pl_media_bongkah', i: idx, kind: kindAkhir, c, data: b64.slice(c * PIN_BONGKAH, (c + 1) * PIN_BONGKAH), q });
        }
        pinKirim(ws, { t: 'pl_media_selesai', i: idx, kind: kindAkhir, q });
    } catch (e) {
        console.error('[PINLIVE] gagal ambil media penuh (' + kindAkhir + '):', e && e.message);
        if (mauVideo && pin.image) {
            // Video gagal diambil (mis. link video sudah kedaluwarsa) - coba
            // balik ke gambar biar kartu tidak mentok kosong.
            return pinTanganiMedia(ws, i, 'image', true, q);
        }
        pinKirim(ws, { t: 'pl_err', m: (mauVideo ? 'Video' : 'Gambar') + ' gagal diambil. Coba pin lain.' });
    }
}

// ---------------------------------------------------------------------------
// 3. KUNCI SESI — identik pola dengan Spotifylive (lihat catatan lengkap di
//    lib/musiklive-relay.js). Sengaja Map terpisah, BUKAN dipakai bareng,
//    supaya kunci Pinlive dan Spotifylive tidak bisa saling dipertukarkan.
// ---------------------------------------------------------------------------
const PIN_UMUR_KUNCI = 30 * 60 * 1000;
const PIN_UMUR_KUNCI_BEBAS = 24 * 60 * 60 * 1000;
const pinKunci = new Map(); // kunci -> { bot, sampai, buang }

function pinBuatKunci(botNumber, opts) {
    pinBersihkanKunci();
    const bebas = !!(opts && opts.bebas);
    const kunci = pinCrypto.randomBytes(9).toString('base64url');
    pinKunci.set(kunci, {
        bot: String(botNumber || ''),
        sampai: bebas ? 0 : Date.now() + PIN_UMUR_KUNCI,
        buang: Date.now() + (bebas ? PIN_UMUR_KUNCI_BEBAS : PIN_UMUR_KUNCI)
    });
    return kunci;
}

function pinBersihkanKunci() {
    const now = Date.now();
    for (const [k, v] of pinKunci) if ((v.buang || v.sampai) < now) pinKunci.delete(k);
}

function pinPakaiKunci(ws, kunci) {
    const v = pinKunci.get(String(kunci || ''));
    if (!v || (v.sampai && v.sampai < Date.now())) {
        pinKirim(ws, { t: 'pl_kunci_habis' });
        try { ws.close(); } catch (e) { }
        return;
    }
    ws.pinBot = v.bot;
    ws.pinSampai = v.sampai;
    pinKirim(ws, { t: 'pl_kunci_ok', sampai: v.sampai });
}

// ---------------------------------------------------------------------------
// 4. PENERUS PESAN
// ---------------------------------------------------------------------------

function pinTangani(ws, d) {
    if (d.t === 'pl_kunci') return pinPakaiKunci(ws, d.kunci);
    if (d.t === 'pl_cari') return void pinTanganiCari(ws, d.q);
    if (d.t === 'pl_lanjut') return void pinTanganiLanjut(ws, d.q);
    if (d.t === 'pl_media') return void pinTanganiMedia(ws, d.i, d.kind === 'video' ? 'video' : 'image', false, d.q);
    if (d.t === 'pl_ping') return pinKirim(ws, { t: 'pl_pong', ts: d.ts });
}

// ---------------------------------------------------------------------------
// 5. NYALAKAN SERVER
// ---------------------------------------------------------------------------

let pinAktifFlag = false;
let pinStatus = 'belum';
let pinAntreSiap = [];
const pinSemuaSoket = new Set();

function pinTetapkanStatus(st) {
    if (pinStatus !== 'belum') return;
    pinStatus = st;
    pinAktifFlag = (st === 'aktif');
    const antre = pinAntreSiap;
    pinAntreSiap = [];
    for (const fn of antre) { try { fn(pinAktifFlag); } catch (e) { } }
}

function pinNyalakanServer() {
    const srv = pinHttp.createServer((req, res) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        if (String(req.url || '/').split('?')[0] === '/pinlive/ping') {
            res.writeHead(200, { 'Content-Type': 'text/plain' });
            res.end('PINLIVE ok');
        } else { res.writeHead(404); res.end(); }
    });

    srv.on('upgrade', (req, socket) => {
        const kunci = req.headers['sec-websocket-key'];
        if (!kunci || String(req.headers['upgrade'] || '').toLowerCase() !== 'websocket') {
            try { socket.destroy(); } catch (e) { }
            return;
        }
        const terima = pinCrypto.createHash('sha1').update(kunci + WS_MAGIC).digest('base64');
        socket.write(
            'HTTP/1.1 101 Switching Protocols\r\n' +
            'Upgrade: websocket\r\n' +
            'Connection: Upgrade\r\n' +
            'Sec-WebSocket-Accept: ' + terima + '\r\n\r\n'
        );
        socket.setNoDelay(true);

        const ws = pinSoket(socket);
        pinSemuaSoket.add(ws);
        ws.pesanPerDetik = 0;

        ws.on('message', (teks) => {
            ws.pesanPerDetik++;
            let d;
            try { d = JSON.parse(teks); } catch (e) { return; }
            if (!d || typeof d.t !== 'string' || d.t.slice(0, 3) !== 'pl_') return;
            try { pinTangani(ws, d); }
            catch (e) {
                console.error('[PINLIVE] error:', e && e.message);
                pinKirim(ws, { t: 'pl_err', m: 'Ada yang salah di server. Coba lagi.' });
            }
        });

        ws.on('close', () => { pinSemuaSoket.delete(ws); });
    });

    srv.on('error', (e) => {
        if (e && e.code === 'EADDRINUSE') {
            console.log('⚠️ [PINLIVE] port ' + PINLIVE_PORT + ' sudah dipakai — fitur pin live mati, fitur lain tetap jalan.');
        } else {
            console.log('⚠️ [PINLIVE] server gagal:', e && e.message);
        }
        pinTetapkanStatus('gagal');
    });

    srv.listen(PINLIVE_PORT, () => {
        console.log('📌 [PINLIVE] server online siap di port ' + PINLIVE_PORT);
        pinTetapkanStatus('aktif');
    });
    return srv;
}

function pinDetak() {
    const jantung = setInterval(() => {
        for (const ws of pinSemuaSoket) {
            if (ws.alive === false) { ws.terminate(); pinSemuaSoket.delete(ws); continue; }
            ws.alive = false;
            ws.ping();
        }
    }, 30000);

    const perDetik = setInterval(() => {
        const now = Date.now();
        for (const ws of pinSemuaSoket) {
            if (ws.pesanPerDetik > 200) { ws.close(1008); pinSemuaSoket.delete(ws); }
            ws.pesanPerDetik = 0;
        }
        for (const ws of pinSemuaSoket) {
            if (ws.pinSampai && ws.pinSampai < now) {
                pinKirim(ws, { t: 'pl_kunci_habis' });
                try { ws.close(); } catch (e) { }
                pinSemuaSoket.delete(ws);
            }
        }
        pinBersihkanKunci();
    }, 1000);

    if (jantung.unref) jantung.unref();
    if (perDetik.unref) perDetik.unref();
}

let pinSudahNyala = false;

/** Nyalakan server pin live. Aman dipanggil berkali-kali. */
function nyalakan() {
    if (pinSudahNyala) return;
    pinSudahNyala = true;
    pinNyalakanServer();
    pinDetak();
}

/** Sama polanya dengan catur-relay.js/musiklive-relay.js: tunggu listen() selesai baru jawab. */
function saatSiap(fn) {
    if (pinStatus !== 'belum') return fn(pinAktifFlag);
    pinAntreSiap.push(fn);
}

module.exports = {
    nyalakan,
    buatKunci: pinBuatKunci,
    saatSiap,
    aktif: () => pinAktifFlag,
    PORT: PINLIVE_PORT
};
    },
    "livenet/pinlive-tunnel": (module, exports, require) => {
// ===========================================================================
// PINLIVE — tunnel
//
// Salinan pola dari lib/catur-tunnel.js dan lib/musiklive-tunnel.js,
// disesuaikan buat relay Pinlive (lib/pinlive-relay.js) yang jalan di port
// terpisah. Tidak dibuat satu tunnel gabungan dengan yang lain karena satu
// proses `cloudflared tunnel --url` cuma bisa mengarah ke satu port tujuan —
// jadi tiap relay (catur, musik, pin) punya proses cloudflared dan berkas
// URL-nya masing-masing, tapi semuanya boleh menyala bersamaan tanpa bentrok.
//
// Matikan penyalaan otomatis lewat PINLIVE_TUNNEL=off.
//
// Dipakai index.js:
//   const { bacaRelayPin } = require('./lib/pinlive-tunnel');
// ===========================================================================

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');
const { pastikanCloudflared } = require('livenet/cloudflared');
const relay = require('livenet/pinlive-relay');


const URL_FILE = path.join(process.cwd(), 'database', 'livenet-pinlive-tunnel-url.txt');

let proses = null;
let sudahNyala = false;
let gagalBeruntun = 0;
const MAKS_GAGAL = 3;

function jadwalUlang() {
    if (gagalBeruntun >= MAKS_GAGAL) {
        console.log('⛔ [PINLIVE] tunnel gagal ' + MAKS_GAGAL + ' kali beruntun — menyerah. ' +
            'Perbaiki cloudflared lalu restart bot.');
        return;
    }
    setTimeout(jalankanCloudflared, 5000);
}

async function cariCloudflared() {
    const kandidat = [
        process.env.CLOUDFLARED_BIN,
        path.join(os.homedir(), 'cloudflared'),
        path.join(os.homedir(), '.local', 'bin', 'cloudflared'),
        path.join(process.cwd(), 'cloudflared'),
        path.join(process.cwd(), 'bin', 'cloudflared'),
        '/usr/local/bin/cloudflared',
        '/usr/bin/cloudflared',
        '/usr/sbin/cloudflared',
        '/snap/bin/cloudflared',
        '/opt/cloudflared/cloudflared',
        '/opt/homebrew/bin/cloudflared'
    ].filter(Boolean);

    for (const j of kandidat) {
        try { if (fs.existsSync(j)) return j; } catch (e) { }
    }
    for (const dir of String(process.env.PATH || '').split(path.delimiter)) {
        if (!dir) continue;
        const j = path.join(dir, 'cloudflared');
        try { if (fs.existsSync(j)) return j; } catch (e) { }
    }
    // Auto-download jika tidak ketemu
    return await pastikanCloudflared();
}

/** Ditulis ke log waktu tidak ketemu, biar jelas di mana saja sudah dicari. */
function tempatDicari() {
    return [
        'CLOUDFLARED_BIN (env)',
        '~/cloudflared', '~/.local/bin/cloudflared',
        './cloudflared', './bin/cloudflared',
        '/usr/local/bin', '/usr/bin', '/usr/sbin', '/snap/bin', '/opt/cloudflared', '/opt/homebrew/bin',
        'semua folder di PATH'
    ].join(', ');
}

function pastikanBisaDieksekusi(bin) {
    try { fs.accessSync(bin, fs.constants.X_OK); return true; } catch (e) { }
    try {
        fs.chmodSync(bin, 0o755);
        fs.accessSync(bin, fs.constants.X_OK);
        console.log('🔧 [PINLIVE] izin eksekusi cloudflared diperbaiki (chmod +x)');
        return true;
    } catch (e) {
        console.log('⚠️ [PINLIVE] cloudflared ada di ' + bin + ' tapi tidak bisa dieksekusi (' +
            (e && e.code || 'EACCES') + '). Jalankan: chmod +x ' + bin);
        return false;
    }
}

async function jalankanCloudflared() {
    if (proses) return;

    const bin = await cariCloudflared();
    if (!bin) {
        console.log('ℹ️ [PINLIVE] cloudflared tidak ketemu di mesin ini. Dicari di: ' + tempatDicari() + '.\n' +
            '   Pasang cloudflared di node ini, atau tunjuk lokasinya lewat CLOUDFLARED_BIN=/path/ke/cloudflared (environment variable).');
        return;
    }
    if (!pastikanBisaDieksekusi(bin)) return;

    let dapat = false, buf = '';
    const mulai = Date.now();
    try {
        proses = spawn(bin, ['tunnel', '--no-autoupdate', '--url', 'http://localhost:' + relay.PORT]);
    } catch (e) {
        console.log('⚠️ [PINLIVE] tunnel gagal dijalankan:', e && e.message);
        proses = null;
        return;
    }

    proses.on('error', (e) => {
        proses = null;
        console.log('⚠️ [PINLIVE] cloudflared gagal dijalankan: ' + (e && e.code || '') + ' ' + (e && e.message || ''));
        if (e && e.code === 'EACCES') console.log('   Perbaiki dengan: chmod +x ' + bin);
        jadwalUlang();
    });

    const baca = (chunk) => {
        buf += chunk.toString();
        if (buf.length > 40000) buf = buf.slice(-8000);
        const m = buf.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/);
        if (m && !dapat) {
            dapat = true;
            const u = 'wss://' + m[0].slice('https://'.length);
            try {
                fs.mkdirSync(path.dirname(URL_FILE), { recursive: true });
                fs.writeFileSync(URL_FILE, u);
            } catch (e) { }
            console.log('✅ [PINLIVE] tunnel aktif: ' + u);
        }
    };
    proses.stdout.on('data', baca);
    proses.stderr.on('data', baca);

    proses.on('exit', () => {
        proses = null;
        if (dapat) gagalBeruntun = 0;
        else if (Date.now() - mulai < 5000) gagalBeruntun++;
        // Alamat lama HARUS dihapus. Kalau berkasnya dibiarkan, kartu .spotifylive
        // berikutnya tetap menanam alamat tunnel yang sudah mati, dan pemakainya
        // cuma melihat "Menyambung ke server..." tanpa penjelasan. Lebih baik
        // kartunya jujur bilang servernya mati.
        try { fs.unlinkSync(URL_FILE); } catch (e) { }
        console.log('🔁 [PINLIVE] tunnel mati.');
        jadwalUlang();
    });

    setTimeout(() => {
        if (proses && !dapat) { try { proses.kill(); } catch (e) { } }
    }, 60000);
}

function nyalakan() {
    if (sudahNyala) return;
    sudahNyala = true;
    if (String(process.env.PINLIVE_TUNNEL || '').toLowerCase() === 'off') {
        console.log('ℹ️ [PINLIVE] PINLIVE_TUNNEL=off — tunnel tidak dinyalakan dari sini');
        return;
    }
    relay.saatSiap((aktif) => {
        if (!aktif) {
            console.log('⚠️ [PINLIVE] server pin live tidak jalan — tunnel dilewati');
            return;
        }
        jalankanCloudflared();
    });
}

/** URL relay buat ditanam di kartu, dibaca ulang tiap kartu dibuat (lihat catatan sama di catur-tunnel.js). */
function bacaRelayPin() {
    if (!relay.aktif()) return '';
    try {
        const u = fs.readFileSync(URL_FILE, 'utf8').trim();
        return /^wss?:\/\//.test(u) ? u : '';
    } catch (e) { return ''; }
}

module.exports = { nyalakan, bacaRelayPin, URL_FILE };
    },
    "livenet/spotifylive-relay": (module, exports, require) => {
// ===========================================================================
// SPOTIFYLIVE RELAY — diambil PERSIS dari lib/musiklive-relay.js sairi
// Hanya ganti: require -> import, module.exports -> export
// Logika TIDAK DIUBAH SAMA SEKALI
// ===========================================================================

const http = require('http');
const crypto = require('crypto');
const { EventEmitter } = require('events');
const axios = require('axios');
const { searchTrack, downloadTrack } = require('livenet/spotify');

const MUSIK_PORT = parseInt(process.env.MUSIK_PORT || '3940', 10);
const MUSIK_MAKS_PESAN = 400 * 1024;
const MUSIK_BONGKAH = 120 * 1024;
const MUSIK_MAKS_ANGGOTA = 10;
const MUSIK_JEDA_KOSONG = 300000;
const MUSIK_MAKS_AUDIO = 15 * 1024 * 1024;

// ---------------------------------------------------------------------------
// 1. SERVER WEBSOCKET MINIMAL (RFC 6455)
// ---------------------------------------------------------------------------

const WS_MAGIC = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

function musikBingkai(opcode, payload) {
    const len = payload.length;
    let head;
    if (len < 126) {
        head = Buffer.allocUnsafe(2);
        head[1] = len;
    } else if (len < 65536) {
        head = Buffer.allocUnsafe(4);
        head[1] = 126;
        head.writeUInt16BE(len, 2);
    } else {
        head = Buffer.allocUnsafe(10);
        head[1] = 127;
        head.writeUInt32BE(0, 2);
        head.writeUInt32BE(len, 6);
    }
    head[0] = 0x80 | opcode;
    return Buffer.concat([head, payload]);
}

function musikSoket(socket) {
    const ws = new EventEmitter();
    ws.readyState = 1;
    ws.alive = true;

    let sisa = Buffer.alloc(0);
    let fragOp = 0;
    let fragBuf = [];
    let fragLen = 0;

    const tulis = (buf) => { try { if (!socket.destroyed) socket.write(buf); } catch (e) { } };

    ws.send = (teks) => {
        if (ws.readyState !== 1) return;
        tulis(musikBingkai(1, Buffer.from(String(teks), 'utf8')));
    };
    ws.ping = () => { if (ws.readyState === 1) tulis(musikBingkai(9, Buffer.alloc(0))); };
    ws.close = (kode) => {
        if (ws.readyState !== 1) return;
        const p = Buffer.allocUnsafe(2);
        p.writeUInt16BE(kode || 1000, 0);
        tulis(musikBingkai(8, p));
        ws.readyState = 3;
        try { socket.end(); } catch (e) { }
    };
    ws.terminate = () => { ws.readyState = 3; try { socket.destroy(); } catch (e) { } };

    const tutupPaksa = (kode) => { try { ws.close(kode); } catch (e) { } ws.terminate(); };

    const pesanUtuh = (opcode, data) => {
        if (opcode === 1) ws.emit('message', data.toString('utf8'));
    };

    socket.on('data', (chunk) => {
        sisa = sisa.length ? Buffer.concat([sisa, chunk]) : chunk;
        while (true) {
            if (sisa.length < 2) break;
            const b0 = sisa[0], b1 = sisa[1];
            const fin = (b0 & 0x80) !== 0;
            const opcode = b0 & 0x0f;
            const bermask = (b1 & 0x80) !== 0;
            let len = b1 & 0x7f;
            let off = 2;

            if (len === 126) {
                if (sisa.length < 4) break;
                len = sisa.readUInt16BE(2); off = 4;
            } else if (len === 127) {
                if (sisa.length < 10) break;
                if (sisa.readUInt32BE(2) !== 0) return tutupPaksa(1009);
                len = sisa.readUInt32BE(6); off = 10;
            }

            if (len > MUSIK_MAKS_PESAN) return tutupPaksa(1009);
            if (!bermask) return tutupPaksa(1002);
            if (sisa.length < off + 4) break;

            const total = off + 4 + len;
            if (sisa.length < total) break;

            const mask = sisa.slice(off, off + 4);
            const mentah = sisa.slice(off + 4, total);
            const data = Buffer.allocUnsafe(len);
            for (let i = 0; i < len; i++) data[i] = mentah[i] ^ mask[i & 3];
            sisa = sisa.slice(total);

            if (opcode === 8) return tutupPaksa(1000);
            if (opcode === 9) { tulis(musikBingkai(10, data)); continue; }
            if (opcode === 10) { ws.alive = true; continue; }

            if (opcode === 0) {
                if (!fragOp) return tutupPaksa(1002);
                fragLen += len;
                if (fragLen > MUSIK_MAKS_PESAN) return tutupPaksa(1009);
                fragBuf.push(data);
                if (fin) {
                    const gabung = Buffer.concat(fragBuf, fragLen);
                    const op = fragOp;
                    fragOp = 0; fragBuf = []; fragLen = 0;
                    pesanUtuh(op, gabung);
                }
                continue;
            }

            if (opcode === 1 || opcode === 2) {
                if (fin) { pesanUtuh(opcode, data); continue; }
                fragOp = opcode; fragBuf = [data]; fragLen = len;
                continue;
            }

            return tutupPaksa(1002);
        }
    });

    const selesai = () => {
        if (ws.readyState === 3 && ws.sudahTutup) return;
        ws.sudahTutup = true;
        ws.readyState = 3;
        ws.emit('close');
    };
    socket.on('close', selesai);
    socket.on('end', selesai);
    socket.on('error', () => { try { socket.destroy(); } catch (e) { } selesai(); });

    return ws;
}

function musikKirim(ws, obj) {
    try { ws.send(JSON.stringify(obj)); } catch (e) { }
}

// ---------------------------------------------------------------------------
// 2. PENCARIAN & PENGAMBILAN LAGU
// ---------------------------------------------------------------------------

async function musikAmbilBytes(url, batasByte) {
    const res = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 45000,
        maxContentLength: batasByte,
        maxBodyLength: batasByte
    });
    return Buffer.from(res.data);
}

const musikSampul = new Map();
const MUSIK_SAMPUL_MAKS = 300;

async function musikAmbilSampul(url) {
    if (!url) return null;
    if (musikSampul.has(url)) return musikSampul.get(url);
    try {
        const { data, headers } = await axios.get(url, { responseType: 'arraybuffer', timeout: 6000 });
        const jenis = (headers && headers['content-type']) || 'image/jpeg';
        const b64 = 'data:' + jenis + ';base64,' + Buffer.from(data).toString('base64');
        if (musikSampul.size >= MUSIK_SAMPUL_MAKS) musikSampul.delete(musikSampul.keys().next().value);
        musikSampul.set(url, b64);
        return b64;
    } catch (e) {
        musikSampul.set(url, null);
        return null;
    }
}

// ---------------------------------------------------------------------------
// JATAH UNDUH LAGU PER NOMOR BOT
// ---------------------------------------------------------------------------
let musikHookJatah = null;

function musikPasangJatah(hook) {
    musikHookJatah = (hook && typeof hook.cek === 'function') ? hook : null;
}

const MUSIK_JATAH_BEBAS = { bebas: true, sisa: Infinity, batas: Infinity, nama: '' };

function musikCekJatah(bot) {
    if (!musikHookJatah) return MUSIK_JATAH_BEBAS;
    try {
        const j = musikHookJatah.cek(String(bot || ''));
        if (!j || j.bebas) return MUSIK_JATAH_BEBAS;
        return {
            bebas: false,
            sisa: Math.max(0, Number(j.sisa) || 0),
            batas: Math.max(0, Number(j.batas) || 0),
            nama: String(j.nama || 'Free')
        };
    } catch (e) {
        console.error('[SPOTIFYLIVE] hook cek jatah gagal:', e && e.message);
        return MUSIK_JATAH_BEBAS;
    }
}

function musikPakaiJatah(bot) {
    if (!musikHookJatah || typeof musikHookJatah.pakai !== 'function') return;
    try { musikHookJatah.pakai(String(bot || '')); }
    catch (e) { console.error('[SPOTIFYLIVE] hook pakai jatah gagal:', e && e.message); }
}

function musikKirimJatah(ws) {
    const j = musikCekJatah(ws.musikBot);
    musikKirim(ws, {
        t: 'm_jatah',
        bebas: j.bebas,
        sisa: j.bebas ? -1 : j.sisa,
        batas: j.bebas ? -1 : j.batas,
        nama: j.nama
    });
}

function musikPengikut(ws) {
    const r = ws.musikKode ? musikRuangan.get(ws.musikKode) : null;
    return !!(r && r.host !== ws);
}

function musikSiarkanKeRuangan(ws, pesan, hanyaHost = true) {
    const kode = ws.musikKode;
    if (!kode) return;
    const r = musikRuangan.get(kode);
    if (!r) return;
    if (hanyaHost && r.host !== ws) return;
    r.sentuh = Date.now();
    for (const lain of r.anggota.keys()) {
        if (lain === ws) continue;
        musikKirim(lain, pesan);
    }
}

async function musikTanganiCari(ws, q) {
    const query = String(q || '').trim();
    if (!query) return musikKirim(ws, { t: 'm_err', m: 'Ketik judul lagu dulu.' });
    try {
        const hasil = await searchTrack(query, 8);
        const sampul = await Promise.all(hasil.map((tr) => musikAmbilSampul(tr.album && tr.album.imageSmall)));
        const pesan = {
            t: 'm_hasil',
            q: query,
            list: hasil.map((tr, i) => ({
                title: tr.name,
                artist: (tr.artists || []).join(', '),
                album: tr.album && tr.album.name,
                cover: sampul[i] || null,
                duration: tr.duration_ms,
                url: tr.url
            }))
        };
        musikKirim(ws, pesan);
        musikSiarkanKeRuangan(ws, pesan);
    } catch (e) {
        console.error('[SPOTIFYLIVE] gagal cari:', e && e.message);
        musikKirim(ws, { t: 'm_err', m: 'Pencarian gagal. Coba kata kunci lain.' });
    }
}

async function musikTanganiPutar(ws, url) {
    if (!url || !/^https?:\/\/open\.spotify\.com\//.test(url)) {
        return musikKirim(ws, { t: 'm_err', m: 'Lagu tidak valid.' });
    }

    const gratis = musikPengikut(ws);

    if (!gratis && ws.musikSibuk) {
        return musikKirim(ws, { t: 'm_err', m: 'Masih menyiapkan lagu sebelumnya. Tunggu sebentar.' });
    }

    const sudahDibayar = !!(ws.musikDibayar && ws.musikDibayar.has(url));

    const jatah = musikCekJatah(ws.musikBot);
    if (!jatah.bebas && !gratis && !sudahDibayar && jatah.sisa <= 0) {
        return musikKirim(ws, { t: 'm_limit', batas: jatah.batas, nama: jatah.nama });
    }

    if (!gratis) ws.musikSibuk = true;
    musikKirim(ws, { t: 'm_proses', m: 'Menyiapkan lagu...' });
    try {
        const info = await downloadTrack(url, 'mp3');
        if (!info || !info.download) throw new Error('Tidak ada tautan audio dari server convert.');

        if (!jatah.bebas && !gratis && !sudahDibayar) {
            musikPakaiJatah(ws.musikBot);
            if (!ws.musikDibayar) ws.musikDibayar = new Set();
            ws.musikDibayar.add(url);
            musikKirimJatah(ws);
        }

        let cover = '';
        try {
            if (info.cover) {
                const bc = await musikAmbilBytes(info.cover, 3 * 1024 * 1024);
                cover = 'data:image/jpeg;base64,' + bc.toString('base64');
            }
        } catch (e) { }

        const audioBuf = await musikAmbilBytes(info.download, MUSIK_MAKS_AUDIO);
        const b64 = audioBuf.toString('base64');
        const totalBongkah = Math.ceil(b64.length / MUSIK_BONGKAH) || 1;

        musikKirim(ws, {
            t: 'm_meta',
            title: info.title, artist: info.artist, album: info.album,
            cover, duration: info.duration, totalBongkah
        });

        for (let i = 0; i < totalBongkah; i++) {
            if (ws.readyState !== 1) return;
            musikKirim(ws, { t: 'm_bongkah', i, data: b64.slice(i * MUSIK_BONGKAH, (i + 1) * MUSIK_BONGKAH) });
        }
        musikKirim(ws, { t: 'm_selesai' });
    } catch (e) {
        console.error('[SPOTIFYLIVE] gagal putar:', e && e.message);
        musikKirim(ws, { t: 'm_err', m: 'Lagu gagal diambil/dikonversi. Coba lagu lain.' });
    } finally {
        ws.musikSibuk = false;
    }
}

// ---------------------------------------------------------------------------
// 3. RUANGAN "DENGERIN BARENG"
// ---------------------------------------------------------------------------

const MUSIK_UMUR_KUNCI = 30 * 60 * 1000;
const MUSIK_UMUR_KUNCI_BEBAS = 24 * 60 * 60 * 1000;
const musikKunci = new Map();

function buatKunci(botNumber, opts) {
    musikBersihkanKunci();
    const bebas = !!(opts && opts.bebas);
    const kunci = crypto.randomBytes(9).toString('base64url');
    musikKunci.set(kunci, {
        bot: String(botNumber || ''),
        sampai: bebas ? 0 : Date.now() + MUSIK_UMUR_KUNCI,
        buang: Date.now() + (bebas ? MUSIK_UMUR_KUNCI_BEBAS : MUSIK_UMUR_KUNCI)
    });
    return kunci;
}

function musikBersihkanKunci() {
    const now = Date.now();
    for (const [k, v] of musikKunci) if ((v.buang || v.sampai) < now) musikKunci.delete(k);
}

function musikPakaiKunci(ws, kunci) {
    const v = musikKunci.get(String(kunci || ''));
    if (!v || (v.sampai && v.sampai < Date.now())) {
        musikKirim(ws, { t: 'm_kunci_habis' });
        try { ws.close(); } catch (e) { }
        return;
    }
    ws.musikBot = v.bot;
    ws.musikSampai = v.sampai;
    musikKirim(ws, { t: 'm_kunci_ok', sampai: v.sampai });
    musikKirimJatah(ws);
}

const MUSIK_KODE_ALFABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const musikRuangan = new Map();

function musikKodeBaru() {
    let kode;
    do {
        const bytes = crypto.randomBytes(4);
        kode = '';
        for (let i = 0; i < 4; i++) kode += MUSIK_KODE_ALFABET[bytes[i] % MUSIK_KODE_ALFABET.length];
    } while (musikRuangan.has(kode));
    return kode;
}

function musikSiarkanAnggota(r) {
    const daftar = Array.from(r.anggota.values()).map((a) => ({ id: a.id, nama: a.nama }));
    const hostId = (r.host && r.anggota.get(r.host) && r.anggota.get(r.host).id) || null;
    const hostNama = (r.host && r.anggota.get(r.host) && r.anggota.get(r.host).nama) || null;
    for (const ws of r.anggota.keys()) musikKirim(ws, { t: 'm_anggota', anggota: daftar, host: hostNama, hostId });
}

function musikIdBaru() {
    return Math.random().toString(36).slice(2, 8);
}

function musikCariAnggota(r, id) {
    for (const [ws, a] of r.anggota) if (a.id === id) return ws;
    return null;
}

function musikPosisiSekarang(r) {
    if (!r.state) return 0;
    if (!r.state.jalan) return r.state.posisi || 0;
    return (r.state.posisi || 0) + (Date.now() - (r.state.waktu || Date.now())) / 1000;
}

function musikTutupRuangan(kode) {
    const r = musikRuangan.get(kode);
    if (!r) return;
    if (r.timerKosong) clearTimeout(r.timerKosong);
    musikRuangan.delete(kode);
}

function musikJadwalTutupJikaKosong(kode) {
    const r = musikRuangan.get(kode);
    if (!r) return;
    if (r.timerKosong) clearTimeout(r.timerKosong);
    r.timerKosong = setTimeout(() => {
        const masih = musikRuangan.get(kode);
        if (masih && masih.anggota.size === 0) musikTutupRuangan(kode);
    }, MUSIK_JEDA_KOSONG);
}

function musikTanganiBuat(ws, nama, opsi) {
    if (ws.musikKode) musikKeluarRuangan(ws);
    const kode = musikKodeBaru();
    const o = opsi || {};
    const r = {
        anggota: new Map(), host: ws, state: null, tendang: new Set(),
        publik: !!o.publik,
        judul: String(o.judul || '').slice(0, 30),
        maks: Math.min(MUSIK_MAKS_ANGGOTA, Math.max(2, parseInt(o.maks, 10) || MUSIK_MAKS_ANGGOTA)),
        sentuh: Date.now(), timerKosong: null
    };
    ws.musikId = musikIdBaru();
    r.anggota.set(ws, { nama: String(nama || 'Pemain').slice(0, 20), id: ws.musikId });
    musikRuangan.set(kode, r);
    ws.musikKode = kode;
    musikKirim(ws, { t: 'm_ruang', kode, host: true, saya: ws.musikId });
    musikSiarkanAnggota(r);
}

function musikKirimDaftar(ws) {
    const daftar = [];
    for (const [kode, r] of musikRuangan) {
        if (!r.publik || r.anggota.size === 0) continue;
        const host = (r.host && r.anggota.get(r.host) && r.anggota.get(r.host).nama) || 'Host';
        daftar.push({
            kode,
            judul: r.judul || (host + ' - dengerin bareng'),
            host,
            jumlah: r.anggota.size,
            maks: r.maks || MUSIK_MAKS_ANGGOTA,
            lagu: (r.state && r.state.track && r.state.track.title) || null,
            artis: (r.state && r.state.track && r.state.track.artist) || null
        });
    }
    daftar.sort((a, b) => b.jumlah - a.jumlah);
    musikKirim(ws, { t: 'm_daftar', list: daftar.slice(0, 30) });
}

function musikTanganiGabung(ws, kode, nama) {
    const k = String(kode || '').toUpperCase().trim();
    const r = musikRuangan.get(k);
    if (!r) return musikKirim(ws, { t: 'm_err', m: 'Kode ruangan tidak ditemukan.' });
    if (r.anggota.size >= (r.maks || MUSIK_MAKS_ANGGOTA)) return musikKirim(ws, { t: 'm_err', m: 'Ruangan penuh.' });
    if (ws.musikKode) musikKeluarRuangan(ws);

    const namaBersih = String(nama || 'Pemain').slice(0, 20);
    if (r.tendang && r.tendang.has(namaBersih.toLowerCase())) {
        return musikKirim(ws, { t: 'm_err', m: 'Kamu sudah dikeluarkan dari ruangan ini.' });
    }

    ws.musikId = musikIdBaru();
    r.anggota.set(ws, { nama: namaBersih, id: ws.musikId });
    ws.musikKode = k;
    r.sentuh = Date.now();
    if (r.timerKosong) { clearTimeout(r.timerKosong); r.timerKosong = null; }
    musikKirim(ws, { t: 'm_ruang', kode: k, host: r.host === ws, saya: ws.musikId });
    musikSiarkanAnggota(r);

    if (r.state && r.state.track) {
        musikKirim(ws, {
            t: 'm_kontrol',
            dari: (r.host && r.anggota.get(r.host) && r.anggota.get(r.host).nama) || 'Host',
            aksi: 'ganti',
            posisi: musikPosisiSekarang(r),
            jalan: !!r.state.jalan,
            track: r.state.track
        });
    }
}

function musikKeluarRuangan(ws) {
    const kode = ws.musikKode;
    if (!kode) return;
    const r = musikRuangan.get(kode);
    ws.musikKode = null;
    if (!r) return;
    r.anggota.delete(ws);
    r.sentuh = Date.now();
    if (r.anggota.size === 0) { musikJadwalTutupJikaKosong(kode); return; }

    if (r.host === ws) {
        r.host = r.anggota.keys().next().value;
        r.state = null;
        musikKirim(r.host, { t: 'm_peran', host: true });
    }
    musikSiarkanAnggota(r);
}

function musikSiarkanKontrol(ws, d) {
    const kode = ws.musikKode;
    if (!kode) return;
    const r = musikRuangan.get(kode);
    if (!r) return;
    if (r.host !== ws) {
        musikKirim(ws, { t: 'm_err', m: 'Cuma host ruangan yang bisa mengatur lagu.' });
        return;
    }
    r.sentuh = Date.now();

    if (d.aksi === 'ganti') {
        r.state = { track: d.track || null, url: (d.track && d.track.url) || '', posisi: 0, jalan: true, waktu: Date.now() };
    } else if (r.state) {
        r.state.posisi = Number(d.posisi) || 0;
        r.state.waktu = Date.now();
        if (d.aksi === 'play') r.state.jalan = true;
        else if (d.aksi === 'pause') r.state.jalan = false;
    }

    const anggotaKu = r.anggota.get(ws) || {};
    const nama = anggotaKu.nama || 'Pemain';
    for (const lain of r.anggota.keys()) {
        if (lain === ws) continue;
        musikKirim(lain, {
            t: 'm_kontrol', dari: nama, aksi: d.aksi, posisi: d.posisi,
            jalan: r.state ? r.state.jalan : true,
            track: d.track
        });
    }
}

function musikSiarkanDenyut(ws, d) {
    const kode = ws.musikKode;
    if (!kode) return;
    const r = musikRuangan.get(kode);
    if (!r || r.host !== ws) return;
    r.sentuh = Date.now();

    if (r.state) {
        r.state.posisi = Number(d.posisi) || 0;
        r.state.jalan = !!d.jalan;
        r.state.waktu = Date.now();
    }
    for (const lain of r.anggota.keys()) {
        if (lain === ws) continue;
        musikKirim(lain, { t: 'm_denyut', url: d.url, posisi: d.posisi, jalan: !!d.jalan });
    }
}

function musikSiarkanChat(ws, teks) {
    const kode = ws.musikKode;
    if (!kode) return;
    const r = musikRuangan.get(kode);
    if (!r) return;
    const anggotaKu = r.anggota.get(ws) || {};
    const nama = anggotaKu.nama || 'Pemain';
    const idPesan = musikIdBaru();
    for (const lain of r.anggota.keys()) {
        if (lain === ws) continue;
        musikKirim(lain, { t: 'm_chat', id: idPesan, dari: anggotaKu.id, nama, m: String(teks || '').slice(0, 120) });
    }
    musikKirim(ws, { t: 'm_chat_id', id: idPesan });
}

function musikHapusChat(ws, d) {
    const kode = ws.musikKode;
    if (!kode) return;
    const r = musikRuangan.get(kode);
    if (!r) return;
    const aku = r.anggota.get(ws);
    if (!aku) return;

    const bolehSemua = r.host === ws;
    if (!bolehSemua && d.dari && d.dari !== aku.id) {
        return musikKirim(ws, { t: 'm_err', m: 'Cuma penulisnya atau host yang bisa menghapus pesan itu.' });
    }
    for (const lain of r.anggota.keys()) {
        musikKirim(lain, { t: 'm_chat_hapus', id: String(d.id || '') });
    }
}

function musikTendang(ws, d) {
    const kode = ws.musikKode;
    if (!kode) return;
    const r = musikRuangan.get(kode);
    if (!r) return;
    if (r.host !== ws) return musikKirim(ws, { t: 'm_err', m: 'Cuma host yang bisa mengeluarkan anggota.' });

    const sasaran = musikCariAnggota(r, String(d.id || ''));
    if (!sasaran || sasaran === ws) return;

    const data = r.anggota.get(sasaran) || {};
    if (data.nama) r.tendang.add(String(data.nama).toLowerCase());

    musikKirim(sasaran, { t: 'm_ditendang' });
    sasaran.musikKode = null;
    r.anggota.delete(sasaran);
    r.sentuh = Date.now();
    musikSiarkanAnggota(r);
    for (const lain of r.anggota.keys()) {
        musikKirim(lain, { t: 'm_chat', id: musikIdBaru(), dari: null, nama: '', m: (data.nama || 'Seseorang') + ' dikeluarkan host.' });
    }
}

// ---------------------------------------------------------------------------
// 4. PENERUS PESAN
// ---------------------------------------------------------------------------

function musikTangani(ws, d) {
    if (d.t === 'm_cari') return void musikTanganiCari(ws, d.q);
    if (d.t === 'm_kunci') return musikPakaiKunci(ws, d.kunci);
    if (d.t === 'm_putar') return void musikTanganiPutar(ws, d.url);
    if (d.t === 'm_buat') return musikTanganiBuat(ws, d.nama, { publik: d.publik, judul: d.judul, maks: d.maks });
    if (d.t === 'm_daftar') return musikKirimDaftar(ws);
    if (d.t === 'm_gabung') return musikTanganiGabung(ws, d.kode, d.nama);
    if (d.t === 'm_keluar') { musikKeluarRuangan(ws); return; }
    if (d.t === 'm_kontrol') return musikSiarkanKontrol(ws, d);
    if (d.t === 'm_denyut') return musikSiarkanDenyut(ws, d);
    if (d.t === 'm_ping') return musikKirim(ws, { t: 'm_pong', ts: d.ts });
    if (d.t === 'm_ketik') return musikSiarkanKeRuangan(ws, { t: 'm_ketik', q: String(d.q || '').slice(0, 60) });
    if (d.t === 'm_chat') return musikSiarkanChat(ws, d.m);
    if (d.t === 'm_chat_hapus') return musikHapusChat(ws, d);
    if (d.t === 'm_tendang') return musikTendang(ws, d);
}

// ---------------------------------------------------------------------------
// 5. NYALAKAN SERVER
// ---------------------------------------------------------------------------

let musikAktif = false;
let musikStatus = 'belum';
let musikAntreSiap = [];
const musikSemuaSoket = new Set();

function musikTetapkanStatus(st) {
    if (musikStatus !== 'belum') return;
    musikStatus = st;
    musikAktif = (st === 'aktif');
    const antre = musikAntreSiap;
    musikAntreSiap = [];
    for (const fn of antre) { try { fn(musikAktif); } catch (e) { } }
}

function musikNyalakanServer() {
    const srv = http.createServer((req, res) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        if (String(req.url || '/').split('?')[0] === '/musiklive/ping') {
            res.writeHead(200, { 'Content-Type': 'text/plain' });
            res.end('SPOTIFYLIVE ' + musikRuangan.size);
        } else { res.writeHead(404); res.end(); }
    });

    srv.on('upgrade', (req, socket) => {
        const kunci = req.headers['sec-websocket-key'];
        if (!kunci || String(req.headers['upgrade'] || '').toLowerCase() !== 'websocket') {
            try { socket.destroy(); } catch (e) { }
            return;
        }
        const terima = crypto.createHash('sha1').update(kunci + WS_MAGIC).digest('base64');
        socket.write(
            'HTTP/1.1 101 Switching Protocols\r\n' +
            'Upgrade: websocket\r\n' +
            'Connection: Upgrade\r\n' +
            'Sec-WebSocket-Accept: ' + terima + '\r\n\r\n'
        );
        socket.setNoDelay(true);

        const ws = musikSoket(socket);
        musikSemuaSoket.add(ws);
        ws.pesanPerDetik = 0;

        ws.on('message', (teks) => {
            ws.pesanPerDetik++;
            let d;
            try { d = JSON.parse(teks); } catch (e) { return; }
            if (!d || typeof d.t !== 'string') return;
            if (d.t.slice(0, 2) !== 'm_') return;
            try { musikTangani(ws, d); }
            catch (e) {
                console.error('[SPOTIFYLIVE] error:', e && e.message);
                musikKirim(ws, { t: 'm_err', m: 'Ada yang salah di server. Coba lagi.' });
            }
        });

        ws.on('close', () => { musikSemuaSoket.delete(ws); musikKeluarRuangan(ws); });
    });

    srv.on('error', (e) => {
        if (e && e.code === 'EADDRINUSE') {
            console.log('⚠️ [SPOTIFYLIVE] port ' + MUSIK_PORT + ' sudah dipakai — fitur musik live mati, fitur lain tetap jalan.');
        } else {
            console.log('⚠️ [SPOTIFYLIVE] server gagal:', e && e.message);
        }
        musikTetapkanStatus('gagal');
    });

    srv.listen(MUSIK_PORT, () => {
        console.log('🎵 [SPOTIFYLIVE] server online siap di port ' + MUSIK_PORT);
        musikTetapkanStatus('aktif');
    });
    return srv;
}

function musikDetak() {
    const jantung = setInterval(() => {
        for (const ws of musikSemuaSoket) {
            if (ws.alive === false) { ws.terminate(); musikSemuaSoket.delete(ws); continue; }
            ws.alive = false;
            ws.ping();
        }
    }, 30000);

    const perDetik = setInterval(() => {
        const now = Date.now();
        for (const ws of musikSemuaSoket) {
            if (ws.pesanPerDetik > 400) { ws.close(1008); musikSemuaSoket.delete(ws); }
            ws.pesanPerDetik = 0;
        }
        for (const [kode, r] of musikRuangan) {
            if (r.anggota.size === 0 && now - r.sentuh > MUSIK_JEDA_KOSONG) musikTutupRuangan(kode);
        }
        for (const ws of musikSemuaSoket) {
            if (ws.musikSampai && ws.musikSampai < now) {
                musikKirim(ws, { t: 'm_kunci_habis' });
                try { ws.close(); } catch (e) { }
                musikSemuaSoket.delete(ws);
            }
        }
        musikBersihkanKunci();
    }, 1000);

    if (jantung.unref) jantung.unref();
    if (perDetik.unref) perDetik.unref();
}

let musikSudahNyala = false;

function nyalakan() {
    if (musikSudahNyala) return;
    musikSudahNyala = true;
    musikNyalakanServer();
    musikDetak();
}

function saatSiap(fn) {
    if (musikStatus !== 'belum') return fn(musikAktif);
    musikAntreSiap.push(fn);
}

module.exports = {
    nyalakan,
    buatKunci,
    pasangJatah: musikPasangJatah,
    saatSiap,
    aktif: () => musikAktif,
    PORT: MUSIK_PORT,
    ruangan: musikRuangan
};
    },
    "livenet/spotifylive-tunnel": (module, exports, require) => {
// ===========================================================================
// SPOTIFYLIVE TUNNEL — diambil PERSIS dari lib/musiklive-tunnel.js sairi
// Hanya ganti: require -> import, module.exports -> export
// Logika TIDAK DIUBAH SAMA SEKALI
// ===========================================================================

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');
const { pastikanCloudflared } = require('livenet/cloudflared');
const relay = require('livenet/spotifylive-relay');


const URL_FILE = path.join(process.cwd(), 'database', 'livenet-spotifylive-tunnel-url.txt');

let proses = null;
let sudahNyala = false;
let gagalBeruntun = 0;
const MAKS_GAGAL = 3;

function jadwalUlang() {
    if (gagalBeruntun >= MAKS_GAGAL) {
        console.log('⛔ [SPOTIFYLIVE] tunnel gagal ' + MAKS_GAGAL + ' kali beruntun — menyerah. Perbaiki cloudflared lalu restart bot.');
        return;
    }
    setTimeout(jalankanCloudflared, 5000);
}

async function cariCloudflared() {
    const kandidat = [
        process.env.CLOUDFLARED_BIN,
        path.join(os.homedir(), 'cloudflared'),
        path.join(os.homedir(), '.local', 'bin', 'cloudflared'),
        path.join(process.cwd(), 'cloudflared'),
        path.join(process.cwd(), 'bin', 'cloudflared'),
        '/usr/local/bin/cloudflared',
        '/usr/bin/cloudflared',
        '/usr/sbin/cloudflared',
        '/snap/bin/cloudflared',
        '/opt/cloudflared/cloudflared',
        '/opt/homebrew/bin/cloudflared'
    ].filter(Boolean);

    for (const j of kandidat) {
        try { if (fs.existsSync(j)) return j; } catch (e) { }
    }
    for (const dir of String(process.env.PATH || '').split(path.delimiter)) {
        if (!dir) continue;
        const j = path.join(dir, 'cloudflared');
        try { if (fs.existsSync(j)) return j; } catch (e) { }
    }
    // Auto-download jika tidak ketemu
    return await pastikanCloudflared();
}

function tempatDicari() {
    return [
        'CLOUDFLARED_BIN (env)',
        '~/cloudflared', '~/.local/bin/cloudflared',
        './cloudflared', './bin/cloudflared',
        '/usr/local/bin', '/usr/bin', '/usr/sbin', '/snap/bin', '/opt/cloudflared', '/opt/homebrew/bin',
        'semua folder di PATH'
    ].join(', ');
}

function pastikanBisaDieksekusi(bin) {
    try { fs.accessSync(bin, fs.constants.X_OK); return true; } catch (e) { }
    try {
        fs.chmodSync(bin, 0o755);
        fs.accessSync(bin, fs.constants.X_OK);
        console.log('🔧 [SPOTIFYLIVE] izin eksekusi cloudflared diperbaiki (chmod +x)');
        return true;
    } catch (e) {
        console.log('⚠️ [SPOTIFYLIVE] cloudflared ada di ' + bin + ' tapi tidak bisa dieksekusi (' +
            (e && e.code || 'EACCES') + '). Jalankan: chmod +x ' + bin);
        return false;
    }
}

async function jalankanCloudflared() {
    if (proses) return;

    const bin = await cariCloudflared();
    if (!bin) {
        console.log('ℹ️ [SPOTIFYLIVE] cloudflared tidak ketemu di mesin ini. Dicari di: ' + tempatDicari() + '.\n' +
            '   Pasang cloudflared di node ini, atau tunjuk lokasinya lewat CLOUDFLARED_BIN=/path/ke/cloudflared (environment variable).');
        return;
    }
    if (!pastikanBisaDieksekusi(bin)) return;

    let dapat = false, buf = '';
    const mulai = Date.now();
    try {
        proses = spawn(bin, ['tunnel', '--no-autoupdate', '--url', 'http://localhost:' + relay.PORT]);
    } catch (e) {
        console.log('⚠️ [SPOTIFYLIVE] tunnel gagal dijalankan:', e && e.message);
        proses = null;
        return;
    }

    proses.on('error', (e) => {
        proses = null;
        console.log('⚠️ [SPOTIFYLIVE] cloudflared gagal dijalankan: ' + (e && e.code || '') + ' ' + (e && e.message || ''));
        if (e && e.code === 'EACCES') console.log('   Perbaiki dengan: chmod +x ' + bin);
        jadwalUlang();
    });

    const baca = (chunk) => {
        buf += chunk.toString();
        if (buf.length > 40000) buf = buf.slice(-8000);
        const m = buf.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/);
        if (m && !dapat) {
            dapat = true;
            const u = 'wss://' + m[0].slice('https://'.length);
            try {
                fs.mkdirSync(path.dirname(URL_FILE), { recursive: true });
                fs.writeFileSync(URL_FILE, u);
            } catch (e) { }
            console.log('✅ [SPOTIFYLIVE] tunnel aktif: ' + u);
        }
    };
    proses.stdout.on('data', baca);
    proses.stderr.on('data', baca);

    proses.on('exit', () => {
        proses = null;
        if (dapat) gagalBeruntun = 0;
        else if (Date.now() - mulai < 5000) gagalBeruntun++;
        try { fs.unlinkSync(URL_FILE); } catch (e) { }
        console.log('🔁 [SPOTIFYLIVE] tunnel mati.');
        jadwalUlang();
    });

    setTimeout(() => {
        if (proses && !dapat) { try { proses.kill(); } catch (e) { } }
    }, 60000);
}

function nyalakan() {
    if (sudahNyala) return;
    sudahNyala = true;
    if (String(process.env.MUSIK_TUNNEL || '').toLowerCase() === 'off') {
        console.log('ℹ️ [SPOTIFYLIVE] MUSIK_TUNNEL=off — tunnel tidak dinyalakan dari sini');
        return;
    }
    relay.saatSiap((aktif) => {
        if (!aktif) {
            console.log('⚠️ [SPOTIFYLIVE] server musik tidak jalan — tunnel dilewati');
            return;
        }
        jalankanCloudflared();
    });
}

function bacaRelayMusik() {
    if (!relay.aktif()) return '';
    try {
        const u = fs.readFileSync(URL_FILE, 'utf8').trim();
        return /^wss?:\/\//.test(u) ? u : '';
    } catch (e) { return ''; }
}

module.exports = { nyalakan, bacaRelayMusik, URL_FILE };
    },
    "livenet": (module, exports, require) => {
// Penyalaan 3 kartu live: ytlive, pinlive, spotifylive.
// Tiap fitur = server relay lokal (WebSocket) + tunnel cloudflared, supaya kartu di dalam chat bisa
// mengambil data lewat jaringan (sandbox kartu WA tidak boleh fetch biasa).
// start() aman dipanggil berkali-kali. Matikan seluruhnya dengan LIVENET=off (environment variable).
const yt = require('livenet/ytlive-relay'), ytT = require('livenet/ytlive-tunnel')
const pin = require('livenet/pinlive-relay'), pinT = require('livenet/pinlive-tunnel')
const sp = require('livenet/spotifylive-relay'), spT = require('livenet/spotifylive-tunnel')

let started = false
function start() {
  if (started) return
  started = true
  if (String(process.env.LIVENET || '').toLowerCase() === 'off') { console.log('[livenet] LIVENET=off — ytlive/pinlive/spotifylive tidak dinyalakan'); return }
  // dijeda berurutan supaya 3 proses cloudflared tidak rebutan saat boot
  const jalan = (nama, r, t, ms) => setTimeout(() => { try { r.nyalakan(); t.nyalakan() } catch (e) { console.log(`[${nama}] gagal nyala:`, e.message) } }, ms)
  jalan('ytlive', yt, ytT, 1000)
  jalan('spotifylive', sp, spT, 6000)
  jalan('pinlive', pin, pinT, 11000)
}
module.exports = { start, yt, ytT, pin, pinT, sp, spT }
    },
}


// ───────── ekspor internal (dipakai file pecahan lain) ─────────
export { dioLibs }
