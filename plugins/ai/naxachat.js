// .naxa <pesan>             chat dengan NaxaChat (mode guest, ingat percakapan ±30 menit)
// .naxa --model <nama> <pesan>   pilih model
// .naxa models              daftar model
// .naxa reset               hapus riwayat obrolan kamu
// Opsional: isi global.naxaSession dengan token sesi NaxaChat untuk akses tanpa batas guest.
const BASE = 'https://www.naxachat.com'
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
const TTL = 30 * 60 * 1000
const MAX_TURNS = 10

const sessions = new Map() // sender -> { history, model, at }

async function getModels(timeout = 10000) {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), timeout)
    try {
        const res = await fetch(`${BASE}/api/chat/models`, {
            headers: { 'User-Agent': UA, Referer: `${BASE}/`, Accept: 'application/json' },
            signal: ctrl.signal
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json()
        return { ok: true, defaultModel: data.defaultModel || 'azure', models: data.models || [] }
    } catch (e) {
        return { ok: false, error: e.name === 'AbortError' ? 'timeout' : e.message }
    } finally {
        clearTimeout(timer)
    }
}

async function naxaChat(prompt, { model = 'azure', history = [], token = null, timeout = 60000 } = {}) {
    const msgs = [...history, { role: 'user', content: prompt }]
    const payload = {
        history: msgs, chatId: null, personaId: null, memoryEnabled: false,
        imageMode: null, imageQuality: null, referenceImage: null, imageMetadata: null,
        image: null, imagePath: null, replyMode: 'text', conversationMode: 'chat', chatModel: model
    }
    const headers = {
        'Content-Type': 'application/json', 'User-Agent': UA, Referer: `${BASE}/`, Origin: BASE,
        Accept: 'text/plain, text/event-stream, */*'
    }
    if (token) headers.Authorization = token.startsWith('Bearer ') ? token : `Bearer ${token}`

    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), timeout)
    try {
        const res = await fetch(`${BASE}/api/chat`, { method: 'POST', headers, body: JSON.stringify(payload), signal: ctrl.signal })
        const tier = res.headers.get('x-naxa-tier') || (token ? 'User' : 'Guest')
        const used = res.headers.get('x-naxa-usage-used')
        const limit = res.headers.get('x-naxa-usage-limit')

        if (!res.ok) {
            let err = {}
            const raw = await res.text().catch(() => '')
            try { err = JSON.parse(raw) } catch { err = { error: raw || `HTTP ${res.status}` } }
            return {
                ok: false, status: res.status, code: err.code || 'REQUEST_FAILED',
                error: err.error || 'Gagal memproses permintaan chat.',
                guestLimit: err.code === 'GUEST_LIMIT_REACHED' || res.status === 429,
                used: err.used ?? used, limit: err.limit ?? limit
            }
        }

        const type = res.headers.get('content-type') || ''
        let reply
        if (type.includes('application/json')) {
            const j = await res.json()
            reply = j.text || j.content || JSON.stringify(j)
        } else {
            reply = await res.text()
        }
        reply = String(reply).trim()
        return {
            ok: true, reply, tier,
            model: res.headers.get('x-naxa-chat-model') || model,
            used: used ? parseInt(used, 10) : null,
            limit: limit ? parseInt(limit, 10) : null,
            history: [...msgs, { role: 'assistant', content: reply }]
        }
    } catch (e) {
        return { ok: false, error: e.name === 'AbortError' ? 'Server NaxaChat tidak merespons (timeout).' : e.message }
    } finally {
        clearTimeout(timer)
    }
}

let handler = async (m, { text, reply, prefix, command }) => {
    const p = prefix || '.'
    let input = String(text || '').trim()
    if (!input) {
        return reply(
            `🤖 *NaxaChat*\n\n` +
            `Contoh:\n• ${p}${command} Halo, siapa kamu?\n• ${p}${command} --model azure jelaskan AI\n` +
            `• ${p}${command} models  (daftar model)\n• ${p}${command} reset  (hapus riwayat)`
        )
    }

    const key = String(m.sender)
    if (/^reset$/i.test(input)) {
        sessions.delete(key)
        return reply('🧹 Riwayat obrolan NaxaChat kamu sudah dihapus.')
    }

    if (/^(models?|model)$/i.test(input)) {
        const r = await getModels()
        if (!r.ok) return reply(`⚠️ Gagal mengambil model: ${r.error}`)
        const list = r.models.map(x => `• ${typeof x === 'string' ? x : (x.id || x.name || x.model || JSON.stringify(x))}`).join('\n') || '(kosong)'
        return reply(`🤖 *Model NaxaChat*\nDefault: *${r.defaultModel}*\n\n${list}`)
    }

    let model = null
    const flag = input.match(/^(?:--model|-m)\s+(\S+)\s*/i)
    if (flag) { model = flag[1]; input = input.slice(flag[0].length).trim() }
    if (!input) return reply('⚠️ Pesannya kosong, tulis pertanyaanmu setelah nama model.')

    let s = sessions.get(key)
    if (!s || Date.now() - s.at > TTL) s = { history: [], model: 'azure', at: Date.now() }
    if (model) s.model = model

    const res = await naxaChat(input, { model: s.model, history: s.history, token: global.naxaSession || null })
    if (!res.ok) {
        if (res.guestLimit) {
            return reply(
                `⚠️ *Kuota guest NaxaChat habis*${res.used != null ? ` (${res.used}/${res.limit})` : ''}\n` +
                `Coba lagi nanti, atau owner bisa mengisi token sesi di global.naxaSession.`
            )
        }
        return reply(`⚠️ ${res.error}`)
    }

    s.history = res.history.slice(-MAX_TURNS * 2)
    s.at = Date.now()
    sessions.set(key, s)
    if (sessions.size > 500) for (const [k, v] of sessions) if (Date.now() - v.at > TTL) sessions.delete(k)

    const foot = res.limit ? `\n\n_${res.tier} • ${res.used ?? '?'}/${res.limit} • model ${res.model}_` : `\n\n_${res.tier} • model ${res.model}_`
    return reply(res.reply + foot)
}

handler.command = ['naxachat', 'naxa']
handler.help = ['naxachat <pesan>']
handler.tags = ['ai']
handler.limit = true

export default handler
