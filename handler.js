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


import chalk from 'chalk'
import { cekLimit, initPlugins, matchPlugin, sendExample, parseCommand, primaryPrefix, runPassivePlugins, afkCheck } from './lib/plugin-engine.js'
import { fiturWatch, fiturLog, fiturBlacklisted } from './lib/plugin-features.js'
import { runDevtools } from './lib/core-system.js'
import { trackMisi } from './lib/plugin-features.js'
import { isOwnerNumber } from './lib/core-system.js'
import { groupGuard, getMeta, isAdminJid } from './lib/wa.js'
import { isPremiumUser, isChatBanned, isUserBanned, recordCommand, isGroupRented } from './lib/core-data.js'

// command yang tetap boleh dipakai di grup yang belum menyewa
const SEWA_FREE = new Set(['sewa', 'ceksewa', 'buktisewa', 'batalsewa'])

const green = (t) => chalk.greenBright(t)
const blue = (t) => chalk.cyanBright(t)

await initPlugins()

// cetak log command masuk ke terminal
function logMessage(isCmd, { pushName, number, chatType, jid, prefix, command, text, mtype, body }) {
    const time = new Date().toLocaleTimeString('id-ID')
    const color = isCmd ? green : blue

    console.log(color(`┌─ [ ${isCmd ? 'COMMAND' : 'MESSAGE'} DETECTED ] ───`))
    console.log(color(`│ Waktu : ${time}`))
    console.log(color(`│ User  : ${pushName} (@${number})`))
    console.log(color(`│ Room  : ${chatType} (${jid})`))
    console.log(color('┠─ [ DATA ] ───'))
    if (isCmd) {
        console.log(color(`│ Cmd   : ${prefix}${command}`))
        if (text) console.log(color(`│ Args  : ${text}`))
    } else {
        console.log(color(`│ Type  : ${mtype}`))
        console.log(color(`│ Text  : ${body}`))
    }
    console.log(color('└───────────────────────────\n'))
}

// ═══════════════ SELF / PUBLIC BOT ═══════════════
// global.public = false (default): bot hanya merespon akun sendiri (fromMe) dan nomor
//   di global.owners. Pesan dari orang lain diabaikan total.
// global.public = true: semua orang bisa memakai bot. Command khusus owner / premium /
//   admin tetap dikunci, dan eval (=>, >, $) tetap hanya untuk owner.
// Owner Telegram: hanya ID numerik di global.telegram.owners (username bisa berpindah tangan,
// dan nomor owner WhatsApp sengaja tidak dipakai supaya tidak bisa bentrok dengan ID Telegram).
function isTelegramOwner(number) {
    const ids = [].concat(global.telegram?.owners || []).map(v => String(v).replace(/\D/g, '')).filter(Boolean)
    return ids.includes(String(number).replace(/\D/g, ''))
}

// fungsi utama: dipanggil tiap ada pesan baru dari index.js / jadibot
export const handler = async (sock, m) => {
    if (!m.message) return
    if (m.isBaileys) return // pesan yang dikirim bot sendiri
    if (global.botSentIds?.has(m.id)) return // cegah bot membalas pesannya sendiri

    const jid = m.chat
    if (!jid || jid === 'status@broadcast' || m.isNewsletter) return

    // Satu pesan bisa diterima dua socket kalau nomor jadibot sama dengan akun yang sudah
    // jalan (mis. nomor bot utama). Tanpa ini command jalan 2x dan salah satunya error
    // ("Tidak ada sesi jadibot aktif" setelah stopjadibot berhasil, dst).
    global.handledMsgs = global.handledMsgs || new Set()
    const selfId = String(sock.user?.id || '').split('@')[0].split(':')[0]
    const dedupeKey = `${selfId}|${jid}|${m.id}`
    if (global.handledMsgs.has(dedupeKey)) return
    global.handledMsgs.add(dedupeKey)
    if (global.handledMsgs.size > 1000) global.handledMsgs.delete(global.handledMsgs.values().next().value)

    const isGroup = m.isGroup
    const sender = isGroup ? (m.key.participant || m.sender) : jid
    const number = sender?.split('@')[0] || '-'

    // platform: 'telegram' kalau pesan datang dari adapter Telegram, selain itu WhatsApp
    const isTelegram = sock.platform === 'telegram'

    const isOwner = m.fromMe || (isTelegram ? isTelegramOwner(number) : await isOwnerNumber(sock, number))

    // SEWA BOT: kalau global.sewamode aktif, grup yang belum menyewa (atau masa sewanya habis) tidak dilayani sama sekali,
    // termasuk penjaga grup. Hanya command sewa yang boleh. Owner selalu lolos.
    if (isGroup && !isTelegram && !isOwner && global.sewamode === true && !isGroupRented(jid)) {
        const early = parseCommand(m.body || '')
        if (!(early.isCmd && SEWA_FREE.has(early.command))) {
            if (early.isCmd) {
                const notices = (global.sewaNotice ||= new Map())
                if (Date.now() - (notices.get(jid) || 0) > 6 * 36e5) {
                    notices.set(jid, Date.now())
                    await m.reply('⛔ Grup ini belum menyewa bot atau masa sewanya sudah habis.\nKetik *' + (early.prefix || primaryPrefix() || '.') + 'sewa* untuk melihat paket dan cara sewa.').catch(() => null)
                }
            }
            return
        }
    }

    // antidelete / antiedit / anti sekali lihat GLOBAL (config.js -> global.fitur), grup & chat pribadi
    if (!isTelegram) await fiturWatch(sock, m)

    // penjaga grup (antilink, antitoxic, antispam, antidelete, autoreply) jalan untuk semua pengirim
    // (khusus WhatsApp: bergantung pada event & metadata grup WhatsApp)
    if (isGroup && !isTelegram) await groupGuard(sock, m, { isOwner })

    // mode self: orang lain diabaikan total. mode public: semua boleh lanjut.
    if (!isOwner && global.public !== true) return

    // pconly / gconly: bot hanya melayani private chat atau grup. Owner tetap dilayani supaya bisa mematikannya.
    if (!isOwner && ((global.pconly === true && isGroup) || (global.gconly === true && !isGroup))) return

    // user yang di-ban (.ban): diabaikan total kecuali owner. Penjaga grup di atas tetap jalan.
    if (!isOwner && await isUserBanned(sock, m, sender).catch(() => false)) return

    // grup yang di-banchat: bot tidak merespon siapa pun kecuali owner (supaya bisa .unbanchat).
    // Penjaga grup (antilink dst) di atas tetap jalan.
    if (isGroup && !isOwner && isChatBanned(jid)) return

    const body = m.body || ''
    const { isCmd, prefix, command, text } = parseCommand(body)

    // blacklist global (config.js -> global.fitur.blacklist): nomor / grup / command / kata diabaikan total, owner lolos
    if (await fiturBlacklisted(sock, m, { sender, command: isCmd ? command : '', text, isOwner })) return

    // AFK: user yang AFK kembali kalau mengirim pesan; pengirim yang menandai user AFK diberi tahu
    // (.afk sendiri dilewati supaya tidak langsung membatalkan AFK-nya)
    if (!isTelegram) await afkCheck(sock, m, { skip: isCmd && command === 'afk' })

    const chatType = isGroup ? 'Group' : 'Private'
    const reply = m.reply
    const example = (usage) => sendExample(sock, m, { prefix: isCmd ? prefix : primaryPrefix(), command, usage })

    if (isCmd) logMessage(true, { pushName: m.pushName, number, chatType, jid, prefix, command, text })

    // isPremium diisi ulang di bawah (setelah metadata grup tersedia) khusus untuk command
    const ctx = { sock, text, prefix, command, reply, example, sender, jid, isOwner, isAdmin: false, isPremium: isOwner, body, isCmd }

    if (body && await runDevtools(sock, m, ctx)) return

    if (!isCmd) {
        if (body) await runPassivePlugins(sock, m, ctx)
        return
    }

    let meta = null
    if (isGroup) {
        try {
            meta = await getMeta(sock, jid)
            ctx.isAdmin = isAdminJid(meta, sender, m.key.participantAlt, m.key.participantPn)
        } catch {
            ctx.isAdmin = false
        }
    }
    // owner selalu premium; user lain premium kalau terdaftar lewat .addprem dan belum kedaluwarsa
    ctx.isPremium = isOwner || await isPremiumUser(sock, m, sender, meta).catch(() => false)
    // akun sendiri dianggap admin supaya fitur group tidak menolak; WhatsApp tetap
    // menolak aksi admin sungguhan kalau akunmu bukan admin di grup itu
    if (m.fromMe) ctx.isAdmin = true

    for (const plugin of Object.values(global.plugins)) {
        if (!matchPlugin(plugin, command)) continue

        if (plugin.owner && !ctx.isOwner) return reply(global.mess.owner)
        if (plugin.premium && !ctx.isPremium) return reply(global.mess.premium)
        // owner tidak dicek admin (lihat catatan di atas); user biasa wajib admin sungguhan
        if (plugin.admin && !ctx.isAdmin && !ctx.isOwner) return reply(global.mess.admin)
        if (plugin.group && !isGroup) return reply(global.mess.group)
        if (plugin.private && isGroup) return reply(global.mess.private)

        let bayarLimit = null
        if (plugin.limit && !ctx.isPremium) {
            bayarLimit = await cekLimit(sock, m, Number(plugin.limit) || 1, ctx)
            if (!bayarLimit) return
        }

        try {
            recordCommand(command, sender, m.pushName)
            fiturLog(sock, m, { command, text, sender, isOwner: ctx.isOwner }).catch(() => null)
            await plugin(m, ctx)
            bayarLimit?.()
            // misi harian (.misi): hitung command yang berhasil dijalankan
            trackMisi(sock, sender, command, plugin).catch(() => null)
        } catch (e) {
            console.error(e)
            await reply(typeof e === 'string' ? e : `🍅 Terjadi error: ${e?.message || String(e)}`).catch(() => null)
        }
        break
    }
}
