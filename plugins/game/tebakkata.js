import { runGame } from '../../lib/plugin-engine.js'

const handler = (m, ctx) => runGame('tebakkata', m, ctx)

handler.tags = ['game']
handler.command = ['tebakkata']

export default handler
