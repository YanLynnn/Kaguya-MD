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


import { wrapPlugin } from '../../lib/plugin-engine.js'
import { runtime } from '../../lib/core-system.js'

const pluginConfig = {
    name: 'runtime',
    alias: [],
    category: 'info',
    description: 'Tampilkan lama bot sudah berjalan',
    usage: '.runtime',
    example: '.runtime',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 3,
    energi: 0,
    isEnabled: true
}

async function handler(m, { reply }) {
    await reply(`*Runtime Bot:* ${runtime(process.uptime())}`)
}

export default wrapPlugin(pluginConfig, handler)
