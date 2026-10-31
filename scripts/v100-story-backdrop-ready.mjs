// The foreground image is the scene. Legacy art also has a blurred decorative
// copy; model-based panoramas deliberately omit that copy to avoid ghost faces.
// This function is serialized into the browser, so it has no module closures.
export function isV100StoryBackdropReady({selector,background}) {
 const backdrop=document.querySelector(selector)?.querySelector('.v100-event-backdrop');
 const image=backdrop?.querySelector('.v100-event-image:not(.v100-event-image-previous)');
 if(!image?.complete||image.naturalWidth<=0||image.naturalHeight<=0)return false;
 if(!new URL(image.currentSrc||image.src,document.baseURI).pathname.endsWith(background))return false;
 const style=getComputedStyle(image),rect=image.getBoundingClientRect();
 if(style.display==='none'||style.visibility==='hidden'||Number(style.opacity)!==1||rect.width<=0||rect.height<=0)return false;
 const decoration=getComputedStyle(backdrop).backgroundImage;
 return background.includes('/quality-20261028/scenes/')
  ?decoration==='none'&&style.objectFit==='contain'
  :decoration.includes(background);
}
