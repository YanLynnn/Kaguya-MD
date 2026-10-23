import { dioRun, dioRegister } from '../../lib/plugin-engine.js'

// ───────── logika fitur (sebelumnya di lib/) ─────────
const libs = {
    "settingsdb": (module) => { module.exports = { get: (k) => (k === 'botname' ? global.namebot : undefined) } },
    "ancientsvg": (module, exports, require) => {
            // DEKORASI SVG GAYA KUNO (Mesir/Yunani): bingkai emas + pola meander, Mata Horus vektor, huruf serif
            const sharp = require('sharp')
            const ST = require('./style')
    
            const SERIF = "'Cinzel','Cormorant Garamond','Trajan Pro','Palatino Linotype','Book Antiqua',Georgia,'DejaVu Serif',serif"
            const SANS = "Poppins,'DejaVu Sans',Arial,sans-serif"
            const C = { gold: '#d4af37', goldL: '#f6e4a0', goldD: '#8a6d1d', night: '#080d1f', lapis: '#14224f', sand: '#efe3bf', stone: '#c9b98c' }
    
            // definisi bersama: gradasi emas, pola meander
            const defs = (accent = C.gold, id = 'a') => `
              <linearGradient id="${id}gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${C.goldL}"/><stop offset="0.5" stop-color="${C.gold}"/><stop offset="1" stop-color="${C.goldD}"/></linearGradient>
              <linearGradient id="${id}bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${C.night}"/><stop offset="0.55" stop-color="${C.lapis}"/><stop offset="1" stop-color="#1b1233"/></linearGradient>
              <radialGradient id="${id}glow" cx="0.15" cy="0.3" r="0.75"><stop offset="0" stop-color="${accent}" stop-opacity="0.30"/><stop offset="1" stop-color="${accent}" stop-opacity="0"/></radialGradient>
              <pattern id="${id}key" width="18" height="14" patternUnits="userSpaceOnUse"><path d="M0 12.5H18M2 12.5V1.5H15.5V9H5.5V4.5H12.5V6.5" fill="none" stroke="url(#${id}gold)" stroke-width="1.5" stroke-linejoin="miter"/></pattern>`
    
            // Mata Horus (Wedjat). (x,y) = pojok kiri-atas, w = lebar
            function eye(x, y, w, fill = 'url(#agold)') {
              const s = w / 120
              return `<g transform="translate(${x},${y}) scale(${s})" fill="none" stroke="${fill}" stroke-linecap="round" stroke-linejoin="round">
                <path d="M10 20 C36 3 74 2 104 17" stroke-width="6"/>
                <path d="M8 42 C30 22 64 22 90 38 C72 52 30 54 8 42 Z" stroke-width="4.5"/>
                <circle cx="49" cy="38" r="11" fill="${fill}" stroke="none"/><circle cx="49" cy="38" r="4.5" fill="#080d1f" stroke="none"/>
                <path d="M90 38 L112 44 C118 56 108 66 97 60 C90 56 93 48 100 50" stroke-width="4.5"/>
                <path d="M46 51 C47 64 44 72 36 76 L18 78" stroke-width="4.5"/>
                <path d="M30 76 C24 70 26 62 33 62" stroke-width="3.5"/>
              </g>`
            }
            // latar + bingkai emas + sudut. return string elemen (taruh setelah <defs>)
            function frame(w, h, accent = C.gold, r = 24, id = 'a') {
              let st = '', x = 7919; const rn = () => (x = (x * 9301 + 49297) % 233280) / 233280
              for (let i = 0; i < 38; i++) st += `<circle cx="${(rn() * w) | 0}" cy="${(rn() * h) | 0}" r="${(rn() * 1.5 + 0.4).toFixed(1)}" fill="${C.goldL}" opacity="${(rn() * 0.35 + 0.08).toFixed(2)}"/>`
              const corner = (cx, cy, sx, sy) => `<g transform="translate(${cx},${cy}) scale(${sx},${sy})"><path d="M0 0H34V6H6V34H0Z" fill="url(#${id}gold)"/><rect x="11" y="11" width="9" height="9" fill="none" stroke="url(#${id}gold)" stroke-width="2" transform="rotate(45 15.5 15.5)"/></g>`
              return `<rect width="${w}" height="${h}" rx="${r}" fill="url(#${id}bg)"/><rect width="${w}" height="${h}" rx="${r}" fill="url(#${id}glow)"/>${st}
              <rect x="5" y="5" width="${w - 10}" height="${h - 10}" rx="${r - 3}" fill="none" stroke="url(#${id}gold)" stroke-width="3.5"/>
              <rect x="14" y="14" width="${w - 28}" height="${h - 28}" rx="${r - 10}" fill="none" stroke="${C.gold}" stroke-opacity="0.35" stroke-width="1.2"/>
              <rect x="${r + 8}" y="3" width="${w - 2 * r - 16}" height="9" fill="url(#${id}key)" opacity="0.9" transform="translate(0,2)"/>
              <rect x="${r + 8}" y="${h - 14}" width="${w - 2 * r - 16}" height="9" fill="url(#${id}key)" opacity="0.9"/>
              ${corner(16, 16, 1, 1)}${corner(w - 16, 16, -1, 1)}${corner(16, h - 16, 1, -1)}${corner(w - 16, h - 16, -1, -1)}`
            }
            // judul bot: mata Horus + nama (ASCII) huruf serif emas
            function brand(x, y, botname, size = 26, sub = '') {
              const name = ST.plain(botname).toUpperCase() || 'KAGUYA'
              return `${eye(x, y - size * 0.9, size * 1.9)}
              <text x="${x + size * 2.2}" y="${y}" font-family="${SERIF}" font-size="${size}" font-weight="700" fill="url(#agold)" letter-spacing="${Math.round(size / 6)}">${name}</text>
              ${sub ? `<text x="${x + size * 2.2}" y="${y + size * 0.85}" font-family="${SERIF}" font-size="${Math.round(size * 0.5)}" fill="${C.stone}" letter-spacing="2">${sub}</text>` : ''}`
            }
            const render = (svg) => sharp(Buffer.from(svg)).png().toBuffer()
            module.exports = { C, SERIF, SANS, defs, eye, frame, brand, render }
        },
    "daycard": (module, exports, require) => {
            // KARTU KALENDER (canvas SVG -> PNG lewat sharp)
            const sharp = require('sharp')
            const AN = require('./ancientsvg'), ST = require('./style')
            const D = require('./daily')
            const FONT = "Poppins, 'DejaVu Sans', Arial, sans-serif"
            const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
            const cut = (s, n) => { s = String(s ?? ''); return s.length > n ? s.slice(0, n - 1) + '…' : s }
    
            function stars(seed) { let x = seed, o = ''; const r = () => (x = (x * 9301 + 49297) % 233280) / 233280; for (let i = 0; i < 40; i++) o += `<circle cx="${(r() * 1000) | 0}" cy="${(r() * 660) | 0}" r="${(r() * 1.6 + 0.4).toFixed(1)}" fill="#fff" opacity="${(r() * 0.4 + 0.08).toFixed(2)}"/>`; return o }
    
            // opt: { y, m, today:{y,m,d}, botname }
            async function calendarCard({ y, m, today, botname = 'Kaguya' }) {
              botname = ST.plain(botname) || 'KAGUYA'
              const AC = '#38bdf8', RED = '#f87171', ORG = '#fb923c', first = D.dowOf(y, m, 1), dim = new Date(Date.UTC(y, m, 0)).getUTCDate()
              const isCur = today.y === y && today.m === m, hol = {}
              D.HOLIDAYS.forEach(h => { if (h.d.slice(0, 7) === `${y}-${D.pad(m)}`) hol[+h.d.slice(8)] = h })
              const hFirst = D.hijri({ y, m, d: 1 }), hLast = D.hijri({ y, m, d: dim })
              const hRange = hFirst.name === hLast.name ? `${hFirst.name} ${hFirst.y} H` : `${hFirst.name} – ${hLast.name} ${hLast.y === hFirst.y ? hLast.y : hFirst.y + '/' + hLast.y} H`
              let work = 0; for (let d = 1; d <= dim; d++) if (D.isWorkday({ y, m, d, dow: D.dowOf(y, m, d) })) work++
              const holCount = Object.values(hol).filter(h => h.t === 'libur').length
    
              // sel kalender
              const CW = 84, CH = 60, GX = 372, GY = 150, DN = ['MIN', 'SEN', 'SEL', 'RAB', 'KAM', 'JUM', 'SAB']
              let cells = DN.map((n, i) => `<text x="${GX + i * CW + CW / 2}" y="${GY - 14}" text-anchor="middle" font-family="${FONT}" font-size="13" font-weight="800" fill="${i === 0 ? RED : i === 6 ? '#fda4af' : '#8fa0cf'}" letter-spacing="1">${n}</text>`).join('')
              for (let d = 1; d <= dim; d++) {
                const idx = first + d - 1, col = idx % 7, row = Math.floor(idx / 7), x = GX + col * CW, yy = GY + row * CH, h = hol[d]
                const isToday = isCur && today.d === d, red = col === 0 || (h && h.t === 'libur'), col2 = h ? (h.t === 'libur' ? RED : ORG) : col === 0 ? RED : col === 6 ? '#fda4af' : '#e5e9ff'
                const hj = D.hijri({ y, m, d })
                cells += `<g>
                  <rect x="${x + 3}" y="${yy + 3}" width="${CW - 6}" height="${CH - 6}" rx="14" fill="${isToday ? AC : '#ffffff0b'}" ${isToday ? '' : `stroke="${h ? col2 : '#ffffff14'}" stroke-opacity="${h ? 0.7 : 1}"`}/>
                  <text x="${x + CW / 2}" y="${yy + 33}" text-anchor="middle" font-family="${FONT}" font-size="24" font-weight="800" fill="${isToday ? '#06202e' : col2}">${d}</text>
                  <text x="${x + CW - 11}" y="${yy + CH - 11}" text-anchor="end" font-family="${FONT}" font-size="10" font-weight="600" fill="${isToday ? '#06202e' : '#7f8db8'}">${hj.d}</text>
                  ${h ? `<circle cx="${x + 14}" cy="${yy + CH - 15}" r="4" fill="${isToday ? '#06202e' : col2}"/>` : ''}
                </g>`
              }
              // daftar libur bulan ini
              const hents = Object.entries(hol), per = Math.ceil(hents.length / 2) || 1
              const hl = hents.slice(0, 12).map(([d, h], i) => { const col = Math.floor(i / per), row = i % per
                return `<g transform="translate(${GX + col * 300},${GY + 6 * CH + 42 + row * 21})"><circle cx="5" cy="-4" r="4.5" fill="${h.t === 'libur' ? RED : ORG}"/><text x="18" y="0" font-family="${FONT}" font-size="13" font-weight="600" fill="#dfe5ff"><tspan font-weight="800">${d}</tspan>  ${esc(cut(h.n.replace(/\s*\(.*\)$/, ''), col ? 36 : 32))}</text></g>` }).join('')
    
              // panel kiri
              let left
              if (isCur) {
                const w = D.weton(today), nx = D.nextHolidays(today, 1)[0], hj = D.hijri(today), dow = D.DAYS[D.dowOf(today.y, today.m, today.d)]
                left = `<text x="40" y="128" font-family="${FONT}" font-size="22" font-weight="700" fill="${AC}" letter-spacing="3">${dow.toUpperCase()}</text>
                  <text x="40" y="250" font-family="${AN.SERIF}" font-size="140" font-weight="700" fill="url(#agold)">${today.d}</text>
                  <text x="40" y="292" font-family="${FONT}" font-size="26" font-weight="700" fill="#e5e9ff">${D.MONTHS[m - 1]} ${y}</text>
                  <text x="40" y="326" font-family="${FONT}" font-size="17" font-weight="600" fill="#8fa0cf">${esc(hj.text)}</text>
                  <text x="40" y="354" font-family="${FONT}" font-size="17" font-weight="600" fill="#8fa0cf">${dow} ${D.pasaranOf(today)} • neptu ${w.neptu}</text>
                  <rect x="40" y="380" width="296" height="104" rx="18" fill="#ffffff0d" stroke="${AC}55"/>
                  <text x="58" y="408" font-family="${FONT}" font-size="12" font-weight="800" fill="${AC}" letter-spacing="2">HARI LIBUR BERIKUTNYA</text>
                  ${nx ? `<text x="58" y="436" font-family="${FONT}" font-size="15" font-weight="700" fill="#fff">${esc(cut(nx.n, 34))}</text><text x="58" y="464" font-family="${FONT}" font-size="15" font-weight="600" fill="#c7cff0">${nx.d} ${D.MONTHS[nx.m - 1]} • ${nx.in === 0 ? 'HARI INI' : nx.in + ' hari lagi'}</text>` : `<text x="58" y="440" font-family="${FONT}" font-size="15" fill="#c7cff0">Data libur belum tersedia</text>`}`
              } else {
                left = `<text x="40" y="128" font-family="${FONT}" font-size="22" font-weight="700" fill="${AC}" letter-spacing="3">KALENDER</text>
                  <text x="40" y="236" font-family="${FONT}" font-size="64" font-weight="800" fill="#fff">${D.MONTHS[m - 1]}</text>
                  <text x="40" y="292" font-family="${FONT}" font-size="46" font-weight="800" fill="${AC}">${y}</text>
                  <text x="40" y="332" font-family="${FONT}" font-size="17" font-weight="600" fill="#8fa0cf">${esc(hRange)}</text>
                  <rect x="40" y="368" width="296" height="116" rx="18" fill="#ffffff0d" stroke="${AC}55"/>
                  <text x="58" y="398" font-family="${FONT}" font-size="12" font-weight="800" fill="${AC}" letter-spacing="2">RINGKASAN BULAN</text>
                  <text x="58" y="430" font-family="${FONT}" font-size="16" font-weight="700" fill="#fff">${dim} hari • ${work} hari kerja</text>
                  <text x="58" y="458" font-family="${FONT}" font-size="16" font-weight="700" fill="#fff">${holCount} libur nasional</text>`
              }
              const prog = isCur ? D.dayOfYear(today) / (D.isLeap(y) ? 366 : 365) : 0
              const info = isCur ? `<text x="40" y="520" font-family="${FONT}" font-size="12" font-weight="800" fill="#8fa0cf" letter-spacing="2">PROGRES TAHUN ${y}</text><rect x="40" y="530" width="296" height="10" rx="5" fill="#0b0f1f" stroke="#ffffff22"/><rect x="40" y="530" width="${Math.max(10, 296 * prog)}" height="10" rx="5" fill="${AC}"/><text x="40" y="566" font-family="${FONT}" font-size="14" font-weight="600" fill="#c7cff0">Hari ke-${D.dayOfYear(today)} • Minggu ke-${D.isoWeek(today)} • ${(prog * 100).toFixed(0)}%</text>` : ''
    
              const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="680" viewBox="0 0 1000 680">
              <defs>${AN.defs(AC)}</defs>
              ${AN.frame(1000, 680, AC, 28)}
              ${AN.brand(64, 70, botname, 24, 'KALENDER &amp; PENANGGALAN • CHRONA')}
              <text x="944" y="66" text-anchor="end" font-family="${AN.SERIF}" font-size="30" font-weight="700" fill="url(#agold)">${D.MONTHS[m - 1].toUpperCase()} ${y}</text>
              <text x="944" y="90" text-anchor="end" font-family="${AN.SANS}" font-size="14" font-weight="600" fill="${AN.C.stone}">${esc(hRange)}</text>
              ${left}${info}${cells}${hl}
              <g transform="translate(${GX},${GY + 6 * CH + 6})" font-family="${FONT}" font-size="11" font-weight="600" fill="#8fa0cf"><circle cx="6" cy="-3" r="4" fill="${RED}"/><text x="16" y="0">Libur nasional</text><circle cx="116" cy="-3" r="4" fill="${ORG}"/><text x="126" y="0">Cuti bersama</text><text x="236" y="0">Angka kecil = tanggal Hijriah (perkiraan)</text></g>
              </svg>`
              return sharp(Buffer.from(svg)).png().toBuffer()
            }
            module.exports = { calendarCard }
        }
}

const feature = (module, exports, require) => {
        // CHRONA — Penjaga Kalender: tanggal (kartu canvas), hitung hari
        const D = require('../../lib/daily'), NU = require('../../lib/npcutil'), P = require('../../lib/profiledb')
        const card = require('../../lib/daycard')
        const MON = { jan: 1, januari: 1, feb: 2, februari: 2, mar: 3, maret: 3, apr: 4, april: 4, mei: 5, jun: 6, juni: 6, jul: 7, juli: 7, agu: 8, agt: 8, agustus: 8, sep: 9, sept: 9, september: 9, okt: 10, oktober: 10, nov: 11, november: 11, des: 12, desember: 12 }
        const dim = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate()
        const rel = (n) => n === 0 ? 'hari ini' : n === 1 ? 'besok' : n === -1 ? 'kemarin' : n > 0 ? `${n} hari lagi` : `${-n} hari lalu`
        const span = (n) => { n = Math.abs(n); const w = Math.floor(n / 7), d = n % 7; return n >= 7 ? `${n} hari (${w} minggu${d ? ' ' + d + ' hari' : ''})` : `${n} hari` }
        function workdays(a, b) { let c = 0, s = a, e = b; if (diffSign(a, b) < 0) [s, e] = [b, a]; for (let n = D.diffDays(s, e), i = 1; i <= n; i++) { const x = D.addDays(s, i); if (D.isWorkday(x)) c++ } return c }
        const diffSign = (a, b) => Math.sign(D.diffDays(a, b))
        const withDow = (o) => ({ ...o, dow: D.dowOf(o.y, o.m, o.d) })
        const info = (o) => { const h = D.hijri(o), w = D.weton(o); return `${D.fmtDate(withDow(o))}\n${h.text} • ${w.hari} ${w.pasaran} (neptu ${w.neptu})` }

        function age(b, t) {
          let y = t.y - b.y, m = t.m - b.m, d = t.d - b.d
          if (d < 0) { m--; d += dim(t.m === 1 ? t.y - 1 : t.y, t.m === 1 ? 12 : t.m - 1) }
          if (m < 0) { y--; m += 12 }
          return { y, m, d }
        }

        module.exports = {
          name: 'tanggal',
          alias: ['kalender', 'calendar', 'date', 'hitunghari'],   // countdown/selisih/tambahhari/umur/usia dimiliki plugin ekstra (countdown, umur) sejak versi lama; alias dobel dihapus v4.7.6
          category: 'world',
          cmds: ['tanggal', 'hitunghari'],
          desc: 'Kalender bergambar, libur nasional, hitung hari, umur (Chrona)',
          run: async ({ sock, m, command, args, text, prefix, reply }) => {
            const jid = m.sender, t = D.now(), today = { y: t.y, m: t.m, d: t.d }
            const done = (body, n = 2) => reply(`${NU.head('chrona', jid)}\n\n${body}${NU.bump(jid, 'chrona', n)}`)

            // ── KALENDER (CANVAS) ──
            if (['tanggal', 'kalender', 'calendar', 'date'].includes(command)) {
              let y = t.y, mo = t.m
              for (const a of args.map(x => x.toLowerCase())) {
                let q
                if ((q = a.match(/^(\d{4})[-/](\d{1,2})$/))) { y = +q[1]; mo = +q[2] }
                else if (/^\d{4}$/.test(a)) y = +a
                else if (MON[a]) mo = MON[a]
                else if (/^\d{1,2}$/.test(a) && +a >= 1 && +a <= 12) mo = +a
                else if (a === 'depan' || a === 'next') { mo++; if (mo > 12) { mo = 1; y++ } }
                else if (a === 'lalu' || a === 'prev') { mo--; if (mo < 1) { mo = 12; y-- } }
              }
              if (mo < 1 || mo > 12 || y < 1900 || y > 2100) return reply(`Contoh: ${prefix}tanggal  |  ${prefix}tanggal maret 2027  |  ${prefix}tanggal 2027-08  |  ${prefix}tanggal depan`)
              const img = await card.calendarCard({ y, m: mo, today, botname: require('../../lib/settingsdb').get('botname') })
              const cur = y === t.y && mo === t.m, h = D.holidayOn(today), nx = D.nextHolidays(today, 1)[0]
              const cap = cur
                ? `${NU.head('chrona', jid)}\n\n${info(today)}\nMinggu ke-${D.isoWeek(today)} • hari ke-${D.dayOfYear(today)} dari ${D.isLeap(t.y) ? 366 : 365}\n${h ? `Hari ini: *${h.n}*\n` : ''}${nx && !h ? `Libur berikutnya: ${nx.n} (${rel(nx.in)})\n` : ''}\n_Hijriah perkiraan (±1 hari). Coba: ${prefix}tanggal maret 2027_`
                : `${NU.head('chrona', jid)}\n\nKalender ${D.MONTHS[mo - 1]} ${y}\n_Libur: ${prefix}harilibur  |  Hitung hari: ${prefix}hitunghari <tgl>_`
              await sock.sendMessage(m.chat, { image: img, caption: cap + NU.bump(jid, 'chrona', 2) }, { quoted: m }); return
            }

            // ── HITUNG HARI ──
            if (['hitunghari', 'countdown', 'selisih'].includes(command)) {
              const a = D.takeDate(text, today); if (!a.date) return reply(`Contoh:\n${prefix}hitunghari 17-08-2027  (dari hari ini)\n${prefix}selisih 01-01-2026 31-12-2026  (dua tanggal)\nFormat: dd-mm-yyyy, yyyy-mm-dd, atau "17 agustus 2027".`)
              const b = D.takeDate(a.rest, today), from = b.date ? a.date : today, to = b.date || a.date, n = D.diffDays(from, to)
              const wd = workdays(from, to)
              return done(`*${b.date ? 'SELISIH TANGGAL' : 'HITUNG MUNDUR'}*\n\n${b.date ? `Dari: ${D.fmtDate(withDow(from))}\n` : ''}${b.date ? 'Ke  : ' : 'Tanggal: '}${D.fmtDate(withDow(to))}\n\n⏳ *${n === 0 ? 'Hari yang sama' : n > 0 ? span(n) + (b.date ? '' : ' lagi') : span(n) + (b.date ? ' sebelumnya' : ' yang lalu')}*\n💼 Hari kerja: ${wd} (tanpa Sabtu, Minggu, dan libur)\n\n${info(to)}`)
            }
            if (command === 'tambahhari') {
              const n = parseInt(args[0]); if (!Number.isFinite(n) || Math.abs(n) > 36500) return reply(`Contoh: ${prefix}tambahhari 100  |  ${prefix}tambahhari -30  |  ${prefix}tambahhari 45 17-08-2026`)
              const base = D.takeDate(args.slice(1).join(' '), today).date || today, r = D.addDays(base, n)
              return done(`*${n >= 0 ? '+' : ''}${n} hari dari ${D.fmtDate(withDow(base))}*\n\n➡️ ${info(r)}\n${D.holidayOn(r) ? `🔴 Bertepatan dengan: ${D.holidayOn(r).n}` : ''}`)
            }

            // ── UMUR ──
            if (['umur', 'usia'].includes(command)) {
              const b = D.takeDate(text, today).date || (P.get(jid).bday ? D.parseDate(P.get(jid).bday) : null)
              if (!b) return reply(`Contoh: ${prefix}umur 31-01-2000\nSimpan tanggal lahir supaya tak perlu mengetik lagi: ${prefix}setlahir 31-01-2000`)
              if (D.diffDays(b, today) < 0) return reply('Tanggal lahir itu ada di masa depan 😄')
              const a = age(b, today), total = D.diffDays(b, today)
              let nb = D.parseDate(`${b.d}-${b.m}-${t.y}`) || { y: t.y, m: 2, d: 28, dow: 0 }; if (D.diffDays(today, nb) < 0) nb = D.parseDate(`${b.d}-${b.m}-${t.y + 1}`) || { y: t.y + 1, m: 2, d: 28 }
              const z = D.zodiak(b), s = D.shio(b), w = D.weton(b), nd = D.diffDays(today, nb)
              return done(`*UMUR KAMU*\n\n🎂 Lahir: ${D.fmtDate(withDow(b))}\n📈 *${a.y} tahun ${a.m} bulan ${a.d} hari*\n🗓️ Sudah menjalani ${total.toLocaleString('id-ID')} hari (± ${Math.floor(total / 7).toLocaleString('id-ID')} minggu)\n🎉 Ulang tahun berikutnya: ${nd === 0 ? '*HARI INI! Selamat ulang tahun!*' : rel(nd)} (${D.fmtDate(withDow(nb))})\n\n✨ Zodiak ${z.name} • Shio ${s.name}${s.edge ? '*' : ''} • Weton ${w.hari} ${w.pasaran}${s.edge ? '\n_*lahir Jan–Feb: shio mengikuti Imlek, bisa berbeda_' : ''}`)
            }
          },
        }
    }

dioRegister("world/chrona", feature, libs)

let handler = (m, ctx) => dioRun("world/chrona", m, ctx)

handler.command = ["tanggal", "kalender", "calendar", "date", "hitunghari"]
handler.hide = ["kalender", "calendar", "date"]
handler.help = ["tanggal", "hitunghari"]
handler.tags = ["world"]

export default handler
