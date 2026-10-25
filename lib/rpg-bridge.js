// Jembatan RPG: menjalankan plugin RPG gaya backup (config + handler, getDatabase(), user.koin,
// user.rpg.*, user.inventory.*) di atas data RPG Kaguya (global.db.rpgData.users, field datar:
// money, limit, exp, level, health, potion, dst).
//
// Prinsip: TIDAK ada database kedua. getUser() mengembalikan "tampilan" (Proxy) dari record user
// Kaguya yang sama, jadi uang/exp/health/item dipakai bersama oleh plugin lama dan plugin baru:
//   koin      <-> money            energi    <-> limit
//   isPremium <-> premium          isRegistered <-> registered     isBanned <-> banned
//   rpg.health/maxHealth/mana/stamina <-> health/maxhealth/mana/stamina
//   inventory.<item>  -> field datar bila ada di record Kaguya (potion, diamond, ...), selain itu
//                        disimpan di record yang sama (u.inventoryx)
//   field lain (clanId, cafe, quest, ...) disimpan langsung di record user.
// Sistem level memakai rumus Kaguya (xpRange/findLevel), bukan rumus backup.
import { saveDB } from './core-system.js'
import { getOwners } from './core-system.js'
import { getMeta } from './wa.js'
import {
    rpgStore, makeDefaultUser, ensureUser, wrapMessage, toPN, wrapPlugin,
    xpRange, findLevel, notifyLevelUp, saluranCtx, config as engineConfig
} from './plugin-engine.js'

export { xpRange, findLevel }

const SELF = Symbol('flat')
const cleanId = (jid) => String(jid || '').replace(/@.+/g, '').replace(/:\d+$/, '')
const isBadJid = (jid) => /@(g\.us|broadcast|newsletter)$/.test(String(jid || ''))
const keyFor = (id) => `${id}@s.whatsapp.net`

// ───────── config ala backup (dibangun di atas config Kaguya) ─────────
export const config = Object.create(engineConfig, {
    owner: { get: () => ({ number: getOwners().map(n => String(n).replace(/\D/g, '')), name: global.ownername || 'Owner' }) },
    energi: { value: { enabled: true, default: 20, premium: -1, owner: -1 } },
    command: { get: () => ({ prefix: (Array.isArray(global.prefix) ? global.prefix[0] : global.prefix) || '.' }) }
})
config.isOwner = (jid) => {
    const n = cleanId(jid)
    return !!n && getOwners().some(o => String(o).replace(/\D/g, '') === n)
}
config.isPremium = (jid) => {
    const n = cleanId(jid)
    if (!n) return false
    if (config.isOwner(n)) return true
    const u = rpgStore().users[keyFor(n)]
    return !!(u && (u.premium === true || Number(u.premiumTime) > Date.now()))
}
const MSG = {
    groupOnly: '⚠️ Fitur ini hanya bisa dipakai di grup.',
    privateOnly: '⚠️ Fitur ini hanya bisa dipakai di chat pribadi.',
    adminOnly: '⚠️ Fitur ini hanya untuk admin grup.',
    botAdminOnly: '⚠️ Jadikan bot admin grup dulu.',
    energiExceeded: '⚡ *Limit habis!* Limit kamu sudah habis, beli lewat *.buy limit* atau tunggu reset.',
    cooldown: '🕕 *Tunggu dulu!* Kamu masih dalam cooldown. Tunggu %time% detik lagi ya.'
}
Object.defineProperty(config, 'messages', {
    get: () => ({ ...engineConfig.messages, ...MSG }),
    configurable: true
})
export default config

// ───────── penyimpanan ─────────
let saveTimer = null
function saveSoon() {
    if (saveTimer) return
    saveTimer = setTimeout(() => {
        saveTimer = null
        try { saveDB(global.db) } catch { }
    }, 3000)
    saveTimer.unref?.()
}

// data selain user (grup, setting, stat, guild, simulator, ...) ikut tersimpan di rpgData
function ext() {
    const s = rpgStore()
    const e = (s.bridge ||= {})
    e.groups ||= {}
    e.settings ||= {}
    e.stats ||= {}
    e.sewa ||= { enabled: false, groups: {} }
    e.legacy ||= { clans: {}, sider: {}, antipm: {}, autopost: {}, activeWars: {}, pendingWars: {}, warHistory: [] }
    e.guilds ||= {}
    e.simulator ||= {}
    e.bots ||= { stock: {} }
    return e
}

// ───────── tampilan user ─────────
const FLAT_ALIAS = { koin: 'money', energi: 'limit', isPremium: 'premium', isRegistered: 'registered', isBanned: 'banned', maxHealth: 'maxhealth' }
const RPG_ALIAS = { health: 'health', maxHealth: 'maxhealth', mana: 'mana', stamina: 'stamina' }
// field datar yang bukan item (tidak ikut dihitung sebagai inventory)
const NOT_ITEM = new Set(['exp', 'money', 'level', 'limit', 'age', 'regTime', 'afk', 'warn', 'premiumTime', 'health', 'maxhealth', 'stamina', 'mana', 'energy', 'gold', 'bank', 'atm', 'fullatm', 'horseexp'])
const isItemKey = (k, v) => typeof v === 'number' && !NOT_ITEM.has(k) && !/^(last|cd|cooldown)/i.test(k)

function rpgView(u) {
    const store = (u.rpgx ||= {})
    return new Proxy(store, {
        get(t, p) {
            if (typeof p === 'symbol') return Reflect.get(t, p)
            if (p === 'level') return u.level
            if (RPG_ALIAS[p]) return u[RPG_ALIAS[p]]
            return t[p]
        },
        set(t, p, v) {
            if (p === 'level') return true // level dikelola sistem level Kaguya
            if (RPG_ALIAS[p]) u[RPG_ALIAS[p]] = v
            else t[p] = v
            saveSoon()
            return true
        },
        has(t, p) { return p === 'level' || !!RPG_ALIAS[p] || p in t },
        ownKeys(t) { return [...new Set([...Reflect.ownKeys(t), 'level', ...Object.keys(RPG_ALIAS)])] },
        getOwnPropertyDescriptor(t, p) {
            if (p === 'level' || RPG_ALIAS[p]) return { value: this.get(t, p), writable: true, enumerable: true, configurable: true }
            return Reflect.getOwnPropertyDescriptor(t, p)
        },
        deleteProperty(t, p) { delete t[p]; saveSoon(); return true }
    })
}

function inventoryView(u) {
    const store = (u.inventoryx ||= {})
    const flatItem = (p) => typeof p === 'string' && Object.prototype.hasOwnProperty.call(u, p) && typeof u[p] === 'number'
    return new Proxy(store, {
        get(t, p) {
            if (typeof p === 'symbol') return Reflect.get(t, p)
            if (p in t) return t[p]
            if (flatItem(p) && !NOT_ITEM.has(p)) return u[p]
            return undefined
        },
        set(t, p, v) {
            if (flatItem(p) && !NOT_ITEM.has(p) && !(p in t)) u[p] = v
            else t[p] = v
            saveSoon()
            return true
        },
        has(t, p) { return p in t || (flatItem(p) && !NOT_ITEM.has(p)) },
        ownKeys(t) {
            const flat = Object.keys(u).filter(k => isItemKey(k, u[k]) && !(k in t))
            return [...Reflect.ownKeys(t), ...flat]
        },
        getOwnPropertyDescriptor(t, p) {
            if (p in t) return Reflect.getOwnPropertyDescriptor(t, p)
            if (flatItem(p) && !NOT_ITEM.has(p)) return { value: u[p], writable: true, enumerable: true, configurable: true }
            return undefined
        },
        deleteProperty(t, p) { delete t[p]; if (flatItem(p) && !NOT_ITEM.has(p)) u[p] = 0; saveSoon(); return true }
    })
}

const views = new WeakMap()
function userView(u, id) {
    if (views.has(u)) return views.get(u)
    const view = new Proxy(u, {
        get(t, p) {
            if (p === SELF) return t
            if (typeof p === 'symbol') return Reflect.get(t, p)
            if (p === 'rpg') return rpgView(t)
            if (p === 'inventory') return inventoryView(t)
            if (p === 'jid' || p === 'number') return id
            if (p === 'cooldowns') return (t.cooldowns ||= {})
            if (p === 'saldo') return t.saldo ?? 0
            if (FLAT_ALIAS[p]) return t[FLAT_ALIAS[p]]
            return t[p]
        },
        set(t, p, v) {
            if (p === 'rpg') { Object.assign(rpgView(t), v); return true }
            if (p === 'inventory') { Object.assign(inventoryView(t), v); return true }
            if (FLAT_ALIAS[p]) t[FLAT_ALIAS[p]] = v
            else t[p] = v
            saveSoon()
            return true
        },
        has(t, p) { return p === 'rpg' || p === 'inventory' || !!FLAT_ALIAS[p] || p in t },
        ownKeys(t) { return [...new Set([...Reflect.ownKeys(t), 'rpg', 'inventory', ...Object.keys(FLAT_ALIAS)])] },
        getOwnPropertyDescriptor(t, p) {
            if (p === 'rpg' || p === 'inventory' || FLAT_ALIAS[p]) return { value: this.get(t, p), writable: true, enumerable: true, configurable: true }
            return Reflect.getOwnPropertyDescriptor(t, p)
        },
        deleteProperty(t, p) { delete t[FLAT_ALIAS[p] || p]; saveSoon(); return true }
    })
    views.set(u, view)
    return view
}

/** record user Kaguya (datar) di balik tampilan */
export const flatOf = (user) => (user && user[SELF]) || user

// db.db.data.users: peta nomor -> tampilan user (bisa di-loop dan diubah)
const usersMap = new Proxy({}, {
    get(_, p) {
        if (typeof p === 'symbol') return undefined
        const u = rpgStore().users[keyFor(cleanId(p))]
        return u ? userView(u, cleanId(p)) : undefined
    },
    set(_, p, v) {
        const id = cleanId(p)
        const users = rpgStore().users
        const u = users[keyFor(id)] || (users[keyFor(id)] = makeDefaultUser(v?.name || id))
        if (v && typeof v === 'object') Object.assign(userView(u, id), v)
        saveSoon()
        return true
    },
    has(_, p) { return typeof p === 'string' && !!rpgStore().users[keyFor(cleanId(p))] },
    deleteProperty(_, p) { delete rpgStore().users[keyFor(cleanId(p))]; saveSoon(); return true },
    ownKeys() { return Object.keys(rpgStore().users).filter(k => k.endsWith('@s.whatsapp.net')).map(cleanId) },
    getOwnPropertyDescriptor(_, p) {
        const v = typeof p === 'string' ? this.get(_, p) : undefined
        return v ? { value: v, writable: true, enumerable: true, configurable: true } : undefined
    }
})

// ───────── database ala backup ─────────
const data = {
    users: usersMap,
    get groups() { return ext().groups },
    get settings() { return ext().settings },
    get stats() { return ext().stats },
    get sewa() { return ext().sewa },
    get legacy() { return ext().legacy },
    get guilds() { return ext().guilds },
    get simulator() { return ext().simulator },
    get bots() { return ext().bots },
    get clans() { return ext().legacy.clans },
    get activeWars() { return ext().legacy.activeWars },
    get pendingWars() { return ext().legacy.pendingWars },
    get warHistory() { return ext().legacy.warHistory },
    premium: [], owner: [], partner: []
}

const database = {
    db: { data, write: () => { saveSoon() }, read: () => { } },
    get data() { return data },
    get users() { return data.users },
    get groups() { return data.groups },
    get settings() { return data.settings },
    get stats() { return data.stats },
    get sewa() { return data.sewa },
    get legacy() { return data.legacy },

    markDirty() { saveSoon() },
    async save() { try { saveDB(global.db); return true } catch { return false } },
    flushAll() { try { saveDB(global.db) } catch { } },

    getUser(jid) {
        if (!jid || isBadJid(jid)) return null
        const id = cleanId(jid)
        if (!id) return null
        const u = rpgStore().users[keyFor(id)]
        return u ? userView(u, id) : null
    },
    setUser(jid, patch = {}) {
        if (!jid || isBadJid(jid)) return null
        const id = cleanId(jid)
        if (!id) return null
        const users = rpgStore().users
        const u = users[keyFor(id)] || (users[keyFor(id)] = makeDefaultUser(patch.name || id))
        const view = userView(u, id)
        for (const key of Object.keys(patch)) view[key] = patch[key]
        saveSoon()
        return view
    },
    deleteUser(jid) {
        const key = keyFor(cleanId(jid))
        if (!rpgStore().users[key]) return false
        delete rpgStore().users[key]
        saveSoon()
        return true
    },
    getAllUsers() { return data.users },
    getUserCount() { return Object.keys(data.users).length },

    updateEnergi(jid, amount) {
        const user = this.getUser(jid) || this.setUser(jid)
        if (!user) return 0
        if (user.energi === -1) return -1
        if (config.isOwner(jid) || config.isPremium(jid)) return -1
        user.energi = Math.max(0, (Number(user.energi) || 0) + amount)
        saveSoon()
        return user.energi
    },
    updateKoin(jid, amount) {
        const user = this.getUser(jid) || this.setUser(jid)
        if (!user) return 0
        user.koin = Math.max(0, Math.min(9e12, (Number(user.koin) || 0) + amount))
        saveSoon()
        return user.koin
    },
    updateSaldo(jid, amount) {
        const user = this.getUser(jid) || this.setUser(jid)
        if (!user) return 0
        user.saldo = Math.max(0, (Number(user.saldo) || 0) + amount)
        saveSoon()
        return user.saldo
    },
    updateExp(jid, amount) {
        const user = this.getUser(jid) || this.setUser(jid)
        if (!user) return 0
        user.exp = Math.max(0, Math.min(9e9, (Number(user.exp) || 0) + amount))
        saveSoon()
        return user.exp
    },
    getTopUsers(field, limit = 10) {
        return Object.values(data.users)
            .filter(u => (u[field] || 0) > 0)
            .sort((a, b) => (b[field] || 0) - (a[field] || 0))
            .slice(0, limit)
    },
    checkCooldown(jid, command) {
        const user = this.getUser(jid) || this.setUser(jid)
        if (!user) return false
        const end = user.cooldowns[command] || 0
        const now = Date.now()
        return now < end ? Math.ceil((end - now) / 1000) : false
    },
    setCooldown(jid, command, seconds) {
        const user = this.getUser(jid) || this.setUser(jid)
        if (!user) return
        user.cooldowns[command] = Date.now() + seconds * 1000
        saveSoon()
    },

    getGroup(jid) { return jid ? (data.groups[jid] || null) : null },
    setGroup(jid, patch = {}) {
        if (!jid) return null
        const old = data.groups[jid] || {}
        data.groups[jid] = {
            ...old, ...patch, jid,
            name: patch.name || old.name || 'Unknown Group',
            game: patch.game ?? old.game ?? true,
            rpg: patch.rpg ?? old.rpg ?? true,
            warnings: patch.warnings ?? old.warnings ?? [],
            chat: old.chat ?? {}
        }
        saveSoon()
        return data.groups[jid]
    },
    getAllGroups() { return data.groups },

    setting(key, value = undefined) {
        if (value !== undefined) { data.settings[key] = value; saveSoon() }
        return data.settings[key]
    },
    getSettings() { return data.settings },
    incrementStat(key, inc = 1) {
        data.stats[key] = (data.stats[key] || 0) + inc
        saveSoon()
        return data.stats[key]
    },
    getStats(key) { return key ? (data.stats[key] || 0) : data.stats },
    resetAllEnergi(defaultEnergi = 20) {
        let count = 0
        for (const user of Object.values(data.users)) { if (!user.isPremium) user.energi = defaultEnergi; count++ }
        saveSoon()
        return count
    }
}

export function getDatabase() { return database }
export const initDatabase = async () => database

// ───────── level (rumus Kaguya) ─────────
export const calculateLevel = (exp) => findLevel(Number(exp) || 0)
export const expForLevel = (level) => xpRange(Math.max(0, level)).min

export function getRole(level) {
    if (level >= 100) return '🐉 Mythic'
    if (level >= 80) return '⚔️ Legend'
    if (level >= 60) return '💜 Epic'
    if (level >= 40) return '💪 Grandmaster'
    if (level >= 20) return '🎖️ Master'
    if (level >= 10) return '⭐ Elite'
    return '🛡️ Warrior'
}

export async function checkAndNotifyLevelUp(sock, m, _db, user) {
    const flat = flatOf(user)
    const oldLevel = Number(flat.level) || 0
    let notified = false
    try { notified = await notifyLevelUp(sock, m, flat, m.chat) } catch { }
    const newLevel = Number(flat.level) || oldLevel
    return { leveledUp: newLevel > oldLevel, notified: !!notified, oldLevel, newLevel }
}

export async function addExpWithLevelCheck(sock, m, db, user, expAmount) {
    if (!user) return { leveledUp: false, notified: false, oldLevel: 1, newLevel: 1 }
    db.updateExp(m.sender, expAmount)
    const result = await checkAndNotifyLevelUp(sock, m, db, user)
    saveSoon()
    return result
}

// ───────── pengiriman pesan (ala src/context.js) ─────────
async function sendPreview(sock, jid, text, _title, options = {}) {
    const { mentions, quoted, contextInfo, ...rest } = options || {}
    const body = String(text ?? '')
    const auto = [...body.matchAll(/@(\d{5,20})/g)].map(x => `${x[1]}@s.whatsapp.net`)
    const all = [...new Set([...(Array.isArray(mentions) ? mentions : []), ...auto])]
    const content = { text: body }
    if (all.length) content.mentions = all
    const ctx = { ...saluranCtx(), ...(contextInfo || {}) }
    if (Object.keys(ctx).length) content.contextInfo = ctx
    const sent = await sock.sendMessage(jid, content, { quoted: quoted || undefined, ...rest })
    return { key: sent?.key || { id: sent?.key?.id, remoteJid: jid, fromMe: true } }
}
export const sendGamePreview = (sock, jid, text, title, _body, options) => sendPreview(sock, jid, text, title, options)
export const sendWinnerPreview = (sock, jid, text, title, _body, options) => sendPreview(sock, jid, text, title, options)
export const sendRpgPreview = (sock, jid, text, title, _body, options) => sendPreview(sock, jid, text, title, options)
export const sendToolsPreview = (sock, jid, text, title, _body, options) => sendPreview(sock, jid, text, title, options)
export const getGameContextInfo = () => saluranCtx()
export const getWinnerContextInfo = () => saluranCtx()
export const getRpgContextInfo = () => saluranCtx()
export { saluranCtx }

// ───────── pembungkus plugin RPG gaya config + handler ─────────
// Meniru gerbang adapter backup: wajib daftar (pakai status daftar Kaguya), cek grup/privat,
// biaya energi (= limit Kaguya), lalu menjalankan handler dengan sender nomor telepon.
export function rpgPlugin(pluginConfig, handler, opts = {}) {
    const cfg = { ...pluginConfig, cooldown: pluginConfig.cooldown ?? 0 }
    // data grup hanya diambil kalau handler memintanya
    const wantsGroup = /\b(groupMetadata|participants)\b/.test(Function.prototype.toString.call(handler))
    const run = async (m, ctx) => {
        const sock = ctx.sock
        const pm0 = await wrapMessage(sock, m)
        const sender = pm0.sender
        const mentioned = pm0.mentionedJid
        const quotedSender = pm0.quoted?.sender
        let groupMetadata
        if (wantsGroup && m.isGroup) {
            const meta = await getMeta(sock, ctx.jid || m.chat).catch(() => null)
            groupMetadata = meta
                ? { ...meta, participants: (meta.participants || []).map(x => ({ ...x, id: x.phoneNumber || x.id })) }
                : { id: ctx.jid || m.chat, participants: [] }
        }
        const pm = new Proxy(m, {
            get(t, p) {
                if (p === 'sender') return sender
                if (p === 'groupMetadata' && groupMetadata) return groupMetadata
                if (p === 'isAdmin') return !!ctx.isAdmin
                if (p === 'isBotAdmin') return !!ctx.isBotAdmin
                if (p === 'isOwner') return !!ctx.isOwner
                if (p === 'isPremium') return !!ctx.isPremium
                if (p === 'mentionedJid') return mentioned
                if (p === 'quoted' && t.quoted) {
                    return new Proxy(t.quoted, { get(q, k) { if (k === 'sender') return quotedSender; const v = Reflect.get(q, k); return typeof v === 'function' ? v.bind(q) : v } })
                }
                const v = Reflect.get(t, p)
                return typeof v === 'function' ? v.bind(t) : v
            }
        })

        const db = getDatabase()
        const flat = ensureUser({ sender, pushName: m.pushName })
        const user = userView(flat, cleanId(sender))
        const owner = !!ctx.isOwner
        const premium = !!ctx.isPremium || owner

        if (cfg.isEnabled === false) return ctx.reply('⚠️ Fitur ini sedang dinonaktifkan.')
        if (!cfg.noRegister && !owner && !flat.registered) {
            const p = ctx.prefix || '.'
            return ctx.reply(`🔒 *Kamu belum terdaftar!*\n\nDaftar dulu untuk bisa main RPG:\n*${p}daftar nama.umur*\nContoh: *${p}daftar Budi.17*`)
        }
        const cost = Number(cfg.energi) || 0
        if (cost > 0 && !owner && !premium) {
            if ((Number(flat.limit) || 0) < cost) return ctx.reply(MSG.energiExceeded)
        }

        try {
            await handler(pm, { ...ctx, db, config, user, groupMetadata, participants: groupMetadata?.participants })
            if (cost > 0 && !owner && !premium) flat.limit = Math.max(0, (Number(flat.limit) || 0) - cost)
            db.incrementStat('rpgCommands')
        } catch (e) {
            // konvensi plugin lama: throw 'teks' = kirim teks itu, throw false = diam
            if (typeof e === 'string') return ctx.reply(e)
            if (e === false || e == null) return
            console.error(`[RPG] error pada command "${ctx.command}":`, e)
            return ctx.reply('⚠️ Terjadi kesalahan saat menjalankan perintah ini, coba lagi nanti.')
        } finally {
            saveSoon()
        }
    }
    const plugin = wrapPlugin(cfg, run)
    plugin.tags = [opts.tag || 'rpg'] // kategori menu (default rpg)
    return plugin
}
