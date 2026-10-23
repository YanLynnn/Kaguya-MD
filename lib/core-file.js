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


import fs from 'fs'
import zlib from 'zlib'
import axios from 'axios'
import FormData from 'form-data'
import { fileTypeFromBuffer } from 'file-type'

// ╔══════════════ [ file.js ] ══════════════╗

// ───────── zip ─────────
const CRC_TABLE = (() => {
    const table = new Uint32Array(256)
    for (let n = 0; n < 256; n++) {
        let c = n
        for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
        table[n] = c >>> 0
    }
    return table
})()

// hitung CRC32 untuk ZIP
export function crc32(buffer) {
    let crc = 0xffffffff
    for (let i = 0; i < buffer.length; i++) crc = CRC_TABLE[(crc ^ buffer[i]) & 0xff] ^ (crc >>> 8)
    return (crc ^ 0xffffffff) >>> 0
}

function dosDateTime(date) {
    const year = Math.max(date.getFullYear(), 1980)
    return {
        time: (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1),
        date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate()
    }
}

function localHeader(entry) {
    const header = Buffer.alloc(30)
    header.writeUInt32LE(0x04034b50, 0)
    header.writeUInt16LE(20, 4)
    header.writeUInt16LE(0x0800, 6)
    header.writeUInt16LE(entry.method, 8)
    header.writeUInt16LE(entry.time, 10)
    header.writeUInt16LE(entry.date, 12)
    header.writeUInt32LE(entry.crc, 14)
    header.writeUInt32LE(entry.packed.length, 18)
    header.writeUInt32LE(entry.size, 22)
    header.writeUInt16LE(entry.name.length, 26)
    header.writeUInt16LE(0, 28)
    return Buffer.concat([header, entry.name])
}

function centralHeader(entry, offset) {
    const header = Buffer.alloc(46)
    header.writeUInt32LE(0x02014b50, 0)
    header.writeUInt16LE(20, 4)
    header.writeUInt16LE(20, 6)
    header.writeUInt16LE(0x0800, 8)
    header.writeUInt16LE(entry.method, 10)
    header.writeUInt16LE(entry.time, 12)
    header.writeUInt16LE(entry.date, 14)
    header.writeUInt32LE(entry.crc, 16)
    header.writeUInt32LE(entry.packed.length, 20)
    header.writeUInt32LE(entry.size, 24)
    header.writeUInt16LE(entry.name.length, 28)
    header.writeUInt32LE(offset, 42)
    return Buffer.concat([header, entry.name])
}

function prepare({ name, data, date = new Date() }) {
    const raw = Buffer.isBuffer(data) ? data : Buffer.from(String(data), 'utf8')
    const deflated = zlib.deflateRawSync(raw, { level: 9 })
    const useDeflate = deflated.length < raw.length
    const stamp = dosDateTime(date)

    return {
        name: Buffer.from(name, 'utf8'),
        size: raw.length,
        crc: crc32(raw),
        method: useDeflate ? 8 : 0,
        packed: useDeflate ? deflated : raw,
        time: stamp.time,
        date: stamp.date
    }
}

// buat file ZIP dari daftar file (tanpa library)
export function createZip(files) {
    const entries = files.map(prepare)
    const chunks = []
    const central = []
    let offset = 0

    for (const entry of entries) {
        const local = localHeader(entry)
        central.push(centralHeader(entry, offset))
        chunks.push(local, entry.packed)
        offset += local.length + entry.packed.length
    }

    const centralBuffer = Buffer.concat(central)
    const end = Buffer.alloc(22)
    end.writeUInt32LE(0x06054b50, 0)
    end.writeUInt16LE(entries.length, 8)
    end.writeUInt16LE(entries.length, 10)
    end.writeUInt32LE(centralBuffer.length, 12)
    end.writeUInt32LE(offset, 16)

    return Buffer.concat([...chunks, centralBuffer, end])
}


// ───────── uploader ─────────
const EXT_MIME = {
    html: 'text/html',
    htm: 'text/html',
    txt: 'text/plain',
    json: 'application/json',
    css: 'text/css',
    js: 'application/javascript',
    csv: 'text/csv',
    svg: 'image/svg+xml'
}

function extOf(fileName) {
    return fileName?.split('.').pop()?.toLowerCase()
}

// unggah file ke hosting sementara, balikan URL
export async function uploadFile(buffer) {
    try {
        let { ext, mime } = (await fileTypeFromBuffer(buffer)) || { ext: 'bin', mime: 'application/octet-stream' }
        const form = new FormData()
        form.append('files[]', buffer, { filename: `myfiles.${ext}`, contentType: mime })
        form.append('expiry', '-1')

        const { data } = await axios.post('https://qu.ax/upload.php', form, {
            headers: form.getHeaders(),
            maxBodyLength: Infinity,
            maxContentLength: Infinity
        })
        return data.files[0].url
    } catch (error) {
        console.log(error)
    }
}

// ───────── configWriter ─────────
const CONFIG_PATH = './config.js'
const IDENT = /^[A-Za-z_$][\w$]*$/

const read = () => fs.readFileSync(CONFIG_PATH, 'utf-8')
const write = (content) => fs.writeFileSync(CONFIG_PATH, content, 'utf-8')
const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const isPrimitive = (v) => v === null || typeof v !== 'object'

function formatJs(value, indent = '') {
    const next = indent + '    '

    if (Array.isArray(value)) {
        if (!value.length) return '[]'
        if (value.every(isPrimitive)) return `[${value.map(v => JSON.stringify(v)).join(', ')}]`
        return `[\n${value.map(v => next + formatJs(v, next)).join(',\n')}\n${indent}]`
    }

    if (value && typeof value === 'object') {
        const entries = Object.entries(value)
        if (!entries.length) return '{}'
        const body = entries.map(([k, v]) => `${next}${IDENT.test(k) ? k : JSON.stringify(k)}: ${formatJs(v, next)}`)
        return `{\n${body.join(',\n')}\n${indent}}`
    }

    return JSON.stringify(value)
}

function findBlock(content, key) {
    const head = new RegExp(`global\\.${escapeRegex(key)}\\s*=\\s*`).exec(content)
    if (!head) return null

    const start = head.index + head[0].length
    const open = content[start]
    if (open !== '[' && open !== '{') return null

    let depth = 0
    let quote = null

    for (let i = start; i < content.length; i++) {
        const c = content[i]
        const n = content[i + 1]

        if (quote) {
            if (c === '\\') i++
            else if (c === quote) quote = null
            continue
        }

        if (c === '"' || c === "'" || c === '`') {
            quote = c
            continue
        }

        if (c === '/' && n === '/') {
            i = content.indexOf('\n', i)
            if (i === -1) return null
            continue
        }

        if (c === '/' && n === '*') {
            const end = content.indexOf('*/', i + 2)
            if (end === -1) return null
            i = end + 1
            continue
        }

        if (c === '[' || c === '{') depth++
        else if (c === ']' || c === '}') {
            depth--
            if (depth === 0) return { start, end: i + 1 }
        }
    }

    return null
}

function setValue(content, { key, value }) {
    if (!isPrimitive(value)) return setBlock(content, { key, value })

    const regex = new RegExp(`(global\\.${escapeRegex(key)}\\s*=\\s*)(?:"(?:[^"\\\\]|\\\\.)*"|'(?:[^'\\\\]|\\\\.)*'|[^\\s;/]+)`)
    if (regex.test(content)) return content.replace(regex, (_, head) => head + JSON.stringify(value))

    return `${content.trimEnd()}\nglobal.${key} = ${JSON.stringify(value)}\n`
}

function setBlock(content, { key, value }) {
    const block = findBlock(content, key)
    if (!block) return null
    return content.slice(0, block.start) + formatJs(value) + content.slice(block.end)
}

function setNested(content, { path, value }) {
    const segments = path.split('.')
    const root = findBlock(content, segments[0])
    if (!root || segments.length < 2) return null

    const field = segments[segments.length - 1]
    const regex = new RegExp(`((?:^|[\\s,{])${escapeRegex(field)}:\\s*)"(?:[^"\\\\]|\\\\.)*"`)
    const section = content.slice(root.start, root.end)
    if (!regex.test(section)) return null

    const updated = section.replace(regex, (_, head) => head + JSON.stringify(value))
    return content.slice(0, root.start) + updated + content.slice(root.end)
}

const TRANSFORMS = { value: setValue, block: setBlock, nested: setNested }

// ubah isi config.js lewat chat (nilai/blok/nested)
export function applyConfigChanges(changes) {
    let content = read()
    const failed = []

    for (const change of changes) {
        const next = TRANSFORMS[change.op]?.(content, change) ?? null
        if (next === null) failed.push(change)
        else content = next
    }

    if (failed.length < changes.length) write(content)
    return { ok: failed.length === 0, failed }
}

// ubah satu nilai di config.js
export const updateConfigValue = (key, value) => applyConfigChanges([{ op: 'value', key, value }]).ok
// ubah satu blok di config.js
export const updateConfigBlock = (key, value) => applyConfigChanges([{ op: 'block', key, value }]).ok


// ───────── tools (helper media & data) ─────────
// Ambil media dari pesan itu sendiri atau pesan yang di-reply (reply diutamakan).
export function pickMedia(m) {
    const q = m.quoted
    if (q?.isMedia && q.download) return { mtype: q.mtype, mime: q.mimetype || '', download: q.download, node: q }
    if (m.isMedia && m.download) return { mtype: m.mtype, mime: m.msg?.mimetype || '', download: m.download, node: m.msg }
    return null
}

// Ambil gambar saja: gambar yang dikirim langsung diutamakan, lalu gambar yang di-reply.
export function pickImage(m) {
    if (m.mtype === 'imageMessage' && m.download) return { mtype: m.mtype, mime: m.msg?.mimetype || 'image/jpeg', download: m.download, node: m.msg }
    if (m.quoted?.mtype === 'imageMessage' && m.quoted.download) return { mtype: m.quoted.mtype, mime: m.quoted.mimetype || 'image/jpeg', download: m.quoted.download, node: m.quoted }
    return null
}

// beri reaksi emoji pada pesan
export async function reactTo(sock, m, emoji) {
    try {
        await sock.sendMessage(m.chat, { react: { text: emoji, key: m.key } })
    } catch (e) {}
}

// tabel mime untuk konversi ke file
export const TOFILE_MIME = {
    js: 'application/javascript',
    mjs: 'application/javascript',
    cjs: 'application/javascript',
    ts: 'application/typescript',
    json: 'application/json',
    yml: 'text/yaml',
    yaml: 'text/yaml',
    env: 'text/plain',
    txt: 'text/plain',
    md: 'text/markdown',
    log: 'text/plain',
    csv: 'text/csv',
    html: 'text/html',
    css: 'text/css',
    xml: 'application/xml',
    sql: 'application/sql',
    db: 'application/octet-stream',
    sqlite: 'application/octet-stream',
    sqlite3: 'application/octet-stream',
    bin: 'application/octet-stream',
    dat: 'application/octet-stream',
    pdf: 'application/pdf'
}

// daftar kode bahasa (terjemahan)
export const KODE_BAHASA = `
af          Afrikaans
ak          Akan
sq          Albanian
am          Amharic
ar          Arabic
hy          Armenian
az          Azerbaijani
eu          Basque
be          Belarusian
bem         Bemba
bn          Bengali
bh          Bihari
xx-bork     Bork, bork, bork!
bs          Bosnian
br          Breton
bg          Bulgarian
km          Cambodian
ca          Catalan
chr         Cherokee
ny          Chichewa
zh-CN       Chinese (Simplified)
zh-TW       Chinese (Traditional)
co          Corsican
hr          Croatian
cs          Czech
da          Danish
nl          Dutch
xx-elmer    Elmer Fudd
en          English
eo          Esperanto
et          Estonian
ee          Ewe
fo          Faroese
tl          Filipino
fi          Finnish
fr          French
fy          Frisian
gaa         Ga
gl          Galician
ka          Georgian
de          German
el          Greek
gn          Guarani
gu          Gujarati
xx-hacker   Hacker
ht          Haitian Creole
ha          Hausa
haw         Hawaiian
iw          Hebrew
hi          Hindi
hu          Hungarian
is          Icelandic
ig          Igbo
id          Indonesian
ia          Interlingua
ga          Irish
it          Italian
ja          Japanese
jw          Javanese
kn          Kannada
kk          Kazakh
rw          Kinyarwanda
rn          Kirundi
xx-klingon  Klingon
kg          Kongo
ko          Korean
kri         Krio (Sierra Leone)
ku          Kurdish
ckb         Kurdish (Soranî)
ky          Kyrgyz
lo          Laothian
la          Latin
lv          Latvian
ln          Lingala
lt          Lithuanian
loz         Lozi
lg          Luganda
ach         Luo
mk          Macedonian
mg          Malagasy
ms          Malay
ml          Malayalam
mt          Maltese
mi          Maori
mr          Marathi
mfe         Mauritian Creole
mo          Moldavian
mn          Mongolian
sr-ME       Montenegrin
ne          Nepali
pcm         Nigerian Pidgin
nso         Northern Sotho
no          Norwegian
nn          Norwegian (Nynorsk)
oc          Occitan
or          Oriya
om          Oromo
ps          Pashto
fa          Persian
xx-pirate   Pirate
pl          Polish
pt-BR       Portuguese (Brazil)
pt-PT       Portuguese (Portugal)
pa          Punjabi
qu          Quechua
ro          Romanian
rm          Romansh
nyn         Runyakitara
ru          Russian
gd          Scots Gaelic
sr          Serbian
sh          Serbo-Croatian
st          Sesotho
tn          Setswana
crs         Seychellois Creole
sn          Shona
sd          Sindhi
si          Sinhalese
sk          Slovak
sl          Slovenian
so          Somali
es          Spanish
es-419      Spanish (Latin American)
su          Sundanese
sw          Swahili
sv          Swedish
tg          Tajik
ta          Tamil
tt          Tatar
te          Telugu
th          Thai
ti          Tigrinya
to          Tonga
lua         Tshiluba
tum         Tumbuka
tr          Turkish
tk          Turkmen
tw          Twi
ug          Uighur
uk          Ukrainian
ur          Urdu
uz          Uzbek
vi          Vietnamese
cy          Welsh
wo          Wolof
xh          Xhosa
yi          Yiddish
yo          Yoruba
zu          Zulu
`
