const BASE_URL = 'https://am.zervida.my.id'

const headers = {
    'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Referer': `${BASE_URL}/runtime/preset.html`,
    'Origin': BASE_URL
}

/*
 * Parse metadata XML Alight Motion
 */
function parseAlightXml(xml) {
    if (!xml || typeof xml !== 'string') return null

    const sceneMatch = xml.match(/<scene\s+([^>]+)>/i)

    const metadata = {
        title: 'Untitled Project',
        width: 1080,
        height: 1920,
        exportWidth: 1080,
        exportHeight: 1920,
        fps: 30,
        totalTimeMs: 0,
        durationFormatted: '00:00',
        backgroundColor: '#000000',
        bookmarksCount: 0,
        mediaList: []
    }

    if (sceneMatch) {
        const attrs = sceneMatch[1]

        const getAttr = key => {
            const match = attrs.match(
                new RegExp(`${key}=["']([^"']+)["']`, 'i')
            )

            return match ? match[1] : null
        }

        metadata.title =
            getAttr('title') || metadata.title

        metadata.width =
            parseInt(getAttr('width') || '1080', 10)

        metadata.height =
            parseInt(getAttr('height') || '1920', 10)

        metadata.exportWidth =
            parseInt(
                getAttr('exportWidth') ||
                String(metadata.width),
                10
            )

        metadata.exportHeight =
            parseInt(
                getAttr('exportHeight') ||
                String(metadata.height),
                10
            )

        metadata.fps =
            parseFloat(getAttr('fps') || '30')

        metadata.totalTimeMs =
            parseInt(getAttr('totalTime') || '0', 10)

        metadata.backgroundColor =
            getAttr('bgcolor') || '#000000'

        if (metadata.totalTimeMs > 0) {
            const totalSec =
                Math.floor(metadata.totalTimeMs / 1000)

            const min =
                String(Math.floor(totalSec / 60))
                    .padStart(2, '0')

            const sec =
                String(totalSec % 60)
                    .padStart(2, '0')

            metadata.durationFormatted =
                `${min}:${sec}`
        }
    }

    const bookmarks =
        xml.match(/<bookmark\s+t=["'](\d+)["']/gi) || []

    metadata.bookmarksCount =
        bookmarks.length

    const mediaRegex =
        /<media\s+([^>]+)\/>/gi

    let match

    while ((match = mediaRegex.exec(xml)) !== null) {
        const attrs = match[1]

        const getAttr = key => {
            const m = attrs.match(
                new RegExp(`${key}=["']([^"']+)["']`, 'i')
            )

            return m ? m[1] : null
        }

        metadata.mediaList.push({
            uri: getAttr('uri'),
            filename:
                getAttr('filename') ||
                getAttr('title'),
            type: getAttr('type'),
            width: getAttr('width')
                ? parseInt(getAttr('width'), 10)
                : undefined,
            height: getAttr('height')
                ? parseInt(getAttr('height'), 10)
                : undefined
        })
    }

    return metadata
}


/*
 * Request API
 */
async function api(path, params = {}) {
    const url = new URL(BASE_URL + path)

    for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== null) {
            url.searchParams.set(key, value)
        }
    }

    const res = await fetch(url, {
        headers
    })

    const text = await res.text()

    let data

    try {
        data = JSON.parse(text)
    } catch {
        data = text
    }

    if (!res.ok) {
        throw new Error(
            typeof data === 'object'
                ? data.error || `HTTP ${res.status}`
                : `HTTP ${res.status}`
        )
    }

    return data
}


/*
 * Format metadata
 */
function metadataText(meta) {
    if (!meta) return 'Metadata tidak tersedia.'

    return [
        `╭─「 ALIGHT MOTION 」`,
        `│`,
        `│ Title : ${meta.title}`,
        `│ Size  : ${meta.width}x${meta.height}`,
        `│ Export: ${meta.exportWidth}x${meta.exportHeight}`,
        `│ FPS   : ${meta.fps}`,
        `│ Durasi: ${meta.durationFormatted}`,
        `│ Beat  : ${meta.bookmarksCount}`,
        `│ Media : ${meta.mediaList.length}`,
        `│`,
        `╰──────────────`
    ].join('\n')
}


/*
 * Kirim XML sebagai document
 */
async function sendXml(sock, jid, xml, filename, quoted) {
    const buffer = Buffer.from(xml, 'utf-8')

    await sock.sendMessage(
        jid,
        {
            document: buffer,
            mimetype: 'application/xml',
            fileName: filename
        },
        {
            quoted
        }
    )
}


/*
 * Main handler
 */
let handler = async (m, { sock, text, reply, command }) => {
    try {

        /*
         * LIST PRESET
         */
        if (command === 'amlist') {
            const data = await api('/api/presets')

            const presets = data.presets || []
            const audio = data.audio || []
            const images = data.images || []

            let teks = [
                `╭─「 ALIGHT MOTION PRESET 」`,
                `│`,
                `│ Preset : ${presets.length}`,
                `│ Audio  : ${audio.length}`,
                `│ Images : ${images.length}`,
                `│`
            ]

            if (presets.length) {
                teks.push(`│ PRESET:`)

                presets.forEach((item, i) => {
                    teks.push(
                        `│ ${i + 1}. ${item.name}`
                    )
                })
            }

            teks.push(`│`)
            teks.push(`╰──────────────`)

            return reply(teks.join('\n'))
        }


        /*
         * DOWNLOAD PRESET
         *
         * .ampreset NamaPreset
         */
        if (command === 'ampreset') {
            if (!text) {
                return reply(
                    `Contoh:\n.ampreset Beraksi`
                )
            }

            const cleanName =
                text.trim().endsWith('.xml')
                    ? text.trim()
                    : `${text.trim()}.xml`

            const data = await api(
                `/preset/${encodeURIComponent(cleanName)}`
            )

            const xml = typeof data === 'string'
                ? data
                : data.xml

            if (!xml) {
                throw new Error(
                    'XML preset tidak ditemukan.'
                )
            }

            const meta =
                parseAlightXml(xml)

            await reply(
                metadataText(meta)
            )

            await sendXml(
                sock,
                m.chat,
                xml,
                cleanName,
                m
            )

            return
        }


        /*
         * ALIGHT LINK
         *
         * .amlink https://alight.link/...
         */
        if (command === 'amlink') {
            if (!text) {
                return reply(
                    `Contoh:\n.amlink https://alight.link/xxxxx`
                )
            }

            if (
                !/^(https?:\/\/)?(alight\.link|alightcreative\.com)/i
                    .test(text.trim())
            ) {
                return reply(
                    'Link bukan link Alight Motion yang valid.'
                )
            }

            const data = await api(
                '/api/project-xml',
                {
                    url: text.trim()
                }
            )

            if (data.error) {
                throw new Error(data.error)
            }

            const xml = data.xml

            if (!xml) {
                return reply(
                    'Project XML tidak ditemukan.'
                )
            }

            const meta =
                parseAlightXml(xml)

            await reply(
                [
                    metadataText(meta),
                    '',
                    `Project: ${data.xmlName || 'project.xml'}`
                ].join('\n')
            )

            await sendXml(
                sock,
                m.chat,
                xml,
                data.xmlName || 'project.xml',
                m
            )

            return
        }


        /*
         * GOOGLE DRIVE
         *
         * .amdrive https://drive.google.com/...
         */
        if (command === 'amdrive') {
            if (!text) {
                return reply(
                    `Contoh:\n.amdrive https://drive.google.com/file/d/xxxxx/view`
                )
            }

            const data = await api(
                '/api/drive-xml',
                {
                    url: text.trim()
                }
            )

            if (data.error) {
                throw new Error(data.error)
            }

            const xml = data.xml

            if (!xml) {
                throw new Error(
                    'XML tidak ditemukan dari Google Drive.'
                )
            }

            const meta =
                parseAlightXml(xml)

            const filename =
                data.name || 'drive_preset.xml'

            await reply(
                metadataText(meta)
            )

            await sendXml(
                sock,
                m.chat,
                xml,
                filename,
                m
            )

            return
        }


        /*
         * TIKTOK AUDIO
         *
         * .amtiktok https://www.tiktok.com/...
         */
        if (command === 'amtiktok') {
            if (!text) {
                return reply(
                    `Contoh:\n.amtiktok https://www.tiktok.com/@user/video/xxxxx`
                )
            }

            const data = await api(
                '/api/tiktok',
                {
                    url: text.trim()
                }
            )

            if (data.error) {
                throw new Error(data.error)
            }

            const audioUrl =
                data.media

            if (!audioUrl) {
                throw new Error(
                    'Audio TikTok tidak ditemukan.'
                )
            }

            /*
             * Download audio
             */
            const audioRes =
                await fetch(audioUrl)

            if (!audioRes.ok) {
                throw new Error(
                    'Gagal mengunduh audio TikTok.'
                )
            }

            const audioBuffer =
                Buffer.from(
                    await audioRes.arrayBuffer()
                )

            await sock.sendMessage(
                m.chat,
                {
                    audio: audioBuffer,
                    mimetype: 'audio/mpeg',
                    fileName: 'tiktok-audio.mp3'
                },
                {
                    quoted: m
                }
            )

            return
        }


        /*
         * HELP
         */
        return reply(
            [
                `╭─「 ALIGHT MOTION 」`,
                `│`,
                `│ .amlist`,
                `│ Lihat katalog preset`,
                `│`,
                `│ .ampreset <nama>`,
                `│ Download preset XML`,
                `│`,
                `│ .amlink <url>`,
                `│ Resolver project Alight Motion`,
                `│`,
                `│ .amdrive <url>`,
                `│ Ambil preset dari Google Drive`,
                `│`,
                `│ .amtiktok <url>`,
                `│ Ambil audio TikTok`,
                `│`,
                `╰──────────────`
            ].join('\n')
        )

    } catch (e) {
        console.error('[ALIGHT MOTION]', e)

        return reply(
            `Gagal menjalankan fitur.\n\n${e.message}`
        )
    }
}


/*
 * Commands
 */
handler.command = ['amlist', 'ampreset', 'amlink', 'amdrive', 'amtiktok']

handler.tags = ['alightmotion']
handler.owner = false

export default handler