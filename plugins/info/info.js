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

let handler = async (m, { sock }) => {
    const pushname = m.pushName || 'No Name'

    const sc = `> *halow ${pushname}, apakah kamu tau siapa yannrzy?*`

    const anu = `
tentang YannRzy Tech

YannRzy adalah owner sekaligus developer dari bot ini. my beloved

YannRzy adalah seseorang yang menghabiskan sebagian besar waktunya untuk vibe coding, memperbaiki error, lalu membuat error baru untuk membuka fesnuk.

Katanya dia ingin membuat bot yang sederhana, tetapi akhirnya malah menambahkan fitur yang tidak pernah direncanakan.

Tujuan utama YannRzy Tech adalah membuat bot yang berguna dan nyaman digunakan, walaupun dalam proses pembuatannya sering terjadi kejadian yang tidak manuk akal.

Terima kasih sudah menggunakan bot ini.

Untuk informasi terbaru, update project, dan hal lainnya, silakan kunjungi saluran resmi di link bawah ini
`.trim()

    try {
        await sendCard(sock, m, {
            body: sc,
            footer: anu,
            imageUrl: global.thumb?.utama,
            buttons: [{ text: 'information', url: 'https://whatsapp.com/channel/0029VaoMGuLA89MbfGh62V16' }]
        })
    } catch (e) {
        console.error(e)
        await sock.sendMessage(m.chat, { text: `❌ Gagal kirim pesan: ${e.message}` }, { quoted: m })
    }
}

handler.command = ['info']
handler.tags = ['info']

export default handler
