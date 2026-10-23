import { updateConfigValue } from '../../lib/core-file.js'

// .public  -> semua orang bisa memakai bot (command khusus owner tetap terkunci)
// .self    -> hanya akun bot sendiri + owner
// .mode    -> lihat mode sekarang
const label = (isPublic) => (isPublic ? 'Public' : 'Self')

let handler = async (m, { reply, command, prefix }) => {
    const isPublic = global.public === true

    if (command === 'mode') {
        return reply(
            `･ﾟ✦ Mode bot saat ini: *${label(isPublic)}*\n\n` +
            `${prefix}public : semua orang bisa pakai bot\n` +
            `${prefix}self : hanya owner & akun bot`
        )
    }

    const target = command === 'public'
    if (isPublic === target) return reply(`･ﾟ✦ Bot sudah dalam mode *${label(target)}*.`)

    global.public = target // berlaku langsung
    const saved = updateConfigValue('public', target) // disimpan ke config.js supaya tetap setelah restart

    await reply(
        `･ﾟ✦ Mode diubah ke *${label(target)}*.\n` +
        (target
            ? 'Semua orang sekarang bisa memakai bot. Command owner/premium/admin tetap terkunci.'
            : 'Sekarang hanya owner dan akun bot yang dilayani.') +
        (saved ? '' : '\n\n_Gagal menyimpan ke config.js, mode akan kembali seperti semula setelah restart._')
    )
}

handler.command = ['public', 'self', 'mode']
handler.help = ['public', 'self', 'mode']
handler.tags = ['owner']
handler.owner = true

export default handler
