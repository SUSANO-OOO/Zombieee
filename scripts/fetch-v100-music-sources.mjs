import { access, writeFile } from 'node:fs/promises';
const sources = {
  Intervention: '2019/01/sb_intervention_nomelody.mp3',
  TheOldOnes: '2018/10/sb_theoldones.mp3',
  AKindOfHope: '2022/10/AKindOfHope.mp3',
  Artemis: '2022/09/Artemis.mp3',
  TheRestoration: '2019/07/sb_monomyth_12_therestoration.mp3',
  TheLongDark: '2023/01/TheLongDark.mp3',
};
for (const [name, path] of Object.entries(sources)) {
  const file = 'assets/source/v100/audio/scott-buckley/' + name + '.mp3';
  if (await access(file).then(() => true, () => false)) { console.log(name + ': retained'); continue; }
  const response = await fetch('https://www.scottbuckley.com.au/library/wp-content/uploads/' + path);
  if (!response.ok) throw new Error(name + ': HTTP ' + response.status);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length < 100000 || !/audio|octet-stream/.test(response.headers.get('content-type') ?? '')) throw new Error('Unexpected source: ' + name);
  await writeFile(file, bytes, { flag: 'wx' });
  console.log(name + ': ' + bytes.length);
}
