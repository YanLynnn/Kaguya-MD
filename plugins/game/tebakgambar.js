import { runGame } from '../../lib/plugin-engine.js'

const handler = (m, ctx) => runGame('tebakgambar', m, ctx)

handler.tags = ['game']
handler.command = ['tebakgambar']

export default handler
