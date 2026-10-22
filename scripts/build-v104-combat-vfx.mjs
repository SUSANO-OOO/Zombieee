import fs from'node:fs/promises';import sharp from'sharp';import{createHash}from'node:crypto';
const root='assets/source/v104/combat-vfx',out='public/art/v104/combat-vfx';await fs.mkdir(out,{recursive:true});
const records=[];for(const id of['steel','organic','eye']){
 const input=`${root}/${id}-r1.png`,file=`${out}/${id}-r1.webp`,source=await fs.readFile(input);
 await sharp(source).resize({width:id==='eye'?1024:512,withoutEnlargement:true}).webp({quality:92,alphaQuality:100}).toFile(file);
 const bytes=await fs.readFile(file),metadata=await sharp(bytes).metadata();if(!metadata.hasAlpha)throw Error('VFX alpha was lost');
 records.push({id,input,sourceSha256:createHash('sha256').update(source).digest('hex'),file,sha256:createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length,width:metadata.width,height:metadata.height});
}
await fs.writeFile(root+'/provenance.json',JSON.stringify({method:'Built-in image generation; resizing/encoding only; original generated PNG alpha retained',prompts:JSON.parse(await fs.readFile(root+'/prompts.json','utf8')),records},null,2)+'\n');console.log(records.map(r=>({id:r.id,bytes:r.bytes})));
