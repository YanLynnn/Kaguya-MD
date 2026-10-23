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


// ───────── effect ─────────
// Gabungan plugin canvas: wasted, wanted, jail, gura, topixel, sroast, balogo
// Port dari RIMURU-MD. Pesan keluar memakai sock.sendMessage / m.reply bawaan WhatsApp (tanpa tombol / kartu custom).

import axios from 'axios'
import sharp from 'sharp'
import { createCanvas, GlobalFonts } from '@napi-rs/canvas'
import { config, te, wrapPlugin, mergePlugins, uploadToTmpFilesOrg as uploadToTmpFiles, uploadToCatboxFile as uploadToCatbox } from '../../lib/plugin-engine.js'
// ── wasted ──
const _wasted = (() => {
const pluginConfig = {
    name: 'wasted',
    alias: [],
    category: 'maker',
    description: 'Efek wasted GTA pada foto',
    usage: '.wasted (reply foto)',
    example: '.wasted',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 5,
    energi: 1,
    isEnabled: true
}

async function handler(m, { sock }) {

    try {

        let buffer = null

        // reply image
        if (
            m.quoted &&
            (
                m.quoted.mimetype?.includes('image') ||
                m.quoted.type === 'imageMessage'
            )
        ) {

            buffer = await m.quoted.download()

        }

        // direct image
        else if (
            m.mimetype?.includes('image')
        ) {

            buffer = await m.download()
        }

        if (!buffer) {

            return await m.reply(
                `❌ Reply / kirim gambar\n\nContoh:\n${pluginConfig.example}`
            )
        }

        const uploaded =
            await uploadToTmpFiles(buffer)

        if (!uploaded) {

            return await m.reply(
                '❌ Upload gambar gagal'
            )
        }

        // FIX API
        const api =
            `https://some-random-api.com/canvas/wasted?avatar=${encodeURIComponent(uploaded)}`

        const response = await axios.get(api, {
            responseType: 'arraybuffer'
        })

        const image = Buffer.from(response.data)

        await sock.sendMessage(
            m.chat,
            {
                image,
                caption: '💀 *WASTED EFFECT*'
            },
            { quoted: m }
        )

    } catch (error) {

        console.error('Wasted Error:', error)

        await m.reply(
            `❌ *GAGAL*\n\n> ${error.message}`
        )
    }
}

  return wrapPlugin(pluginConfig, handler)
})()

// ── wanted ──
const _wanted = (() => {
const pluginConfig = {
    name: 'wanted',
    alias: [],
    category: 'maker',
    description: 'Efek poster wanted',
    usage: '.wanted (reply foto)',
    example: '.wanted',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 5,
    energi: 1,
    isEnabled: true
}

async function handler(m, { sock }) {

    try {

        let buffer = null

        // reply image
        if (
            m.quoted &&
            (
                m.quoted.mimetype?.includes('image') ||
                m.quoted.type === 'imageMessage'
            )
        ) {

            buffer = await m.quoted.download()

        }

        // direct image
        else if (
            m.mimetype?.includes('image')
        ) {

            buffer = await m.download()
        }

        if (!buffer) {

            return await m.reply(
                `❌ Reply / kirim gambar\n\nContoh:\n${pluginConfig.example}`
            )
        }

        const uploaded =
            await uploadToTmpFiles(buffer)

        if (!uploaded) {

            return await m.reply(
                '❌ Upload gambar gagal'
            )
        }

        // API Wanted
        const api =
            `https://api.popcat.xyz/wanted?image=${encodeURIComponent(uploaded)}`

        const response = await axios.get(api, {
            responseType: 'arraybuffer'
        })

        const image = Buffer.from(response.data)

        await sock.sendMessage(
            m.chat,
            {
                image,
                caption: '🤠 *WANTED POSTER*'
            },
            { quoted: m }
        )

    } catch (error) {

        console.error('Wanted Error:', error)

        await m.reply(
            `❌ *GAGAL*\n\n> ${error.message}`
        )
    }
}

  return wrapPlugin(pluginConfig, handler)
})()

// ── jail ──
const _jail = (() => {
const pluginConfig = {
    name: 'jail',
    alias: [],
    category: 'maker',
    description: 'Efek penjara pada foto',
    usage: '.jail (reply foto)',
    example: '.jail',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 5,
    energi: 1,
    isEnabled: true
}

async function handler(m, { sock }) {

    try {

        let buffer = null

        // reply image
        if (
            m.quoted &&
            (
                m.quoted.mimetype?.includes('image') ||
                m.quoted.type === 'imageMessage'
            )
        ) {

            buffer = await m.quoted.download()

        }

        // direct image
        else if (
            m.mimetype?.includes('image')
        ) {

            buffer = await m.download()
        }

        if (!buffer) {

            return await m.reply(
                `❌ Reply / kirim gambar\n\nContoh:\n${pluginConfig.example}`
            )
        }

        const uploaded =
            await uploadToTmpFiles(buffer)

        if (!uploaded) {

            return await m.reply(
                '❌ Upload gambar gagal'
            )
        }

        // API FIX
        const api =
            `https://api.popcat.xyz/jail?image=${encodeURIComponent(uploaded)}`

        const response = await axios.get(api, {
            responseType: 'arraybuffer'
        })

        const image = Buffer.from(response.data)

        await sock.sendMessage(
            m.chat,
            {
                image,
                caption: '🔒 *JAIL EFFECT*'
            },
            { quoted: m }
        )

    } catch (error) {

        console.error('Jail Error:', error)

        await m.reply(
            `❌ *GAGAL*\n\n> ${error.message}`
        )
    }
}

  return wrapPlugin(pluginConfig, handler)
})()

// ── gura ──
const _gura = (() => {
const pluginConfig = {
  name: "gura",
  alias: [],
  category: "canvas",
  description: "Bikin efek canvas gura dari fotomu",
  usage: ".gura (reply/kirim foto)",
  example: ".gura",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 5,
  energi: 1,
  isEnabled: true,
};

async function handler(m, { sock }) {
  let media = null;

  if (m.quoted?.message) {
    const type = m.quoted.mtype;
    if (!type || type !== "imageMessage") {
      return m.reply("⚠️ Kak, tolong reply ke pesan gambar ya!");
    }
    media = await m.quoted.download();
  } else if (m.message) {
    const type = m.mtype;
    if (!type || type !== "imageMessage") {
      return m.reply(`🦈 *GURA CANVAS*\n\nKirim atau reply foto dengan perintah \`${m.prefix}gura\` untuk memberikan efek Gura!`);
    }
    media = await m.download();
  }

  if (!media) return m.reply("❌ Gagal membaca media, coba lagi!");

  await m.react("🕕");

  try {
    const imgUrl = await uploadToCatbox(media);

    const apiUrl = `https://api.nexray.eu.cc/canvas/gura?url=${encodeURIComponent(imgUrl)}`;
    const res = await fetch(apiUrl);
    
    if (!res.ok) throw new Error("API Nexray error");
    
    const buffer = Buffer.from(await res.arrayBuffer());

    await sock.sendMessage(m.chat, { image: buffer, caption: "🦈 *RAWWRR! Gura is here!*" }, { quoted: m });
    await m.react("✅");

  } catch (err) {
    await m.react("☢");
    m.reply(te(m.prefix, m.command, m.pushName));
  }
}

  return wrapPlugin(pluginConfig, handler)
})()

// ── topixel ──
const _topixel = (() => {
const pluginConfig = {
  name: "topixel",
  alias: [],
  category: "canvas",
  description: "Ubah foto kamu jadi gambar pixel art yang keren",
  usage: ".topixel [level] (reply/kirim foto)",
  example: ".topixel 30",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 10,
  energi: 2,
  isEnabled: true,
};

function getBlock(level) {
  const value = Math.min(Math.max(Number(level) || 12, 1), 40);
  return 41 - value;
}

async function pixelArt(inputBuffer, level) {
  const image = sharp(inputBuffer, { limitInputPixels: false }).rotate().ensureAlpha();
  const meta = await image.metadata();

  const width = meta.width;
  const height = meta.height;
  const block = getBlock(level);

  const input = await image.raw().toBuffer();
  const output = Buffer.alloc(input.length);

  for (let y = 0; y < height; y += block) {
    for (let x = 0; x < width; x += block) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      let count = 0;

      const maxY = Math.min(y + block, height);
      const maxX = Math.min(x + block, width);

      for (let yy = y; yy < maxY; yy++) {
        for (let xx = x; xx < maxX; xx++) {
          const i = (yy * width + xx) * 4;
          r += input[i];
          g += input[i + 1];
          b += input[i + 2];
          a += input[i + 3];
          count++;
        }
      }

      r = Math.round(r / count);
      g = Math.round(g / count);
      b = Math.round(b / count);
      a = Math.round(a / count);

      for (let yy = y; yy < maxY; yy++) {
        for (let xx = x; xx < maxX; xx++) {
          const i = (yy * width + xx) * 4;
          output[i] = r;
          output[i + 1] = g;
          output[i + 2] = b;
          output[i + 3] = a;
        }
      }
    }
  }

  return await sharp(output, {
    raw: { width, height, channels: 4 }
  })
    .png({ compressionLevel: 9, adaptiveFiltering: false })
    .toBuffer();
}

async function handler(m, { sock }) {
  let media = null;
  const level = m.args[0] || "12";

  if (m.quoted?.message) {
    const type = m.quoted.mtype;
    if (!type || type !== "imageMessage") {
      return m.reply("⚠️ Kak, tolong reply ke pesan gambar ya!");
    }
    media = await m.quoted.download();
  } else if (m.message) {
    const type = m.mtype;
    if (!type || type !== "imageMessage") {
      return m.reply(`👾 *PIXEL ART MAKER*\n\nKirim atau reply foto dengan perintah \`${m.prefix}topixel [level]\` untuk mengubah fotomu menjadi gaya retro pixel art!\n\n_Catatan: Level opsional antara 1-40 (semakin besar semakin kotak-kotak)._`);
    }
    media = await m.download();
  }

  if (!media) return m.reply("❌ Gagal membaca media gambar, coba lagi!");

  await m.react("🕕");

  try {
    const pixelatedBuffer = await pixelArt(media, level);
    
    await sock.sendMessage(
      m.chat, 
      { 
        image: pixelatedBuffer, 
        caption: `👾 *PIXEL ART BERHASIL!*\n\nIni dia fotomu dalam gaya pixel art retro 8-bit. Keren kan? ✨` 
      }, 
      { quoted: m }
    );
    
    await m.react("✅");
  } catch (err) {
    await m.react("☢");
    m.reply(te(m.prefix, m.command, m.pushName));
  }
}

  return wrapPlugin(pluginConfig, handler)
})()

// ── sroast ──
const _sroast = (() => {
const pluginConfig = {
  name: "sroast",
  alias: [],
  category: "canvas",
  description: "Buat stiker roast",
  usage: ".sroast <teks1> | <teks2> | <teks3>",
  example: ".sroast kamu | JELEK | banget",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 5,
  energi: 2,
  isEnabled: true,
};

let isFontLoaded = false;
async function loadFont() {
    if (isFontLoaded) return;
    try {
        const fontBuffer = await axios.get("https://files.catbox.moe/8wqg77.ttf", { responseType: "arraybuffer" }).then(r => r.data);
        GlobalFonts.register(Buffer.from(fontBuffer), "ArialBoldSroast");
        isFontLoaded = true;
    } catch (e) {
    }
}

function wrapText(ctx, text, maxWidth) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (let i = 0; i < words.length; i++) {
    const testLine = line ? line + ' ' + words[i] : words[i];
    const { width } = ctx.measureText(testLine);
    if (width > maxWidth && line) {
      lines.push(line);
      line = words[i];
    } else {
      line = testLine;
    }
  }
  if (line) lines.push(line);
  return lines;
}

async function handler(m, { sock }) {
  await loadFont();
  const input = m.text?.trim();

  if (!input) {
    return m.reply(`⚠️ Harap masukkan teks!\nContoh: \`${m.prefix}${m.command} aku | JELEK | banget\``);
  }

  const parts = input.split('|').map(v => v.trim());
  const t1 = parts[0] || '-';
  const t2 = (parts[1] || '-').toUpperCase();
  const t3 = parts[2] || '-';

  await m.react("🕕");

  try {
    const width = 512;
    const height = 512;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    const marginXText = 70;
    const marginXTitle = 30;
    const maxWidthTop = width - marginXText * 2;
    const maxWidthTitle = width - marginXTitle * 2;
    const spacingAfterT1 = 14;
    const spacingAfterT2 = 18;

    const fontFace = isFontLoaded ? "ArialBoldSroast" : "sans-serif";

    ctx.font = `28px "${fontFace}"`;
    let lines1 = wrapText(ctx, t1, maxWidthTop);
    const heightT1 = lines1.length * 34;

    let fontSizeTitle = 60;
    ctx.font = `bold ${fontSizeTitle}px "${fontFace}"`;
    let lines2 = wrapText(ctx, t2, maxWidthTitle);
    const heightT2 = lines2.length * (fontSizeTitle + 6);

    ctx.font = `28px "${fontFace}"`;
    let lines3 = wrapText(ctx, t3, maxWidthTop);
    const heightT3 = lines3.length * 34;

    const totalHeight = heightT1 + spacingAfterT1 + heightT2 + spacingAfterT2 + heightT3;
    let y = (height - totalHeight) / 2;

    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#1E90FF';

    ctx.font = `28px "${fontFace}"`;
    for (const line of lines1) { ctx.fillText(line, marginXText, y); y += 34; }
    y += spacingAfterT1;

    ctx.font = `bold ${fontSizeTitle}px "${fontFace}"`;
    for (const line of lines2) { ctx.fillText(line, marginXTitle, y); y += fontSizeTitle + 6; }
    y += spacingAfterT2;

    ctx.font = `28px "${fontFace}"`;
    for (const line of lines3) { ctx.fillText(line, marginXText, y); y += 34; }

    const buffer = await canvas.encode("png");
    
    await sock.sendImageAsSticker(m.chat, buffer, m, {
        packname: config.sticker.packname,
        author: config.sticker.author
    });

    await m.react("✅");
  } catch (error) {
    await m.react("☢");
    m.reply(te(m.prefix, m.command, m.pushName));
  }
}

  return wrapPlugin(pluginConfig, handler)
})()

// ── balogo ──
const _balogo = (() => {
const pluginConfig = {
    name: 'balogo',
    alias: [],
    category: 'canvas',
    description: 'Membuat logo Blue Archive style',
    usage: '.balogo <textL> & <textR>',
    example: '.balogo Blue & Archive',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 10,
    energi: 1,
    isEnabled: true
}

async function handler(m, { sock }) {
    const input = m.text?.trim() || ''
    const parts = input.split(/[&,]/).map(s => s.trim()).filter(s => s)

    if (parts.length < 2) {
        return m.reply(`🎮 *ʙʟᴜᴇ ᴀʀᴄʜɪᴠᴇ ʟᴏɢᴏ*\n\n> Masukkan 2 teks untuk logo\n\n> Contoh: ${m.prefix}balogo Blue & Archive`)
    }

    const textL = parts[0]
    const textR = parts[1]

    m.react('🕕')

    try {

        await sock.sendMessage(m.chat, { image: { url: `https://api.nexray.web.id/maker/balogo?text=${encodeURIComponent(textL)} ${encodeURIComponent(textR)}` } }, { quoted: m })

        m.react('✅')

    } catch (error) {
        m.react('☢')
        m.reply(te(m.prefix, m.command, m.pushName))
    }
}

  return wrapPlugin(pluginConfig, handler)
})()

export default mergePlugins(
    'canvas',
    _wasted,
    _wanted,
    _jail,
    _gura,
    _topixel,
    _sroast,
    _balogo
)
