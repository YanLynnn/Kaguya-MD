import { runGame } from '../../lib/plugin-engine.js'

const handler = (m, ctx) => runGame('tebakbendera', m, ctx)

handler.tags = ['game']
handler.command = ['tebakbendera']

export default handler
