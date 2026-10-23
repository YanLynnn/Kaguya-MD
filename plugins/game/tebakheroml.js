import { runGame } from '../../lib/plugin-engine.js'

const handler = (m, ctx) => runGame('tebakheroml', m, ctx)

handler.tags = ['game']
handler.command = ['tebakheroml']

export default handler
