// Voice note → teks (speech-to-text)
//   Reply VN / audio / video dengan  .stt           → transkrip (bahasa terdeteksi otomatis)
//   .stt id | .stt en | .stt ja ...                 → paksa bahasa (lebih akurat kalau sudah tahu)
//
// Butuh minimal satu API key GRATIS (taruh di config.js, atau env):
//   global.groqKey   = 'gsk_xxx'   // https://console.groq.com/keys  (Whisper — utama, cepat)
//   global.geminiKey = 'AIza_xxx'  // https://aistudio.google.com/apikey (cadangan kalau Groq gagal)
import { reactTo } from '../../lib/core-file.js'

const LINE = '─────────────────────'
const MAX_BYTES = 24 * 1024 * 1024           // batas upload Groq tier gratis ±25 MB
const OK_TYPES = ['audioMessage', 'videoMessage', 'documentMessage']
const GROQ_MODEL = 'whisper-large-v3-turbo'
const GEMINI_MODEL = 'gemini-2.5-flash'

// placeholder bawaan config.js ('gsk_...', 'AIza...') bukan key asli
const realKey = (v) => (typeof v === 'string' && v.trim() && !/\.{3}$|^(isi|your)/i.test(v.trim())) ? v.trim() : ''
const groqKey = () => realKey(global.groqKey) || realKey(process.env.GROQ_API_KEY)
const geminiKey = () => realKey(global.geminiKey) || realKey(process.env.GEMINI_API_KEY)

function pickMedia(m) {
    if (m.quoted && OK_TYPES.includes(m.quoted.mtype)) return m.quoted
    if (m.mtype === 'audioMessage' && m.download) return m
    return null
}

const extFor = (mime = '') => /mp4|video/.test(mime) ? 'mp4' : /mpeg|mp3/.test(mime) ? 'mp3' : /wav/.test(mime) ? 'wav' : /m4a|aac/.test(mime) ? 'm4a' : /webm/.test(mime) ? 'webm' : 'ogg'
const mimeBase = (mime = '') => String(mime).split(';')[0].trim() || 'audio/ogg'

async function viaGroq(buf, mime, lang) {
    const form = new FormData()
    form.append('file', new Blob([buf], { type: mimeBase(mime) }), `audio.${extFor(mime)}`)
    form.append('model', GROQ_MODEL)
    form.append('response_format', 'json')
    form.append('temperature', '0')
    if (lang) form.append('language', lang)
    const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
        method: 'POST', headers: { Authorization: `Bearer ${groqKey()}` }, body: form, signal: AbortSignal.timeout(120000)
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(`Groq ${res.status}: ${data?.error?.message || 'gagal'}`)
    return String(data.text || '').trim()
}

async function viaGemini(buf, mime, lang) {
    const prompt = `Transkripsikan audio ini persis apa adanya (verbatim) dalam bahasa aslinya${lang ? ` (${lang})` : ''}. ` +
        `Jangan menerjemahkan, jangan meringkas, jangan menambah komentar. Kalau tidak ada ucapan, balas persis: [tidak ada ucapan]`
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${geminiKey()}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(120000),
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: mimeBase(mime), data: buf.toString('base64') } }] }] })
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(`Gemini ${res.status}: ${data?.error?.message || 'gagal'}`)
    const out = (data.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('').trim()
    return out === '[tidak ada ucapan]' ? '' : out
}

async function transcribe(buf, mime, lang) {
    const errs = []
    if (groqKey()) { try { return { text: await viaGroq(buf, mime, lang), engine: 'Whisper (Groq)' } } catch (e) { errs.push(e.message) } }
    if (geminiKey()) { try { return { text: await viaGemini(buf, mime, lang), engine: 'Gemini' } } catch (e) { errs.push(e.message) } }
    if (!errs.length) throw new Error('NOKEY')
    throw new Error(errs.join(' | '))
}

let handler = async (m, { sock, text, prefix, command, reply }) => {
    const media = pickMedia(m)
    if (!media) {
        return reply(`*🎙️ VOICE NOTE → TEKS*\n${LINE}\nReply voice note / audio / video dengan:\n*${prefix}${command}*\n*${prefix}${command} id*  _(paksa bahasa Indonesia)_\n\nKode bahasa: id, en, ja, ko, ar, ms, jv, su, dll.`)
    }
    const lang = (String(text || '').trim().toLowerCase().match(/^[a-z]{2,3}$/) || [])[0] || ''

    try {
        await reactTo(sock, m, '⏳')
        const buf = await media.download()
        if (!buf || !buf.length) throw new Error('Gagal mengunduh media dari pesan.')
        if (buf.length > MAX_BYTES) throw new Error(`File terlalu besar (${(buf.length / 1048576).toFixed(1)} MB, maks 24 MB).`)

        const mime = media.mimetype || media.msg?.mimetype || media.mime || 'audio/ogg'
        const { text: hasil, engine } = await transcribe(buf, mime, lang)
        if (!hasil) throw new Error('Tidak ada ucapan yang terdeteksi (hening / hanya musik / suara terlalu kecil).')

        await reply(`*🎙️ TRANSKRIP*\n${LINE}\n${hasil}\n\n_${engine}${lang ? ` • bahasa: ${lang}` : ''} • bisa salah pada nama/istilah, cek lagi kalau penting_`)
        await reactTo(sock, m, '✅')
    } catch (e) {
        await reactTo(sock, m, '❌')
        if (e.message === 'NOKEY') {
            return reply(`❌ API key belum diatur.\n\nTambahkan di *config.js* (gratis):\n\`global.groqKey = 'gsk_...'\`  → console.groq.com/keys\n\nCadangan (opsional):\n\`global.geminiKey = 'AIza...'\`  → aistudio.google.com/apikey`)
        }
        reply(`❌ ${e.message || 'Gagal memproses.'}`)
    }
}

handler.command = ['stt', 'transkrip', 'vn2text', 'voice2text', 'totext']
handler.help = ['stt (reply voice note)']
handler.tags = ['convert']
handler.limit = true

export default handler
