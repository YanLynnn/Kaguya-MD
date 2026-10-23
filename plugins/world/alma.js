import { dioRun, dioRegister } from '../../lib/plugin-engine.js'

// ───────── logika fitur (sebelumnya di lib/) ─────────
const feature = (module, exports, require) => {
        // ALMA — Sekretaris Pribadi: ringkasan harian, profil (kota & tanggal lahir)
        const D = require('../../lib/daily'), NU = require('../../lib/npcutil'), P = require('../../lib/profiledb'), G = require('../../lib/geo')
        const hhmm = (ms) => { const p = D.parts(new Date(ms)); return `${D.pad(p.hh)}:${D.pad(p.mm)}` }
        module.exports = {
          name: 'harini',
          alias: ['hariini', 'today', 'briefing', 'ringkasan', 'setkota', 'setlahir'],
          category: 'world',
          cmds: ['harini', 'setkota', 'setlahir'],
          desc: 'Ringkasan harian, simpan kota & tanggal lahir (Alma)',
          run: async ({ m, command, text, args, prefix, reply, pushname }) => {
            const jid = m.sender, head = NU.head('alma', jid)

            if (command === 'setkota') {
              if (!text) return reply(`${head}\n\nKota tersimpan: *${P.get(jid).city || '(belum ada)'}*\nContoh: ${prefix}setkota bandung`)
              const c = await G.resolve(text); if (!c) return reply(`${head}\n\nKota "${text}" tidak ketemu. Coba nama lain.`)
              P.set(jid, 'city', text.trim().slice(0, 40)); return reply(`${head}\n\nSiap! Kota kamu *${c.name}*. Sekarang ${prefix}salat, ${prefix}cuaca, dan ${prefix}harini otomatis memakai kota ini.`)
            }
            if (command === 'setlahir') {
              const b = D.takeDate(text).date; if (!b) return reply(`${head}\n\nContoh: ${prefix}setlahir 31-01-2000\nTersimpan: ${P.get(jid).bday || '(belum ada)'}`)
              if (D.diffDays(b, D.now()) < 0) return reply('Tanggal lahir tidak boleh di masa depan.')
              P.set(jid, 'bday', `${b.y}-${D.pad(b.m)}-${D.pad(b.d)}`); return reply(`${head}\n\nTanggal lahir tersimpan: *${D.fmtDate(b)}*. Cek ${prefix}umur atau ${prefix}weton.`)
            }

            // ── RINGKASAN HARI INI ──
            const t = D.now(), o = { y: t.y, m: t.m, d: t.d }, prof = P.get(jid), h = D.holidayOn(o), nx = D.nextHolidays(o, 1)[0], hj = D.hijri(o)
            let out = `${head}\n\n*${D.greet(t.hh)}, ${pushname || 'Kak'}!*\n\n📅 ${D.fmtDate({ ...o, dow: t.dow })}\n🌙 ${hj.text} • ${D.DAYS[t.dow]} ${D.pasaranOf(o)}\n🕐 Pukul ${D.pad(t.hh)}:${D.pad(t.mm)}`
            out += h ? `\n🔴 Hari ini: *${h.n}*` : nx ? `\n🏖️ Libur berikutnya: ${nx.n} (${nx.in} hari lagi)` : ''
            if (prof.bday) { const b = D.parseDate(prof.bday); if (b) { let n = D.parseDate(`${b.d}-${b.m}-${t.y}`) || { y: t.y, m: 2, d: 28 }; if (D.diffDays(o, n) < 0) n = D.parseDate(`${b.d}-${b.m}-${t.y + 1}`) || n; const dd = D.diffDays(o, n); if (dd === 0) out += `\n🎂 *Selamat ulang tahun ke-${t.y - b.y}!* 🎉`; else if (dd <= 14) out += `\n🎂 Ulang tahunmu ${dd} hari lagi` } }
            let city = null
            if (prof.city) {
              city = await G.resolve(prof.city)
              if (city) {
                const lt = G.nowAt(city.tz), pt = D.prayerTimes({ y: lt.y, m: lt.m, d: lt.d }, city.lat, city.lng, city.tz), nowH = lt.hh + lt.mm / 60, w = ['subuh', 'dzuhur', 'ashar', 'maghrib', 'isya'], nk = w.find(k => pt[k] > nowH) || 'subuh'
                out += `\n🕌 Salat berikutnya (${city.name}): *${nk[0].toUpperCase() + nk.slice(1)} ${D.hm(pt[nk])}*`
                try { const axios = require('axios'), r = await axios.get('https://api.open-meteo.com/v1/forecast', { timeout: 6000, params: { latitude: city.lat, longitude: city.lng, timezone: 'auto', current: 'temperature_2m,weather_code', daily: 'precipitation_probability_max', forecast_days: 1 } }); out += `\n🌤️ Cuaca: ${Math.round(r.data.current.temperature_2m)}°C, peluang hujan ${r.data.daily.precipitation_probability_max[0] ?? 0}%` } catch {}
              }
            } else out += `\n💡 Atur kota dengan ${prefix}setkota <kota> untuk salat & cuaca otomatis`
            out += `\n\n💬 _${D.quoteOf(o)}_`
            return reply(out + NU.bump(jid, 'alma', 2))
          },
        }
    }

dioRegister("world/alma", feature)

let handler = (m, ctx) => dioRun("world/alma", m, ctx)

handler.command = ["harini", "hariini", "today", "briefing", "ringkasan", "setkota", "setlahir"]
handler.hide = ["hariini", "today", "briefing", "ringkasan"]
handler.help = ["harini", "setkota", "setlahir"]
handler.tags = ["world"]

export default handler
