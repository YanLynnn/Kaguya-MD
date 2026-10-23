import { runDadu } from '../../lib/plugin-engine.js'

const handler = (m, ctx) => runDadu(m, ctx)

handler.tags = ['game']
handler.command = ['dadu']

export default handler
