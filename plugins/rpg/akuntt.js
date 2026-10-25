import { adapt } from '../../lib/plugin-engine.js'
let handler = async (m) => {
    let who = m.sender;
    const user = global.db.data.users[who];

    if (!user.tiktok || !user.tiktok.username) {
        return m.reply('❌ Anda belum memiliki akun TikTok! Gunakan perintah *.creatett <username>* untuk membuat akun.');
    }

    const { username, followers = 0, likes = 0, views = 0 } = user.tiktok;

    m.reply(`
📱 **Profil TikTok Anda** 📱

🔹 **Username**: ${username}
⭐ **Followers**: ${followers}
❤️ **Likes**: ${likes}
👁️ **Views**: ${views}

Gunakan perintah *.livett <judul>* untuk memulai siaran langsung.
    `.trim());
};

handler.help = ['akuntt'];
handler.tags = ['rpg'];
handler.command = /^(akuntiktok|akuntiktokprofile|akuntt)$/i;

export default adapt(handler, { category: 'rpg' })