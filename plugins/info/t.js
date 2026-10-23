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


import { expandPlugins } from '../../lib/plugin-engine.js'

function countCommands() {
    let command = 0

    for (const h of expandPlugins()) {
        if (!h) continue
        if (!h.command) continue
        if (h.command instanceof RegExp) continue
        if (h.disabled) continue

        const hidden = Array.isArray(h.hide) ? h.hide : []
        const cmds = (Array.isArray(h.command) ? h.command : [h.command])
            .map(String)
            .filter(c => c && !c.includes('_') && !hidden.includes(c))

        command += cmds.length
    }

    return command
}

let handler = async (m, { reply }) => {
    const total = countCommands().toLocaleString('id-ID')
    const botName = global.namebot ? String(global.namebot) : 'BOT'

    return reply(`📊 *TOTAL FITUR ${botName.toUpperCase()}*\n\nTotal fitur : *${total}*`)
}

handler.command = ['t']
handler.help = ['t']
handler.tags = ['info']

export default handler
