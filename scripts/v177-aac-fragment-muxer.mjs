// Offline transport prototype only: not connected to the game or an iPhone.
// Pure typed arrays keep this candidate usable by a future hosted WebCodecs test.
const rates=[96000,88200,64000,48000,44100,32000,24000,22050,16000,12000,11025,8000,7350];
const check=(ok,message)=>{if(!ok)throw new Error(message);};
const bytes=value=>value instanceof Uint8Array?Uint8Array.from(value):new Uint8Array(value);
const join=(...parts)=>{const out=new Uint8Array(parts.reduce((n,p)=>n+p.length,0));let at=0;for(const p of parts){out.set(p,at);at+=p.length;}return out;};
const zero=n=>new Uint8Array(n),ascii=s=>Uint8Array.from(s,c=>c.charCodeAt(0));
function integer(n,max){check(Number.isSafeInteger(n)&&n>=0&&n<=max,'Invalid integer field');return n;}
const u8=n=>Uint8Array.of(integer(n,255));
const u16=n=>{const b=zero(2);new DataView(b.buffer).setUint16(0,integer(n,65535));return b;};
const u24=n=>{integer(n,16777215);return Uint8Array.of(n>>>16,(n>>>8)&255,n&255);};
const u32=n=>{const b=zero(4);new DataView(b.buffer).setUint32(0,integer(n,4294967295));return b;};
const u64=n=>{const b=zero(8),value=BigInt(n);check(value>=0n&&value<=0xffffffffffffffffn,'Invalid sample clock');new DataView(b.buffer).setBigUint64(0,value);return b;};
const box=(type,...parts)=>{check(type.length===4,'Invalid box type');const p=join(...parts);return join(u32(p.length+8),ascii(type),p);};
const full=(type,version,flags,...parts)=>box(type,u8(version),u24(flags),...parts);
function descriptor(tag,payload) {
 let size=payload.length,encoded=[size&127];while((size=Math.floor(size/128))>0)encoded.unshift((size&127)|128);
 check(encoded.length<=4,'Descriptor too large');return join(u8(tag),Uint8Array.from(encoded),payload);
}
function readDescriptor(data,at,end) {
 check(at<end,'Missing descriptor');const tag=data[at++];let length=0,count=0,part;
 do{check(at<end&&count++<4,'Truncated descriptor length');part=data[at++];length=length*128+(part&127);}while(part&128);
 check(at+length<=end,'Truncated descriptor payload');return {tag,start:at,end:at+length,next:at+length};
}

export function normalizeAacDescription(description,{sampleRate,numberOfChannels,codec='mp4a.40.2'}) {
 check(codec==='mp4a.40.2'||codec==='mp4a.40.02','Only AAC LC is supported by this prototype');
 let data=bytes(description),asc,kind='raw-ASC';
 if(data.length===2)asc=data;
 else{
  if(data.length>=12&&String.fromCharCode(...data.slice(4,8))==='esds'){
   check(new DataView(data.buffer,data.byteOffset,data.byteLength).getUint32(0)===data.length,'Invalid esds box size');
   check(data.slice(8,12).every(b=>b===0),'Unsupported esds version/flags');data=data.slice(12);
  }else if(data.length>=5&&data.slice(0,4).every(b=>b===0))data=data.slice(4);
  const root=readDescriptor(data,0,data.length);check(root.tag===3&&root.next===data.length&&root.end-root.start>=3,'Expected one ES descriptor');
  check(data[root.start+2]===0,'Unsupported ES descriptor flags');
  let at=root.start+3,configs=0,found=[];
  while(at<root.end){
   const item=readDescriptor(data,at,root.end);at=item.next;
   if(item.tag===4){
    configs++;check(item.end-item.start>=13&&data[item.start]===64,'Invalid MPEG4 audio decoder configuration');
    check((data[item.start+1]>>2)===5,'Decoder configuration is not audio');
    let childAt=item.start+13;
    while(childAt<item.end){const child=readDescriptor(data,childAt,item.end);childAt=child.next;check(child.tag===5,'Unexpected decoder descriptor');found.push(data.slice(child.start,child.end));}
   }else check(item.tag===6,'Unexpected ES descriptor');
  }
  check(configs===1&&found.length===1,'Expected exactly one AudioSpecificConfig');asc=found[0];kind='ESDS-contained-ASC';
 }
 check(asc.length===2,'Only two-byte AAC LC configurations are supported');
 const bits=asc[0]*256+asc[1],objectType=bits>>11,index=(bits>>7)&15,channels=(bits>>3)&15;
 check(objectType===2&&index<rates.length&&[1,2].includes(channels)&&(bits&7)===0,'Unsupported AAC LC frame configuration');
 check(rates[index]===sampleRate&&channels===numberOfChannels,'Declared audio parameters disagree with encoded configuration');
 return {asc:Uint8Array.from(asc),sampleRate,numberOfChannels,kind};
}

function initialization(config) {
 const {asc,sampleRate,numberOfChannels}=config;
 check(sampleRate<65536,'Audio sample entry needs an extended rate representation');
 const matrix=join(...[65536,0,0,0,65536,0,0,0,1073741824].map(u32));
 const mvhd=full('mvhd',0,0,u32(0),u32(0),u32(sampleRate),u32(0),u32(65536),u16(256),zero(10),matrix,zero(24),u32(2));
 const tkhd=full('tkhd',0,7,u32(0),u32(0),u32(1),u32(0),u32(0),zero(8),u16(0),u16(0),u16(256),u16(0),matrix,u32(0),u32(0));
 const mdhd=full('mdhd',0,0,u32(0),u32(0),u32(sampleRate),u32(0),u16(21956),u16(0));
 const hdlr=full('hdlr',0,0,u32(0),ascii('soun'),zero(12),ascii('Game mix\0'));
 const dref=full('dref',0,0,u32(1),full('url ',0,1));
 const decoderConfig=descriptor(4,join(u8(64),u8(21),u24(0),u32(192000),u32(192000),descriptor(5,asc)));
 const esds=full('esds',0,0,descriptor(3,join(u16(1),u8(0),decoderConfig,descriptor(6,u8(2)))));
 const entry=box('mp4a',zero(6),u16(1),zero(8),u16(numberOfChannels),u16(16),u16(0),u16(0),u32(sampleRate*65536),esds);
 const stbl=box('stbl',full('stsd',0,0,u32(1),entry),full('stts',0,0,u32(0)),full('stsc',0,0,u32(0)),full('stsz',0,0,u32(0),u32(0)),full('stco',0,0,u32(0)));
 const minf=box('minf',full('smhd',0,0,u16(0),u16(0)),box('dinf',dref),stbl);
 const trak=box('trak',tkhd,box('mdia',mdhd,hdlr,minf));
 const mvex=box('mvex',full('trex',0,0,u32(1),u32(1),u32(1024),u32(0),u32(33554432)));
 return join(box('ftyp',ascii('iso6'),u32(0),ascii('iso6isommp41')),box('moov',mvhd,trak,mvex));
}

export class AacFragmentMuxer {
 #sequence=1;
 #nextSample=0;
 #init;
 constructor(description,parameters){this.configuration=normalizeAacDescription(description,parameters);this.#init=initialization(this.configuration);}
 get initializationSegment(){return this.#init.slice();}
 snapshot(){return{nextSample:this.#nextSample,nextSequence:this.#sequence,sampleRate:this.configuration.sampleRate,channels:this.configuration.numberOfChannels};}
 segment(packets) {
  check(Array.isArray(packets)&&packets.length>0,'No encoded packets');
  let next=this.#nextSample;
  const data=packets.map(packet=>{
   check(packet.timestampSamples===next&&Number.isSafeInteger(next),'Missing, duplicate or reordered AAC packet clock');
   check(packet.durationSamples===1024,'Unsupported AAC frame duration');
   const payload=bytes(packet.data);check(payload.length>0,'Empty AAC packet');next+=1024;return payload;
  });
  const run=offset=>full('trun',0,769,u32(packets.length),u32(offset),...data.flatMap(p=>[u32(1024),u32(p.length)]));
  const movie=offset=>box('moof',full('mfhd',0,0,u32(this.#sequence)),box('traf',full('tfhd',0,131072,u32(1)),full('tfdt',1,0,u64(this.#nextSample)),run(offset)));
  const first=movie(0),moof=movie(first.length+8),result=join(moof,box('mdat',...data));
  this.#sequence++;this.#nextSample=next;return result;
 }
}

export function splitAdtsAac(input) {
 const data=bytes(input),packets=[];let at=0,configuration=null;
 while(at<data.length){
  check(at+7<=data.length&&data[at]===255&&(data[at+1]&246)===240,'Invalid ADTS header');
  const header=data[at+1]&1?7:9,profile=(data[at+2]>>6)+1,index=(data[at+2]>>2)&15,channels=((data[at+2]&1)<<2)|(data[at+3]>>6);
  const length=((data[at+3]&3)<<11)|(data[at+4]<<3)|(data[at+5]>>5);
  check(profile===2&&index<rates.length&&[1,2].includes(channels)&&(data[at+6]&3)===0,'Unsupported ADTS frame');
  check(length>header&&at+length<=data.length,'Truncated ADTS frame');
  const bits=(profile<<11)|(index<<7)|(channels<<3),current={description:Uint8Array.of(bits>>8,bits&255),sampleRate:rates[index],numberOfChannels:channels};
  if(configuration)check(configuration.sampleRate===current.sampleRate&&configuration.numberOfChannels===channels,'ADTS configuration changed');
  else configuration=current;
  packets.push({data:data.slice(at+header,at+length),durationSamples:1024,timestampSamples:packets.length*1024});
  at+=length;
 }
 check(packets.length>0,'No ADTS packets');return{configuration,packets};
}
