// Deploy ke Vercel langsung dari chat (khusus owner).
//   .deployvercel <nama>   kirim / reply file .html atau .zip -> online di https://<nama>.vercel.app
//   .redeployvercel <nama> deploy ulang versi terakhir (dipakai setelah ubah env)
//   .envvercel <nama> KEY=VALUE   (boleh banyak baris) set environment variable project
//   .listvercel            daftar project
//   .delvercel <nama> ya   hapus project
//   .adddomain <proyek> <domain>          pasang domain (contoh: toko.com atau shop.toko.com)
//   .addsub <proyek> <sub> <domain>       pasang subdomain (contoh: .addsub toko shop toko.com)
//   .listdomain <proyek>                  daftar domain project
//   .cekdomain <proyek> <domain>          verifikasi + cek DNS
//   .gantidomain <proyek> <lama> <baru>   ganti domain lama dengan yang baru
//   .deldomain <proyek> <domain>          lepas domain dari project
import AdmZip from 'adm-zip'
import { isType, mediaNode } from '../../lib/core-system.js'

const API = 'https://api.vercel.com'
const MAX_TOTAL = 40 * 1024 * 1024 // total isi deploy (setelah ekstrak)
const MAX_FILES = 1500
const SKIP = /(^|\/)(node_modules|\.git|__MACOSX|\.vercel)(\/|$)|(^|\/)\.DS_Store$|(^|\/)\.env(\.(local|production|development))?$/i
const sleep = (ms) => new Promise(r => setTimeout(r, ms))

async function api(path, { method = 'GET', body } = {}) {
    const c = global.vercel || {}
    if (!c.token) throw new Error('global.vercel.token belum diisi di config.js')
    const url = new URL(API + path)
    if (c.teamId) url.searchParams.set('teamId', c.teamId)
    const res = await fetch(url, {
        method,
        headers: { Authorization: `Bearer ${c.token}`, 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(120000)
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.error?.message || `Vercel HTTP ${res.status}`)
    return data
}

// nama project Vercel: huruf kecil, angka, . _ - (tanpa "---"), maks 100
const slug = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/-{3,}/g, '--').replace(/^[-.]+|[-.]+$/g, '').slice(0, 52)

function collectFiles(buf, fileName = '', mimetype = '') {
    const isZip = /\.zip$/i.test(fileName) || /zip/i.test(mimetype) || (buf[0] === 0x50 && buf[1] === 0x4b)
    if (!isZip) {
        const name = /\.html?$/i.test(fileName) || !fileName ? 'index.html' : fileName.replace(/[\\/]/g, '_')
        return [{ file: name, data: buf.toString('base64'), encoding: 'base64' }]
    }
    const entries = new AdmZip(buf).getEntries().filter(e => !e.isDirectory)
    let names = entries.map(e => e.entryName.replace(/\\/g, '/'))
    if (names.some(n => n.startsWith('/') || n.split('/').includes('..'))) throw new Error('Zip berisi path berbahaya, ditolak.')
    // zip dari "Compress folder" biasanya punya satu folder induk: buang supaya index.html ada di root
    const roots = new Set(names.map(n => n.split('/')[0]))
    const strip = roots.size === 1 && names.every(n => n.includes('/'))
    const out = []
    let total = 0
    entries.forEach((e, i) => {
        const rel = strip ? names[i].split('/').slice(1).join('/') : names[i]
        if (!rel || SKIP.test(rel)) return
        total += e.header.size
        if (total > MAX_TOTAL) throw new Error('Isi zip terlalu besar (maks 40 MB setelah diekstrak).')
        out.push({ file: rel, data: e.getData().toString('base64'), encoding: 'base64' })
    })
    if (!out.length) throw new Error('Zip kosong.')
    if (out.length > MAX_FILES) throw new Error(`Terlalu banyak file (${out.length}, maks ${MAX_FILES}).`)
    return out
}

async function waitReady(id) {
    for (let i = 0; i < 60; i++) { // maks ~3 menit
        const d = await api(`/v13/deployments/${id}`)
        if (d.readyState === 'READY') return d
        if (d.readyState === 'ERROR' || d.readyState === 'CANCELED') throw new Error(`Deploy ${d.readyState}: ${d.errorMessage || 'cek log build di dashboard Vercel'}`)
        await sleep(3000)
    }
    throw new Error('Deploy belum selesai setelah 3 menit, cek dashboard Vercel.')
}

const siteUrl = (d, name) => {
    const alias = (d.alias || []).filter(a => a.endsWith('.vercel.app')).sort((a, b) => a.length - b.length)[0]
    return `https://${alias || d.url || name + '.vercel.app'}`
}

const DOMAIN_RE = /^(?=.{4,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/
const cleanDomain = (s) => String(s || '').toLowerCase().trim().replace(/^https?:\/\//, '').replace(/[\/?#].*$/, '').replace(/\.$/, '')
const pj = (s) => encodeURIComponent(slug(s))
const dj = (s) => encodeURIComponent(s)

// petunjuk DNS: apex -> A record, subdomain -> CNAME (+ TXT kalau domain belum terverifikasi)
async function dnsText(domain, info = {}) {
    const apexName = info.apexName || domain.split('.').slice(-2).join('.')
    const isApex = apexName === domain
    const c = await api(`/v6/domains/${dj(domain)}/config`).catch(() => null)
    const cname = c?.recommendedCNAME?.[0]?.value || 'cname.vercel-dns.com'
    const ip = [].concat(c?.recommendedIPv4?.[0]?.value || '76.76.21.21')[0]
    const host = isApex ? '@' : domain.slice(0, -(apexName.length + 1))
    let t = '📌 *Atur DNS di tempat domain kamu dibeli:*\n' + (isApex ? `A      @   →  ${ip}\nCNAME  www →  ${cname}` : `CNAME  ${host}  →  ${cname}`)
    if (info.verified === false && info.verification?.length) {
        t += '\n\n🔐 *Verifikasi kepemilikan (wajib):*\n' + info.verification.map(v => `${v.type}  ${v.domain}  →  ${v.value}`).join('\n')
    }
    return t + '\n\nDNS butuh beberapa menit sampai jam untuk aktif.'
}

let handler = async (m, { sock, jid, text = '', command, prefix, reply, example }) => {
    const p0 = prefix || '.'
    const arg = text.trim()
    const progress = await reply('⏳ Memproses...').catch(() => null)
    const upd = (t) => (progress?.key ? sock.sendMessage(jid, { text: t, edit: progress.key }).catch(() => reply(t)) : reply(t))

    try {
        if (command === 'listvercel') {
            const { projects = [] } = await api('/v9/projects?limit=30')
            if (!projects.length) return upd('Belum ada project di akun Vercel ini.')
            return upd('▲ *PROJECT VERCEL*\n\n' + projects.map((p, i) => `${i + 1}. ${p.name}\n   https://${p.targets?.production?.alias?.[0] || p.name + '.vercel.app'}`).join('\n'))
        }

        if (command === 'delvercel') {
            const [name, ok] = arg.split(/\s+/)
            if (!name) return upd(`Contoh: ${p0}delvercel namaproject ya`)
            if (!/^(ya|yes|y)$/i.test(ok || '')) return upd(`Menghapus project tidak bisa dibatalkan.\nKetik: ${p0}delvercel ${name} ya`)
            await api(`/v9/projects/${encodeURIComponent(name)}`, { method: 'DELETE' })
            return upd(`🗑️ Project ${name} dihapus.`)
        }

        if (command === 'envvercel') {
            const [name, ...rest] = arg.split('\n')[0].split(/\s+/).concat(arg.split('\n').slice(1))
            const lines = rest.join('\n').split('\n').map(l => l.trim()).filter(l => /^[A-Za-z_][A-Za-z0-9_]*=/.test(l))
            if (!name || !lines.length) return upd(`Contoh:\n${p0}envvercel namaproject\nGOPAY_EMAIL=a@b.com\nINTERNAL_TOKEN=rahasia\n\n(project harus sudah pernah di-deploy. Pakai di chat pribadi, lalu redeploy.)`)
            const body = lines.map(l => { const i = l.indexOf('='); return { key: l.slice(0, i), value: l.slice(i + 1).replace(/^["']|["']$/g, ''), type: 'encrypted', target: ['production', 'preview', 'development'] } })
            await api(`/v10/projects/${encodeURIComponent(name)}/env?upsert=true`, { method: 'POST', body })
            return upd(`✅ ${body.length} env diset di ${name}: ${body.map(b => b.key).join(', ')}\nJalankan ${p0}redeployvercel ${name} supaya berlaku.`)
        }

        if (command === 'redeployvercel') {
            if (!arg) return upd(`Contoh: ${p0}redeployvercel namaproject`)
            const name = slug(arg.split(/\s+/)[0])
            const { deployments = [] } = await api(`/v6/deployments?app=${encodeURIComponent(name)}&limit=1&target=production`)
            if (!deployments[0]) return upd('Belum ada deployment produksi untuk project itu.')
            const d = await api('/v13/deployments?forceNew=1', { method: 'POST', body: { name, deploymentId: deployments[0].uid, target: 'production' } })
            await upd('🚀 Redeploy berjalan, menunggu build...')
            const done = await waitReady(d.id)
            return upd(`✅ *REDEPLOY SELESAI*\n${siteUrl(done, name)}`)
        }

        // ───── domain & subdomain ─────
        if (['adddomain', 'addsub', 'listdomain', 'cekdomain', 'deldomain', 'gantidomain'].includes(command)) {
            const [proj, a, b] = arg.split(/\s+/)
            const usage = {
                adddomain: `${p0}adddomain namaproject domain.com`,
                addsub: `${p0}addsub namaproject sub domain.com`,
                listdomain: `${p0}listdomain namaproject`,
                cekdomain: `${p0}cekdomain namaproject domain.com`,
                deldomain: `${p0}deldomain namaproject domain.com`,
                gantidomain: `${p0}gantidomain namaproject domainlama.com domainbaru.com`
            }[command]
            if (!proj) return upd(`Contoh: ${usage}`)

            if (command === 'listdomain') {
                const { domains = [] } = await api(`/v9/projects/${pj(proj)}/domains`)
                if (!domains.length) return upd(`Project ${proj} belum punya domain.`)
                return upd(`🌐 *DOMAIN ${slug(proj)}*\n\n` + domains.map(d => `${d.verified ? '✅' : '⏳'} ${d.name}${d.redirect ? ` → ${d.redirect}` : ''}`).join('\n'))
            }

            if (command === 'adddomain' || command === 'addsub') {
                const domain = cleanDomain(b ? `${a}.${b}` : a) // dua argumen = sub + domain utama
                if (!DOMAIN_RE.test(domain)) return upd(`Domain tidak valid.\nContoh: ${usage}`)
                const info = await api(`/v10/projects/${pj(proj)}/domains`, { method: 'POST', body: { name: domain } })
                return upd(`✅ *${domain}* ditambahkan ke ${slug(proj)}\n\n${await dnsText(domain, info)}\n\nSetelah DNS diset: ${p0}cekdomain ${slug(proj)} ${domain}`)
            }

            const domain = cleanDomain(a)
            if (!DOMAIN_RE.test(domain)) return upd(`Domain tidak valid.\nContoh: ${usage}`)

            if (command === 'cekdomain') {
                await api(`/v9/projects/${pj(proj)}/domains/${dj(domain)}/verify`, { method: 'POST' }).catch(() => null)
                const info = await api(`/v9/projects/${pj(proj)}/domains/${dj(domain)}`)
                const c = await api(`/v6/domains/${dj(domain)}/config`).catch(() => null)
                if (info.verified && c && !c.misconfigured) return upd(`✅ ${domain} aktif dan DNS sudah benar.\nhttps://${domain}`)
                return upd(`⏳ ${domain} belum siap (${info.verified ? 'DNS belum mengarah ke Vercel' : 'belum terverifikasi'}).\n\n${await dnsText(domain, info)}`)
            }

            if (command === 'deldomain') {
                await api(`/v9/projects/${pj(proj)}/domains/${dj(domain)}`, { method: 'DELETE' })
                return upd(`🗑️ ${domain} dilepas dari ${slug(proj)}.`)
            }

            if (command === 'gantidomain') {
                const baru = cleanDomain(b)
                if (!DOMAIN_RE.test(baru)) return upd(`Contoh: ${usage}`)
                // tambah yang baru dulu, baru lepas yang lama, supaya situs tidak sempat tanpa domain
                const info = await api(`/v10/projects/${pj(proj)}/domains`, { method: 'POST', body: { name: baru } })
                await api(`/v9/projects/${pj(proj)}/domains/${dj(domain)}`, { method: 'DELETE' }).catch(() => null)
                return upd(`🔁 ${domain} diganti ke *${baru}*\n\n${await dnsText(baru, info)}`)
            }
        }

        // ───── deploy file ─────
        const type = ['documentMessage'].find(t => isType(m, t))
        const media = type && mediaNode(m, type)
        if (!media?.download) return upd(`Kirim atau reply file *.html* / *.zip* dengan caption:\n${p0}${command} namaproject\n\nZip boleh berisi site statis atau project Node (folder api/, package.json, vercel.json).`)

        const fileName = media.node.fileName || media.node.title || ''
        const name = slug(arg.split(/\s+/)[0] || fileName.replace(/\.[a-z0-9]+$/i, '')) || 'lynnx-' + Date.now().toString(36)
        const buf = await media.download()
        if (!buf?.length) throw new Error('File gagal diunduh.')

        const files = collectFiles(buf, fileName, media.node.mimetype)
        await upd(`⬆️ Upload ${files.length} file ke Vercel (${name})...`)
        const dep = await api('/v13/deployments?skipAutoDetectionConfirmation=1', {
            method: 'POST',
            body: { name, files, target: 'production', projectSettings: { framework: null } }
        })
        await upd('🔨 Build berjalan, menunggu selesai...')
        const done = await waitReady(dep.id)
        return upd(`✅ *DEPLOY BERHASIL*\n\nProject : ${name}\nFile    : ${files.length}\nURL     : ${siteUrl(done, name)}\n\nKalau project butuh env, set dengan ${p0}envvercel lalu ${p0}redeployvercel ${name}`)
    } catch (e) {
        return upd(`❌ Gagal: ${e.message}`)
    }
}

handler.command = ['deployvercel', 'vercel', 'redeployvercel', 'envvercel', 'listvercel', 'delvercel', 'adddomain', 'addsub', 'listdomain', 'cekdomain', 'deldomain', 'gantidomain']
handler.help = ['deployvercel <nama>', 'redeployvercel <nama>', 'envvercel <nama>', 'listvercel', 'delvercel <nama>', 'adddomain <proyek> <domain>', 'addsub <proyek> <sub> <domain>', 'listdomain <proyek>', 'cekdomain <proyek> <domain>', 'gantidomain <proyek> <lama> <baru>', 'deldomain <proyek> <domain>']
handler.tags = ['vercel']
handler.owner = true

export default handler
