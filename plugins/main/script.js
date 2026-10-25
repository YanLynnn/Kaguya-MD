
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

import { sendCard } from '../../lib/plugin-engine.js'

let handler = async (m, { sock, jid }) => {
    const pushname = m.pushName || 'Kak'

    const sc = `
🍓 *KAGUYA MD — WHATSAPP BOT*

Halo ${pushname}! 👋✨

🍰 Script ini GRATIS untuk kamu!

💎 Ingin fitur lebih lengkap dan eksklusif?
Upgrade ke *VERSI PREMIUM* untuk pengalaman
bot yang lebih maksimal! 🚀

👑 *PREMIUM VERSION — PAID*

📩 Klik tombol di bawah untuk info harga
dan pembelian. 🍡
`.trim()

    const anu = `
╭─「 💎 PREMIUM VERSION 」
│
│ ✨ Fitur lebih eksklusif
│ 🚀 Pengalaman bot lebih maksimal
│ 💰 Versi premium berbayar
│ 📩 Hubungi admin untuk info harga
│
╰────────────────

╭─「 🍓 THANKS TO 」
│
│ 🍅 YannRzy Tech — Developer
│ 🍋 Zanspiw — Friends & Support
│ 🍡 Zass Desuta
│ 🧃 Node.js & Open-source Packages
│
╰────────────────

╭─「 📜 RULES 」
│
│ 🍓 Dilarang menghapus credit.
│     Minimal cantumkan di TQTO.
│
│ 🍅 Dilarang memperjualbelikan
│     script versi gratis ini.
│
│ 🍋 Dilarang mengklaim script ini
│     sebagai milik sendiri.
│
╰────────────────

🔗 GitHub:
https://github.com/YanLynnn/Kaguya-MD

© YannRzy Tech 2026
`.trim()

    const buttons = [
        {
            type: 'url',
            text: '🍓 Get Free Script',
            url: 'https://github.com/YanLynnn/Kaguya-MD'
        },
        {
            type: 'url',
            text: '💎 Buy Premium Script',
            url: 'https://wa.me/6285956337454'
        }
    ]

    try {
        await sock.sendButtons(jid, {
            text: sc,
            footer: anu,
            image: global.thumb?.utama
                ? { url: global.thumb.utama }
                : undefined,
            buttons
        }, { quoted: m })
    } catch (e) {
        console.error('[SC]', e.message)

        try {
            await sendCard(sock, m, {
                body: sc,
                footer: anu,
                imageUrl: global.thumb?.utama,
                buttons: [
                    {
                        text: '🍓 Get Free Script',
                        url: 'https://github.com/YanLynnn/Kaguya-MD'
                    },
                    {
                        text: '💎 Buy Premium Script',
                        url: 'https://wa.me/6285956337454'
                    }
                ]
            })
        } catch (err) {
            console.error('[SC FALLBACK]', err.message)

            await sock.sendMessage(m.chat, {
                text: `❌ Gagal mengirim pesan!\n${err.message}`
            }, { quoted: m })
        }
    }
}

handler.command = ['sc', 'script', 'getsc']
handler.tags = ['main']

export default handler
