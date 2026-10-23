import { adapt } from '../../lib/plugin-engine.js'
import { kartu } from '../../lib/core-data.js'
import { parsePhoneNumber } from 'awesome-phonenumber'
import moment from 'moment-timezone'
import sharp from 'sharp'

const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']

// foto default dibuat lokal (tanpa download), jadi tidak bergantung pada host gambar luar
let fotoDefaultCache = null
async function fotoDefault() {
  if (fotoDefaultCache) return fotoDefaultCache
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="640" viewBox="0 0 640 640">
    <rect width="640" height="640" fill="#cfd8dc"/>
    <circle cx="320" cy="250" r="110" fill="#90a4ae"/>
    <path d="M100 640c0-130 100-210 220-210s220 80 220 210z" fill="#90a4ae"/></svg>`
  fotoDefaultCache = await sharp(Buffer.from(svg)).png().toBuffer()
  return fotoDefaultCache
}

// jaga-jaga kalau nilainya NaN
const angka = (v, cadangan = 0) => (Number.isFinite(Number(v)) ? Number(v) : cadangan)

// format birthday: 17-8-2005
function bacaUlangTahun(birthday) {
  if (!birthday) return { teks: 'Belum di set', umur: '-' }
  const [d, bln, thn] = birthday.split('-').map(Number)
  const teks = `${d} ${BULAN[bln - 1]}${thn ? ' ' + thn : ''}`
  if (!thn) return { teks, umur: '-' }

  const now = new Date()
  const belumUlangTahun = now.getMonth() + 1 < bln || (now.getMonth() + 1 === bln && now.getDate() < d)
  return { teks, umur: `${now.getFullYear() - thn - (belumUlangTahun ? 1 : 0)} tahun` }
}

let handler = async (m, { conn }) => {
  const who = m.mentionedJid?.[0] || m.quoted?.sender || m.sender
  const user = global.db.data.users[who]
  if (!user) return m.reply(`🍅 ${global.namebot || 'Bot'} tidak menemukan user itu di database`)

  // kalau gagal ambil dari WA, pakai default
  const foto = await conn.profilePictureUrl(who, 'image').catch(() => null)
  const bio = (await conn.fetchStatus(who).catch(() => null))?.status || 'Tidak ada bio'
  const nama = user.registered ? user.name : await conn.getName(who)
  const nomor = (() => { const raw = who.split('@')[0]; try { return parsePhoneNumber('+' + raw).number?.international || '+' + raw } catch { return '+' + raw } })()

  const ultah = bacaUlangTahun(user.birthday)
  const premium = angka(user.premiumTime) > 0 ? 'Ya 🌟' : 'Tidak'
  const sekarang = moment().tz('Asia/Jakarta')

  const caption = kartu(`${global.namebot || 'Bot'} Profile`, [
    ['Nama', nama],
    ['Umur', ultah.umur],
    ['Ulang tahun', ultah.teks],
    ['Bio', bio],
    ['Tag', `@${who.split('@')[0]}`],
    ['Nomor', nomor],
    ['Role', user.role || 'Peanut Beginner'],
    ['Level', angka(user.level)],
    ['Exp', angka(user.exp)],
    ['Limit', angka(user.limit)],
    ['Premium', premium],
    ['Tanggal', sekarang.format('dddd, DD MMMM YYYY')],
    ['Waktu', sekarang.format('HH:mm:ss')],
  ], 'Waku waku~')

  const opsi = { quoted: m }
  // urutan: foto WA -> foto default lokal -> teks saja
  if (foto) {
    try { return await conn.sendMessage(m.chat, { image: { url: foto }, caption, mentions: [who] }, opsi) } catch {}
  }
  try { return await conn.sendMessage(m.chat, { image: await fotoDefault(), caption, mentions: [who] }, opsi) } catch {}
  await conn.sendMessage(m.chat, { text: caption, mentions: [who] }, opsi)
}

handler.help = ['profile', 'profil', 'me', 'my']
handler.tags = ['info', 'xp']
handler.command = /^(profile|profil|me|my)$/i
handler.limit = false

export default adapt(handler, { category: 'economy' })
