import fs from 'fs'
import path from 'path'

// Folder session bot utama (sama dengan SESSION_DIR di index.js)
const SESSION_DIR = path.resolve('session')

// Hanya file sesi enkripsi yang menumpuk yang dibersihkan.
// creds.json (login), pre-key-*, app-state-sync-*, dan folder jadibot TIDAK disentuh,
// jadi bot tidak logout dan tidak perlu scan ulang.
const CLEANABLE = /^(session-|sender-key-|sender-key-memory-)/

const fmt = (bytes) => bytes > 1048576 ? `${(bytes / 1048576).toFixed(2)} MB` : `${(bytes / 1024).toFixed(1)} KB`

let handler = async (m, { reply }) => {
    if (!fs.existsSync(SESSION_DIR)) return reply('Folder session tidak ditemukan.')

    let files = 0
    let bytes = 0
    let failed = 0

    for (const entry of fs.readdirSync(SESSION_DIR, { withFileTypes: true })) {
        if (!entry.isFile() || entry.name === 'creds.json' || !CLEANABLE.test(entry.name)) continue
        const file = path.join(SESSION_DIR, entry.name)
        try {
            const size = fs.statSync(file).size
            fs.unlinkSync(file)
            files++
            bytes += size
        } catch {
            failed++
        }
    }

    return reply(
        `* CLEAR SESSION*\n` +
        `File dihapus : *${files}*\n` +
        `Ruang kosong : *${fmt(bytes)}*` +
        (failed ? `\nGagal hapus : ${failed} file` : '') +
        `\n\n_creds.json tetap aman, bot tidak logout. Sesi chat akan terbentuk ulang otomatis; kalau ada pesan sempat gagal terbaca sebentar, itu normal._`
    )
}

handler.command = ['clearsession']
handler.help = ['clearsession']
handler.tags = ['owner']
handler.owner = true

export default handler
