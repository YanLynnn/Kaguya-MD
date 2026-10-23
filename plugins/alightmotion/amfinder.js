
 // plugins/alightmotion/amfinder.js
 // AMFinder - Alight Motion Preset Finder
 // Challenge -> HMAC-SHA256 -> Token -> SSE
 // Node.js 18+ | ES Module

import { webcrypto } from 'node:crypto'

const BASE_URL = 'https://amfinder.web.id'
const CHALLENGE_ENDPOINT = `${BASE_URL}/api/v/2b51359f`
const ENDPOINT = `${BASE_URL}/api/find`

const TIMEOUT_MS = 90 * 1000
const MAX_SHOW = 10

const DID = '267f6fd3-34f4-4d9a-8d90-5aa28db8922b'

const HEADERS = {
    'Content-Type': 'application/json',
    'Origin': BASE_URL,
    'Referer': `${BASE_URL}/`,
    'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
}

// ================== REACTION ==================

async function react(conn, m, emoji) {
    try {
        await conn.sendMessage(m.chat, {
            react: {
                text: emoji,
                key: m.key
            }
        })
    } catch {}
}

// ================== HMAC PROOF ==================

async function computeProof(saltHex, messageStr, rounds) {
    if (!saltHex || !/^(?:[0-9a-f]{2})+$/i.test(saltHex)) {
        throw new Error('Salt challenge AMFinder tidak valid.')
    }

    const saltBuffer = Buffer.from(saltHex, 'hex')

    const key = await webcrypto.subtle.importKey(
        'raw',
        saltBuffer,
        {
            name: 'HMAC',
            hash: 'SHA-256'
        },
        false,
        ['sign']
    )

    let data = new TextEncoder().encode(messageStr)

    const actualRounds = Math.max(
        1,
        Math.min(10000, Math.floor(Number(rounds) || 1))
    )

    for (let i = 0; i < actualRounds; i++) {
        const signature = await webcrypto.subtle.sign(
            'HMAC',
            key,
            data
        )

        data = new Uint8Array(signature)
    }

    return Array.from(data, byte =>
        byte.toString(16).padStart(2, '0')
    ).join('')
}

// ================== HTTP HELPER ==================

async function requestJson(url, body, signal) {
    const response = await fetch(url, {
        method: 'POST',
        signal,
        headers: HEADERS,
        body: JSON.stringify(body)
    })

    const raw = await response.text()

    let data

    try {
        data = JSON.parse(raw)
    } catch {
        throw new Error(
            `Respons server bukan JSON (HTTP ${response.status}).`
        )
    }

    if (!response.ok) {
        throw new Error(
            data?.message ||
            data?.error ||
            `HTTP ${response.status}`
        )
    }

    return data
}

// ================== SSE PARSER ==================

function parseSSEBlock(block) {
    let event = 'message'
    const dataLines = []

    for (const line of block.split(/\r?\n/)) {
        if (line.startsWith(':')) continue

        if (line.startsWith('event:')) {
            event = line.slice(6).trim()
        } else if (line.startsWith('data:')) {
            dataLines.push(line.slice(5).trimStart())
        }
    }

    return {
        event,
        data: dataLines.join('\n')
    }
}

async function readSSE(response, signal) {
    if (!response.body) {
        throw new Error('Stream SSE dari AMFinder kosong.')
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder('utf-8')

    let buffer = ''

    try {
        while (true) {
            if (signal?.aborted) {
                throw new Error('Pencarian dibatalkan karena timeout.')
            }

            const { done, value } = await reader.read()

            if (done) break

            buffer += decoder.decode(value, {
                stream: true
            })

            const blocks = buffer.split(/\r?\n\r?\n/)
            buffer = blocks.pop() || ''

            for (const block of blocks) {
                if (!block.trim()) continue

                const parsed = parseSSEBlock(block)

                if (!parsed.data) continue

                if (parsed.event === 'error') {
                    let message = parsed.data

                    try {
                        const errorData = JSON.parse(parsed.data)
                        message =
                            errorData.message ||
                            errorData.error ||
                            parsed.data
                    } catch {}

                    throw new Error(message)
                }

                if (parsed.event === 'result') {
                    try {
                        return JSON.parse(parsed.data)
                    } catch {
                        throw new Error(
                            'Gagal memparsing hasil preset AMFinder.'
                        )
                    }
                }
            }
        }

        buffer += decoder.decode()

        // Proses blok terakhir jika server tidak mengirim pemisah
        if (buffer.trim()) {
            const parsed = parseSSEBlock(buffer)

            if (parsed.data) {
                if (parsed.event === 'error') {
                    let message = parsed.data

                    try {
                        const errorData = JSON.parse(parsed.data)
                        message =
                            errorData.message ||
                            errorData.error ||
                            parsed.data
                    } catch {}

                    throw new Error(message)
                }

                if (parsed.event === 'result') {
                    try {
                        return JSON.parse(parsed.data)
                    } catch {
                        throw new Error(
                            'Gagal memparsing hasil preset AMFinder.'
                        )
                    }
                }

                // Fallback jika server mengirim JSON biasa
                try {
                    return JSON.parse(buffer.trim())
                } catch {}
            } else {
                try {
                    return JSON.parse(buffer.trim())
                } catch {}
            }
        }

        throw new Error(
            'Tidak menerima hasil preset dari AMFinder.'
        )
    } finally {
        try {
            await reader.cancel()
        } catch {}
    }
}

// ================== SCRAPER ==================

async function findAmPresets(targetUrl) {
    if (!targetUrl || typeof targetUrl !== 'string') {
        throw new Error('URL video TikTok wajib disertakan.')
    }

    const cleanUrl = targetUrl.trim()

    let parsedUrl

    try {
        parsedUrl = new URL(cleanUrl)
    } catch {
        throw new Error('Format URL tidak valid.')
    }

    if (
        !/^https?:$/.test(parsedUrl.protocol) ||
        !/(^|\.)tiktok\.com$/i.test(parsedUrl.hostname)
    ) {
        throw new Error(
            'URL yang dimasukkan bukan tautan TikTok yang valid.'
        )
    }

    const controller = new AbortController()

    const timer = setTimeout(() => {
        controller.abort()
    }, TIMEOUT_MS)

    try {
        // 1. Meminta challenge
        const challenge = await requestJson(
            CHALLENGE_ENDPOINT,
            { did: DID },
            controller.signal
        )

        const { cid, salt, ts, rounds } = challenge || {}

        if (!cid || !salt || ts == null) {
            throw new Error(
                'Data challenge AMFinder tidak lengkap.'
            )
        }

        // 2. Menghitung proof HMAC-SHA256
        const messageToSign = `${cid}|${DID}|${ts}`

        const proof = await computeProof(
            salt,
            messageToSign,
            rounds
        )

        // 3. Memverifikasi challenge dan mengambil token
        const verification = await requestJson(
            CHALLENGE_ENDPOINT,
            {
                cid,
                did: DID,
                ts,
                proof,
                score: 0,
                reasons: []
            },
            controller.signal
        )

        const token = verification?.token

        if (!token) {
            throw new Error(
                'Gagal mendapatkan token valid dari AMFinder.'
            )
        }

        // 4. Mengirim URL TikTok ke endpoint pencarian
        const params = new URLSearchParams({
            url: cleanUrl,
            bat: '88',
            chg: '0',
            t: token
        })

        const response = await fetch(
            `${ENDPOINT}?${params.toString()}`,
            {
                method: 'GET',
                signal: controller.signal,
                headers: {
                    ...HEADERS,
                    Accept: 'text/event-stream'
                }
            }
        )

        if (!response.ok) {
            throw new Error(
                `Gagal menghubungi AMFinder (HTTP ${response.status}).`
            )
        }

        // 5. Membaca hasil SSE
        const finalResult = await readSSE(
            response,
            controller.signal
        )

        if (!finalResult) {
            throw new Error(
                'Tidak menerima data preset dari AMFinder.'
            )
        }

        if (finalResult.ok === false) {
            throw new Error(
                finalResult.error ||
                finalResult.message ||
                'Gagal memproses video TikTok ini.'
            )
        }

        const presetLinks = (
            Array.isArray(finalResult.presetLinks)
                ? finalResult.presetLinks
                : []
        ).map(p => ({
            type: p.type || '5mb',
            url: p.url || '',
            title:
                p.title ||
                (p.type === 'xml' ? 'XML file' : '5MB preset'),
            size: p.size || null,
            pinned: Boolean(p.pinned),
            byAuthor: Boolean(p.byAuthor),
            detail: p.detail || null
        })).filter(p => p.url)

        return {
            found: Boolean(finalResult.found) &&
                presetLinks.length > 0,
            totalPresets: presetLinks.length,
            author: finalResult.author || '',
            videoUrl: finalResult.videoUrl || cleanUrl,
            presetLinks,
            message: finalResult.message || ''
        }
    } catch (error) {
        if (error.name === 'AbortError') {
            throw new Error(
                'Server AMFinder terlalu lama merespons (timeout 90 detik).'
            )
        }

        throw error
    } finally {
        clearTimeout(timer)
    }
}

// ================== HANDLER ==================

const handler = async (m, { sock: conn, text, prefix }) => {
    const p = prefix || '.'

    // Ambil URL dari argumen atau pesan yang di-reply
    const pick = value => {
        const match = String(value || '').match(
            /https?:\/\/[^\s<>"']+/i
        )

        if (!match) return ''

        const candidate = match[0].replace(/[),.!?]+$/, '')

        try {
            const url = new URL(candidate)

            if (
                /^https?:$/.test(url.protocol) &&
                /(^|\.)tiktok\.com$/i.test(url.hostname)
            ) {
                return candidate
            }
        } catch {}

        return ''
    }

    const quotedText =
        m.quoted?.text ||
        m.quoted?.body ||
        ''

    const url =
        pick(text) ||
        pick(quotedText)

    if (!url) {
        return conn.sendMessage(
            m.chat,
            {
                text:
                    `🔎 *AMFinder - Alight Motion Preset Finder*\n\n` +
                    `Cari link preset Alight Motion (5MB & XML) dari video TikTok.\n\n` +
                    `*Cara pakai:*\n${p}amfinder <link tiktok>\n\n` +
                    `*Contoh:*\n${p}amfinder https://vt.tiktok.com/ZS6e6k5jF/\n\n` +
                    `_Bisa juga reply pesan yang berisi link TikTok._`
            },
            { quoted: m }
        )
    }

    await react(conn, m, '⏳')

    await conn.sendMessage(
        m.chat,
        {
            text:
                '🔎 *Memindai preset Alight Motion...*\n' +
                '_Memverifikasi challenge dan memproses video TikTok. Mohon tunggu._'
        },
        { quoted: m }
    )

    try {
        const res = await findAmPresets(url)

        if (!res.found) {
            await react(conn, m, '❌')

            return conn.sendMessage(
                m.chat,
                {
                    text:
                        `❌ *Preset tidak ditemukan.*\n\n` +
                        (res.author
                            ? `👤 Kreator: ${res.author}\n`
                            : '') +
                        (res.message
                            ? `📝 ${res.message}`
                            : 'Kreator belum menaruh link preset di video ini.')
                },
                { quoted: m }
            )
        }

        const shown = res.presetLinks.slice(0, MAX_SHOW)

        let out =
            `✅ *Preset Ditemukan!* (${res.totalPresets})\n`

        if (res.author) {
            out += `👤 Kreator: ${res.author}\n`
        }

        out += '─────────────────────\n'

        shown.forEach((pr, i) => {
            out += `\n*#${i + 1}* [${pr.type.toUpperCase()}] ${pr.title}\n`

            if (pr.size) {
                out += `📦 ${pr.size}\n`
            }

            if (pr.pinned) {
                out += '📌 Pinned\n'
            }

            if (pr.byAuthor) {
                out += '✍️ Dari kreator\n'
            }

            if (pr.detail) {
                out += `📝 ${pr.detail}\n`
            }

            out += `🔗 ${pr.url}\n`
        })

        if (res.totalPresets > MAX_SHOW) {
            out +=
                `\n_+${res.totalPresets - MAX_SHOW} preset lainnya tidak ditampilkan._`
        }

        await conn.sendMessage(
            m.chat,
            {
                text: out.trim()
            },
            { quoted: m }
        )

        await react(conn, m, '✅')
    } catch (err) {
        console.error('[AMFINDER]', err.message)

        await react(conn, m, '❌')

        await conn.sendMessage(
            m.chat,
            {
                text: `❌ *Gagal:* ${err.message}`
            },
            { quoted: m }
        )
    }
}

handler.command = ['amfinder']
handler.tags = ['alightmotion']

export default handler
