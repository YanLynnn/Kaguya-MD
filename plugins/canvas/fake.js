/**

* YannRzy Multi Device — WhatsApp & Tele Bot
* 
* Library      : whiskeysockets baileys
* Type         : Plugins | ESM Modules
* Creator      : YannRzy Tech
* Recode       : (Your Name)
* 
* Official Channels:
* • https://whatsapp.com/channel/0029VaoMGuLA89MbfGh62V16
* 
* Copyright © YannRzy Tech 2026
* All Rights Reserved.
  */



// ───────── fake ─────────
// Gabungan plugin canvas: fakecall, fakedev7, fakegopay, fakeovo
// Port dari RIMURU-MD. Pesan keluar memakai sock.sendMessage / m.reply bawaan WhatsApp (tanpa tombol / kartu custom).

import axios from 'axios'
import FormData from 'form-data'
import * as _canvas from '@napi-rs/canvas'
import { te, wrapPlugin, mergePlugins, defaultAvatar } from '../../lib/plugin-engine.js'
// ── fakecall ──
const _fakecall = (() => {
const pluginConfig = {
    name: ['fakecall', 'fakecall-ios'],
    alias: [],
    category: 'canvas',
    description: 'Membuat gambar fake call WhatsApp (Tersedia versi Android dan iOS)',
    usage: '.fakecall nama | durasi',
    example: '.fakecall Zann | 19:00',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 10,
    energi: 1,
    isEnabled: true
}

async function handler(m, { sock }) {
    const cmd = m.command.toLowerCase()
    const text = m.text

    if (!text || !text.includes('|')) {
        let helpText = `Halo! Sepertinya format yang kamu masukkan kurang tepat.\n\n`
        helpText += `Fitur ini digunakan untuk membuat gambar panggilan palsu (Fake Call) seolah-olah seseorang sedang meneleponmu secara langsung.\n\n`
        helpText += `*Daftar Perintah yang Tersedia:*\n`
        helpText += `- *${m.prefix}fakecall* (Untuk tampilan panggilan Android)\n`
        helpText += `- *${m.prefix}fakecall-ios* (Untuk tampilan panggilan iPhone atau iOS)\n\n`
        helpText += `*Cara Penggunaan:*\n`
        helpText += `Ketik perintah diikuti dengan *Nama* dan *Durasi* yang dipisahkan oleh tanda pipa (|).\n\n`
        helpText += `*Contoh Penggunaan:*\n`
        helpText += `- *${m.prefix}fakecall Zann | 03:33:33*\n`
        helpText += `- *${m.prefix}fakecall-ios Sayangku | 12:00:00*\n\n`
        helpText += `*Tips Tambahan:*\n`
        helpText += `Kamu bisa me-reply (membalas) sebuah gambar jika ingin menggunakan foto tersebut sebagai avatar profil sang penelepon!`
        
        return m.reply(helpText)
    }

    const [nama, durasi] = text.split('|').map(s => s.trim())

    if (!nama) {
        return m.reply(`Maaf, nama penelepon tidak boleh dikosongkan. Silakan isi namanya terlebih dahulu!`)
    }

    if (!durasi) {
        return m.reply(`Maaf, durasi panggilan tidak boleh dikosongkan. Silakan isi durasinya terlebih dahulu!`)
    }

    await m.react('🕕')

    try {
        let bufferBase
        
        if (m.isImage) {
            try {
                bufferBase = await m.download()
            } catch (err) {}
        } else if (m.quoted?.isImage) {
            try {
                bufferBase = await m.quoted.download()
            } catch (err) {}
        }

        if (!bufferBase) {
            try {
                const ppUrl = await sock.profilePictureUrl(m.sender, 'image')
                const res = await axios.get(ppUrl, { responseType: 'arraybuffer' })
                bufferBase = Buffer.from(res.data)
            } catch (err) {
                const res = await axios.get('https://files.catbox.moe/nwvkbt.png', { responseType: 'arraybuffer' })
                bufferBase = Buffer.from(res.data)
            }
        }

        const form = new FormData()
        form.append('avatarUrl', bufferBase, { filename: 'avatar.jpg', contentType: 'image/jpeg' })
        form.append('name', nama)
        form.append('duration', durasi)

        let endpoint = 'fakecall-android'
        if (cmd === 'fakecall-ios') {
            endpoint = 'fakecall-ios'
        }

        const apiUrl = `https://my.izuka-api.xyz/api/canvas/${endpoint}`

        const response = await axios.post(apiUrl, form, {
            headers: form.getHeaders(),
            responseType: 'arraybuffer'
        })

        await sock.sendMessage(m.chat, { image: Buffer.from(response.data) }, { quoted: m })

        await m.react('📞')

    } catch (err) {
        await m.react('☢')
        return m.reply(te(m.prefix, m.command, m.pushName))
    }
}

  return wrapPlugin(pluginConfig, handler)
})()

// ── fakedev7 ──
const _fakedev7 = (() => {
const pluginConfig = {
  name: "fakedev7",
  alias: [],
  category: "canvas",
  description: "Membuat fake developer (Python Theme)",
  usage: ".fakedev7 <nama> (reply/kirim foto)",
  example: ".fakedev7 Misaki",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 10,
  energi: 1,
  isEnabled: true,
};

async function handler(m, { sock }) {
  const name = m.text?.trim();
  if (!name) {
    return m.reply(`🎮 *ꜰᴀᴋᴇ ᴅᴇᴠᴇʟᴏᴘᴇʀ 7*\n\n> Masukkan nama untuk profile\n\n*ᴄᴀʀᴀ ᴘᴀᴋᴀɪ:*\n> 1. Kirim foto + caption \`${m.prefix}fakedev7 <nama>\`\n> 2. Reply foto dengan \`${m.prefix}fakedev7 <nama>\``);
  }
  let buffer = null;
  if (m.quoted && (m.quoted.type === "imageMessage" || m.quoted.mtype === "imageMessage")) {
    try { buffer = await m.quoted.download(); } catch (e) { return m.reply(te(m.prefix, m.command, m.pushName)); }
  } else if (m.isMedia && m.type === "imageMessage") {
    try { buffer = await m.download(); } catch (e) { return m.reply(te(m.prefix, m.command, m.pushName)); }
  } else {
    try {
      let teUrl = await sock.profilePictureUrl(m.sender, "image");
      buffer = Buffer.from((await axios.get(teUrl, { responseType: "arraybuffer" })).data);
    } catch (error) {
      buffer = defaultAvatar();
    }
  }
  if (!buffer) return m.reply(`❌ Kirim/reply gambar untuk dijadikan avatar!`);
  
  m.react("🕕");

  try {
    const userImage = await _canvas.loadImage(buffer);
    const blueTick = await _canvas.loadImage("https://raw.githubusercontent.com/kayzzaoshi-code/Uploader/main/file_1772220719294.jpeg");
    const crown = await _canvas.loadImage("https://cdn3.emoji.gg/emojis/3043_Crown.png").catch(() => null);
    const leaf = await _canvas.loadImage("https://cdn3.emoji.gg/emojis/6401-leaf.png").catch(() => null);

    const canvas = _canvas.createCanvas(1080, 1080);
    const ctx = canvas.getContext("2d");

    // ==========================================
    // 1. Draw Python Theme Background
    // ==========================================
    ctx.fillStyle = "#1e1e24"; // dark slate
    ctx.fillRect(0, 0, 1080, 1080);
    
    ctx.font = "bold 22px 'Consolas', monospace";
    const colors = ["#ffcc00", "#6699cc", "#c594c5", "#99c794", "#fac863"];
    const codeLines = [
        "import numpy as np",
        "import pandas as pd",
        "def analyze_data(dataset):",
        "    if dataset is None:",
        "        raise ValueError('No data!')",
        "    results = np.mean(dataset, axis=0)",
        "    return results",
        "class Developer:",
        "    def __init__(self, name):",
        "        self.name = name",
        "    def code(self):",
        "        print(f'{self.name} is coding...')",
        "if __name__ == '__main__':",
        "    main()"
    ];
    
    ctx.globalAlpha = 0.6;
    for (let y = 40; y < 1080; y += 40) {
        for (let x = 20; x < 1080; x += 450) {
            const line = codeLines[Math.floor(Math.random() * codeLines.length)];
            let drawX = x;
            const words = line.split(" ");
            for (let word of words) {
                ctx.fillStyle = colors[Math.floor(Math.random() * colors.length)];
                ctx.fillText(word + " ", drawX, y);
                drawX += ctx.measureText(word + " ").width;
            }
        }
    }
    const grad = ctx.createRadialGradient(540, 540, 200, 540, 540, 800);
    grad.addColorStop(0, "rgba(0,0,0,0)");
    grad.addColorStop(1, "rgba(0,0,0,0.8)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1080, 1080);
    ctx.globalAlpha = 1.0;

    // ==========================================
    // 2. Draw Avatar & Badges (Standard Layout)
    // ==========================================
    const centerX = 540;
    const centerY = 540;
    const radius = 263;

    ctx.save();
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    const aspect = userImage.width / userImage.height;
    let sw = userImage.width, sh = userImage.height, sx = 0, sy = 0;
    if (aspect > 1) { sw = userImage.height; sx = (userImage.width - sw) / 2; } 
    else { sh = userImage.width; sy = (userImage.height - sh) / 2; }
    ctx.drawImage(userImage, sx, sy, sw, sh, centerX - radius, centerY - radius, radius * 2, radius * 2);
    ctx.restore();

    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 15;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.font = "bold 80px 'Segoe UI', Arial";
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    const textRadius = radius + 85;
    const chars = name.toUpperCase().split("");
    const arcSpan = Math.PI * 0.6;
    const n = chars.length;
    const angleIncrement = n > 1 ? arcSpan / (n - 1) : 0;
    const start = Math.PI / 2 + arcSpan / 2;

    for (let i = 0; i < n; i++) {
      const angle = start - i * angleIncrement;
      const tx = centerX + Math.cos(angle) * textRadius;
      const ty = centerY + Math.sin(angle) * textRadius;
      ctx.save();
      ctx.translate(tx, ty);
      ctx.rotate(angle - Math.PI / 2);
      ctx.strokeStyle = "#000";
      ctx.lineWidth = 4;
      ctx.strokeText(chars[i], 0, 0);
      ctx.fillText(chars[i], 0, 0);
      ctx.restore();
    }

    ctx.drawImage(blueTick, centerX + radius + 10, centerY - 35, 70, 70);
    
    if (crown) {
        ctx.save();
        ctx.translate(centerX + radius * 0.7, centerY - radius * 0.8);
        ctx.rotate(0.3);
        ctx.drawImage(crown, -70, -70, 140, 140);
        ctx.restore();
    }
    
    if (leaf) {
        ctx.save();
        ctx.translate(centerX - radius * 0.6, centerY - radius * 0.7);
        ctx.rotate(-0.5);
        ctx.drawImage(leaf, -50, -50, 100, 100);
        ctx.restore();
    }

    const finalBuffer = await canvas.encode("png");
    await sock.sendMessage(m.chat, { image: finalBuffer }, { quoted: m });
    m.react("✅");
  } catch (error) {
    m.react("❌");
    m.reply(`❌ Terjadi kesalahan saat memproses gambar.`);
  }
}

  return wrapPlugin(pluginConfig, handler)
})()

// ── fakegopay ──
const _fakegopay = (() => {
const pluginConfig = {
    name: "fakegopay",
    alias: [],
    category: "canvas",
    description: "Membuat canvas fake gopay",
    usage: ".fakegopay <saldo>|<coin>|<terpakai>|<bulan>",
    example: ".fakegopay 100000|500|20000|Januari",
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 5,
    energi: 2,
    isEnabled: true,
};

async function handler(m, { sock, text }) {
    if (!text) return m.reply(`Format salah!\n\n> Contoh: .fakegopay 100000|500|20000|Januari`);
    const [saldo, coin, terpakai, bulan] = text.split("|").map(v => v.trim());
    if (!saldo || !coin || !terpakai || !bulan) return m.reply(`Pastikan semua argumen diisi dengan benar, dipisah dengan tanda |.`);
    
    await m.react("🕕");
    try {
        const url = `https://kyzznekoo.zone.id/api/canvas/fakegopay?saldo=${encodeURIComponent(saldo)}&coin=${encodeURIComponent(coin)}&terpakai=${encodeURIComponent(terpakai)}&bulan=${encodeURIComponent(bulan)}`;
        const res = await axios.get(url, {
            responseType: 'arraybuffer',
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36",
                "Content-Type": "application/json"
            }
        });
        await sock.sendMessage(m.chat, { image: Buffer.from(res.data), caption: "✅ Berhasil membuat fake gopay" }, { quoted: m });
        await m.react("✅");
    } catch (e) {
        console.error("[FakeGopay Error]", e);
        await m.react("❌");
        m.reply(te(m.prefix, m.command, m.pushName));
    }
}

  return wrapPlugin(pluginConfig, handler)
})()

// ── fakeovo ──
const _fakeovo = (() => {
const pluginConfig = {
    name: "fakeovo",
    alias: [],
    category: "canvas",
    description: "Membuat canvas fake ovo",
    usage: ".fakeovo <nama>",
    example: ".fakeovo Jokowi",
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 5,
    energi: 2,
    isEnabled: true,
};

async function handler(m, { sock, text }) {
    if (!text) return m.reply(`Format salah!\n\n> Contoh: .fakeovo Budi`);
    
    await m.react("🕕");
    try {
        const url = `https://kyzznekoo.zone.id/api/canvas/fake-ovo?q=${encodeURIComponent(text)}`;
        const res = await axios.get(url, {
            responseType: 'arraybuffer',
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36",
                "Content-Type": "application/json"
            }
        });
        await sock.sendMessage(m.chat, { image: Buffer.from(res.data), caption: "✅ Berhasil membuat fake ovo" }, { quoted: m });
        await m.react("✅");
    } catch (e) {
        console.error("[FakeOvo Error]", e);
        await m.react("❌");
        m.reply(te(m.prefix, m.command, m.pushName));
    }
}

  return wrapPlugin(pluginConfig, handler)
})()

export default mergePlugins(
    'canvas',
    _fakecall,
    _fakedev7,
    _fakegopay,
    _fakeovo
)
