import { dioRun, dioRegister } from '../../lib/plugin-engine.js'

// ───────── logika fitur (sebelumnya di lib/) ─────────
const feature = (module, exports, require) => {
// KARTU LIVE: Kaguya Musik — pemutar musik di dalam kartu (lagu dari Google Drive, scroll ▲▼, seek, volume)
//   .musikbot                 -> kartu pemutar, playlist mulai dari lagu 1
//   .musikbot <no|judul>      -> kartu pemutar, playlist mulai dari lagu itu
//   .musikbot list [hal]     -> daftar teks (cadangan bila kartu tidak tampil)
//   .musikbot refresh         -> (owner) scan ulang folder Drive
//   .musikbot add <link drive> | <Artis - Judul>   -> (owner) tambah lagu manual
//   .musikbot del <no>        -> (owner) hapus lagu manual
//   .musikbot cari <kata>     -> cari lagu (hasil teks)
//   .musikbot acak            -> kartu + lagu acak
//   .musikbot info <no>       -> detail lagu (durasi, jumlah putar, status favorit)
//   .musikbot fav [no]        -> tanpa nomor: kartu berisi favoritmu; dengan nomor: tambah/hapus favorit
//   .musikbot top             -> 10 lagu paling sering diputar
//   .musikbot lanjut          -> lanjut dari lagu terakhir yang kamu putar
const M = require('../../lib/musik')
const ST = require('../../lib/style')
const { buildMusikHtml } = require('../../lib/cards/musik')
const { sendHtmlCard } = require('../../lib/htmlcard')

// ── teks "bot mengetik sendiri" di bawah kartu: makin tinggi volume, makin asik musiknya ──
const sleep = (ms) => new Promise(r => setTimeout(r, ms))
const LINES = [
  (n) => `@${n} semakin tinggi volumenya, semakin asik musiknya. Jangan biarkan semangatmu berhenti, naikkan volumenya sekarang! 🔊`,
  (n) => `Gas @${n}! Putar kencang-kencang, makin keras makin hidup. Jangan biarkan semangatmu padam! 🎶`,
  (n) => `@${n}, naikkan volumenya sampai mentok. Musiknya makin asik kalau makin kencang, semangatmu jangan berhenti! 🔥`,
  (n) => `Malam ini milik @${n}. Volume tinggi, hati tenang, semangat jangan pernah berhenti! 🎧`,
]
const MAX_HTML = Math.max(200, Number(process.env.MUSIK_MAX_HTML_KB) || 700) * 1024   // batas aman ukuran HTML kartu
async function sendAudio(sock, m, t, reply) {
  try {
    const f = await M.ensureHq(t)
    await sock.sendMessage(m.chat, { audio: require('fs').readFileSync(f), mimetype: 'audio/mpeg', ptt: false, fileName: `${t.artist} - ${t.title}.mp3` }, { quoted: m })
    return true
  } catch (e) { console.log('[musikbot audio]', e.message); if (reply) reply('Audio gagal dikirim: ' + e.message); return false }
}
const busy = new Set() // chat yang kartunya sedang disiapkan (cegah perintah ganda saat lagu masih diunduh)
const turns = new Map() // chat -> antrean, supaya tiap user yang memakai perintah mendapat giliran sendiri
async function typeText(sock, m, name) {
  const prev = turns.get(m.chat) || Promise.resolve()
  const run = prev.then(async () => {
    const full = LINES[Math.floor(Math.random() * LINES.length)](name)
    const words = full.split(' '), steps = Math.min(8, words.length), per = Math.ceil(words.length / steps)
    const part = (i) => words.slice(0, Math.min(words.length, per * i)).join(' ')
    const mentions = [m.sender]
    try { await sock.sendPresenceUpdate('composing', m.chat) } catch {}
    await sleep(900)
    let sent = await sock.sendMessage(m.chat, { text: part(1) + ' ▍', mentions }, { quoted: m })
    for (let i = 2; i <= steps; i++) {
      await sleep(650)
      const t = part(i) + (i < steps ? ' ▍' : '')
      try { await sock.sendMessage(m.chat, { text: t, edit: sent.key, mentions }) } catch { break }
    }
    try { await sock.sendPresenceUpdate('paused', m.chat) } catch {}
  }).catch(e => console.log('[musikbot typing]', e.message))
  turns.set(m.chat, run)
  await run
  if (turns.get(m.chat) === run) turns.delete(m.chat)
}

module.exports = {
  name: 'musikbot',
  sendAudio,
  alias: ['dmusik', 'dmp'],
  category: 'live',
  desc: 'Pemutar musik: kartu playlist, cari, acak, favorit, top, lanjut + kirim audio',
  run: async ({ sock, m, reply, args, text, prefix, pushname, isOwner }) => {
    const sub = (args[0] || '').toLowerCase()

    // ── owner: refresh / add / del ──
    if (['refresh', 'scan', 'update'].includes(sub)) {
      if (!isOwner) return reply(((global.mess && global.mess.owner) || 'Fitur ini khusus owner.'))
      const list = await M.getTracks(true)
      return reply(list.length ? `Daftar musik diperbarui: ${list.length} lagu.` : 'Tidak ada lagu terbaca. Pastikan folder Drive dibagikan ke "Siapa saja yang memiliki link".')
    }
    if (sub === 'add') {
      if (!isOwner) return reply(((global.mess && global.mess.owner) || 'Fitur ini khusus owner.'))
      const [link, ...nm] = text.replace(/^add\s+/i, '').split('|')
      const t = M.addManual(link, nm.join('|').trim())
      return reply(t ? `Ditambahkan: ${t.artist} - ${t.title}` : `Format: ${prefix}musikbot add <link file drive> | Artis - Judul`)
    }
    if (sub === 'del') {
      if (!isOwner) return reply(((global.mess && global.mess.owner) || 'Fitur ini khusus owner.'))
      const list = await M.getTracks(), t = M.find(list, args[1])
      return reply(t && M.removeManual(t.id) ? `Dihapus: ${t.title}` : 'Hanya lagu tambahan manual yang bisa dihapus (cek nomornya).')
    }

    const tracks = await M.getTracks()
    if (!tracks.length) return reply('Belum ada lagu terbaca dari Google Drive.\nPastikan folder dibagikan ke "Siapa saja yang memiliki link", lalu ketik ' + prefix + 'musikbot refresh (owner).')

    // ── daftar teks (cadangan bila kartu tidak tampil): .musikbot list [halaman] ──
    if (['list', 'daftar', 'teks'].includes(sub)) {
      const per = 25, pages = Math.max(1, Math.ceil(tracks.length / per)), pg = Math.min(pages, Math.max(1, parseInt(args[1], 10) || 1))
      const rows = tracks.slice((pg - 1) * per, pg * per).map((t, i) => `${(pg - 1) * per + i + 1}. ${ST.cut(t.artist + ' - ' + t.title, 60)}`).join('\n')
      return reply(`${ST.B(String(global.namebot || 'Kaguya').toUpperCase() + ' MUSIK')} (${tracks.length} lagu)\n━━━━━━━━━━━━━━━━━━━━\n${rows}\n\n_Halaman ${pg}/${pages} • ${prefix}musikbot list <hal>_\n_Kirim lagu: ${prefix}dmp3 <no|judul>_`)
    }

    const short = (t) => ST.cut(t.artist + ' - ' + t.title, 60)
    const withDur = (list) => list.map(t => ({ ...t, dur: M.fmtDur(M.durOf(t.id)) === '-' ? '' : M.fmtDur(M.durOf(t.id)) }))
    const me = m.sender

    // ── cari ──
    if (['cari', 'search', 'find'].includes(sub)) {
      const q = text.replace(/^\S+\s*/, '').trim()
      if (!q) return reply(`Format: ${prefix}musikbot cari <kata>`)
      const hit = M.search(tracks, q)
      if (!hit.length) return reply(`Tidak ada lagu dengan kata \"${ST.cut(q, 40)}\".`)
      const rows = hit.slice(0, 20).map(({ t, i }) => `${i + 1}. ${short(t)}`).join('\n')
      return reply(`${ST.B('HASIL CARI')} (${hit.length})\n━━━━━━━━━━━━━━━━━━━━\n${rows}${hit.length > 20 ? `\n… dan ${hit.length - 20} lainnya` : ''}\n\n_Putar: ${prefix}musikbot <no> • Kirim audio: ${prefix}dmp3 <no>_`)
    }
    // ── info ──
    if (sub === 'info') {
      const t = M.find(tracks, text.replace(/^\S+\s*/, ''))
      if (!t) return reply(`Format: ${prefix}musikbot info <no|judul>`)
      const plays = (M.topPlays(9999).find(([id]) => id === t.id) || [0, 0])[1], fv = M.favs(me).includes(t.id)
      return reply(`${ST.B(t.title)}\nArtis   : ${t.artist}\nNomor   : ${tracks.indexOf(t) + 1} dari ${tracks.length}\nDurasi  : ${M.fmtDur(M.durOf(t.id))}\nDiputar : ${plays}x\nFavorit : ${fv ? 'ya' : 'belum'}\nBerkas  : ${ST.cut(t.file, 60)}\n\n_${prefix}dmp3 ${tracks.indexOf(t) + 1} untuk menerima audionya_`)
    }
    // ── top ──
    if (['top', 'populer', 'terpopuler'].includes(sub)) {
      const top = M.topPlays(10).map(([id, n]) => [tracks.find(t => t.id === id), n]).filter(([t]) => t)
      if (!top.length) return reply('Belum ada statistik putar. Putar beberapa lagu dulu.')
      return reply(`${ST.B('TOP LAGU')}\n━━━━━━━━━━━━━━━━━━━━\n` + top.map(([t, n], i) => `${i + 1}. ${short(t)} — ${n}x`).join('\n'))
    }
    // ── fav ──
    let prefer = [], favMode = false
    if (['fav', 'favorit', 'suka'].includes(sub)) {
      const arg = text.replace(/^\S+\s*/, '').trim()
      if (arg) {
        const t = M.find(tracks, arg); if (!t) return reply(`Lagu \"${ST.cut(arg, 40)}\" tidak ditemukan.`)
        const on = M.toggleFav(me, t.id)
        return reply(on ? `Ditambahkan ke favorit: ${short(t)}` : `Dihapus dari favorit: ${short(t)}`)
      }
      prefer = M.favs(me).map(id => tracks.findIndex(t => t.id === id)).filter(k => k >= 0)
      if (!prefer.length) return reply(`Favoritmu masih kosong.\nTambah: ${prefix}musikbot fav <no|judul>`)
      favMode = true
    }
    // ── lanjut / acak: tentukan lagu awal ──
    let forced = null
    if (['lanjut', 'resume', 'terakhir'].includes(sub)) {
      const id = M.lastPlayed(me); forced = tracks.find(t => t.id === id)
      if (!forced) return reply(`Belum ada riwayat putar. Mulai dengan ${prefix}musikbot <no>.`)
    }
    if (['acak', 'random', 'shuffle'].includes(sub)) forced = tracks[Math.floor(Math.random() * tracks.length)]

    let start = 0, picked = null
    if (forced) { picked = forced; start = tracks.indexOf(forced) }
    else if (favMode) start = prefer[0]
    else if (text.trim()) {
      picked = M.find(tracks, text)
      if (!picked) return reply(`Lagu "${ST.cut(text, 40)}" tidak ditemukan.\nKetik ${prefix}musikbot untuk melihat daftar.`)
      start = tracks.indexOf(picked)
    }
    if (busy.has(m.chat)) return reply('Kartu musik masih disiapkan, tunggu sebentar ya.')
    busy.add(m.chat)
    let wait = null
    try {
      try { await sock.sendPresenceUpdate('composing', m.chat) } catch {}
      try { wait = await sock.sendMessage(m.chat, { text: 'Menyiapkan ' + (global.namebot || 'Kaguya') + ' Musik... (pertama kali agak lama karena lagu diunduh dulu)' }, { quoted: m }) } catch {}
      const [thumb, bg, pl] = await Promise.all([M.getImage('thumb'), M.getImage('bg'), M.buildPlaylist(tracks, start, prefer)])
      M.warm(tracks)   // siapkan sisa lagu di belakang layar

      // 1) kartu HTML. Pesan kartu WA punya batas ukuran: kalau terlalu besar kartu tidak dirender sama sekali,
      //    jadi audio preview dibuang otomatis bila HTML melebihi MAX_HTML.
      const mk = (audio) => buildMusikHtml({ playerName: pushname || String(m.sender).split('@')[0], tracks: withDur(tracks), favIds: M.favs(me), prefix, thumbUri: thumb && thumb.uri, bgUri: bg && bg.uri, audio, start })
      let html = mk(pl.audio)
      if (Buffer.byteLength(html) > MAX_HTML) html = mk(new Map())
      const ok = await sendHtmlCard(sock, m, html, (global.namebot || 'Kaguya') + ' Musik', '🎵')
      if (wait) { try { await sock.sendMessage(m.chat, { delete: wait.key }) } catch {} wait = null }

      // 2) lagu pilihan dikirim sebagai pesan audio asli (pasti bisa diputar di WhatsApp)
      if (picked) { M.countPlay(me, picked.id); await sendAudio(sock, m, picked, reply) }
      if (ok) await typeText(sock, m, String(m.sender).split('@')[0])
    } catch (e) {
      console.log('[musikbot]', e.message)
      reply('Gagal menyiapkan kartu musik: ' + e.message)
    } finally {
      busy.delete(m.chat)
      if (wait) { try { await sock.sendMessage(m.chat, { delete: wait.key }) } catch {} }
    }
  },
}
    }

dioRegister("live/musikbot", feature)

let handler = (m, ctx) => dioRun("live/musikbot", m, ctx)

handler.command = ["musikbot", "dmusik", "dmp"]
handler.help = ["musikbot", "dmusik"]
handler.tags = ["live"]

export default handler
