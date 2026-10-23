// .bacamanga — baca manga / manhwa / manhua langsung di chat + unduh PDF / CBZ untuk dibaca offline.
// Sumber: MangaDex (API publik). Hanya konten rating aman/suggestive; chapter tautan-luar (penerbit resmi) tidak ikut.
//   .bacamanga <judul> [--id|--en|--es...]   cari           .bacamanga <no>            detail + daftar chapter
//   .bacamanga bab [hal]                      daftar chapter .bacamanga baca <ch> [hal]  baca di chat (8 halaman per kiriman)
//   .bacamanga unduh <ch|dari-sampai> [pdf|cbz] [hd]         .bacamanga lanjut         lanjut bacaan terakhir
import { baca as L } from '../../lib/scraper.js'
import { asisten as K } from '../../lib/core-data.js'
import { B } from '../../lib/core-data.js'
import { fromSpec } from '../../lib/wa.js'
const LINE = '─────────────────────', PER_SEND = 8, PER_LIST = 20, MAX_DL_PAGES = 200, TTL = 60 * 60 * 1000
const sess = new Map(), busy = new Set()
const get = (jid) => { const s = sess.get(jid); if (s && Date.now() - s.t < TTL) { s.t = Date.now(); return s } sess.delete(jid); return null }
const put = (jid, patch) => { const s = get(jid) || { t: Date.now() }; Object.assign(s, patch, { t: Date.now() }); sess.set(jid, s); if (sess.size > 500) sess.delete(sess.keys().next().value); return s }

const STATUS = { ongoing: 'Berlanjut', completed: 'Tamat', hiatus: 'Hiatus', cancelled: 'Dibatalkan' }
const chTitle = (c) => `Ch ${L.chLabel(c)}${c.vol ? ' (Vol ' + c.vol + ')' : ''}${c.title ? ' — ' + L.clip(c.title, 40) : ''}`

function parseFlags(args) {
  let lang = null, hd = false, fmt = null; const rest = [], dl = /^(unduh|download|dl|simpan|offline)$/i.test(args[0] || '')   // kata polos pdf/cbz/hd hanya dikenali setelah "unduh"
  for (const a of args) {
    const l = a.toLowerCase(), dash = dl ? '-{0,2}' : '--?'
    if (new RegExp(`^${dash}(hd|asli)$`).test(l)) hd = true
    else if (new RegExp(`^${dash}(pdf|cbz)$`).test(l)) fmt = l.replace(/-/g, '')
    else if (/^--[a-z]{2}(-[a-z]{2})?$/.test(l)) lang = l.slice(2)
    else rest.push(a)
  }
  return { lang, hd, fmt, rest }
}
const pickLang = (manga, want) => {
  const have = manga.langs || []
  if (want) return have.includes(want) ? want : null
  return ['id', 'en'].find(l => have.includes(l)) || have[0] || null
}
async function sendCover(sock, m, url, caption) {
  try { const r = await L.getBuf(url, 2 * 1024 * 1024, { tries: 2, timeout: 15000 }); if (L.isImg(r.buffer)) return await sock.sendMessage(m.chat, { image: r.buffer, caption }, { quoted: m }) } catch {}
  return sock.sendMessage(m.chat, { text: caption }, { quoted: m })
}
function chapterListText(s, page) {
  const list = s.chapters, pages = Math.max(1, Math.ceil(list.length / PER_LIST)), p = Math.min(Math.max(1, page), pages)
  const rows = list.slice((p - 1) * PER_LIST, p * PER_LIST).map(c => `• ${chTitle(c)} — ${c.pages} hlm`)
  return { p, pages, text: `${B('CHAPTER')} (${L.langName(s.lang)}) • ${list.length} chapter\n${LINE}\n${rows.join('\n')}\n${LINE}\nHalaman daftar ${p}/${pages}` }
}

async function doSearch(ctx, q, lang) {
  const { m, reply, prefix } = ctx
  const list = await L.mangaSearch(q, lang)
  if (!list.length) return reply(`✕ Tidak ada manga bertemu "${q}"${lang ? ' dalam bahasa ' + L.langName(lang) : ''}.\nCoba judul lain / bahasa lain (--en, --id).`)
  put(m.sender, { results: list, want: lang || null, manga: null, chapters: null })
  const rows = list.map((x, i) => `${i + 1}. *${x.title}*${x.year ? ' (' + x.year + ')' : ''}\n   ${STATUS[x.status] || x.status || '-'} • bahasa: ${x.langs.slice(0, 5).join(', ') || '-'}`)
  return reply(`${B('HASIL MANGA')}\n${LINE}\n${rows.join('\n')}\n${LINE}\nPilih: *${prefix}bacamanga <no>*   _(sumber: MangaDex)_`)
}
async function doPick(ctx, no) {
  const { sock, m, reply, prefix } = ctx, s = get(m.sender)
  if (!s || !s.results) return reply(`Belum ada hasil pencarian. Cari dulu: ${prefix}bacamanga <judul>`)
  const x = s.results[no - 1]; if (!x) return reply(`✕ Nomor tidak valid (1-${s.results.length}).`)
  const lang = pickLang(x, s.want)
  if (!lang) return reply(`✕ *${x.title}* tidak punya chapter berbahasa ${L.langName(s.want)}. Tersedia: ${x.langs.join(', ') || '-'}.\nCoba: ${prefix}bacamanga ${x.title} --${x.langs[0] || 'en'}`)
  const chapters = await L.mangaChapters(x.id, lang)
  if (!chapters.length) return reply(`✕ Belum ada chapter yang bisa dibaca di sini untuk *${x.title}* (${L.langName(lang)}). Kemungkinan hanya tersedia di penerbit resmi.`)
  put(m.sender, { manga: x, lang, chapters })
  const cap = [B(x.title.toUpperCase()), LINE, x.alt ? `Judul lain : ${x.alt}` : '', `Status     : ${STATUS[x.status] || x.status || '-'}${x.year ? ' • ' + x.year : ''}`,
    `Genre      : ${x.tags.join(', ') || '-'}`, `Bahasa     : ${L.langName(lang)} (${chapters.length} chapter)${x.langs.length > 1 ? ' • lainnya: ' + x.langs.filter(l => l !== lang).slice(0, 6).join(', ') : ''}`,
    '', L.clip(x.desc, 450) || 'Belum ada sinopsis.', '', `*Baca:* ${prefix}bacamanga baca ${L.chLabel(chapters[0])}`, `*Unduh:* ${prefix}bacamanga unduh ${L.chLabel(chapters[0])}`, `_Daftar chapter: ${prefix}bacamanga bab_`].filter(l => l !== '').join('\n')
  if (x.cover) await sendCover(sock, m, x.cover, cap); else await reply(cap)
  return reply(chapterListText(get(m.sender), 1).text + `\nChapter lain: ${prefix}bacamanga bab 2`)
}
async function doRead(ctx, label, from) {
  const { sock, m, reply, prefix } = ctx, s = get(m.sender)
  if (!s || !s.chapters) return reply(`Pilih manga dulu: ${prefix}bacamanga <judul>, lalu ${prefix}bacamanga <no>`)
  const c = L.findChapter(s.chapters, label); if (!c) return reply(`✕ Chapter "${label}" tidak ada. Lihat daftar: ${prefix}bacamanga bab`)
  const pages = await L.chapterPages(c.id, false), start = Math.max(1, from || 1)
  if (start > pages.length) return reply(`✕ Chapter ini hanya ${pages.length} halaman.`)
  const end = Math.min(pages.length, start + PER_SEND - 1)
  const imgs = await L.fetchAll(pages.slice(start - 1, end), { conc: 4, maxTotal: 40 * 1024 * 1024 })
  for (let i = 0; i < imgs.length; i++) {
    const n = start + i, cap = i === 0 ? `${s.manga.title}\n${chTitle(c)} • hlm ${start}-${end}/${pages.length}` : undefined
    await sock.sendMessage(m.chat, { image: imgs[i].buf, ...(cap ? { caption: cap } : {}) }, i === 0 ? { quoted: m } : {})
    if (i < imgs.length - 1) await L.sleep(500)
  }
  const idx = s.chapters.indexOf(c), nxt = s.chapters[idx + 1]
  K.set(m.sender, 'bacamanga', { id: s.manga.id, title: s.manga.title, lang: s.lang, ch: L.chLabel(c), page: end, total: pages.length })
  const tail = end < pages.length ? `Lanjut: *${prefix}bacamanga baca ${L.chLabel(c)} ${end + 1}*` : nxt ? `Chapter selesai. Berikutnya: *${prefix}bacamanga baca ${L.chLabel(nxt)}*` : 'Chapter terakhir yang tersedia. Tamat untuk sekarang ✓'
  return reply(`${tail}\nSimpan offline: ${prefix}bacamanga unduh ${L.chLabel(c)}`)
}
function parseRange(list, spec) {
  const m = String(spec || '').match(/^([\w.]+)(?:\s*[-–~]\s*([\w.]+))?$/); if (!m) return null
  const a = L.findChapter(list, m[1]), b = m[2] ? L.findChapter(list, m[2]) : a; if (!a || !b) return null
  let i = list.indexOf(a), j = list.indexOf(b); if (i > j) [i, j] = [j, i]
  return list.slice(i, j + 1)
}
async function doDownload(ctx, spec, fl) {
  const { sock, m, reply, prefix } = ctx, s = get(m.sender)
  if (!s || !s.chapters) return reply(`Pilih manga dulu: ${prefix}bacamanga <judul>, lalu ${prefix}bacamanga <no>`)
  const sel = parseRange(s.chapters, spec); if (!sel) return reply(`Format: ${prefix}bacamanga unduh <chapter> [pdf|cbz] [hd]\nContoh: ${prefix}bacamanga unduh 12  •  ${prefix}bacamanga unduh 1-5 cbz`)
  const total = sel.reduce((n, c) => n + c.pages, 0)
  if (total > MAX_DL_PAGES) return reply(`✕ ${sel.length} chapter = ${total} halaman, batasnya ${MAX_DL_PAGES} halaman per berkas.\nBagi jadi rentang lebih kecil, mis. ${prefix}bacamanga unduh ${L.chLabel(sel[0])}-${L.chLabel(sel[Math.max(0, Math.floor(sel.length / 2) - 1)])}`)
  const fmt = fl.fmt || 'pdf'
  await reply(`⏳ Mengunduh ${sel.length} chapter (${total} halaman) → ${fmt.toUpperCase()}${fl.hd ? ' kualitas asli' : ''}…\nMohon tunggu, jangan kirim perintah unduh lagi dulu.`)
  const all = []
  for (const c of sel) {
    const pg = await L.chapterPages(c.id, fl.hd), imgs = await L.fetchAll(pg, { conc: 4, maxTotal: 90 * 1024 * 1024 })
    all.push(...imgs); await L.sleep(300)
  }
  const buf = fmt === 'cbz' ? L.imagesToCbz(all) : await L.imagesToPdf(all)
  if (buf.length > 95 * 1024 * 1024) return reply(`✕ Berkas ${(buf.length / 1048576).toFixed(0)} MB, terlalu besar. Kurangi jumlah chapter atau pakai mode hemat (tanpa hd).`)
  const first = L.chLabel(sel[0]), last = L.chLabel(sel[sel.length - 1]), name = `${L.slug(s.manga.title)}-ch${first}${first !== last ? '-' + last : ''}-${s.lang}.${fmt}`
  return sock.sendMessage(m.chat, { document: buf, mimetype: fmt === 'cbz' ? 'application/vnd.comicbook+zip' : 'application/pdf', fileName: name,
    caption: `${B('MANGA OFFLINE')}\n${s.manga.title}\nCh ${first}${first !== last ? '–' + last : ''} • ${all.length} hlm • ${(buf.length / 1048576).toFixed(1)} MB\n${fmt === 'cbz' ? '_CBZ: buka dengan Mihon / Tachiyomi, Moon+ Reader, CDisplayEx_' : '_PDF: buka dengan aplikasi PDF apa saja_'}\n_Sumber: MangaDex — hargai kreator, dukung rilis resminya._` }, { quoted: m })
}
async function doContinue(ctx) {
  const { m, reply, prefix } = ctx, last = K.get(m.sender, 'bacamanga', null)
  if (!last) return reply(`Belum ada riwayat baca. Mulai: ${prefix}bacamanga <judul>`)
  let s = get(m.sender)
  if (!s || !s.manga || s.manga.id !== last.id) {
    const x = await L.mangaGet(last.id); if (!x) return reply('✕ Manga terakhir tidak ditemukan lagi.')
    put(m.sender, { manga: x, lang: last.lang, chapters: await L.mangaChapters(x.id, last.lang), results: null }); s = get(m.sender)
  }
  const cur = L.findChapter(s.chapters, last.ch); if (!cur) return reply('✕ Chapter terakhir tidak ditemukan.')
  if (last.total && last.page < last.total) return doRead(ctx, last.ch, last.page + 1)
  const nxt = s.chapters[s.chapters.indexOf(cur) + 1]; if (!nxt) return reply(`Kamu sudah sampai chapter terakhir *${last.title}* (Ch ${last.ch}).`)
  return doRead(ctx, L.chLabel(nxt), 1)
}

const spec = {
  name: 'bacamanga', alias: ['mangaread', 'readmanga', 'mdx', 'mangadex', 'bacakomik', 'mangabaca'], category: 'anime', cmds: ['bacamanga'],
  desc: 'Baca manga di chat + unduh PDF/CBZ offline: .bacamanga <judul> • <no> • baca <ch> • unduh <ch> [pdf|cbz] • lanjut',
  run: async (ctx) => {
    const { m, args, prefix, reply } = ctx, p = prefix + 'bacamanga', fl = parseFlags(args), a = fl.rest, sub = (a[0] || '').toLowerCase()
    if (!a.length) return reply([B('BACA MANGA'), LINE, `${p} <judul> [--id|--en]  — cari`, `${p} <no>  — pilih hasil`, `${p} bab [hal]  — daftar chapter`, `${p} baca <chapter> [hal]  — baca di chat`, `${p} unduh <chapter|1-5> [pdf|cbz] [hd]  — simpan offline`, `${p} lanjut  — lanjut bacaan terakhir`, '', `Contoh: ${p} one piece --id`, '_Sumber MangaDex. Chapter resmi penerbit (tautan luar) tidak bisa dibuka di sini._'].join('\n'))
    if (busy.has(m.sender)) return reply('⏳ Proses sebelumnya masih berjalan, tunggu selesai dulu.')
    busy.add(m.sender)
    try {
      if (/^\d{1,2}$/.test(sub) && a.length === 1) return await doPick(ctx, +sub)
      if (['bab', 'chapter', 'daftar'].includes(sub)) { const s = get(m.sender); if (!s || !s.chapters) return reply(`Pilih manga dulu: ${p} <judul>`); const r = chapterListText(s, parseInt(a[1], 10) || 1); return reply(r.text + (r.p < r.pages ? `\nBerikutnya: ${p} bab ${r.p + 1}` : '')) }
      if (['baca', 'read', 'buka'].includes(sub)) { if (!a[1]) return reply(`Format: ${p} baca <chapter> [halaman]`); return await doRead(ctx, a[1], parseInt(a[2], 10) || 1) }
      if (['unduh', 'download', 'dl', 'simpan', 'offline'].includes(sub)) { if (!a[1]) return reply(`Format: ${p} unduh <chapter|dari-sampai> [pdf|cbz] [hd]`); return await doDownload(ctx, a.slice(1).join(' '), fl) }
      if (['lanjut', 'continue', 'terakhir'].includes(sub)) return await doContinue(ctx)
      return await doSearch(ctx, a.join(' ').slice(0, 100), fl.lang)
    } catch (e) {
      console.log('[bacamanga]', e.message)
      return reply(e.code === 'ETOOBIG' ? '✕ Ukuran file melebihi batas, kurangi jumlah chapter atau pakai mode hemat.' : '✕ Gagal: ' + e.message)
    } finally { busy.delete(m.sender) }
  },
}

export default fromSpec(spec)
