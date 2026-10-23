import { dioRun, dioRegister } from '../../lib/plugin-engine.js'

// ───────── logika fitur (sebelumnya di lib/) ─────────
const libs = {
    "kreasi2": (module, exports, require) => {
            const sharp = require('sharp'), crypto = require('crypto')
            const hash = (s) => parseInt(crypto.createHash('md5').update(String(s)).digest('hex').slice(0, 8), 16)
            const rng = (seed) => { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 } }
            const svgBuf = (s) => Buffer.from(s)
            const pick = (r, a) => a[Math.floor(r() * a.length)]
            async function shapesImage(n, seed) {
              const W = 900, H = 600, r = rng(hash(seed)), items = [], cols = ['#ef476f', '#ffd166', '#06d6a0', '#118ab2', '#9b5de5', '#f78c6b']
              let guard = 0
              while (items.length < n && guard++ < 6000) {
                const s = 26 + r() * 22, x = s + 10 + r() * (W - 2 * s - 20), y = s + 10 + r() * (H - 2 * s - 20)
                if (items.every(i => Math.hypot(i.x - x, i.y - y) > i.s + s + 6)) items.push({ x, y, s, k: Math.floor(r() * 3), c: pick(r, cols), rot: r() * 360 })
              }
              const sh = items.map(i => i.k === 0 ? `<circle cx="${i.x}" cy="${i.y}" r="${i.s}" fill="${i.c}"/>` : i.k === 1 ? `<rect x="${i.x - i.s * 0.85}" y="${i.y - i.s * 0.85}" width="${i.s * 1.7}" height="${i.s * 1.7}" rx="6" fill="${i.c}" transform="rotate(${i.rot} ${i.x} ${i.y})"/>` : `<polygon points="${i.x},${i.y - i.s} ${i.x + i.s},${i.y + i.s * 0.8} ${i.x - i.s},${i.y + i.s * 0.8}" fill="${i.c}" transform="rotate(${i.rot} ${i.x} ${i.y})"/>`).join('')
              return { buf: await sharp(svgBuf(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="#f7f4ea"/>${sh}<rect x="3" y="3" width="${W - 6}" height="${H - 6}" fill="none" stroke="#2b2b2b" stroke-width="6"/></svg>`)).png().toBuffer(), count: items.length }
            }
            module.exports = { shapesImage }
        }
}

const feature = (module, exports, require) => {
        // .hitungbenda — bot menggambar bentuk warna-warni acak; hitung jumlah semuanya, ketik angkanya. Yang pertama tepat menang.
        //   .hitungbenda nyerah
        const K2 = require('../../lib/kreasi2'), E = require('../../lib/ekstra'), R = require('../../lib/rpg'), ST = require('../../lib/style')
        const games = new Map()
        const stop = (c) => { const g = games.get(c); if (g) clearTimeout(g.timer); games.delete(c) }

        module.exports = {
          name: 'hitungbenda', alias: ['hitunggambar', 'countgame', 'berapabenda'], category: 'fun', cmds: ['hitungbenda'],
          desc: 'Hitung jumlah bentuk di gambar acak buatan bot (menang dapat skor dan Money)',
          run: async ({ sock, m, args, reply, prefix }) => {
            const g = games.get(m.chat)
            if (String(args[0] || '').toLowerCase() === 'nyerah') { if (!g) return reply('Tidak ada soal yang berjalan.'); stop(m.chat); return reply(`Menyerah? Jumlahnya *${g.n}*`) }
            if (g) return reply(`Masih ada soal yang berjalan. Ketik angkanya, atau ${prefix}hitungbenda nyerah`)
            const lvl = ['mudah', 'sedang', 'sulit'].indexOf(String(args[0] || '').toLowerCase()), n0 = [12, 20, 32][lvl < 0 ? 1 : lvl]
            const want = n0 + Math.floor(Math.random() * 6), { buf, count } = await K2.shapesImage(want, String(Date.now()))
            const ng = { n: count }
            ng.timer = setTimeout(() => { if (games.get(m.chat) === ng) { games.delete(m.chat); sock.sendMessage(m.chat, { text: `Waktu habis! Jumlahnya *${ng.n}*` }).catch(() => {}) } }, 45000)
            games.set(m.chat, ng)
            await sock.sendMessage(m.chat, { image: buf, caption: `${ST.B('HITUNG BENDA')}\n━━━━━━━━━━━━━━━━━━━━\nAda berapa bentuk (lingkaran, kotak, segitiga) di gambar ini?\nKetik angkanya saja.\n\nWaktu 45 detik  •  Hadiah 100 gold + 10 poin\n_Tingkat: ${prefix}hitungbenda mudah|sedang|sulit_` }, { quoted: m })
          },
          before: async ({ sock, m, budy }) => {
            const g = games.get(m.chat); if (!g || !budy || !/^\d{1,3}$/.test(budy.trim())) return false
            if (parseInt(budy, 10) !== g.n) return false
            stop(m.chat)
            E.addScore(m.sender, m.pushName, 10, 'hitungbenda')
            const u = R.get(m.sender); let bonus = ''
            if (u) { const got = R.addGold(u, 100); R.save(); bonus = `\n+${R.fmt(got)} Money` }
            await sock.sendMessage(m.chat, { text: `Benar! @${m.sender.split('@')[0]} menghitung *${g.n}* bentuk.\n+10 poin game${bonus}`, mentions: [m.sender] }, { quoted: m })
            return true
          },
        }
    }

dioRegister("fun/hitungbenda", feature, libs)

let handler = (m, ctx) => dioRun("fun/hitungbenda", m, ctx)

handler.command = ["hitungbenda", "hitunggambar", "countgame", "berapabenda"]
handler.hide = ["hitunggambar", "countgame", "berapabenda"]
handler.help = ["hitungbenda"]
handler.tags = ["fun"]

export default handler
