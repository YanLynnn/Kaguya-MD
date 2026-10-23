import { runGame } from '../../lib/plugin-engine.js'

const handler = (m, ctx) => runGame('tebaklagu', m, ctx)

handler.tags = ['game']
handler.command = ['tebaklagu']

export default handler
