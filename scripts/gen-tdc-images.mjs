import ZAI from 'z-ai-web-dev-sdk';
import fs from 'fs';
import path from 'path';

const OUT = '/home/z/my-project/public/TDC-Intro/assets';

const jobs = [
  {
    name: 'founder-kianoush.png',
    size: '864x1152',
    prompt:
      'Professional studio headshot portrait of a confident Middle Eastern male dental technician in his early 30s, short dark hair, light stubble, wearing a clean charcoal-gray medical lab coat over a dark shirt, neutral dark smoky-gray studio background, soft cinematic side lighting with a subtle warm amber rim light, sharp focus, high-end corporate photography, looking calmly at camera, premium magazine quality'
  },
  {
    name: 'founder-soma.png',
    size: '864x1152',
    prompt:
      'Professional studio headshot portrait of a confident Middle Eastern female dental technician in her late 20s, dark hair styled professionally and tucked back, wearing a clean charcoal-gray medical lab coat, neutral dark smoky-gray studio background, soft cinematic side lighting with a subtle warm amber rim light, sharp focus, high-end corporate photography, looking calmly at camera, premium magazine quality'
  },
  {
    name: 'work-crown.png',
    size: '1024x1024',
    prompt:
      'Macro product photography of a single glossy white zirconia dental crown restoration floating on a dark charcoal-gray gradient background, dramatic studio lighting with a warm burnt-orange amber accent light, ultra detailed, reflective ceramic surface, professional dental lab showcase, high resolution, centered composition'
  },
  {
    name: 'work-bridge.png',
    size: '1024x1024',
    prompt:
      'Macro product photography of a three-unit glossy white zirconia dental bridge restoration floating on a dark charcoal-gray gradient background, dramatic studio lighting with a warm burnt-orange amber accent light, ultra detailed, reflective ceramic surface, professional dental lab showcase, high resolution, centered composition'
  },
  {
    name: 'work-implant.png',
    size: '1024x1024',
    prompt:
      'Macro product photography of a metallic titanium dental implant abutment topped with a white ceramic crown, floating on a dark charcoal-gray gradient background, dramatic studio lighting with a warm burnt-orange amber accent light, ultra detailed, brushed metal and glossy ceramic, professional dental lab showcase, high resolution, centered composition'
  },
  {
    name: 'work-veneer.png',
    size: '1024x1024',
    prompt:
      'Macro product photography of several ultra-thin translucent white ceramic dental veneers arranged in a fan, floating on a dark charcoal-gray gradient background, dramatic studio lighting with a warm burnt-orange amber accent light, ultra detailed, glossy translucent ceramic, professional dental lab showcase, high resolution, centered composition'
  }
];

async function run() {
  if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });
  const zai = await ZAI.create();
  for (const job of jobs) {
    const outPath = path.join(OUT, job.name);
    if (fs.existsSync(outPath)) {
      console.log(`SKIP (exists): ${job.name}`);
      continue;
    }
    try {
      console.log(`Generating: ${job.name} (${job.size})`);
      const res = await zai.images.generations.create({ prompt: job.prompt, size: job.size });
      const b64 = res.data[0].base64;
      fs.writeFileSync(outPath, Buffer.from(b64, 'base64'));
      console.log(`OK: ${job.name} (${fs.statSync(outPath).size} bytes)`);
    } catch (e) {
      console.error(`FAIL: ${job.name} -> ${e.message}`);
    }
  }
  console.log('ALL DONE');
}

run().catch((e) => { console.error(e); process.exit(1); });
