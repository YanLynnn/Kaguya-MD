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
    const pushname = m.pushName || 'No Name'

    const sc = `> *halo ${pushname}, apakah kamu ingin script ini?*`

    const anu = `
jika kamu menginginkan script ini silahkan klik tombol di bawah ini

\`thanks to\`
- yannrzy (developer)
- zanspiw (friends & support)
- zass desuta
- Node.js & seluruh open-source package di package.json

\`rulles\`
- dilarang keras menghapus credits minimal taro di tqto
- dilarang memperjual belikan script ini karena 100% free
- boleh di jual dengan syarat sudah di tambah fitur
- dilarang mengklaim script ini 100%
https://github.com/YanLynnn/Kaguya-MD
`.trim()

    const buttons = [{
        type: 'url',
        text: 'get sc',
        url: 'https://github.com/YanLynnn/Kaguya-MD'
    }]

    try {
        await sock.sendButtons(jid, {
            text: sc,
            footer: anu,
            image: global.thumb?.utama ? { url: global.thumb.utama } : undefined,
            buttons
        }, { quoted: m })
    } catch (e) {
        console.error('[SC]', e.message)
        // tombol gagal (mis. platform tidak mendukung) -> kirim kartu gambar + link
        try {
            await sendCard(sock, m, {
                body: sc,
                footer: anu,
                imageUrl: global.thumb?.utama,
                buttons: [{ text: 'get sc', url: buttons[0].url }]
            })
        } catch (err) {
            console.error(err)
            await sock.sendMessage(m.chat, { text: `❌ Gagal kirim pesan: ${err.message}` }, { quoted: m })
        }
    }
}

handler.command = ['sc', 'script', 'getsc']
handler.tags = ['main']

export default handler
