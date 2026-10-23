import { runGame } from '../../lib/plugin-engine.js'

const handler = (m, ctx) => runGame('tebakhewan', m, ctx)

handler.tags = ['game']
handler.command = ['tebakhewan']

export default handler
