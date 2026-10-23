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


import fs from 'fs'
import path from 'path'
import { saveDB, getOwners, jidNumber, isLidJid, resolvePhone, formatWib } from './core-system.js'
import { getStats } from './core-data.js'
import { getMeta } from './wa.js'
import crypto from 'crypto'

// ───────── dari file pecahan lain ─────────
import { rpgStore, toPN } from './plugin-engine.js'

// ╔══════════════ [ fitur.js — digabung ke sini ] ══════════════╗
// Fitur global dari config.js -> global.fitur: antidelete, antiedit, antiviewonce, blacklist, log.
// Fitur tambahan yang SEMUA pengaturannya ada di config.js -> global.fitur
//   event shop, leaderboard mingguan, marketplace, clan war,
//   anti-delete / anti-edit / anti sekali lihat (global), log perintah, laporan harian, blacklist.
// Dibungkus satu blok supaya nama internalnya tidak bentrok dengan kode lain di file ini.
const __fitur = (() => {
  // ╔══════════════ [ fitur.js ] ══════════════╗
  // Fitur tambahan yang SEMUA pengaturannya ada di config.js -> global.fitur
  //   event shop, leaderboard mingguan, marketplace, clan war,
  //   anti-delete / anti-edit / anti sekali lihat (global), log perintah, laporan harian, blacklist.
  // Plugin cukup memanggil fungsi di sini; mengubah angka/aturan cukup lewat config.js.

  // ───────── konfigurasi (config.js + nilai bawaan) ─────────
  const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v)
  const merge = (a, b) => {
      const out = { ...a }
      for (const k of Object.keys(b || {})) out[k] = isObj(a?.[k]) && isObj(b[k]) ? merge(a[k], b[k]) : b[k]
      return out
  }

  const DEFAULTS = {
      reward: {
          harian: { cooldownJam: 24, free: { exp: 500, money: 1000, limit: 5 }, prem: { exp: 1000, money: 5000, limit: 10 } },
          mingguan: { cooldownJam: 168, free: { exp: 2999, money: 7000, limit: 15 }, prem: { exp: 4999, money: 14000, limit: 30 } },
          bulanan: { cooldownJam: 720, free: { exp: 4999, money: 50000, limit: 30 }, prem: { exp: 5999, money: 100000, limit: 50 } },
          streak: {
              on: true,
              toleransiJam: { harian: 48, mingguan: 336 },
              tingkat: { harian: [[30, 100], [14, 50], [7, 25], [3, 10]], mingguan: [[8, 50], [4, 25], [2, 10]] },
              milestone: { harian: { setiap: 7, hadiah: { limit: 10 } }, mingguan: { setiap: 4, hadiah: { limit: 20 } } }
          }
      },
      eventShop: { on: true, events: [] },
      lbMingguan: {
          on: true, mode: 'naik', kategori: ['exp', 'money'], hariReset: 'minggu', jamReset: 20, minNilai: 1,
          hadiah: [{ money: 100000, exp: 5000, limit: 10 }, { money: 50000, exp: 3000, limit: 5 }, { money: 25000, exp: 1500, limit: 3 }],
          umumkanKe: 'semuaGrup'
      },
      marketplace: {
          on: true, pajakPersen: 5, maxListing: 5, durasiHari: 7, hargaMin: 1, hargaMax: 100000000, itemBoleh: 'semua',
          itemDilarang: ['money', 'exp', 'level', 'limit', 'bank', 'health', 'stamina', 'atm', 'fullatm', 'age', 'regtime', 'afk', 'warn', 'premiumtime', 'sword', 'pickaxe', 'axe', 'fishingrod', 'armor']
      },
      clan: {
          on: true, wajibGuild: true, biayaBuat: 100000, maxAnggota: 20, maxNama: 12, pesertaWar: 5, minAnggotaWar: 2,
          cooldownWarMenit: 60, expiredTantanganMenit: 10, acakPersen: 25,
          bobot: { level: 10, sword: 30, armor: 20, pickaxe: 5, potion: 2 },
          menang: { money: 50000, exp: 5000 }, kalah: { exp: 1000 }, rampasKasPersen: 10
      },
      antidelete: { on: false, grup: true, pribadi: true, kirimKe: 'owner', media: true, kecualiGrup: [] },
      antiedit: { on: false, grup: true, pribadi: true, kirimKe: 'owner', kecualiGrup: [] },
      antiviewonce: { on: false, grup: true, pribadi: true, kirimKe: 'owner', kecualiGrup: [] },
      logCommand: { on: false, kirimKe: 'owner', intervalMenit: 10, simpanFile: true, abaikanOwner: true, abaikanCommand: ['menu', 'ping'] },
      laporanHarian: { on: false, jam: 21 },
      blacklist: { on: false, nomor: [], grup: [], command: [], kata: [], balas: false, pesan: 'Kamu masuk blacklist bot ini.' }
  }

  const F = () => merge(DEFAULTS, global.fitur || {})

  // ───────── util ─────────
  const fmt = (n) => Number(n || 0).toLocaleString('id-ID')
  const WIB = 7 * 36e5
  const DAYS = ['minggu', 'senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu']
  const wibDate = (t = Date.now()) => new Date(t + WIB)
  const wibDayKey = (t = Date.now()) => wibDate(t).toISOString().slice(0, 10)
  const save = () => { try { saveDB(global.db) } catch {} }
  const store = () => (global.db.fitur ||= {})
  const sub = (key, init) => { const s = store(); if (!s[key]) { s[key] = init; } return s[key] }
  const users = () => rpgStore().users
  const ICON = { money: '💹 Money', exp: '✨ Exp', limit: '🎫 Limit' }
  const BOT = () => (global.namebot || 'BOT').toUpperCase()

  const prefixOf = () => (Array.isArray(global.prefix) ? global.prefix.find(p => typeof p === 'string' && p) : '') || '.'

  /** Tambahkan hadiah { money, exp, limit, <item>: n } ke user. Mengembalikan daftar teks. */
  function giveReward(u, r = {}) {
      const out = []
      for (const [k, v] of Object.entries(r || {})) {
          const n = Number(v) || 0
          if (!n) continue
          u[k] = (Number(u[k]) || 0) + n
          out.push(`${ICON[k] || k} +${fmt(n)}`)
      }
      return out
  }
  const rewardText = (r) => Object.entries(r || {}).filter(([, v]) => Number(v)).map(([k, v]) => `${ICON[k] || k} ${fmt(v)}`).join(' • ') || '-'

  function parseWib(s, end = false) {
      if (!s) return null
      s = String(s).trim()
      const iso = /^\d{4}-\d{2}-\d{2}$/.test(s) ? `${s}T${end ? '23:59:59' : '00:00:00'}+07:00` : `${s.replace(' ', 'T')}:00+07:00`
      const t = Date.parse(iso)
      return Number.isFinite(t) ? t : null
  }

  function owners(sock) {
      const nums = [...new Set(getOwners().map(n => String(n).replace(/\D/g, '')).filter(Boolean))]
      return nums.map(n => `${n}@s.whatsapp.net`)
  }

  function targets(spec, chat) {
      if (spec === 'chat') return chat ? [chat] : []
      if (Array.isArray(spec)) return spec.filter(Boolean)
      return owners()
  }

  function waSock() {
      const s = global.sock
      return s && s.platform !== 'telegram' ? s : null
  }

  const sleep = (ms) => new Promise(r => setTimeout(r, ms))

  // ╔══════════ 1. REWARD (dipakai rpg-reward.js) ══════════╗
  const rewardCfg = () => F().reward

  // ╔══════════ 2. SHOP EVENT ══════════╗
  function eventKey(e) { return `${e.nama}|${e.mulai || ''}|${e.selesai || ''}|${(e.hari || []).join(',')}` }

  function isActive(e, now = Date.now()) {
      const w = wibDate(now)
      if (Array.isArray(e.hari) && e.hari.length && !e.hari.map(h => String(h).toLowerCase()).includes(DAYS[w.getUTCDay()])) return false
      const a = parseWib(e.mulai), b = parseWib(e.selesai, true)
      if (a && now < a) return false
      if (b && now > b) return false
      return true
  }

  function activeEvents() {
      const c = F().eventShop
      if (!c.on) return []
      return (c.events || []).filter(e => e && e.nama && isActive(e))
  }

  /** Persen diskon terbesar untuk item .buy saat ini (0 kalau tidak ada). */
  function diskonItem(item) {
      let best = 0
      for (const e of activeEvents()) {
          const d = Number(e.diskon) || 0
          if (!d) continue
          if (e.item === 'semua' || (Array.isArray(e.item) && e.item.includes(item))) best = Math.max(best, d)
      }
      return Math.min(best, 95)
  }
  const hargaDiskon = (harga, item) => Math.max(1, Math.round(harga * (100 - diskonItem(item)) / 100))

  function stockOf(e, name) {
      const st = sub('eventStock', {})
      return (st[`${eventKey(e)}#${name}`] ||= { terjual: 0, user: {} })
  }

  function eventBarang() {
      const out = []
      for (const e of activeEvents()) {
          for (const [id, b] of Object.entries(e.barang || {})) {
              const s = stockOf(e, id)
              out.push({ e, id, b, sisa: b.stok > 0 ? Math.max(0, b.stok - s.terjual) : Infinity, terjual: s.terjual })
          }
      }
      return out
  }

  function eventBeli(jid, id, qty) {
      const hit = eventBarang().find(x => x.id === String(id).toLowerCase())
      if (!hit) return { ok: false, msg: 'Barang event tidak ditemukan atau event sudah berakhir.' }
      const u = users()[jid]
      const { e, b, sisa } = hit
      qty = Math.max(1, Math.floor(qty) || 1)
      if (sisa < qty) return { ok: false, msg: `Stok tinggal ${sisa === Infinity ? '∞' : sisa}.` }
      const s = stockOf(e, hit.id)
      if (b.batasPerUser > 0 && (s.user[jid] || 0) + qty > b.batasPerUser) {
          return { ok: false, msg: `Batas beli per orang ${b.batasPerUser}. Kamu sudah beli ${s.user[jid] || 0}.` }
      }
      const total = Math.round(Number(b.harga) * qty)
      if ((Number(u.money) || 0) < total) return { ok: false, msg: `Money kurang. Butuh ${fmt(total)}.` }
      u.money -= total
      const got = []
      for (const [k, v] of Object.entries(b.beri || {})) got.push(...giveReward(u, { [k]: v * qty }))
      s.terjual += qty
      s.user[jid] = (s.user[jid] || 0) + qty
      save()
      return { ok: true, nama: b.nama || hit.id, total, got }
  }

  // ╔══════════ 3. LEADERBOARD MINGGUAN ══════════╗
  function lastBoundary(now = Date.now()) {
      const c = F().lbMingguan
      const dow = Math.max(0, DAYS.indexOf(String(c.hariReset).toLowerCase()))
      const w = wibDate(now)
      let ms = Date.UTC(w.getUTCFullYear(), w.getUTCMonth(), w.getUTCDate(), Number(c.jamReset) || 0) - WIB
      let diff = (w.getUTCDay() - dow + 7) % 7
      ms -= diff * 864e5
      if (ms > now) ms -= 7 * 864e5
      return ms
  }

  const snapshotOf = (kat) => {
      const snap = {}
      for (const [jid, u] of Object.entries(users())) {
          const v = Number(u?.[kat]) || 0
          if (v > 0) snap[jid] = v
      }
      return snap
  }

  function lbRank(kat) {
      const c = F().lbMingguan
      const lb = store().lb
      return Object.entries(users())
          .map(([jid, u]) => {
              const now = Number(u?.[kat]) || 0
              const base = c.mode === 'total' ? 0 : Number(lb?.snap?.[kat]?.[jid]) || 0
              return { jid, nilai: now - base }
          })
          .filter(x => x.nilai >= Math.max(1, Number(c.minNilai) || 1))
          .sort((a, b) => b.nilai - a.nilai)
  }

  const lbInfo = () => ({ mulai: store().lb?.boundary || null, berikutnya: lastBoundary() + 7 * 864e5 })

  async function lbAnnounce(text, mentions) {
      const sock = waSock()
      if (!sock) return
      const c = F().lbMingguan
      let list = []
      if (c.umumkanKe === 'semuaGrup') list = Object.keys(global.db.groups || {}).filter(j => j.endsWith('@g.us'))
      else if (Array.isArray(c.umumkanKe)) list = c.umumkanKe
      for (const jid of list.slice(0, 60)) {
          await sock.sendMessage(jid, { text, mentions }).catch(() => null)
          await sleep(2500)
      }
      for (const o of owners()) await sock.sendMessage(o, { text, mentions }).catch(() => null)
  }

  async function lbTick() {
      const c = F().lbMingguan
      if (!c.on) return
      const b = lastBoundary()
      const s = store()
      if (!s.lb) {
          s.lb = { boundary: b, snap: Object.fromEntries(c.kategori.map(k => [k, snapshotOf(k)])) }
          return save()
      }
      if (s.lb.boundary >= b) return

      // periode lama selesai -> bagikan hadiah
      const lines = [`🏆 *${BOT()} LEADERBOARD MINGGUAN* 🏆`, `Periode berakhir, selamat untuk para juara!`, '']
      const mentions = []
      for (const kat of c.kategori) {
          const rank = lbRank(kat).slice(0, c.hadiah.length)
          lines.push(`📊 *${kat.toUpperCase()}*`)
          if (!rank.length) lines.push('_Belum ada yang masuk peringkat._')
          rank.forEach((r, i) => {
              const u = users()[r.jid]
              giveReward(u, c.hadiah[i])
              mentions.push(r.jid)
              lines.push(`${['🥇', '🥈', '🥉'][i] || `${i + 1}.`} @${jidNumber(r.jid)} • ${fmt(r.nilai)}  →  ${rewardText(c.hadiah[i])}`)
          })
          lines.push('')
      }
      lines.push('Periode baru dimulai. Semangat!')
      s.lb = { boundary: b, snap: Object.fromEntries(c.kategori.map(k => [k, snapshotOf(k)])) }
      save()
      await lbAnnounce(lines.join('\n'), mentions)
  }

  // ╔══════════ 4. MARKETPLACE ══════════╗
  const market = () => sub('market', { seq: 0, list: [] })

  function canTrade(item) {
      const c = F().marketplace
      item = String(item || '').toLowerCase()
      if (!/^[a-z0-9_]+$/.test(item)) return false
      if ((c.itemDilarang || []).map(v => String(v).toLowerCase()).includes(item)) return false
      if (/durability|time|last|cooldown|^is|registered|banned|premium|name|role|guild|clan|streak/.test(item)) return false
      if (Array.isArray(c.itemBoleh) && !c.itemBoleh.map(v => String(v).toLowerCase()).includes(item)) return false
      return true
  }

  function marketExpire() {
      const c = F().marketplace
      const mk = market()
      const lim = Date.now() - c.durasiHari * 864e5
      const keep = []
      let changed = false
      for (const l of mk.list) {
          if (l.at < lim) {
              const u = users()[l.seller]
              if (u) u[l.item] = (Number(u[l.item]) || 0) + l.qty
              changed = true
          } else keep.push(l)
      }
      if (changed) { mk.list = keep; save() }
  }

  function marketList() { marketExpire(); return market().list }

  function marketJual(jid, item, qty, harga) {
      const c = F().marketplace
      marketExpire()
      item = String(item || '').toLowerCase()
      qty = Math.floor(Number(qty))
      harga = Math.floor(Number(harga))
      const u = users()[jid]
      if (!canTrade(item)) return { ok: false, msg: `Item *${item}* tidak bisa dijual.` }
      if (!(item in u) || typeof u[item] !== 'number') return { ok: false, msg: `Kamu tidak punya item *${item}*.` }
      if (!(qty > 0)) return { ok: false, msg: 'Jumlah tidak valid.' }
      if (!(harga >= c.hargaMin && harga <= c.hargaMax)) return { ok: false, msg: `Harga per item harus ${fmt(c.hargaMin)} - ${fmt(c.hargaMax)}.` }
      if (u[item] < qty) return { ok: false, msg: `${item} kamu cuma ${fmt(u[item])}.` }
      const mk = market()
      if (mk.list.filter(l => l.seller === jid).length >= c.maxListing) return { ok: false, msg: `Maksimal ${c.maxListing} listing aktif.` }
      u[item] -= qty
      const id = ++mk.seq
      mk.list.push({ id, seller: jid, item, qty, harga, at: Date.now() })
      save()
      return { ok: true, id }
  }

  function marketBeli(jid, id, qty) {
      const c = F().marketplace
      marketExpire()
      const mk = market()
      const l = mk.list.find(x => x.id === Number(id))
      if (!l) return { ok: false, msg: 'Listing tidak ditemukan (mungkin sudah terjual / kedaluwarsa).' }
      if (l.seller === jid) return { ok: false, msg: 'Itu listing milikmu sendiri. Pakai .mtarik untuk menariknya.' }
      qty = Math.max(1, Math.floor(Number(qty)) || l.qty)
      if (qty > l.qty) return { ok: false, msg: `Stok listing tinggal ${l.qty}.` }
      const buyer = users()[jid]
      const total = l.harga * qty
      if ((Number(buyer.money) || 0) < total) return { ok: false, msg: `Money kurang. Butuh ${fmt(total)}.` }
      const pajak = Math.floor(total * (Number(c.pajakPersen) || 0) / 100)
      const seller = users()[l.seller]
      buyer.money -= total
      buyer[l.item] = (Number(buyer[l.item]) || 0) + qty
      if (seller) seller.money = (Number(seller.money) || 0) + total - pajak
      l.qty -= qty
      if (l.qty <= 0) mk.list = mk.list.filter(x => x !== l)
      save()
      return { ok: true, item: l.item, qty, total, pajak, seller: l.seller, terima: total - pajak }
  }

  function marketTarik(jid, id) {
      marketExpire()
      const mk = market()
      const l = mk.list.find(x => x.id === Number(id))
      if (!l || l.seller !== jid) return { ok: false, msg: 'Listing tidak ditemukan atau bukan milikmu.' }
      const u = users()[jid]
      u[l.item] = (Number(u[l.item]) || 0) + l.qty
      mk.list = mk.list.filter(x => x !== l)
      save()
      return { ok: true, item: l.item, qty: l.qty }
  }

  // ╔══════════ 5. CLAN & CLAN WAR ══════════╗
  const clans = () => sub('clan', {})
  const clanKey = (n) => String(n || '').toLowerCase().replace(/[^a-z0-9]/g, '')
  const getClan = (key) => clans()[key]
  const allClans = () => Object.entries(clans()).map(([key, c]) => ({ key, ...c }))
  const clanOfUser = (jid) => { const k = users()[jid]?.clan; const c = k && clans()[k]; return c ? { key: k, ...c } : null }

  function clanBuat(jid, nama) {
      const c = F().clan
      const u = users()[jid]
      const key = clanKey(nama)
      if (!key || key.length < 3) return { ok: false, msg: 'Nama clan minimal 3 huruf/angka.' }
      if (String(nama).length > c.maxNama) return { ok: false, msg: `Nama clan maksimal ${c.maxNama} karakter.` }
      if (clanOfUser(jid)) return { ok: false, msg: 'Kamu sudah punya clan. Keluar dulu dengan .clan keluar' }
      if (c.wajibGuild && !u.guild) return { ok: false, msg: `Kamu harus ikut guild dulu: ${prefixOf()}guild` }
      if (clans()[key]) return { ok: false, msg: 'Nama clan sudah dipakai.' }
      if ((Number(u.money) || 0) < c.biayaBuat) return { ok: false, msg: `Money kurang. Biaya buat clan ${fmt(c.biayaBuat)}.` }
      u.money -= c.biayaBuat
      clans()[key] = { nama: String(nama).trim(), ketua: jid, anggota: [jid], kas: 0, menang: 0, kalah: 0, dibuat: Date.now(), warCd: 0 }
      u.clan = key
      save()
      return { ok: true, key }
  }

  function clanGabung(jid, nama) {
      const c = F().clan
      const u = users()[jid]
      const key = clanKey(nama)
      const cl = clans()[key]
      if (!cl) return { ok: false, msg: 'Clan tidak ditemukan.' }
      if (clanOfUser(jid)) return { ok: false, msg: 'Kamu sudah punya clan.' }
      if (c.wajibGuild && !u.guild) return { ok: false, msg: `Kamu harus ikut guild dulu: ${prefixOf()}guild` }
      if (cl.anggota.length >= c.maxAnggota) return { ok: false, msg: 'Clan sudah penuh.' }
      cl.anggota.push(jid)
      u.clan = key
      save()
      return { ok: true, nama: cl.nama }
  }

  function clanKeluar(jid, kickBy = false) {
      const cu = clanOfUser(jid)
      if (!cu) return { ok: false, msg: 'Kamu tidak punya clan.' }
      const cl = clans()[cu.key]
      cl.anggota = cl.anggota.filter(j => j !== jid)
      users()[jid].clan = ''
      let bubar = false
      if (!cl.anggota.length) { delete clans()[cu.key]; bubar = true }
      else if (cl.ketua === jid) cl.ketua = cl.anggota[0]
      save()
      return { ok: true, nama: cu.nama, bubar, ketuaBaru: bubar ? null : cl.ketua }
  }

  function clanKick(ketua, target) {
      const cu = clanOfUser(ketua)
      if (!cu || cu.ketua !== ketua) return { ok: false, msg: 'Hanya ketua clan yang bisa kick.' }
      if (target === ketua) return { ok: false, msg: 'Tidak bisa kick diri sendiri.' }
      const cl = clans()[cu.key]
      if (!cl.anggota.includes(target)) return { ok: false, msg: 'User itu bukan anggota clanmu.' }
      cl.anggota = cl.anggota.filter(j => j !== target)
      if (users()[target]) users()[target].clan = ''
      save()
      return { ok: true, nama: cu.nama }
  }

  function clanDonasi(jid, jumlah) {
      const cu = clanOfUser(jid)
      if (!cu) return { ok: false, msg: 'Kamu tidak punya clan.' }
      jumlah = Math.floor(Number(jumlah))
      const u = users()[jid]
      if (!(jumlah > 0)) return { ok: false, msg: 'Jumlah tidak valid.' }
      if ((Number(u.money) || 0) < jumlah) return { ok: false, msg: 'Money kamu kurang.' }
      u.money -= jumlah
      clans()[cu.key].kas += jumlah
      save()
      return { ok: true, nama: cu.nama, kas: clans()[cu.key].kas }
  }

  function memberPower(jid) {
      const u = users()[jid] || {}
      const b = F().clan.bobot
      let p = 0
      for (const [k, w] of Object.entries(b)) p += (Number(u[k]) || 0) * (Number(w) || 0)
      return Math.round(p)
  }

  function clanPower(key) {
      const c = F().clan
      const cl = clans()[key]
      if (!cl) return { total: 0, peserta: [] }
      const peserta = cl.anggota.map(j => ({ jid: j, p: memberPower(j) })).sort((a, b) => b.p - a.p).slice(0, c.pesertaWar)
      return { total: peserta.reduce((s, x) => s + x.p, 0), peserta }
  }

  const pending = new Map() // key clan lawan -> { dari, at, chat }

  function clanTantang(jid, namaLawan, chat) {
      const c = F().clan
      const me = clanOfUser(jid)
      if (!me || me.ketua !== jid) return { ok: false, msg: 'Hanya ketua clan yang bisa menantang war.' }
      const key = clanKey(namaLawan)
      const lawan = clans()[key]
      if (!lawan) return { ok: false, msg: 'Clan lawan tidak ditemukan.' }
      if (key === me.key) return { ok: false, msg: 'Tidak bisa war melawan clan sendiri.' }
      if (me.anggota.length < c.minAnggotaWar || lawan.anggota.length < c.minAnggotaWar) return { ok: false, msg: `Kedua clan minimal punya ${c.minAnggotaWar} anggota.` }
      const cdMs = c.cooldownWarMenit * 60000
      for (const cl of [me, lawan]) {
          const sisa = (cl.warCd || 0) + cdMs - Date.now()
          if (sisa > 0) return { ok: false, msg: `Clan *${cl.nama}* masih cooldown war ${Math.ceil(sisa / 60000)} menit.` }
      }
      pending.set(key, { dari: me.key, at: Date.now(), chat })
      return { ok: true, lawan, ketuaLawan: lawan.ketua, menit: c.expiredTantanganMenit }
  }

  function clanTolak(jid) {
      const me = clanOfUser(jid)
      if (!me || me.ketua !== jid) return { ok: false, msg: 'Hanya ketua clan yang bisa menolak.' }
      const p = pending.get(me.key)
      if (!p) return { ok: false, msg: 'Tidak ada tantangan war untuk clanmu.' }
      pending.delete(me.key)
      return { ok: true, dari: clans()[p.dari]?.nama || p.dari }
  }

  function clanTerima(jid) {
      const c = F().clan
      const me = clanOfUser(jid)
      if (!me || me.ketua !== jid) return { ok: false, msg: 'Hanya ketua clan yang bisa menerima war.' }
      const p = pending.get(me.key)
      if (!p || Date.now() - p.at > c.expiredTantanganMenit * 60000) {
          pending.delete(me.key)
          return { ok: false, msg: 'Tidak ada tantangan war yang aktif (atau sudah kedaluwarsa).' }
      }
      pending.delete(me.key)
      const A = clans()[p.dari]
      const B = clans()[me.key]
      if (!A || !B) return { ok: false, msg: 'Salah satu clan sudah bubar.' }

      const pa = clanPower(p.dari)
      const pb = clanPower(me.key)
      const rnd = () => 1 + (Math.random() * 2 - 1) * (Number(c.acakPersen) || 0) / 100
      const sa = pa.total * rnd()
      const sb = pb.total * rnd()
      const aMenang = sa >= sb
      const [W, wk, wp, L, lk, lp] = aMenang ? [A, p.dari, pa, B, me.key, pb] : [B, me.key, pb, A, p.dari, pa]

      const rampas = Math.floor(L.kas * (Number(c.rampasKasPersen) || 0) / 100)
      L.kas -= rampas
      W.kas += rampas
      W.menang++
      L.kalah++
      const now = Date.now()
      A.warCd = now
      B.warCd = now
      for (const x of wp.peserta) if (users()[x.jid]) giveReward(users()[x.jid], c.menang)
      for (const x of lp.peserta) if (users()[x.jid]) giveReward(users()[x.jid], c.kalah)
      save()
      return {
          ok: true, chat: p.chat,
          pemenang: { key: wk, nama: W.nama, power: Math.round(aMenang ? sa : sb), peserta: wp.peserta.map(x => x.jid) },
          kalah: { key: lk, nama: L.nama, power: Math.round(aMenang ? sb : sa), peserta: lp.peserta.map(x => x.jid) },
          rampas
      }
  }

  // ╔══════════ 6. ANTI-DELETE / ANTI-EDIT / ANTI SEKALI LIHAT (GLOBAL) ══════════╗
  const WRAP = ['ephemeralMessage', 'viewOnceMessage', 'viewOnceMessageV2', 'viewOnceMessageV2Extension', 'documentWithCaptionMessage']
  function layers(msg) {
      const out = []
      let cur = msg
      for (let i = 0; i < 6 && cur; i++) {
          out.push(cur)
          const k = WRAP.find(w => cur[w])
          cur = k ? cur[k].message : null
      }
      return out
  }
  const textOf = (msg) => {
      for (const l of layers(msg)) {
          const t = l.conversation || l.extendedTextMessage?.text || l.imageMessage?.caption || l.videoMessage?.caption || l.documentMessage?.caption
          if (t) return t
      }
      return ''
  }
  const isViewOnce = (m) => !!m.msg?.viewOnce || layers(m.message).some(l => l.viewOnceMessage || l.viewOnceMessageV2 || l.viewOnceMessageV2Extension)

  const MAX_CACHE = 400
  const MAX_FILE = 12 * 1024 * 1024
  const MAX_TOTAL = 40 * 1024 * 1024
  const seen = new Map()      // id -> { m, chat, sender }
  const mediaCache = new Map() // id -> Promise<Buffer|null>
  const mediaSize = new Map()
  let mediaTotal = 0
  const edited = new Map()

  function dropMedia(id) {
      mediaCache.delete(id)
      mediaTotal -= mediaSize.get(id) || 0
      mediaSize.delete(id)
  }

  function cacheMedia(m) {
      if (!m.isMedia || typeof m.download !== 'function' || mediaCache.has(m.id)) return
      const len = Number(m.msg?.fileLength?.toString?.() ?? m.msg?.fileLength ?? 0)
      if (len > MAX_FILE) return
      const id = m.id
      mediaCache.set(id, (async () => {
          try {
              const buf = await m.download()
              if (!buf || buf.length > MAX_FILE) { dropMedia(id); return null }
              mediaSize.set(id, buf.length)
              mediaTotal += buf.length
              while (mediaTotal > MAX_TOTAL && mediaCache.size > 1) dropMedia(mediaCache.keys().next().value)
              return buf
          } catch { dropMedia(id); return null }
      })())
  }

  function scoped(sec, m) {
      if (!sec?.on) return false
      if (m.isGroup) return sec.grup !== false && !(sec.kecualiGrup || []).includes(m.chat)
      return sec.pribadi !== false
  }

  async function whereLabel(sock, m) {
      if (!m.isGroup) return 'chat pribadi'
      const meta = await getMeta(sock, m.chat).catch(() => null)
      return `grup ${meta?.subject || m.chat}`
  }

  /** Jangan kirim ganda kalau tujuan = chat itu sendiri dan grup tsb sudah mengaktifkan fitur yang sama sendiri. */
  function destFor(sec, m, own) {
      const list = targets(sec.kirimKe, m.chat)
      if (sec.kirimKe === 'chat' && m.isGroup && global.db?.groups?.[m.chat]?.[own]?.on) return []
      return list
  }

  async function sendCopy(sock, to, m, buf, note, mentions) {
      const msg = m.msg || {}
      const caption = [note, m.body].filter(Boolean).join('\n\n')
      switch (m.mtype) {
          case 'imageMessage': return sock.sendMessage(to, { image: buf, caption, mentions })
          case 'videoMessage': return sock.sendMessage(to, { video: buf, caption, mentions, gifPlayback: !!msg.gifPlayback, mimetype: msg.mimetype })
          case 'audioMessage':
              await sock.sendMessage(to, { text: note, mentions })
              return sock.sendMessage(to, { audio: buf, mimetype: msg.mimetype || 'audio/ogg; codecs=opus', ptt: !!msg.ptt })
          case 'stickerMessage':
              await sock.sendMessage(to, { text: note, mentions })
              return sock.sendMessage(to, { sticker: buf })
          case 'documentMessage': return sock.sendMessage(to, { document: buf, mimetype: msg.mimetype, fileName: msg.fileName || 'file', caption, mentions })
          default: return false
      }
  }

  async function onRevoke(sock, m, c) {
      const id = m.message?.protocolMessage?.key?.id
      const orig = seen.get(id)?.m
      if (!orig || orig.fromMe || m.fromMe) return
      const dests = destFor(c, m, 'antidelete')
      if (!dests.length) return
      const author = orig.key?.participant || orig.sender
      const mentions = [author].filter(Boolean)
      const note = `🛡️ *ANTIDELETE*\n@${jidNumber(author)} menghapus pesan di ${await whereLabel(sock, m)}`
      const text = edited.get(id) ?? (orig.message?.conversation || orig.message?.extendedTextMessage?.text)
      const buf = orig.isMedia ? await mediaCache.get(id)?.catch(() => null) : null
      for (const to of dests) {
          if (text) { await sock.sendMessage(to, { text: `${note}\n\n${text}`, mentions }).catch(() => null); continue }
          if (buf) { const ok = await sendCopy(sock, to, orig, buf, note, mentions).catch(() => false); if (ok !== false) continue }
          await sock.sendMessage(to, { text: note, mentions }).catch(() => null)
          await sock.sendMessage(to, { forward: orig }).catch(() => null)
      }
  }

  async function onEdit(sock, m, c) {
      const pm = m.message?.protocolMessage
      const id = pm?.key?.id
      if (!id || !pm.editedMessage) return
      const orig = seen.get(id)?.m
      if (m.fromMe || orig?.fromMe) return
      const after = textOf(pm.editedMessage)
      if (!after) return
      const before = edited.get(id) ?? orig?.body ?? ''
      if (before === after) return
      edited.set(id, after)
      if (edited.size > MAX_CACHE) edited.delete(edited.keys().next().value)
      const dests = destFor(c, m, 'antiedit')
      if (!dests.length) return
      const cut = (t) => (t.length > 700 ? `${t.slice(0, 700)}…` : t)
      const text = [
          `✏️ *ANTIEDIT*`, `@${jidNumber(m.sender)} mengedit pesan di ${await whereLabel(sock, m)}`, '',
          before ? `*Sebelum:*\n${cut(before)}` : '_Pesan asli tidak tersimpan (dikirim sebelum bot aktif)._', '', `*Sesudah:*\n${cut(after)}`
      ].join('\n')
      for (const to of dests) await sock.sendMessage(to, { text, mentions: [m.sender] }).catch(() => null)
  }

  async function onViewOnce(sock, m, c) {
      if (!m.isMedia || !['imageMessage', 'videoMessage', 'audioMessage'].includes(m.mtype)) return
      const dests = destFor(c, m, 'antiviewonce')
      if (!dests.length) return
      const buf = await m.download().catch(() => null)
      if (!buf) return
      const kind = { imageMessage: 'foto', videoMessage: 'video', audioMessage: 'audio / VN' }[m.mtype]
      const note = `👁️ *ANTI SEKALI LIHAT*\n@${jidNumber(m.sender)} mengirim ${kind} sekali lihat di ${await whereLabel(sock, m)}`
      for (const to of dests) await sendCopy(sock, to, m, buf, note, [m.sender]).catch(() => null)
  }

  /** Dipanggil handler untuk setiap pesan masuk (sebelum filter self/public). */
  async function watch(sock, m) {
      try {
          const cfg = F()
          const { antidelete: d, antiedit: e, antiviewonce: v } = cfg
          if (!d.on && !e.on && !v.on) return
          if (sock.platform === 'telegram') return

          if (m.mtype === 'protocolMessage') {
              const type = m.message?.protocolMessage?.type
              if (d.on && scoped(d, m) && (type === 0 || type === 'REVOKE')) await onRevoke(sock, m, d)
              else if (e.on && scoped(e, m) && (type === 14 || type === 'MESSAGE_EDIT')) await onEdit(sock, m, e)
              return
          }
          if (m.fromMe || m.isBaileys) return

          if ((d.on && scoped(d, m)) || (e.on && scoped(e, m))) {
              seen.set(m.id, { m })
              if (seen.size > MAX_CACHE) {
                  const old = seen.keys().next().value
                  seen.delete(old); edited.delete(old); dropMedia(old)
              }
              if (d.on && d.media !== false && scoped(d, m)) cacheMedia(m)
          }
          if (v.on && scoped(v, m) && isViewOnce(m)) await onViewOnce(sock, m, v)
      } catch (err) {
          console.error('[FITUR watch]', err.message)
      }
  }

  // ╔══════════ 7. LOG PERINTAH & LAPORAN HARIAN ══════════╗
  const LOG_FILE = path.join(process.cwd(), 'database', 'command.log')
  let logBuf = []
  let logLastFlush = Date.now()

  function writeLogFile(line) {
      try {
          fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true })
          try { if (fs.statSync(LOG_FILE).size > 1024 * 1024) fs.renameSync(LOG_FILE, LOG_FILE + '.old') } catch {}
          fs.appendFileSync(LOG_FILE, line + '\n')
      } catch {}
  }

  async function logCommand(sock, m, { command, text, sender, isOwner }) {
      try {
          const c = F().logCommand
          if (!c.on) return
          if (c.abaikanOwner && isOwner) return
          if ((c.abaikanCommand || []).map(v => String(v).toLowerCase()).includes(command)) return
          const where = m.isGroup ? `grup ${(await getMeta(sock, m.chat).catch(() => null))?.subject || m.chat}` : 'pribadi'
          const entry = { t: Date.now(), who: `${m.pushName || '-'} (${jidNumber(sender)})`, where, cmd: `${prefixOf()}${command}${text ? ' ' + String(text).slice(0, 80) : ''}` }
          if (c.simpanFile) writeLogFile(`${new Date(entry.t).toISOString()} | ${entry.who} | ${entry.where} | ${entry.cmd}`)
          logBuf.push(entry)
          if (!(Number(c.intervalMenit) > 0)) await flushLog(sock)
          else if (logBuf.length > 200) logBuf.shift()
      } catch (err) { console.error('[FITUR log]', err.message) }
  }

  async function flushLog(sockArg) {
      const sock = sockArg || waSock()
      if (!sock || !logBuf.length) return
      const c = F().logCommand
      const items = logBuf.splice(0, logBuf.length)
      logLastFlush = Date.now()
      const lines = items.slice(0, 25).map(e => `• ${new Date(e.t + WIB).toISOString().slice(11, 16)} ${e.who} [${e.where}]\n   ${e.cmd}`)
      const text = `📋 *LOG PERINTAH* (${items.length})\n\n${lines.join('\n')}${items.length > 25 ? `\n\n…dan ${items.length - 25} lainnya (lihat database/command.log)` : ''}`
      for (const to of targets(c.kirimKe, null)) await sock.sendMessage(to, { text }).catch(() => null)
  }

  async function laporanTick() {
      const c = F().laporanHarian
      if (!c.on) return
      const w = wibDate()
      const s = store()
      const key = wibDayKey()
      if (w.getUTCHours() < Number(c.jam) || s.laporan === key) return
      s.laporan = key
      save()
      const sock = waSock()
      if (!sock) return
      const st = getStats()
      const cmds = st.commands.slice(0, 5).map(([k, n], i) => `${i + 1}. ${k} — ${n}x`).join('\n') || '-'
      const usr = st.users.slice(0, 5).map(([k, n], i) => `${i + 1}. ${k} — ${n}x`).join('\n') || '-'
      const text = `📊 *LAPORAN HARIAN ${BOT()}*\n${key}\n\nCommand hari ini : ${fmt(st.today)}\nTotal command    : ${fmt(st.total)}\nUser terdaftar   : ${fmt(Object.keys(users()).length)}\nGrup tercatat    : ${fmt(Object.keys(global.db.groups || {}).length)}\nMarketplace aktif: ${fmt(market().list.length)} listing\nClan             : ${fmt(Object.keys(clans()).length)}\n\n*Command terpopuler*\n${cmds}\n\n*User paling aktif*\n${usr}`
      for (const to of owners()) await sock.sendMessage(to, { text }).catch(() => null)
  }

  // ╔══════════ 8. BLACKLIST GLOBAL ══════════╗
  const normNum = (n) => {
      n = String(n || '').replace(/\D/g, '')
      if (n.startsWith('0')) n = '62' + n.slice(1)
      return n
  }
  const warned = new Map()

  /** Mengembalikan true kalau pesan harus diabaikan total. Owner tidak pernah diblokir. */
  async function isBlacklisted(sock, m, { sender, command, text, isOwner }) {
      try {
          const c = F().blacklist
          if (!c.on || isOwner) return false
          let why = null
          if ((c.grup || []).includes(m.chat)) why = 'grup'
          if (!why && command && (c.command || []).map(v => String(v).toLowerCase()).includes(command)) why = 'command'
          if (!why && command && (c.kata || []).length) {
              const low = `${command} ${text || ''}`.toLowerCase()
              if (c.kata.some(k => k && low.includes(String(k).toLowerCase()))) why = 'kata'
          }
          if (!why && (c.nomor || []).length) {
              const list = c.nomor.map(normNum)
              const ids = [jidNumber(sender), jidNumber(m.key?.participantPn)]
              if (isLidJid(sender)) ids.push(await resolvePhone(sock, sender).catch(() => null))
              if (ids.filter(Boolean).map(normNum).some(n => list.includes(n))) why = 'nomor'
          }
          if (!why) return false
          if (c.balas && why !== 'grup' && command) {
              const k = `${m.chat}|${sender}`
              if (Date.now() - (warned.get(k) || 0) > 6 * 36e5) {
                  warned.set(k, Date.now())
                  await m.reply(c.pesan).catch(() => null)
              }
          }
          return true
      } catch { return false }
  }

  // ╔══════════ pewaktu ══════════╗
  function startFitur() {
      if (global.__fiturTimer) clearInterval(global.__fiturTimer)
      const tick = async () => {
          try {
              await lbTick()
              marketExpire()
              await laporanTick()
              const c = F().logCommand
              if (c.on && Number(c.intervalMenit) > 0 && Date.now() - logLastFlush >= c.intervalMenit * 60000) await flushLog()
          } catch (e) { console.error('[FITUR tick]', e.message) }
      }
      setTimeout(tick, 20_000)
      global.__fiturTimer = setInterval(tick, 30_000)
      global.__fiturTimer.unref?.()
  }

  // ringkasan status untuk .fitur
  function statusFitur() {
      const c = F()
      const on = (b) => (b ? '✅' : '❌')
      return [
          `${on(c.reward.streak.on)} Streak harian/mingguan`,
          `${on(c.eventShop.on)} Shop event (aktif sekarang: ${activeEvents().map(e => e.nama).join(', ') || '-'})`,
          `${on(c.lbMingguan.on)} Leaderboard mingguan (${c.lbMingguan.kategori.join(', ')}; reset ${c.lbMingguan.hariReset} ${c.lbMingguan.jamReset}:00; berikutnya ${formatWib(lbInfo().berikutnya)})`,
          `${on(c.marketplace.on)} Marketplace (pajak ${c.marketplace.pajakPersen}%, ${market().list.length} listing)`,
          `${on(c.clan.on)} Clan & war (${Object.keys(clans()).length} clan)`,
          `${on(c.antidelete.on)} Antidelete global → ${JSON.stringify(c.antidelete.kirimKe)}`,
          `${on(c.antiedit.on)} Antiedit global → ${JSON.stringify(c.antiedit.kirimKe)}`,
          `${on(c.antiviewonce.on)} Anti sekali lihat global → ${JSON.stringify(c.antiviewonce.kirimKe)}`,
          `${on(c.logCommand.on)} Log perintah (tiap ${c.logCommand.intervalMenit} menit)`,
          `${on(c.laporanHarian.on)} Laporan harian (jam ${c.laporanHarian.jam} WIB)`,
          `${on(c.blacklist.on)} Blacklist (${c.blacklist.nomor.length} nomor, ${c.blacklist.grup.length} grup, ${c.blacklist.command.length} command, ${c.blacklist.kata.length} kata)`
      ].join('\n')
  }

  const BOT_NAME = BOT

  return { F, fmt, prefixOf, giveReward, rewardText, rewardCfg, isActive, activeEvents, diskonItem, hargaDiskon, eventBarang, eventBeli, lbRank, lbInfo, canTrade, marketList, marketJual, marketBeli, marketTarik, clanKey, getClan, allClans, clanOfUser, clanBuat, clanGabung, clanKeluar, clanKick, clanDonasi, memberPower, clanPower, clanTantang, clanTolak, clanTerima, watch, logCommand, isBlacklisted, startFitur, statusFitur, BOT_NAME }
})()
export const { F: fiturCfg, fmt: fiturFmt, prefixOf, giveReward, rewardText, rewardCfg, isActive, activeEvents, diskonItem, hargaDiskon, eventBarang, eventBeli, lbRank, lbInfo, canTrade, marketList, marketJual, marketBeli, marketTarik, clanKey, getClan, allClans, clanOfUser, clanBuat, clanGabung, clanKeluar, clanKick, clanDonasi, memberPower, clanPower, clanTantang, clanTolak, clanTerima, watch: fiturWatch, logCommand: fiturLog, isBlacklisted: fiturBlacklisted, startFitur, statusFitur, BOT_NAME } = __fitur
// ╚══════════════ [ akhir fitur ] ══════════════╝


// ╔══════════════ [ extra.js ] ══════════════╗
// Tambahan kecil di akhir file.
// (digabung dari lib/extra.js; harus di akhir file karena memakai giveReward & fiturFmt di atas)
const __extra = (() => {
    // ╔══════════════ [ extra.js ] ══════════════╗
    // Fondasi fitur tambahan Kaguya 🍓: jam bahagia (pengali hadiah), misi harian, referral,
    // dan penyimpanan kecil bersama. Dipakai plugins/rpg/{misi,gacha,invite,top}.js, plugins/fun/menfess.js,
    // plugins/game/quiz.js dan handler.js (pelacak misi).
    //
    // Pengaturan ada di config.js -> global.extra. Nilai yang tidak diisi memakai DEFAULT di bawah.

    const fmt = (n) => fiturFmt(n)

    const WIB_MS = 7 * 3_600_000
    const DAY_MS = 86_400_000

    const DEFAULT = {
        jamBahagia: { on: true, jam: [[12, 13], [19, 21]], pengali: 2 },
        misi: { on: true, hadiahBonus: { limit: 5, money: 3000, exp: 500 } },
        gacha: { biaya: 5000, cooldownDetik: 20, maxPerHari: 15, pityTiap: 10 },
        menfess: { on: true, biayaLimit: 1, maxPerHari: 5, cooldownDetik: 60, maxPanjang: 500 },
        referral: {
            on: true,
            hadiahPengundang: { limit: 10, money: 2000 },
            hadiahTeman: { limit: 10, money: 2000 },
            maxUndangan: 50,
            milestone: { 5: { limit: 25 }, 10: { limit: 50, money: 20000 }, 25: { limit: 150, money: 100000 } }
        },
        kuis: { hadiah: { money: 500, exp: 300 }, waktuDetik: 30 }
    }

    /** Pengaturan gabungan (config.js menimpa DEFAULT per bagian). */
    function cfg(section) {
        const user = (global.extra && global.extra[section]) || {}
        return { ...DEFAULT[section], ...user }
    }

    // ───────── waktu WIB ─────────
    const wibDate = (t = Date.now()) => new Date(t + WIB_MS)
    /** Kunci hari WIB, contoh "2026-10-23" */
    const wibDay = (t = Date.now()) => wibDate(t).toISOString().slice(0, 10)

    function durasi(ms) {
        const s = Math.max(0, Math.ceil(ms / 1000))
        const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), d = s % 60
        return [h && `${h} jam`, m && `${m} menit`, (!h && d) && `${d} detik`].filter(Boolean).join(' ') || '0 detik'
    }

    // ───────── penyimpanan bersama (global.db.kaguya) ─────────
    function store() {
        const db = global.db
        if (!db.kaguya) db.kaguya = {}
        const k = db.kaguya
        k.menfess ||= {}
        k.menfessBlock ||= {}
        k.refCodes ||= {}
        k.happy ||= null // { until, mult } penyalaan manual oleh owner
        return k
    }

    /** Data user RPG berdasarkan jid (nomor@s.whatsapp.net). */
    const userByJid = (jid) => rpgStore().users[jid]

    // ───────── jam bahagia ─────────
    /** { aktif, mult, sumber, sampai } — sampai = ms timestamp berakhir (kalau diketahui) */
    function happy(now = Date.now()) {
        const k = store()
        if (k.happy && k.happy.until > now) {
            return { aktif: true, mult: Number(k.happy.mult) || 2, sumber: 'owner', sampai: k.happy.until }
        }
        const c = cfg('jamBahagia')
        if (!c.on) return { aktif: false, mult: 1, sumber: null, sampai: 0 }
        const w = wibDate(now)
        const jam = w.getUTCHours() + w.getUTCMinutes() / 60
        for (const [a, b] of c.jam || []) {
            if (jam >= a && jam < b) {
                const sampai = now + Math.round((b - jam) * 3_600_000)
                return { aktif: true, mult: Number(c.pengali) || 2, sumber: 'jadwal', sampai }
            }
        }
        return { aktif: false, mult: 1, sumber: null, sampai: 0 }
    }

    /** Kalikan angka dengan pengali jam bahagia (kalau sedang aktif). */
    const boost = (n) => Math.round((Number(n) || 0) * happy().mult)

    /** Kalikan semua nilai hadiah { money, exp, limit } */
    function boostReward(r = {}) {
        const mult = happy().mult
        if (mult === 1) return { ...r }
        const out = {}
        for (const [k, v] of Object.entries(r)) out[k] = Math.round((Number(v) || 0) * mult)
        return out
    }

    function happyBanner() {
        const h = happy()
        if (!h.aktif) return ''
        const sisa = h.sampai ? ` (sisa ${durasi(h.sampai - Date.now())})` : ''
        return `🍓 *JAM BAHAGIA x${h.mult}* aktif!${sisa}`
    }

    function setHappyManual(menit, mult = 2) {
        const k = store()
        k.happy = menit > 0 ? { until: Date.now() + menit * 60_000, mult } : null
        global.db.kaguya = k // memicu penyimpanan lewat Proxy
    }

    // ───────── kartu / hadiah ─────────
    /** Beri hadiah (sudah dikali jam bahagia kalau boost=true). Mengembalikan daftar teks. */
    function beri(user, hadiah, { boost: withBoost = true } = {}) {
        return giveReward(user, withBoost ? boostReward(hadiah) : hadiah)
    }

    // ═══════════════ MISI HARIAN ═══════════════
    // Disimpan di user.misi = { day, list: [{ id, target, base, progress, done, claimed }], bonus }
    // tipe:
    //   event : dihitung tiap command yang cocok (cmd / game / rpg / download / sticker / ai / tools)
    //   delta : selisih nilai user.<field> sejak misi dibuat (exp / money)
    //   claim : klaim hadiah harian
    const MISI = {
        cmd:      { tipe: 'event', emoji: '🍓', teks: (n) => `Pakai ${n} command apa saja`,          target: [5, 8, 12],      hadiah: { limit: 2, money: 500 } },
        game:     { tipe: 'event', emoji: '🎮', teks: (n) => `Mainkan ${n} game`,                    target: [2, 3, 4],       hadiah: { limit: 3, money: 800 } },
        rpg:      { tipe: 'event', emoji: '🍡', teks: (n) => `Pakai ${n} command RPG (mining, hunt, kerja, dll)`, target: [3, 5, 7], hadiah: { limit: 3, money: 800 } },
        download: { tipe: 'event', emoji: '🍥', teks: (n) => `Download ${n} media`,                    target: [1, 2],          hadiah: { limit: 2, money: 600 } },
        sticker:  { tipe: 'event', emoji: '🍰', teks: (n) => `Buat ${n} stiker`,                      target: [1, 2, 3],       hadiah: { limit: 2, money: 500 } },
        ai:       { tipe: 'event', emoji: '✨', teks: (n) => `Pakai ${n} fitur AI`,                   target: [1, 2],          hadiah: { limit: 2, money: 700 } },
        tools:    { tipe: 'event', emoji: '🧃', teks: (n) => `Pakai ${n} tools`,                      target: [2, 3],          hadiah: { limit: 2, money: 500 } },
        exp:      { tipe: 'delta', field: 'exp',   emoji: '🍧', teks: (n) => `Kumpulkan ${fmt(n)} EXP`,   target: [300, 600, 1000], hadiah: { limit: 3, money: 1000 } },
        money:    { tipe: 'delta', field: 'money', emoji: '💹', teks: (n) => `Kumpulkan ${fmt(n)} money`, target: [2000, 5000, 10000], hadiah: { limit: 3, money: 1000 } },
        claim:    { tipe: 'claim', emoji: '🎁', teks: () => 'Klaim hadiah harian (.daily)',             target: [1],             hadiah: { limit: 1, money: 300 } }
    }

    // tag plugin -> jenis misi event
    const TAG_MISI = { game: 'game', fun: 'game', rpg: 'rpg', download: 'download', sticker: 'sticker', ai: 'ai', 'ai-image': 'ai', tools: 'tools' }

    const pick = (arr) => arr[Math.floor(Math.random() * arr.length)]

    function buatMisi(user) {
        const ids = Object.keys(MISI)
        const dipilih = []
        // selalu ada 1 misi mudah supaya user baru tidak merasa mustahil
        dipilih.push(pick(['cmd', 'claim', 'sticker']))
        while (dipilih.length < 3) {
            const id = pick(ids)
            if (!dipilih.includes(id)) dipilih.push(id)
        }
        return dipilih.map((id) => {
            const def = MISI[id]
            return { id, target: pick(def.target), base: def.tipe === 'delta' ? Number(user[def.field]) || 0 : 0, progress: 0, done: false, claimed: false }
        })
    }

    /** Pastikan misi user untuk hari ini ada; reset kalau sudah ganti hari. */
    function misiHariIni(user) {
        const today = wibDay()
        if (!user.misi || user.misi.day !== today || !Array.isArray(user.misi.list)) {
            user.misi = { day: today, list: buatMisi(user), bonus: false }
        }
        return user.misi
    }

    function refresh(user, ms) {
        for (const q of ms.list) {
            const def = MISI[q.id]
            if (!def) continue
            if (def.tipe === 'delta') q.progress = Math.max(q.progress, (Number(user[def.field]) || 0) - q.base)
            q.done = q.progress >= q.target
            q.progress = Math.min(q.progress, q.target)
        }
        return ms
    }

    const misiDenganProgres = (user) => refresh(user, misiHariIni(user))

    /**
     * Dipanggil handler.js setelah sebuah command sukses dijalankan.
     * Tidak pernah melempar error (aman dipanggil dengan .catch).
     */
    async function trackMisi(sock, sender, command, plugin) {
        if (!cfg('misi').on) return
        if (!command || command === 'misi' || command === 'mission') return
        const pn = await toPN(sock, sender)
        const user = userByJid(pn)
        if (!user) return

        const ms = misiHariIni(user)
        const tag = String((Array.isArray(plugin?.tags) ? plugin.tags[0] : plugin?.tags) || '').toLowerCase()
        const jenis = TAG_MISI[tag]
        const klaim = /^(daily|harian|claim)$/.test(command)

        for (const q of ms.list) {
            if (q.done) continue
            const def = MISI[q.id]
            if (!def) continue
            if (def.tipe === 'event' && (q.id === 'cmd' || q.id === jenis)) q.progress++
            else if (def.tipe === 'claim' && klaim) q.progress++
        }
        refresh(user, ms)
        saveDB(global.db)
    }

    // ═══════════════ REFERRAL ═══════════════
    function kodeUser(jid) {
        const user = userByJid(jid)
        if (!user) return null
        const k = store()
        if (!user.refCode) {
            let code
            do { code = crypto.createHash('sha1').update(jid + crypto.randomBytes(4).toString('hex')).digest('hex').slice(0, 6).toUpperCase() } while (k.refCodes[code])
            user.refCode = code
            k.refCodes[code] = jid
            global.db.kaguya = k
        } else if (!k.refCodes[user.refCode]) {
            k.refCodes[user.refCode] = jid
        }
        return user.refCode
    }

    return { cfg, wibDate, wibDay, durasi, store, userByJid, happy, boost, boostReward, happyBanner, setHappyManual, beri, MISI, misiHariIni, misiDenganProgres, trackMisi, kodeUser }
})()
export const { cfg, wibDate, wibDay, durasi, store, userByJid, happy, boost, boostReward, happyBanner, setHappyManual, beri, MISI, misiHariIni, misiDenganProgres, trackMisi, kodeUser } = __extra

