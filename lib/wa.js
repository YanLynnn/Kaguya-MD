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

// ╔══════════════ [ PENJELASAN FILE ] ══════════════╗
// Lapisan WhatsApp (Baileys): membuat socket, mengubah pesan mentah jadi objek m (serialize),
// kirim tombol/rich message/media, manajemen grup (metadata, admin, welcome),
// penjaga grup (antilink, antitoxic, antispam, antiviewonce, antidelete),
// pelacak aktivitas, dan JADIBOT (startJadibot/stopJadibot: nomor lain jadi bot tambahan).
// ╚═════════════════════════════════════════════════╝


import { downloadContentFromMessage, prepareWAMessageMedia, getContentType, makeWASocket, makeCacheableSignalKeyStore, fetchLatestBaileysVersion, jidDecode, useMultiFileAuthState, DisconnectReason } from '@whiskeysockets/baileys'
import * as baileysLib from '@whiskeysockets/baileys'
import pino from 'pino'
import chalk from 'chalk'
import luna from '@ryuu-reinzz/luna-lib'
import { followNewsletters } from './core-system.js'
import { buildContextInfo, sleep, saveDB, TTLCache, registerCleaner, recallMessage } from './core-system.js'
import { addWarn, getWarn, warnLimit, resetWarn, isMutedIds, hasMutes, cuteContent } from './core-data.js'
import { randomUUID, randomBytes } from 'crypto'
import fs from 'fs'
import path from 'path'
import { execFile as _execFile } from 'child_process'
import { createRequire as _createRequire } from 'module'


// ╔══════════════ [ socket.js ] ══════════════╗

// ───────── serialize ─────────
const WRAPPER_TYPES = ['documentWithCaptionMessage', 'viewOnceMessage', 'viewOnceMessageV2', 'viewOnceMessageV2Extension', 'ephemeralMessage']

// buka pembungkus pesan (ephemeral, viewOnce, dll) sampai isi aslinya
function unwrap(message) {
    if (!message) return { mtype: undefined, msg: undefined }

    let mtype = getContentType(message)
    let depth = 0

    while (mtype && WRAPPER_TYPES.includes(mtype) && depth < 5) {
        message = message[mtype]?.message
        mtype = message ? getContentType(message) : undefined
        depth++
    }

    return { mtype, msg: mtype ? message[mtype] : undefined }
}

// tentukan jenis media dari pesan
const mediaTypeOf = (mtype = '') => {
    if (!mtype) return 'document'
    let type = mtype.replace(/Message$/, '').toLowerCase()
    if (!['image', 'video', 'audio', 'sticker'].includes(type)) return 'document'
    return type
}

// unduh isi media dari node pesan
async function downloadNode(node) {
    if (!node) return null
    let type = mediaTypeOf(node.mtype)
    let stream = await downloadContentFromMessage(node, type)
    let chunks = []
    for await (let chunk of stream) chunks.push(chunk)
    return Buffer.concat(chunks)
}

// bangun objek pesan yang di-reply (m.quoted)
function buildQuoted(sock, m, contextInfo) {
    let quotedMessage = contextInfo?.quotedMessage
    if (!quotedMessage) return null

    let { mtype, msg } = unwrap(quotedMessage)
    if (typeof msg === 'string') msg = { text: msg }

    let quoted = {
        ...msg,
        mtype,
        id: contextInfo.stanzaId,
        chat: contextInfo.remoteJid || m.chat,
        sender: sock.decodeJid(contextInfo.participant),
        mentionedJid: contextInfo.mentionedJid || []
    }
    quoted.fromMe = quoted.sender === sock.decodeJid(sock.user.id)
    quoted.isBaileys = quoted.id ? quoted.id.startsWith('BAE5') && quoted.id.length === 16 : false
    quoted.text = msg?.text || msg?.caption || msg?.conversation || msg?.selectedDisplayText || ''
    quoted.isMedia = !!msg?.mimetype
    quoted.download = () => downloadNode({ ...msg, mtype })
    quoted.fakeKey = {
        remoteJid: quoted.chat,
        fromMe: quoted.fromMe,
        id: quoted.id,
        participant: quoted.sender
    }
    quoted.delete = () => sock.sendMessage(quoted.chat, { delete: quoted.fakeKey })

    return quoted
}

// Balasan tombol (quick_reply, list, template, buttons klasik) -> teks command.
// Tanpa ini, tap tombol tidak dianggap pesan oleh handler.
function buttonReplyId(msg, mtype) {
    if (!msg) return ''
    try {
        switch (mtype) {
            case 'interactiveResponseMessage': {
                const params = msg.nativeFlowResponseMessage?.paramsJson
                if (params) {
                    const parsed = JSON.parse(params)
                    return String(parsed.id ?? parsed.selectedId ?? parsed.selected_id ?? parsed.title ?? '')
                }
                return msg.body?.text || ''
            }
            case 'buttonsResponseMessage': return msg.selectedButtonId || msg.selectedDisplayText || ''
            case 'listResponseMessage': return msg.singleSelectReply?.selectedRowId || msg.title || ''
            case 'templateButtonReplyMessage': return msg.selectedId || msg.selectedDisplayText || ''
            default: return ''
        }
    } catch {
        return ''
    }
}

// Perangkat lawan bicara di chat pribadi, dikenali dari id pesan terakhir yang mereka kirim
// (id iPhone: berawalan 3A, total 20 karakter). Dipakai untuk memilih tombol yang bisa dirender iPhone.
export const isIosId = (id) => /^3A.{18}$/.test(String(id || ''))
const iosChats = new Map()
// cek apakah lawan chat memakai iPhone
export const chatIsIos = (jid) => iosChats.get(jid) === true

// ubah pesan mentah Baileys jadi objek m (body, sender, reply, quoted, dll)
export function serialize(sock, rawMsg) {
    let m = rawMsg
    if (!m || !m.key) return m

    m.id = m.key.id
    m.isBaileys = m.id?.startsWith('BAE5') && m.id.length === 16
    m.chat = m.key.remoteJid
    m.fromMe = m.key.fromMe
    m.isGroup = m.chat?.endsWith('@g.us')
    m.isNewsletter = m.chat?.endsWith('@newsletter')
    m.sender = sock.decodeJid(m.fromMe ? sock.user.id : (m.key.participant || m.chat))
    m.pushName = m.pushName || 'Unknown'
    if (!m.fromMe && m.chat && !m.isGroup && !m.isNewsletter && m.chat !== 'status@broadcast') {
        iosChats.set(m.chat, isIosId(m.id))
        if (iosChats.size > 2000) iosChats.delete(iosChats.keys().next().value)
    }

    if (!m.message) return m

    const unwrapped = unwrap(m.message)
    m.mtype = unwrapped.mtype
    m.msg = unwrapped.msg

    let contextInfo =
        m.msg?.contextInfo ||
        m.message?.extendedTextMessage?.contextInfo ||
        m.message?.imageMessage?.contextInfo ||
        m.message?.videoMessage?.contextInfo ||
        null

    m.mentionedJid = contextInfo?.mentionedJid || []
    m.quoted = buildQuoted(sock, m, contextInfo)
    if (m.quoted) {
        m.quoted.forwardable = {
            key: { remoteJid: m.quoted.chat, id: m.quoted.id, participant: m.quoted.sender },
            message: contextInfo.quotedMessage
        }
    }

    m.body =
        m.message.conversation ||
        m.msg?.text ||
        m.msg?.caption ||
        buttonReplyId(m.msg, m.mtype) ||
        ''

    m.text = m.body
    m.isMedia = !!m.msg?.mimetype
    m.download = m.isMedia ? () => downloadNode({ ...m.msg, mtype: m.mtype }) : null

    // bisa m.reply(teks, opsi) atau m.reply(teks, null, opsi)
    m.reply = (text, options = {}, extraOptions = {}) => {
        options = { ...(options || {}), ...(extraOptions || {}) }
        const { thumbnail, title, description, sourceUrl, largerThumbnail, forward, ...content } = options
        const contextInfo = buildContextInfo({ forward, thumbnail, title, description, sourceUrl, largerThumbnail })
        const payload = Object.keys(contextInfo).length
            ? { ...content, contextInfo: { ...content.contextInfo, ...contextInfo } }
            : content

        if (Buffer.isBuffer(text)) {
            return sock.sendMessage(m.chat, { document: text, ...payload }, { quoted: m })
        }
        return sock.sendMessage(m.chat, { text, ...payload }, { quoted: m })
    }

    return m
}

// ╔══════════════ [ rich: AIRich, tabel A2UI, tombol, FOMO ] ══════════════╗
const baileys = async () => baileysLib

// ───────── tokenizer kode (highlight) ─────────
const KEYWORDS = new Set(['break', 'case', 'catch', 'continue', 'debugger', 'default', 'delete', 'do', 'else', 'finally', 'for', 'function', 'if', 'in', 'instanceof', 'new', 'return', 'switch', 'this', 'throw', 'try', 'typeof', 'var', 'void', 'while', 'with', 'true', 'false', 'null', 'undefined', 'NaN', 'Infinity', 'class', 'const', 'let', 'super', 'extends', 'export', 'import', 'yield', 'static', 'constructor', 'of', 'async', 'await', 'get', 'set', 'implements', 'interface', 'package', 'private', 'protected', 'public', 'enum', 'throws', 'transient'])
// warna/gaya penyorotan kode untuk pesan rich
const HIGHLIGHT = { DEFAULT: 0, KEYWORD: 1, METHOD: 2, STR: 3, NUMBER: 5 }

// pecah kode jadi token untuk disorot
export function tokenizeCode(src = '') {
    const tokens = []
    const len = src.length
    let i = 0
    const push = (content, type) => {
        const last = tokens[tokens.length - 1]
        if (type === 'DEFAULT' && last?.type === 'DEFAULT') last.content += content
        else tokens.push({ content, type })
    }

    while (i < len) {
        const ch = src[i]
        if (/\s/.test(ch)) {
            const s = i
            while (i < len && /\s/.test(src[i])) i++
            push(src.slice(s, i), 'DEFAULT')
        } else if (ch === '"' || ch === "'" || ch === '`') {
            const s = i++
            while (i < len && src[i] !== ch) { if (src[i] === '\\') i++; i++ }
            i++
            push(src.slice(s, i), 'STR')
        } else if (/[0-9]/.test(ch)) {
            const s = i
            while (i < len && /[0-9.]/.test(src[i])) i++
            push(src.slice(s, i), 'NUMBER')
        } else if (/[a-zA-Z_$]/.test(ch)) {
            const s = i
            while (i < len && /[a-zA-Z0-9_$]/.test(src[i])) i++
            const word = src.slice(s, i)
            if (KEYWORDS.has(word)) { push(word, 'KEYWORD'); continue }
            let j = i
            while (j < len && /\s/.test(src[j])) j++
            push(word, src[j] === '(' ? 'METHOD' : 'DEFAULT')
        } else {
            push(ch, 'DEFAULT')
            i++
        }
    }
    return tokens
}

// ───────── helper media ─────────
const asSource = (src) => {
    if (Buffer.isBuffer(src)) return src
    if (src && typeof src === 'object' && src.url) return src
    return { url: String(src) }
}

// siapkan/unggah media untuk pesan
const uploadMedia = async (sock, type, src, extra = {}) => {
    const { prepareWAMessageMedia } = await baileys()
    return prepareWAMessageMedia({ [type]: asSource(src), ...extra }, { upload: sock.waUploadToServer })
}

// ═══════════════ TOMBOL ═══════════════
const J = (o) => JSON.stringify(o)

// rapikan daftar section pada pesan list
function normalizeSections(b) {
    const sections = b.sections || [{ title: b.sectionTitle || b.title || 'Menu', rows: b.rows || [] }]
    return sections.map(s => ({
        title: s.title || '',
        ...(s.highlight_label || s.highlight ? { highlight_label: s.highlight_label || s.highlight } : {}),
        rows: (s.rows || []).map(r => ({
            header: r.header || '',
            title: String(r.title ?? r.text ?? r.id ?? ''),
            description: r.description || r.desc || '',
            id: String(r.id ?? r.title ?? '')
        }))
    }))
}

/** Ubah satu definisi tombol (shorthand atau mentah) menjadi { name, buttonParamsJson }. */
export function toNativeButton(b) {
    if (!b || typeof b !== 'object') throw new Error('Tombol tidak valid')
    if (b.name && b.buttonParamsJson) {
        return { name: b.name, buttonParamsJson: typeof b.buttonParamsJson === 'string' ? b.buttonParamsJson : J(b.buttonParamsJson) }
    }

    const type = String(b.type || '').toLowerCase().replace(/^cta_/, '')
    const label = b.text ?? b.display_text ?? b.title ?? ''

    switch (type) {
        case 'reply':
        case 'quick_reply':
            return { name: 'quick_reply', buttonParamsJson: J({ display_text: label, id: String(b.id ?? label) }) }
        case 'url':
            return { name: 'cta_url', buttonParamsJson: J({ display_text: label, url: b.url, merchant_url: b.merchant_url || b.url }) }
        case 'copy':
            return { name: 'cta_copy', buttonParamsJson: J({ display_text: label, copy_code: String(b.code ?? b.copy_code ?? ''), id: String(b.id ?? '') }) }
        case 'call':
            {
            const phone = String(b.phone ?? b.phone_number ?? b.id ?? '')
            return { name: 'cta_call', buttonParamsJson: J({ display_text: label, phone_number: phone, id: phone }) }
        }
        case 'address':
        case 'address_message':
            return { name: 'address_message', buttonParamsJson: J({ display_text: label || 'Alamat', id: String(b.id ?? label) }) }
        case 'location':
        case 'send_location':
            return { name: 'send_location', buttonParamsJson: J({ display_text: label || 'Kirim Lokasi' }) }
        case 'list':
        case 'select':
        case 'single_select':
            return { name: 'single_select', buttonParamsJson: J({ title: label || 'Pilih', sections: normalizeSections(b) }) }
        case 'webview':
        case 'open_webview':
            return { name: 'open_webview', buttonParamsJson: J({ title: label, link: { in_app_webview: true, url: b.url } }) }
        case 'reminder':
            return { name: 'cta_reminder', buttonParamsJson: J({ display_text: label || 'Ingatkan Saya', id: String(b.id ?? label) }) }
        case 'cancel_reminder':
            return { name: 'cta_cancel_reminder', buttonParamsJson: J({ display_text: label || 'Batalkan Pengingat', id: String(b.id ?? label) }) }
        default:
            throw new Error(`Tipe tombol tidak dikenal: ${b.type}`)
    }
}

/** Daftar tombol -> teks (dipakai kalau tombol gagal terkirim). */
export function buttonsToText(buttons = []) {
    const lines = []
    for (const raw of buttons) {
        let nb
        try { nb = toNativeButton(raw) } catch { continue }
        let p = {}
        try { p = JSON.parse(nb.buttonParamsJson) } catch {}
        switch (nb.name) {
            case 'single_select':
                for (const s of p.sections || []) for (const r of s.rows || []) lines.push(`▢ ${r.id || r.title}${r.description ? ` _(${r.description})_` : ''}`)
                break
            case 'quick_reply': lines.push(`▢ ${p.id || p.display_text}`); break
            case 'cta_url': lines.push(`🔗 ${p.display_text}: ${p.url}`); break
            case 'open_webview': lines.push(`🔗 ${p.title}: ${p.link?.url}`); break
            case 'cta_copy': lines.push(`📋 ${p.display_text}: ${p.copy_code}`); break
            case 'cta_call': lines.push(`📞 ${p.display_text}: ${p.phone_number}`); break
            default: break
        }
    }
    return lines.join('\n')
}

// contextInfo pesan tombol: mention, forward dari saluran (newsletter), dan bisnis
function buildButtonContext(o, sock) {
    const ctx = {}
    if (o.mentions?.length) ctx.mentionedJid = o.mentions
    const nl = o.newsletter
    if (nl) {
        ctx.isForwarded = true
        ctx.forwardingScore = nl.score ?? 999
        ctx.forwardedNewsletterMessageInfo = {
            newsletterName: nl.name || global.nameSaluran,
            newsletterJid: nl.jid || global.idSaluran,
            serverMessageId: nl.serverMessageId ?? 143
        }
    }
    if (o.business && sock.user?.id) ctx.businessMessageForwardInfo = { businessOwnerJid: sock.decodeJid(sock.user.id) }
    Object.assign(ctx, o.contextInfo || {})
    return Object.keys(ctx).length ? ctx : undefined
}

// kirim pesan dengan tombol
export async function sendButtons(sock, jid, o = {}, relay = {}) {
    const { generateWAMessageFromContent, proto } = await baileys()
    const { text = '', title = '', subtitle = '', footer = '', image, video, mentions = [], buttons = [] } = o
    if (!buttons.length) throw new Error('Tidak ada tombol')

    const nativeButtons = buttons.slice(0, 10).map(toNativeButton)

    const header = { title, subtitle, hasMediaAttachment: false }
    if (image || video) {
        const media = await uploadMedia(sock, image ? 'image' : 'video', image || video)
        Object.assign(header, media, { hasMediaAttachment: true })
    }

    const IM = proto.Message.InteractiveMessage
    const interactiveMessage = IM.create({
        header: IM.Header.create(header),
        body: IM.Body.create({ text: text || ' ' }),
        footer: IM.Footer.create({ text: footer }),
        nativeFlowMessage: IM.NativeFlowMessage.create({ buttons: nativeButtons, messageParamsJson: '' }),
        contextInfo: buildButtonContext(o, sock)
    })

    const msg = generateWAMessageFromContent(jid, {
        viewOnceMessage: {
            message: {
                messageContextInfo: { deviceListMetadata: {}, deviceListMetadataVersion: 2 },
                interactiveMessage
            }
        }
    }, { quoted: relay.quoted, userJid: sock.user?.id })

    // node biz diperlukan supaya WhatsApp mau merender tombol native flow
    const additionalNodes = [{
        tag: 'biz',
        attrs: {},
        content: [{
            tag: 'interactive',
            attrs: { type: 'native_flow', v: '1' },
            content: [{ tag: 'native_flow', attrs: { v: '9', name: 'mixed' } }]
        }]
    }]
    if (!String(jid).endsWith('@g.us')) additionalNodes.push({ tag: 'bot', attrs: { biz_bot: '1' } })

    await sock.relayMessage(jid, msg.message, { messageId: msg.key.id, additionalNodes })
    return msg
}

// ═══════════════ AIRich ═══════════════
function normalizeTables(data) {
    const list = [...(data.tables || []), ...(data.table ? [data.table] : [])]
    return list.filter(t => t?.headers?.length).map(t => ({
        title: t.title || 'Tabel',
        headers: t.headers.map(String),
        rows: (t.rows || []).map(r => r.map(c => String(c ?? ''))),
        a2ui: t.a2ui ?? data.a2ui ?? true
    }))
}

// kirim pesan rich (teks, tabel, kode) ke WhatsApp
export async function sendRichResponse(sock, jid, data = {}, options = {}) {
    const submessages = []
    const sections = []
    const sources = []

    if (data.text) {
        submessages.push({ messageType: 2, messageText: data.text })
        sections.push({
            view_model: {
                primitive: { text: data.text, __typename: 'GenAIMarkdownTextUXPrimitive' },
                __typename: 'GenAISingleLayoutViewModel'
            }
        })
    }

    for (const t of normalizeTables(data)) {
        submessages.push({
            messageType: 4,
            tableMetadata: {
                title: t.title,
                rows: [{ items: t.headers, isHeading: true }, ...t.rows.map(items => ({ items }))]
            }
        })
        // A2UI: tabel juga dikirim sebagai komponen UI di unified response
        if (t.a2ui) {
            sections.push({
                view_model: {
                    primitive: {
                        title: t.title,
                        rows: [{ is_header: true, cells: t.headers }, ...t.rows.map(cells => ({ is_header: false, cells }))],
                        __typename: 'GenATableUXPrimitive'
                    },
                    __typename: 'GenAISingleLayoutViewModel'
                }
            })
        }
    }

    if (data.code?.code) {
        const language = data.code.language || 'javascript'
        const tokens = tokenizeCode(data.code.code)
        submessages.push({
            messageType: 5,
            codeMetadata: {
                codeLanguage: language,
                codeBlocks: tokens.map(t => ({ codeContent: t.content, highlightType: HIGHLIGHT[t.type] || 0 }))
            }
        })
        sections.push({
            view_model: {
                primitive: { language, code_blocks: tokens, __typename: 'GenAICodeUXPrimitive' },
                __typename: 'GenAISingleLayoutViewModel'
            }
        })
    }

    if (data.reels?.length) {
        // upload paralel per reel (dulu berurutan 3x per item -> lambat)
        const reels = await Promise.all(data.reels.map(async (item) => {
            const [video, thumb, profile] = await Promise.all([
                uploadMedia(sock, 'video', item.videoUrl, { mimetype: 'video/mp4', fileName: `${Date.now()}reel.mp4` }),
                uploadMedia(sock, 'image', item.thumbnailUrl, { mimetype: 'image/jpeg', fileName: `${Date.now()}thumbnail.jpg` }),
                uploadMedia(sock, 'image', item.profileIconUrl, { mimetype: 'image/jpeg', fileName: `${Date.now()}profile.jpg` })
            ])
            return {
                title: item.title || 'Reel',
                description: item.description || 'Video',
                profileIconUrl: profile.imageMessage?.url || item.profileIconUrl,
                thumbnailUrl: thumb.imageMessage?.url || item.thumbnailUrl,
                videoUrl: video.videoMessage?.url || item.videoUrl
            }
        }))

        submessages.push({
            messageType: 9,
            contentItemsMetadata: {
                contentType: 1,
                itemsMetadata: reels.map(r => ({
                    reelItem: { title: r.title, profileIconUrl: r.profileIconUrl, thumbnailUrl: r.thumbnailUrl, videoUrl: r.videoUrl }
                }))
            }
        })
        sections.push({
            view_model: {
                primitives: reels.map(r => ({
                    reels_url: r.videoUrl,
                    thumbnail_url: r.thumbnailUrl,
                    creator: r.title,
                    avatar_url: r.profileIconUrl,
                    reels_title: r.description,
                    likes_count: 0,
                    shares_count: 0,
                    view_count: 0,
                    reel_source: 'IG',
                    is_verified: false,
                    __typename: 'GenAIReelPrimitive'
                })),
                __typename: 'GenAIHScrollLayoutViewModel'
            }
        })
        reels.forEach((r, idx) => sources.push({
            provider: 'UNKNOWN',
            thumbnailCDNURL: r.thumbnailUrl,
            sourceProviderURL: r.videoUrl,
            sourceQuery: '',
            faviconCDNURL: r.profileIconUrl,
            citationNumber: idx + 1,
            sourceTitle: r.title
        }))
    }

    if (!submessages.length) throw new Error('sendRichResponse: tidak ada konten (text/table/code/reels)')

    const content = {
        messageContextInfo: {
            deviceListMetadata: {},
            deviceListMetadataVersion: 2,
            botMetadata: { pluginMetadata: {}, richResponseSourcesMetadata: { sources } }
        },
        botForwardedMessage: {
            message: {
                richResponseMessage: {
                    messageType: 1,
                    submessages,
                    unifiedResponse: { data: JSON.stringify({ response_id: randomUUID(), sections }) },
                    contextInfo: {
                        forwardingScore: 1,
                        isForwarded: true,
                        forwardedAiBotMessageInfo: { botJid: '867051314767696@bot' },
                        forwardOrigin: 4,
                        mentionedJid: data.mentionedJid || []
                    }
                }
            }
        }
    }

    return sock.relayMessage(jid, content, {
        messageId: options.messageId || `ZASSKU_${Date.now()}${randomBytes(2).toString('hex')}`
    })
}

/** Versi teks dari konten rich (fallback kalau WhatsApp menolak rich response). */
export function richToText(data = {}) {
    const parts = []
    if (data.text) parts.push(data.text)

    for (const t of normalizeTables(data)) {
        const all = [t.headers, ...t.rows]
        const widths = t.headers.map((_, i) => Math.max(...all.map(r => String(r[i] ?? '').length)))
        const line = (r) => r.map((c, i) => String(c ?? '').padEnd(widths[i])).join(' | ')
        parts.push([`*${t.title}*`, '```', line(t.headers), widths.map(w => '-'.repeat(w)).join('-+-'), ...t.rows.map(line), '```'].join('\n'))
    }

    if (data.code?.code) parts.push('```' + (data.code.language || '') + '\n' + data.code.code + '\n```')
    return parts.join('\n\n')
}

/** Rich response + tombol, dengan fallback otomatis ke teks biasa. */
export async function sendAIRich(sock, jid, data = {}, options = {}) {
    const quoted = options.quoted
    let result = null
    const hasRich = !!(data.text || data.table || data.tables?.length || data.code?.code || data.reels?.length)

    if (hasRich) {
        try {
            result = await sendRichResponse(sock, jid, data, options)
        } catch (e) {
            console.log(`[ RICH ] gagal kirim rich response (${e.message}), pakai teks biasa`)
            result = await sock.sendMessage(jid, { text: richToText(data) || ' ', mentions: data.mentionedJid }, { quoted })
        }
    }

    if (data.buttons?.length) {
        try {
            await sendButtons(sock, jid, {
                text: data.buttonsText || (hasRich ? 'Pilih aksi:' : data.text || ' '),
                title: data.title,
                footer: data.footer,
                image: data.image,
                video: data.video,
                buttons: data.buttons
            }, { quoted })
        } catch (e) {
            console.log(`[ RICH ] gagal kirim tombol (${e.message}), pakai daftar teks`)
            const fallback = buttonsToText(data.buttons)
            if (fallback) await sock.sendMessage(jid, { text: fallback }, { quoted })
        }
    }

    return result
}

// ═══════════════ HTML -> rich ═══════════════
const ENTITIES = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&nbsp;': ' ' }
// ubah entitas HTML jadi karakter biasa
const decode = (s) => s
    .replace(/&(amp|lt|gt|quot|#39|nbsp);/g, m => ENTITIES[m])
    .replace(/&#(\d+);/g, (_, n) => { try { return String.fromCodePoint(Number(n)) } catch { return '' } })
// buang tag HTML dari teks
const stripTags = (s) => decode(s.replace(/<[^>]+>/g, ''))
// ambil atribut dari tag HTML
const attr = (attrs = '', name) => {
    const m = new RegExp(`${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'i').exec(attrs)
    return m ? decode(m[1] ?? m[2]) : undefined
}

/**
 * Ubah subset HTML ke konten rich.
 * Didukung: h1-h6, p, div, br, b/strong, i/em, s/del, code, pre, ul/ol/li, a, table(+caption),
 * dan tombol: <button data-id>, <button data-url>, <button data-copy>, <button data-call>, <a data-btn href>.
 */
export function htmlToRich(html = '') {
    let src = String(html)
    const out = { text: '', tables: [], code: null, buttons: [] }

    src = src.replace(/<table[^>]*>([\s\S]*?)<\/table>/gi, (_, inner) => {
        const cap = /<caption[^>]*>([\s\S]*?)<\/caption>/i.exec(inner)
        const rows = [...inner.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)]
            .map(r => [...r[1].matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi)].map(c => stripTags(c[1]).trim()))
            .filter(r => r.length)
        if (rows.length) {
            const [headers, ...body] = rows
            out.tables.push({ title: cap ? stripTags(cap[1]).trim() : undefined, headers, rows: body })
        }
        return '\n'
    })

    src = src.replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, (_, inner) => {
        if (!out.code) out.code = { language: /language-(\w+)/i.exec(inner)?.[1] || 'javascript', code: stripTags(inner).replace(/^\n+|\n+$/g, '') }
        return '\n'
    })

    const addButton = (attrs, label) => {
        label = stripTags(label).trim() || 'Buka'
        if (attr(attrs, 'data-url')) out.buttons.push({ type: 'url', text: label, url: attr(attrs, 'data-url') })
        else if (attr(attrs, 'data-copy')) out.buttons.push({ type: 'copy', text: label, code: attr(attrs, 'data-copy') })
        else if (attr(attrs, 'data-call')) out.buttons.push({ type: 'call', text: label, phone: attr(attrs, 'data-call') })
        else if (attr(attrs, 'href')) out.buttons.push({ type: 'url', text: label, url: attr(attrs, 'href') })
        else out.buttons.push({ type: 'reply', text: label, id: attr(attrs, 'data-id') || label })
    }

    src = src.replace(/<button([^>]*)>([\s\S]*?)<\/button>/gi, (_, a, label) => { addButton(a, label); return '' })
    src = src.replace(/<a([^>]*\sdata-btn[^>]*)>([\s\S]*?)<\/a>/gi, (_, a, label) => { addButton(a, label); return '' })

    src = src
        .replace(/<a[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_, url, label) => {
            const l = stripTags(label).trim()
            return l && l !== url ? `${l} (${url})` : url
        })
        .replace(/<(b|strong)[^>]*>([\s\S]*?)<\/\1>/gi, '*$2*')
        .replace(/<(i|em)[^>]*>([\s\S]*?)<\/\1>/gi, '_$2_')
        .replace(/<(s|del|strike)[^>]*>([\s\S]*?)<\/\1>/gi, '~$2~')
        .replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, '`$1`')
        .replace(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/gi, '\n\n*$1*\n')
        .replace(/<li[^>]*>/gi, '\n• ')
        .replace(/<\/(ul|ol)>/gi, '\n')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/(p|div)>/gi, '\n\n')

    out.text = stripTags(src).replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
    return out
}

// ═══════════════ FOMO ═══════════════
const rupiah = (n) => `Rp${Number(n).toLocaleString('id-ID')}`

// format sisa waktu
export function formatRemaining(ms) {
    if (ms <= 0) return 'sudah berakhir'
    const s = Math.floor(ms / 1000)
    const d = Math.floor(s / 86400)
    const h = Math.floor((s % 86400) / 3600)
    const m = Math.floor((s % 3600) / 60)
    const sec = s % 60
    if (d) return `${d} hari ${h} jam ${m} menit`
    if (h) return `${h} jam ${m} menit`
    return `${m} menit ${sec} detik`
}

// susun teks promosi/FOMO
export function buildFomo(o = {}) {
    const lines = [`🔥 *${o.title || 'PENAWARAN TERBATAS'}*`]

    const endsAt = o.endsAt || (o.minutes ? Date.now() + o.minutes * 60_000 : null)
    if (endsAt) lines.push(`⏳ Berakhir dalam *${formatRemaining(endsAt - Date.now())}*`)

    if (o.total && o.stock != null) {
        const sold = Math.max(0, Math.min(1, (o.total - o.stock) / o.total))
        const filled = Math.round(sold * 10)
        lines.push(`📦 Sisa *${o.stock}* dari ${o.total}  ${'▰'.repeat(filled)}${'▱'.repeat(10 - filled)} ${Math.round(sold * 100)}% terjual`)
    } else if (o.stock != null) {
        lines.push(`📦 Sisa stok: *${o.stock}*`)
    }

    if (o.price != null) {
        const price = rupiah(o.price)
        if (o.oldPrice && o.oldPrice > o.price) {
            const off = Math.round((1 - o.price / o.oldPrice) * 100)
            lines.push(`💸 ~${rupiah(o.oldPrice)}~ ➜ *${price}* (hemat ${off}%)`)
        } else {
            lines.push(`💸 *${price}*`)
        }
    }

    const rich = o.html ? htmlToRich(o.html) : { text: '', tables: [], code: null, buttons: [] }
    const text = [lines.join('\n'), o.text, rich.text].filter(Boolean).join('\n\n')

    return {
        text,
        tables: [...(o.tables || []), ...(o.table ? [o.table] : []), ...rich.tables],
        code: o.code || rich.code || undefined,
        buttons: [...(o.buttons || []), ...rich.buttons],
        buttonsText: o.buttonsText || 'Amankan sebelum kehabisan 👇',
        footer: o.footer,
        title: undefined,
        image: o.image,
        mentionedJid: o.mentionedJid
    }
}

// kirim promosi ke chat
export const sendFomo = (sock, jid, o = {}, options = {}) => sendAIRich(sock, jid, buildFomo(o), options)

// ═══════════════ pasang ke sock ═══════════════
function installRich(sock) {
    sock.sendRichResponse = (jid, data, options) => sendRichResponse(sock, jid, data, options)
    sock.sendAIRich = (jid, data, options) => sendAIRich(sock, jid, data, options)
    sock.sendTable = (jid, table, options = {}) => sendAIRich(sock, jid, { text: options.text, table, buttons: options.buttons, footer: options.footer }, options)
    sock.sendButtons = (jid, o, options) => sendButtons(sock, jid, o, options)
    // gaya lama: sendButtonImage(jid, image, buttons, text, footer, mentions, quoted)
    sock.sendButtonImage = (jid, image, buttons = [], text = '', footer = '', mentions = [], quoted) =>
        sendButtons(sock, jid, { image, buttons, text, footer, mentions }, { quoted })
    sock.sendFomo = (jid, o, options) => sendFomo(sock, jid, o, options)
    return sock
}

// ───────── socket ─────────
export function attachHelpers(sock) {
    try {
        luna.addProperty(sock, baileysLib)
    } catch (e) {
        console.log(chalk.yellow('[ WARNING ] luna-lib gagal di-inject, fitur previewThumbnail mungkin tidak bekerja optimal.'))
    }

    sock.decodeJid = (jid) => {
        if (!jid) return jid
        if (/:\d+@/.test(jid)) {
            let decoded = jidDecode(jid) || {}
            return (decoded.user && decoded.server && `${decoded.user}@${decoded.server}`) || jid
        }
        return jid
    }
    
    installRich(sock) // sendRichResponse, sendAIRich, sendTable, sendButtons, sendFomo

    return sock
}

// cache retry counter untuk pesan yang gagal didekripsi (kurangi beban & delay)
const msgRetryCounterCache = new TTLCache({ max: 2000, ttl: 10 * 60_000 })
registerCleaner('msgRetryCounterCache', (level) => level === 'hard' ? msgRetryCounterCache.flushAll() : msgRetryCounterCache.prune())

// buat socket WhatsApp (Baileys) lengkap dengan cache & pengaturan koneksi
export async function createSocket(state) {
    // versi WA Web terbaru; kalau gagal diambil, pakai versi bawaan Baileys (jangan crash)
    let version
    try { ({ version } = await fetchLatestBaileysVersion()) } catch {}
    const silent = pino({ level: 'silent' })

    const sock = makeWASocket({
        ...(version ? { version } : {}),
        logger: silent,
        printQRInTerminal: false,
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, silent)
        },
        // identitas browser standar bawaan Baileys (string versi karangan seperti '20.0.04' tidak lazim)
        browser: baileysLib.Browsers?.ubuntu?.('Chrome') || ['Ubuntu', 'Chrome', '22.04.4'],
        // self bot: jangan tandai akun "online" terus, supaya notifikasi HP tetap masuk
        markOnlineOnConnect: false,

        // ── stabilitas: ping rutin supaya koneksi mati terdeteksi cepat dan tersambung ulang ──
        keepAliveIntervalMs: 25_000,
        connectTimeoutMs: 60_000,
        defaultQueryTimeoutMs: 60_000,
        retryRequestDelayMs: 500,
        maxMsgRetryCount: 2,
        msgRetryCounterCache,

        // ── RAM & kecepatan: tidak perlu sinkron riwayat chat lama / preview link berat ──
        syncFullHistory: false,
        shouldSyncHistoryMessage: () => false,
        generateHighQualityLinkPreview: false,
        emitOwnEvents: true,

        // metadata grup dari cache lokal -> kirim pesan ke grup tidak menunggu query ke server
        cachedGroupMetadata: async (jid) => groupMetaFromCache(jid),
        // dibutuhkan WhatsApp untuk mengirim ulang pesan yang gagal dekripsi di sisi penerima
        getMessage: async (key) => recallMessage(key?.id)
    })

    attachHelpers(sock)

    return sock
}

// ───────── group welcome / goodbye ─────────
export const GROUP_DEFAULT_TEXT = {
    welcome: 'Halo @user 👋\nSelamat datang di *@group*!\nSemoga betah ya, kamu member ke-@count.',
    goodbye: 'Selamat tinggal @user 👋\nTerima kasih sudah pernah jadi bagian dari *@group*.'
}

// ambil pengaturan grup dari database
export function getGroupSetting(groupJid) {
    const saved = global.db.groups?.[groupJid] || {}
    return {
        welcome: { on: !!saved.welcome?.on, text: saved.welcome?.text || GROUP_DEFAULT_TEXT.welcome, custom: !!saved.welcome?.text },
        goodbye: { on: !!saved.goodbye?.on, text: saved.goodbye?.text || GROUP_DEFAULT_TEXT.goodbye, custom: !!saved.goodbye?.text }
    }
}

// ubah pengaturan grup
export function updateGroupSetting(groupJid, type, patch) {
    const groups = global.db.groups || (global.db.groups = {})
    groups[groupJid] = groups[groupJid] || {}
    const next = { ...(groups[groupJid][type] || {}), ...patch }
    for (const key of Object.keys(next)) if (next[key] === undefined) delete next[key]
    groups[groupJid][type] = next
    saveDB(global.db)
}

// isi variabel teks welcome/leave
export function formatGroupText(template, { user, group, count, desc }) {
    return String(template)
        .replace(/@user/gi, user)
        .replace(/@group/gi, group)
        .replace(/@count/gi, String(count))
        .replace(/@desc/gi, desc || '-')
}

// cek apakah user admin grup
export async function isGroupAdmin(sock, groupJid, ...senders) {
    try {
        const meta = await sock.groupMetadata(groupJid)
        const ids = senders.filter(Boolean).map(id => sock.decodeJid(id))
        return (meta.participants || []).some(p => {
            if (!p.admin) return false
            return [p.id, p.lid, p.phoneNumber, p.jid].filter(Boolean).some(id => ids.includes(sock.decodeJid(id)))
        })
    } catch {
        return false
    }
}

// tangani member masuk/keluar/promote/demote grup
export async function onGroupParticipants(sock, update) {
    try {
        const { id: groupJid, participants = [], action } = update || {}
        if (!groupJid || !groupJid.endsWith('@g.us')) return
        if (action !== 'add' && action !== 'remove') return
        if (!global.db?.groups?.[groupJid]) return

        const type = action === 'add' ? 'welcome' : 'goodbye'
        const setting = getGroupSetting(groupJid)[type]
        if (!setting.on) return

        let meta = null
        try { meta = await sock.groupMetadata(groupJid) } catch {}

        const botIds = [sock.user?.id, sock.user?.lid].filter(Boolean).map(id => sock.decodeJid(id))

        for (const p of participants) {
            const jid = typeof p === 'string' ? p : (p.id || p.phoneNumber)
            if (!jid || botIds.includes(sock.decodeJid(jid))) continue

            const text = formatGroupText(setting.text, {
                user: `@${jid.split('@')[0]}`,
                group: meta?.subject || 'grup ini',
                count: meta?.participants?.length || '-',
                desc: meta?.desc
            })

            let sent = false
            try {
                const url = await sock.profilePictureUrl(jid, 'image')
                if (url) {
                    await sock.sendMessage(groupJid, { image: { url }, caption: text, mentions: [jid] })
                    sent = true
                }
            } catch {}

            if (!sent) await sock.sendMessage(groupJid, { text, mentions: [jid] })
            await sleep(700)
        }
    } catch (e) {
        console.log(chalk.red(`[ ERROR ] Gagal kirim welcome/goodbye: ${e.message}`))
    }
}

// ╔══════════════ [ group.js ] ══════════════╗

// ───────── helper grup ─────────
// Cache metadata, pencarian member, pelacak aktivitas, dan penjaga (antilink, antitoxic,
// antispam, antidelete, autoreply). Semua pengecekan penjaga berhenti di baris pertama
// kalau grup tidak punya fitur aktif, jadi grup biasa tidak membebani bot.


// ambil JID user dari data peserta
const userOf = (jid) => String(jid || '').split('@')[0].split(':')[0]
// kumpulkan semua ID (jid/lid) milik user
const idsOf = (p) => [p.id, p.lid, p.phoneNumber, p.jid].filter(Boolean).map(userOf)

// ───────── metadata cache (60 detik) ─────────
const META_TTL = 60 * 1000
// cache metadata grup
const metaCache = new Map()

// ambil metadata grup (pakai cache)
export async function getMeta(sock, jid, fresh = false) {
    const hit = metaCache.get(jid)
    if (!fresh && hit && Date.now() - hit.at < META_TTL) return hit.meta
    const meta = await sock.groupMetadata(jid)
    metaCache.set(jid, { meta, at: Date.now() })
    if (metaCache.size > 200) metaCache.delete(metaCache.keys().next().value)
    return meta
}

// hapus cache metadata grup
export const invalidateMeta = (jid) => metaCache.delete(jid)

// dipakai Baileys (cachedGroupMetadata); kedaluwarsa tetap dihormati
function groupMetaFromCache(jid) {
    const hit = metaCache.get(jid)
    return hit && Date.now() - hit.at < META_TTL ? hit.meta : undefined
}

registerCleaner('metaCache', (level) => {
    if (level === 'hard') return metaCache.clear()
    const now = Date.now()
    for (const [k, v] of metaCache) if (now - v.at > META_TTL) metaCache.delete(k)
})

// ───────── member ─────────
export const memberId = userOf

// cari member di metadata grup
export function findMember(meta, jid) {
    const u = userOf(jid)
    if (!u) return null
    return (meta?.participants || []).find(p => idsOf(p).includes(u)) || null
}

// cek admin berdasarkan JID
export const isAdminJid = (meta, ...jids) => jids.filter(Boolean).some(j => !!findMember(meta, j)?.admin)

// ambil data bot di grup
export const botMember = (sock, meta) => findMember(meta, sock.user?.id) || findMember(meta, sock.user?.lid)
// cek apakah bot admin
export const botIsAdmin = (sock, meta) => !!botMember(sock, meta)?.admin

// target dari mention, reply, atau nomor yang diketik -> daftar member grup
export function resolveTargets(m, text, meta) {
    const raw = [
        ...(m.mentionedJid || []),
        m.quoted?.sender,
        ...(String(text || '').match(/\d{8,15}/g) || []).map(n => `${n}@s.whatsapp.net`)
    ]
    const found = new Map()
    for (const jid of raw) {
        const p = findMember(meta, jid)
        if (p) found.set(p.id, p)
    }
    return [...found.values()]
}

// pesan error WhatsApp yang paling sering muncul -> kalimat yang jelas
export function waError(e) {
    const msg = String(e?.message || e)
    if (/not-authorized|forbidden|403/i.test(msg) || e?.data === 403) return 'Akunmu bukan admin di grup ini.'
    if (/not-acceptable|406/i.test(msg)) return 'Permintaan ditolak WhatsApp.'
    return msg
}

// ───────── pelacak aktivitas (untuk .inactive) ─────────
fs.mkdirSync('./database', { recursive: true })
// file penyimpanan aktivitas chat
const ACT_FILE = './database/activity.json'

// data aktivitas pesan per grup
let activity = { since: Date.now(), countSince: Date.now(), groups: {}, counts: {} }
try { activity = { ...activity, ...JSON.parse(fs.readFileSync(ACT_FILE, 'utf8')) } } catch {}

let saveTimer = null
// simpan aktivitas dengan jeda (hemat tulis disk)
function scheduleSave() {
    if (saveTimer) return
    saveTimer = setTimeout(() => {
        saveTimer = null
        fs.writeFile(ACT_FILE, JSON.stringify(activity), () => {})
    }, 60 * 1000)
    saveTimer.unref?.()
}

// hitung pesan masuk per user
function trackActivity(m) {
    if (!m.sender || m.mtype === 'reactionMessage') return
    const user = userOf(m.sender)
    const group = (activity.groups[m.chat] ||= {})
    group[user] = Date.now()

    // total pesan per orang per grup (untuk .totalpesan)
    const count = (activity.counts[m.chat] ||= {})
    count[user] = (count[user] || 0) + 1
    scheduleSave()
}

// ambil data aktivitas
export const getActivity = (jid) => ({ since: activity.since, seen: activity.groups[jid] || {} })

// Jumlah pesan per orang di satu grup sejak `since` (ms). Kunci = id pengirim (nomor / LID).
export const getMessageCounts = (jid) => ({ since: activity.countSince, counts: activity.counts[jid] || {} })

// reset hitungan pesan
export function resetMessageCounts(jid) {
    delete activity.counts[jid]
    scheduleSave()
}

// ───────── penjaga ─────────
const LINK_WA = /(chat\.whatsapp\.com\/[\w-]{10,}|whatsapp\.com\/channel\/[\w-]+)/i
// pola semua link
const LINK_ANY = /(https?:\/\/|www\.)\S+/i

// daftar kata kasar bawaan antitoxic
export const DEFAULT_TOXIC = ['anjing', 'bangsat', 'bajingan', 'kontol', 'memek', 'ngentot', 'jancok', 'tolol', 'goblok', 'babi', 'brengsek', 'kampret']

// catatan pesan untuk deteksi spam
const spam = new Map()
// catatan user yang sudah diperingatkan
const warned = new Map()
// catatan autoreply agar tidak berulang
const replied = new Map()
// cache pesan terhapus (antidelete)
const deleted = new Map() // id pesan -> pesan (antidelete & antiedit)
// cache pesan diedit (antiedit)
const edits = new Map()   // id pesan -> teks terbaru setelah diedit (antiedit)

// deteksi spam/flood
function floodCheck(chat, sender) {
    const key = chat + sender
    const now = Date.now()
    const list = (spam.get(key) || []).filter(t => now - t < 6000)
    list.push(now)
    spam.set(key, list)
    if (spam.size > 500) for (const [k, v] of spam) if (now - v[v.length - 1] > 6000) spam.delete(k)
    return list.length > 5
}

// amankan teks untuk regex
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// ids (nomor + LID) pengirim, diambil dari metadata grup supaya cocok dengan data warn / mute
function idsOfSender(m, meta) {
    const jids = [m.sender, m.key.participant, m.key.participantAlt, m.key.participantPn].filter(Boolean)
    for (const j of jids) {
        const p = findMember(meta, j)
        if (p) return idsOf(p)
    }
    return [...new Set(jids.map(userOf))]
}

/** Laporan ke admin grup (di grup, dengan tag) saat member mencapai batas warn: siapa, hasilnya, dan riwayat alasan. */
export async function notifyWarnKick(sock, chat, meta, memberJid, entry, kicked) {
    const admins = (meta?.participants || []).filter(p => p.admin && p.id !== botMember(sock, meta)?.id).map(p => p.id)
    const reasons = entry?.reasons?.length ? entry.reasons.map((r, i) => `${i + 1}. ${r}`).join('\n') : '-'
    const text = [
        '🚨 *Laporan batas peringatan*',
        `@${userOf(memberJid)} mencapai batas peringatan (${entry?.count ?? '?'}/${warnLimit(chat)}) dan ${kicked ? 'sudah dikeluarkan' : '*gagal dikeluarkan*, mohon tindak lanjut manual'}.`,
        '',
        'Riwayat alasan:',
        reasons,
        ...(admins.length ? ['', `Admin: ${admins.map(j => '@' + userOf(j)).join(' ')}`] : [])
    ].join('\n')
    await sock.sendMessage(chat, { text, mentions: [memberJid, ...admins] }).catch(() => null)
}

// kick = keluarkan langsung. warn = pakai sistem peringatan (.warn): pesan dihapus, pelanggar
// dapat 1 warn, dan baru dikeluarkan saat mencapai batas. warn menggantikan kick.
async function punish(sock, m, meta, reason, kick = false, warn = false) {
    if (!botIsAdmin(sock, meta)) return
    await sock.sendMessage(m.chat, { delete: m.key }).catch(() => null)

    const key = m.chat + m.sender
    if (Date.now() - (warned.get(key) || 0) < 15000) return // peringatan tidak diulang beruntun
    warned.set(key, Date.now())
    if (warned.size > 500) warned.delete(warned.keys().next().value)

    if (warn) {
        const ids = idsOfSender(m, meta)
        const { count, limit } = addWarn(m.chat, ids, reason, m.sender)
        const text = `⚠️ @${userOf(m.sender)} ${reason}\nPeringatan *${count}/${limit}*`
        if (count < limit) return sock.sendMessage(m.chat, { text, mentions: [m.sender] }).catch(() => null)

        await sock.sendMessage(m.chat, { text: `${text}\nBatas peringatan tercapai, kamu dikeluarkan.`, mentions: [m.sender] }).catch(() => null)
        const entry = getWarn(m.chat, ids) // ambil riwayat sebelum direset
        const out = await sock.groupParticipantsUpdate(m.chat, [m.sender], 'remove').then(() => true).catch(() => false)
        if (out) resetWarn(m.chat, ids)
        await notifyWarnKick(sock, m.chat, meta, m.sender, entry, out)
        return
    }

    await sock.sendMessage(m.chat, { text: `⚠️ @${userOf(m.sender)} ${reason}${kick ? '\nKamu akan dikeluarkan.' : ''}`, mentions: [m.sender] }).catch(() => null)
    if (kick) await sock.groupParticipantsUpdate(m.chat, [m.sender], 'remove').catch(() => null)
}

// ───────── helper deteksi pesan ─────────
// Satu pesan bisa terbungkus beberapa lapis (ephemeral, viewOnce, dst). Fungsi ini
// mengembalikan semua lapisnya supaya deteksi tidak terlewat.
function layersOf(message) {
    const out = []
    let cur = message
    for (let depth = 0; cur && depth < 6; depth++) {
        out.push(cur)
        const key = WRAPPER_TYPES.find(k => cur[k]?.message)
        cur = key ? cur[key].message : null
    }
    return out
}

// nama kunci pesan sekali lihat
const VIEWONCE_KEYS = ['viewOnceMessage', 'viewOnceMessageV2', 'viewOnceMessageV2Extension']
// cek pesan sekali lihat
const isViewOnce = (m, layers) => !!m.msg?.viewOnce || layers.some(l => VIEWONCE_KEYS.some(k => l[k]))
// cek pesan status grup
const isGroupStatus = (layers) => layers.some(l => l.groupStatusMessage || l.groupStatusMessageV2)
// cek pesan yang menandai lewat status
const isTagStatus = (layers) => layers.some(l =>
    l.groupStatusMentionMessage || l.statusMentionMessage ||
    (l.protocolMessage && [25, 'STATUS_MENTION_MESSAGE'].includes(l.protocolMessage.type))
)

// ───────── cache media untuk antidelete ─────────
// Media WhatsApp bisa hilang dari server begitu pesannya dihapus, jadi file diunduh
// SAAT pesan masuk (bukan saat dihapus). Dibatasi supaya RAM panel kecil tetap aman.
const MEDIA_MAX_FILE = 12 * 1024 * 1024   // maks 12MB per file
// batas total cache media
const MEDIA_MAX_TOTAL = 48 * 1024 * 1024  // maks 48MB seluruh cache
// cache media untuk antidelete
const mediaCache = new Map()              // id pesan -> Promise<Buffer | null>
// hitung ukuran media
const mediaSize = new Map()               // id pesan -> ukuran byte (setelah selesai diunduh)
// total ukuran cache media
let mediaTotal = 0

// hapus media dari cache
function dropMedia(id) {
    mediaCache.delete(id)
    mediaTotal -= mediaSize.get(id) || 0
    mediaSize.delete(id)
}

// simpan media ke cache
function cacheMedia(m) {
    if (!m.isMedia || typeof m.download !== 'function' || mediaCache.has(m.id)) return
    const len = Number(m.msg?.fileLength?.toString?.() ?? m.msg?.fileLength ?? 0)
    if (len > MEDIA_MAX_FILE) return

    const id = m.id
    mediaCache.set(id, (async () => {
        try {
            const buf = await m.download()
            if (!buf || buf.length > MEDIA_MAX_FILE) { dropMedia(id); return null }
            mediaSize.set(id, buf.length)
            mediaTotal += buf.length
            // buang yang paling lama kalau cache penuh
            while (mediaTotal > MEDIA_MAX_TOTAL && mediaCache.size > 1) dropMedia(mediaCache.keys().next().value)
            return buf
        } catch {
            dropMedia(id)
            return null
        }
    })())
}

// Kirim ulang satu media. `note` = teks keterangan. Audio & sticker tidak punya caption,
// jadi keterangan dikirim sebagai teks terpisah sebelumnya.
async function sendMedia(sock, chat, m, buf, note, mentions) {
    const msg = m.msg || {}
    const caption = [note, m.body].filter(Boolean).join('\n\n')

    switch (m.mtype) {
        case 'imageMessage':
            return sock.sendMessage(chat, { image: buf, caption, mentions })
        case 'videoMessage':
            return sock.sendMessage(chat, { video: buf, caption, mentions, gifPlayback: !!msg.gifPlayback, mimetype: msg.mimetype })
        case 'audioMessage':
            await sock.sendMessage(chat, { text: note, mentions })
            return sock.sendMessage(chat, { audio: buf, mimetype: msg.mimetype || 'audio/ogg; codecs=opus', ptt: !!msg.ptt })
        case 'stickerMessage':
            await sock.sendMessage(chat, { text: note, mentions })
            return sock.sendMessage(chat, { sticker: buf })
        case 'documentMessage':
            return sock.sendMessage(chat, { document: buf, mimetype: msg.mimetype, fileName: msg.fileName || 'file', caption, mentions })
        default:
            return false
    }
}

// tangani pesan yang ditarik (antidelete)
async function onRevoke(sock, m, g) {
    const target = m.message.protocolMessage
    const id = target?.key?.id
    const original = deleted.get(id)
    if (!original || m.fromMe || original.fromMe) return

    const author = original.key.participant || original.sender
    const mentions = [author, m.sender].filter(Boolean)
    const by = m.sender && m.sender !== author ? `\n_dihapus oleh @${userOf(m.sender)}_` : ''
    const note = `🛡️ *ANTIDELETE*\n@${userOf(author)} menghapus pesan${by}`
    const text = edits.get(id) ?? (original.message?.conversation || original.message?.extendedTextMessage?.text)

    if (text) {
        return sock.sendMessage(m.chat, { text: `${note}\n\n${text}`, mentions })
    }

    // media (foto, video, audio, vn, sticker, dokumen): pakai file yang sudah disimpan
    if (original.isMedia) {
        const buf = await mediaCache.get(id)?.catch(() => null)
        if (buf) {
            const sent = await sendMedia(sock, m.chat, original, buf, note, mentions).catch(() => false)
            if (sent !== false) return
        }
    }

    // jenis lain (kontak, lokasi, poll, dst) atau media gagal disimpan: teruskan aslinya
    await sock.sendMessage(m.chat, { text: note, mentions })
    await sock.sendMessage(m.chat, { forward: original }).catch(() => null)
}

// teks dari satu pesan (termasuk caption media), menembus pembungkus ephemeral / viewOnce
function textOfMessage(message) {
    for (const l of layersOf(message)) {
        const t = l.conversation || l.extendedTextMessage?.text || l.imageMessage?.caption || l.videoMessage?.caption || l.documentMessage?.caption
        if (t) return t
    }
    return ''
}

// Antiedit: pesan yang diedit dikirim ulang dengan teks sebelum dan sesudahnya.
async function onEdit(sock, m) {
    const pm = m.message.protocolMessage
    const id = pm?.key?.id
    if (!id || !pm.editedMessage) return

    const original = deleted.get(id)
    if (m.fromMe || original?.fromMe) return

    const after = textOfMessage(pm.editedMessage)
    if (!after) return

    const before = edits.get(id) ?? original?.body ?? ''
    if (before === after) return // edit yang tidak mengubah teks (mis. preview link)

    edits.set(id, after)
    if (edits.size > 300) edits.delete(edits.keys().next().value)

    const cut = (t) => (t.length > 700 ? `${t.slice(0, 700)}…` : t)
    const lines = [`✏️ *ANTIEDIT*`, `@${userOf(m.sender)} mengedit pesan`]
    lines.push('', before ? `*Sebelum:*\n${cut(before)}` : '_Pesan asli tidak tersimpan (dikirim sebelum bot aktif)._', '', `*Sesudah:*\n${cut(after)}`)
    await sock.sendMessage(m.chat, { text: lines.join('\n'), mentions: [m.sender] })
}

// Anti sekali lihat: media view once dikirim ulang sebagai media biasa.
async function revealViewOnce(sock, m, g) {
    if (!m.isMedia || !['imageMessage', 'videoMessage', 'audioMessage'].includes(m.mtype)) return false

    const buf = await m.download().catch(() => null)
    if (!buf) return false

    const kind = { imageMessage: 'foto', videoMessage: 'video', audioMessage: 'audio / VN' }[m.mtype]
    const note = `👁️ *ANTI SEKALI LIHAT*\n@${userOf(m.sender)} mengirim ${kind} sekali lihat`
    const sent = await sendMedia(sock, m.chat, m, buf, note, [m.sender]).catch(() => false)
    return sent !== false
}

// penjaga grup: antilink, antitoxic, antispam, autoreply, dll
export async function groupGuard(sock, m, { isOwner = false } = {}) {
    try {
        const layers = layersOf(m.message)
        const tagSw = isTagStatus(layers)

        if (m.mtype === 'protocolMessage' && !tagSw) {
            const g = global.db?.groups?.[m.chat]
            const type = m.message?.protocolMessage?.type
            if (g?.antidelete?.on && type === 0) await onRevoke(sock, m, g)
            else if (g?.antiedit?.on && (type === 14 || type === 'MESSAGE_EDIT')) await onEdit(sock, m)
            return
        }

        if (m.mtype !== 'protocolMessage') trackActivity(m)

        const g = global.db?.groups?.[m.chat]
        if (!g) return

        if (g.antidelete?.on || g.antiedit?.on) {
            deleted.set(m.id, m)
            if (deleted.size > 300) {
                const oldest = deleted.keys().next().value
                deleted.delete(oldest)
                edits.delete(oldest)
                dropMedia(oldest)
            }
            if (g.antidelete?.on && !m.fromMe) cacheMedia(m)
        }

        if (m.fromMe || m.isBaileys || isOwner) return
        if (!(g.antilink?.on || g.antitoxic?.on || g.antispam?.on || g.autoreply?.on ||
            g.antisticker?.on || g.antiswgc?.on || g.antitagsw?.on || g.antiviewonce?.on || hasMutes(g))) return

        const body = m.body || ''
        let meta = null
        const exempt = async () => {
            meta ||= await getMeta(sock, m.chat)
            return isAdminJid(meta, m.sender, m.key.participant, m.key.participantAlt, m.key.participantPn)
        }

        // mute: semua pesan member yang di-mute dihapus diam-diam (butuh bot admin)
        if (hasMutes(g)) {
            meta ||= await getMeta(sock, m.chat)
            if (isMutedIds(g.muted, idsOfSender(m, meta))) {
                if (botIsAdmin(sock, meta)) await sock.sendMessage(m.chat, { delete: m.key }).catch(() => null)
                return
            }
        }

        // antitagsw: tag grup di status WhatsApp
        if (g.antitagsw?.on && tagSw && !(await exempt())) {
            return punish(sock, m, meta, 'dilarang menandai grup ini di status.', !!g.antitagsw.kick, !!g.antitagsw.warn)
        }

        // antiswgc: status grup
        if (g.antiswgc?.on && isGroupStatus(layers) && !(await exempt())) {
            return punish(sock, m, meta, 'dilarang mengirim status grup di sini.', !!g.antiswgc.kick, !!g.antiswgc.warn)
        }

        // antisticker
        if (g.antisticker?.on && m.mtype === 'stickerMessage' && !(await exempt())) {
            return punish(sock, m, meta, 'dilarang mengirim sticker di grup ini.', !!g.antisticker.kick, !!g.antisticker.warn)
        }

        // antiviewonce: foto / video / audio sekali lihat
        if (g.antiviewonce?.on && isViewOnce(m, layers)) {
            const ok = await revealViewOnce(sock, m, g)
            if (ok && g.antiviewonce.del) {
                meta ||= await getMeta(sock, m.chat)
                if (botIsAdmin(sock, meta)) await sock.sendMessage(m.chat, { delete: m.key }).catch(() => null)
            }
            return
        }

        // antilink
        if (g.antilink?.on && body && (g.antilink.all ? LINK_ANY : LINK_WA).test(body) && !(await exempt())) {
            return punish(sock, m, meta, 'dilarang mengirim link di grup ini.', !!g.antilink.kick, !!g.antilink.warn)
        }

        // antitoxic
        if (g.antitoxic?.on && body) {
            const words = new Set(g.antitoxic.words || DEFAULT_TOXIC)
            const tokens = body.toLowerCase().match(/[a-z0-9]+/g) || []
            if (tokens.some(t => words.has(t)) && !(await exempt())) {
                return punish(sock, m, meta, 'jaga bahasa ya, kata kasar dilarang di grup ini.', false, !!g.antitoxic.warn)
            }
        }

        // antispam
        if (g.antispam?.on && floodCheck(m.chat, m.sender) && !(await exempt())) {
            return punish(sock, m, meta, 'jangan spam di grup ini.', false, !!g.antispam.warn)
        }

        // autoreply
        if (g.autoreply?.on && body) {
            const lower = body.toLowerCase()
            for (const [trigger, answer] of Object.entries(g.autoreply.rules || {})) {
                const hit = new RegExp(`(^|\\s)${escapeRegex(trigger)}(\\s|$|[?!.,])`, 'i').test(lower)
                if (!hit) continue
                const key = m.chat + trigger
                if (Date.now() - (replied.get(key) || 0) < 10000) break
                replied.set(key, Date.now())
                await sock.sendMessage(m.chat, { text: answer }, { quoted: m })
                break
            }
        }
    } catch (e) {
        console.error('[GROUP GUARD]', e.message)
    }
}

// ╔══════════════ [ jadibot.js ] ══════════════╗

// ───────── pengaturan ─────────
const SESSION_ROOT = './session/jadibot'
// jeda sambung ulang jadibot
const RECONNECT_DELAY = 3000
// batas percobaan sambung ulang jadibot
const MAX_RETRY = 5
// batas waktu menunggu pairing jadibot
const PAIRING_TIMEOUT = 90000

const red = (t) => chalk.red(t)
const green = (t) => chalk.greenBright(t)
const blue = (t) => chalk.cyanBright(t)

// nomor -> { sock, number, startedAt, requester }
export const clones = new Map()

// rapikan JID
function decodeJid(jid) {
    if (!jid) return jid

    if (/:\d+@/.test(jid)) {
        const decoded = jidDecode(jid) || {}
        return (
            (decoded.user &&
                decoded.server &&
                `${decoded.user}@${decoded.server}`) ||
            jid
        )
    }

    return jid
}

// folder sesi per nomor jadibot
function sessionDir(number) {
    return path.join(SESSION_ROOT, number)
}

// hapus sesi jadibot
function removeSession(number) {
    try {
        fs.rmSync(sessionDir(number), {
            recursive: true,
            force: true
        })
    } catch {}
}

// cek apakah sesi sudah terdaftar
function isRegistered(number) {
    try {
        const creds = JSON.parse(
            fs.readFileSync(
                path.join(sessionDir(number), 'creds.json'),
                'utf8'
            )
        )

        return !!creds?.registered
    } catch {
        return false
    }
}

// ───────── start ─────────
/**
 * @param {string} number   nomor WhatsApp tujuan clone (628xxxx, tanpa @s.whatsapp.net)
 * @param {object} notify   { jid, sock } tempat kode pairing & status dikirim
 * @param {string} requester jid yang meminta (buat listjadibot)
 */
export async function startJadibot(number, notify, requester) {
    if (clones.has(number)) {
        throw new Error('Nomor ini sudah punya sesi jadibot yang aktif.')
    }

    const dir = sessionDir(number)

    fs.mkdirSync(dir, {
        recursive: true
    })

    const { state, saveCreds } = await useMultiFileAuthState(dir)
    const alreadyPaired = isRegistered(number)

    let retry = 0
    let pairingHandled = alreadyPaired
    let stopped = false

    const entry = {
        sock: null,
        number,
        startedAt: Date.now(),
        requester,
        stop: () => {
            stopped = true
        }
    }

    clones.set(number, entry)

    async function connect() {
        if (stopped) return

        const { version } = await fetchLatestBaileysVersion()

        const sock = makeWASocket({
            version,
            logger: pino({
                level: 'silent'
            }),
            printQRInTerminal: false,
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(
                    state.keys,
                    pino({
                        level: 'silent'
                    })
                )
            },
            // identitas browser standar bawaan Baileys (string versi karangan seperti '20.0.04' tidak lazim)
        browser: baileysLib.Browsers?.ubuntu?.('Chrome') || ['Ubuntu', 'Chrome', '22.04.4'],
            markOnlineOnConnect: false
        })

        // Pasang helper ke socket
        attachHelpers(sock)

        entry.sock = sock

        // tandai pesan yang dikirim clone supaya tidak diproses ulang sebagai command
        const botSentIds = global.botSentIds ||= new Set()
        const rawSend = sock.sendMessage.bind(sock)

        sock.sendMessage = async (...args) => {
            cuteContent(args[1])
            const sent = await rawSend(...args)

            if (sent?.key?.id) {
                botSentIds.add(sent.key.id)

                if (botSentIds.size > 1000) {
                    botSentIds.delete(
                        botSentIds.values().next().value
                    )
                }
            }

            return sent
        }

        sock.ev.on('creds.update', saveCreds)

        sock.ev.on(
            'messages.upsert',
            async ({ messages, type }) => {
                try {
                    if (type !== 'notify') return

                    const raw = messages[0]

                    if (
                        !raw ||
                        raw.key?.remoteJid === 'status@broadcast'
                    ) {
                        return
                    }

                    // handler.js diimpor sekali (cache ESM),
                    // dipakai apa adanya:
                    // perilakunya sama seperti bot utama —
                    // hanya merespon fromMe di sesi ini.
                    const { handler } = await import('../handler.js')

                    const m = serialize(sock, raw)

                    await handler(sock, m)
                } catch (e) {
                    console.log(
                        red(
                            `[ JADIBOT ${number} ] messages.upsert: ${e.message}`
                        )
                    )
                }
            }
        )

        sock.ev.on(
            'connection.update',
            async (update) => {
                if (clones.get(number)?.sock !== sock) {
                    return
                }

                const {
                    connection,
                    lastDisconnect,
                    qr
                } = update

                if (
                    !pairingHandled &&
                    !sock.authState.creds.registered
                ) {
                    pairingHandled = true

                    setTimeout(
                        async () => {
                            if (stopped) return

                            try {
                                const code =
                                    await sock.requestPairingCode(
                                        number
                                    )

                                console.log(
                                    green(
                                        `[ JADIBOT ] Kode pairing untuk ${number}: ${code}`
                                    )
                                )

                                await notify?.sock
                                    ?.sendMessage(
                                        notify.jid,
                                        {
                                            text:
                                                `*[ JADIBOT ]*\n\n` +
                                                `Kode pairing untuk *${number}*:\n` +
                                                `*${code}*\n\n` +
                                                `Buka WhatsApp di nomor itu:\n` +
                                                `*Setelan > Perangkat Tertaut > Tautkan Perangkat > Tautkan dengan nomor telepon*\n\n` +
                                                `Kode berlaku sekitar ${PAIRING_TIMEOUT / 1000} detik.`
                                        }
                                    )
                                    .catch(() => null)
                            } catch (e) {
                                await notify?.sock
                                    ?.sendMessage(
                                        notify.jid,
                                        {
                                            text:
                                                `Gagal minta kode pairing untuk ${number}: ${e.message}`
                                        }
                                    )
                                    .catch(() => null)

                                stopJadibot(number).catch(
                                    () => null
                                )
                            }
                        },
                        3000
                    )

                    // kalau tidak kunjung dipakai,
                    // bersihkan sesi supaya tidak menggantung
                    setTimeout(
                        () => {
                            if (
                                !stopped &&
                                clones.has(number) &&
                                !sock.authState.creds.registered
                            ) {
                                notify?.sock
                                    ?.sendMessage(
                                        notify.jid,
                                        {
                                            text:
                                                `Jadibot ${number} dibatalkan: kode pairing tidak digunakan.`
                                        }
                                    )
                                    .catch(() => null)

                                stopJadibot(number).catch(
                                    () => null
                                )
                            }
                        },
                        PAIRING_TIMEOUT
                    )
                }

                if (connection === 'open') {
                    retry = 0

                    // auto follow saluran untuk nomor jadibot
                    followNewsletters(sock).catch(() => {})

                    console.log(
                        green(
                            `[ JADIBOT ] ${number} tersambung`
                        )
                    )

                    await notify?.sock
                        ?.sendMessage(
                            notify.jid,
                            {
                                text:
                                    `Jadibot *${number}* berhasil tersambung.\n` +
                                    `Sekarang bot itu merespon pesan dari nomor itu sendiri, seperti self bot biasa.`
                            }
                        )
                        .catch(() => null)
                }

                if (connection === 'close') {
                    const reason =
                        lastDisconnect?.error?.output?.statusCode

                    if (stopped) return

                    if (
                        reason === DisconnectReason.loggedOut
                    ) {
                        clones.delete(number)
                        removeSession(number)

                        console.log(
                            red(
                                `[ JADIBOT ] ${number} logout, sesi dihapus`
                            )
                        )

                        await notify?.sock
                            ?.sendMessage(
                                notify.jid,
                                {
                                    text:
                                        `Jadibot ${number} logout. Sesinya sudah dihapus.`
                                }
                            )
                            .catch(() => null)

                        return
                    }

                    retry++

                    if (retry > MAX_RETRY) {
                        clones.delete(number)

                        console.log(
                            red(
                                `[ JADIBOT ] ${number} gagal sambung ulang ${MAX_RETRY}x, dihentikan`
                            )
                        )

                        await notify?.sock
                            ?.sendMessage(
                                notify.jid,
                                {
                                    text:
                                        `Jadibot ${number} dihentikan: gagal sambung ulang berkali-kali.`
                                }
                            )
                            .catch(() => null)

                        return
                    }

                    console.log(
                        blue(
                            `[ JADIBOT ] ${number} putus, sambung ulang (${retry}/${MAX_RETRY})...`
                        )
                    )

                    await sleep(RECONNECT_DELAY)

                    connect().catch(
                        e =>
                            console.log(
                                red(
                                    `[ JADIBOT ] ${number} gagal sambung ulang: ${e.message}`
                                )
                            )
                    )
                }
            }
        )
    }

    try {
        await connect()
    } catch (e) {
        // jangan tinggalkan entri "hantu" yang bikin nomor ini terblokir
        clones.delete(number)
        entry.stop()
        removeSession(number)
        throw e
    }

    return entry
}

// ───────── stop ─────────
export async function stopJadibot(number) {
    const entry = clones.get(number)

    if (!entry) {
        throw new Error(
            'Tidak ada sesi jadibot aktif untuk nomor itu.'
        )
    }

    entry.stop()
    clones.delete(number)

    try {
        entry.sock?.ev.removeAllListeners(
            'connection.update'
        )
    } catch {}

    try {
        entry.sock?.ev.removeAllListeners(
            'messages.upsert'
        )
    } catch {}

    try {
        entry.sock?.end(undefined)
    } catch {}

    removeSession(number)

    return true
}

// daftar jadibot aktif
export function listJadibot() {
    return [...clones.values()].map(
        ({
            number,
            startedAt,
            requester
        }) => ({
            number,
            startedAt,
            requester
        })
    )
}


// ╔══════════════ [ bantu.js ] ══════════════╗

// helper media: ambil media dari pesan/reply, ffmpeg, file sementara
export const bantu = (() => {
  // Helper bersama fitur media: ambil media dari pesan/reply, unduh, ffmpeg, RNG berbiji, file sementara

  // @ffmpeg-installer dimuat dengan aman: tanpa binary bawaannya (mis. Termux) bot tetap menyala dan memakai ffmpeg sistem
  const _bantuRequire = _createRequire(import.meta.url)
  let FFMPEG = 'ffmpeg'
  try { FFMPEG = _bantuRequire('@ffmpeg-installer/ffmpeg').path || 'ffmpeg' } catch {}
  const TMP = path.join(process.cwd(), 'tmp')
  const tmpFile = (ext) => { fs.mkdirSync(TMP, { recursive: true }); return path.join(TMP, `tmp_${Date.now()}_${randomBytes(4).toString('hex')}.${ext}`) }
  const rm = (...a) => { for (const f of a) try { fs.unlinkSync(f) } catch {} }

  // ── media: cari di pesan yang di-reply dulu, lalu di pesan itu sendiri ──
  // kinds: subset dari ['image','audio','video','document']; hasil { kind, node, mime } atau null
  function kindOf(node, mtype) {
    const mime = String(node.mimetype || '')
    if (mtype === 'documentMessage' || mtype === 'documentWithCaptionMessage') return 'document'
    if (mtype === 'audioMessage' || mime.startsWith('audio/')) return 'audio'
    if (mtype === 'videoMessage' || mime.startsWith('video/')) return 'video'
    if (mtype === 'imageMessage' || mime.startsWith('image/')) return mime === 'image/webp' ? 'sticker' : 'image'
    return null
  }
  function pickNode(m, kinds) {
    const tryNode = (node, mtype) => {
      if (mtype === 'documentWithCaptionMessage') { node = node && node.message && node.message.documentMessage; mtype = 'documentMessage' }
      if (!node || typeof node !== 'object' || !node.mimetype) return null
      const kind = kindOf(node, mtype); if (!kind || !kinds.includes(kind)) return null
      return { kind, node, mime: String(node.mimetype) }
    }
    // tipe ASLI pesan yang di-reply dibaca dari contextInfo (m.quoted hanya berisi isi dalamnya).
    // Penting: dokumen dan gambar memakai kunci dekripsi media yang berbeda.
    const qm = m.msg && m.msg.contextInfo && m.msg.contextInfo.quotedMessage
    if (qm) {
      const qt = Object.keys(qm).find(k => k !== 'messageContextInfo' && k !== 'senderKeyDistributionMessage')
      const r = qt && tryNode(qm[qt], qt); if (r) return r
    }
    return tryNode(m.msg, m.mtype)
  }
  async function download(media) {
      const stream = await downloadContentFromMessage(media.node, media.kind === 'sticker' ? 'sticker' : media.kind)
    const chunks = []; for await (const c of stream) chunks.push(c)
    return Buffer.concat(chunks)
  }

  // ── ffmpeg ──
  const ff = (args, timeout = 120000) => new Promise((res, rej) => _execFile(FFMPEG, ['-y', '-hide_banner', '-loglevel', 'error', ...args], { maxBuffer: 1 << 26, timeout }, (e, _o, se) => e ? rej(new Error(String(se || e.message).split('\n').slice(-3).join(' ').trim())) : res()))
  // buffer masuk -> buffer keluar. ext = ekstensi masuk, out = ekstensi keluar
  async function runFF(buf, inExt, outExt, args, pre = []) {
    const a = tmpFile(inExt), b = tmpFile(outExt)
    try { fs.writeFileSync(a, buf); await ff([...pre, '-i', a, ...args, b]); return fs.readFileSync(b) } finally { rm(a, b) }
  }

  // ── RNG berbiji: teks yang sama selalu menghasilkan urutan yang sama ──
  function hash32(str) { let h = 1779033703 ^ str.length; for (let i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19) } return () => { h = Math.imul(h ^ (h >>> 16), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return (h ^= h >>> 16) >>> 0 } }
  function rng(seedStr) { const s = hash32(String(seedStr)); let a = s(), b = s(), c = s(), d = s(); return () => { a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0; let t = (a + b) | 0; a = b ^ (b >>> 9); b = (c + (c << 3)) | 0; c = (c << 21) | (c >>> 11); d = (d + 1) | 0; t = (t + d) | 0; c = (c + t) | 0; return (t >>> 0) / 4294967296 } }

  // ── penyimpanan JSON kecil dengan tulis tertunda ──
  function store(file, fallback) {
    const f = path.join(process.cwd(), 'database', file); let db = fallback, t = null
    try { db = JSON.parse(fs.readFileSync(f, 'utf8')) } catch {}
    const flush = () => { try { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify(db)) } catch (e) { console.log('[store]', e.message) } }
    process.on('exit', flush)
    return { get: () => db, set: (v) => { db = v; return db }, save: () => { if (t) return; t = setTimeout(() => { t = null; flush() }, 1500) }, flush }
  }

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))

  return { FFMPEG, tmpFile, rm, pickNode, download, ff, runFF, hash32, rng, store, esc }
})()


// ╔══════════════ [ spec.js ] ══════════════╗

// Pembungkus plugin berbentuk spesifikasi { name, alias, cmds, category, desc, run }
// menjadi handler Kaguya: handler(m, ctx) dengan command / tags / help.

// bangun plugin dari spesifikasi (helper)
export function fromSpec(spec) {
    const names = [...new Set([...(spec.cmds || []), ...(spec.alias || [])].map(s => String(s).toLowerCase()))]
    const wantsMeta = /groupMetadata/.test(String(spec.run))

    const handler = async (m, ctx) => {
        const text = ctx.text || ''
        const args = text.split(/\s+/).filter(Boolean)
        const groupMetadata = wantsMeta && m.isGroup ? await getMeta(ctx.sock, m.chat).catch(() => null) : null
        return spec.run({ ...ctx, m, text, args, isGroup: !!m.isGroup, groupMetadata })
    }

    handler.command = names
    handler.tags = [spec.category || 'misc']
    handler.help = spec.cmds || names.slice(0, 1)
    handler.description = spec.desc
    if (spec.owner) handler.owner = true
    return handler
}
