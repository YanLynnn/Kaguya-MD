import { runGame } from '../../lib/plugin-engine.js'

const handler = (m, ctx) => runGame('tebakanml', m, ctx)

handler.tags = ['game']
handler.command = ['tebakanml']

export default handler
