/* A small, dependency-free viewer. Pages keep the original PDF artwork. */
(() => {
  const total=12, reader=document.querySelector('.reader'), book=document.querySelector('.book');
  const left=book.querySelector('.base.left'), right=book.querySelector('.base.right');
  const turner=book.querySelector('.turner'), front=turner.querySelector('.front'), back=turner.querySelector('.back');
  const previous=document.querySelector('.previous'), next=document.querySelector('.next');
  const count=document.querySelector('.page-count'), tooltip=document.querySelector('#tooltip');
  const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
  let single=false, index=1, busy=false, auto, animation, finger, suppressClickUntil=0;

  function page(number, interactive=true){
    if(number<1||number>total)return null;
    const el=document.createElement('div');el.className='page';el.dataset.page=number;
    const img=document.createElement('img');img.src=`pages/${String(number).padStart(2,'0')}.webp`;
    img.alt=`Catalogue 2026 — page ${number}`;img.draggable=false;el.append(img);
    if(interactive)for(const item of (window.CATALOG_HOTSPOTS[number]||[])){
      const a=document.createElement('a');a.className='hotspot';a.href=item.url;a.target='_blank';a.rel='noopener noreferrer';
      a.setAttribute('aria-label',`See details: ${item.name}`);a.dataset.ean=item.ean;
      const [x,y,w,h]=item.rect;a.style.cssText=`left:${x}%;top:${y}%;width:${w}%;height:${h}%`;
      if(item.clip)a.style.clipPath=item.clip;
      a.addEventListener('pointerenter',e=>showTip(a,e));a.addEventListener('pointermove',placeTip);
      a.addEventListener('pointerleave',hideTip);a.addEventListener('focus',()=>showTip(a));a.addEventListener('blur',hideTip);
      a.addEventListener('click',e=>{clearTimeout(auto);if(Date.now()<suppressClickUntil)e.preventDefault();hideTip();});
      el.append(a);
    }
    return el;
  }
  function setPage(container,number,interactive=true){const el=page(number,interactive);container.replaceChildren(...(el?[el]:[]));}
  function visible(at=index){return single?[0,at]:at===1?[0,1]:[at,at+1];}
  function render(){
    const [l,r]=visible();setPage(left,l);setPage(right,r);
    book.classList.toggle('cover',index===1);previous.disabled=index===1;next.disabled=index>=total;
    count.textContent=single||index===1||index===total?`${index} / ${total}`:`${index}–${index+1} / ${total}`;
    // Warm only the next pages, without any remote services or libraries.
    for(const n of [index+1,index+2,index+3])if(n<=total){const img=new Image();img.src=`pages/${String(n).padStart(2,'0')}.webp`;}
  }
  function destination(dir){return single?Math.max(1,Math.min(total,index+dir)):dir>0?(index===1?2:Math.min(total,index+2)):(index===2?1:Math.max(1,index-2));}
  async function turn(dir){
    clearTimeout(auto);hideTip();const target=destination(dir);if(busy||target===index)return;
    busy=true;book.classList.remove('cover');previous.disabled=next.disabled=true;
    const before=visible(),after=visible(target);
    const incoming=single?target:dir>0?after[0]:after[1];
    const outgoing=single?index:dir>0?before[1]:before[0];
    // Decode both surfaces before starting the turn, so the reverse is never blank.
    await Promise.all([incoming,outgoing].map(n=>{if(n<1||n>total)return;const im=new Image();im.src=`pages/${String(n).padStart(2,'0')}.webp`;return im.decode?im.decode().catch(()=>{}):Promise.resolve();}));
    if(single){
      // Layer complete pages: one settles back while the other glides over it.
      const track=document.createElement('div');track.className='mobile-slide';track.setAttribute('aria-hidden','true');
      const currentPage=page(outgoing,false),nextPage=page(incoming,false);
      const settle=[{transform:'translate3d(0,0,0) scale(1)',opacity:1},{transform:'translate3d(0,4%,0) scale(.95)',opacity:.78}];
      const arrive=[{transform:'translate3d(103%,-2%,0) scale(1.01)',opacity:1},{transform:'translate3d(0,0,0) scale(1)',opacity:1}];
      const currentFrames=dir>0?settle:[...arrive].reverse(),nextFrames=dir>0?arrive:[...settle].reverse();
      currentPage.style.zIndex=dir>0?'1':'2';nextPage.style.zIndex=dir>0?'2':'1';
      Object.assign(currentPage.style,currentFrames[0]);Object.assign(nextPage.style,nextFrames[0]);
      track.append(currentPage,nextPage);book.append(track);book.classList.add('sliding');
      if(typeof track.animate==='function'&&!reduce){
        const timing={duration:460,easing:'cubic-bezier(.22,.61,.36,1)',fill:'forwards'};
        const motions=[currentPage.animate(currentFrames,timing),nextPage.animate(nextFrames,timing)];
        animation={finished:Promise.all(motions.map(m=>m.finished)),finish(){motions.forEach(m=>m.finish());},cancel(){motions.forEach(m=>m.cancel());}};
        await animation.finished.catch(()=>{});
      }
      // Replace the static page before removing the moving track, in one frame.
      index=target;render();track.remove();book.classList.remove('sliding');
      if(animation){animation.cancel();animation=null;}busy=false;resize();return;
    }
    let from,to;
    if(dir>0){setPage(front,outgoing,false);setPage(back,incoming,false);setPage(right,after[1]);from=0;to=-180;}
    else{setPage(front,incoming,false);setPage(back,outgoing,false);setPage(left,after[0]);from=-180;to=0;}
    turner.style.transform=`rotateY(${from}deg)`;turner.classList.add('active');
    if(typeof turner.animate==='function'&&!reduce){
      animation=turner.animate([{transform:`rotateY(${from}deg)`},{transform:`rotateY(${to}deg)`}],{duration:1050,easing:'cubic-bezier(.32,.02,.2,1)',fill:'forwards'});
      await animation.finished.catch(()=>{});
    }
    index=target;render();turner.classList.remove('active');if(animation){animation.cancel();animation=null;}front.replaceChildren();back.replaceChildren();busy=false;resize();
  }
  function resize(){
    if(busy){if(animation)animation.finish();return;}
    const newSingle=innerWidth<760;
    if(newSingle!==single){single=newSingle;if(!single&&index>1)index-=index%2;reader.classList.toggle('single',single);}
    const availableW=innerWidth-(single?24:168),availableH=innerHeight-24;
    const w=Math.min(availableW/(single?1:2),availableH*595.2756/841.8898);
    book.style.setProperty('--book-w',`${Math.max(100,w)*(single?1:2)}px`);book.style.setProperty('--page-h',`${Math.max(100,w)*841.8898/595.2756}px`);render();
    reader.style.setProperty('--arrow-x',`${single?4:Math.max(18,(innerWidth-w*2)/4-24)}px`);
  }
  function hideTip(){tooltip.hidden=true;}
  function placeTip(e){if(tooltip.hidden)return;const x=e.clientX??0,y=e.clientY??0;tooltip.style.left=`${Math.max(8,Math.min(innerWidth-tooltip.offsetWidth-8,x+14))}px`;tooltip.style.top=`${Math.max(8,Math.min(innerHeight-tooltip.offsetHeight-8,y+18))}px`;}
  function showTip(a,e){if(busy||e?.pointerType==='touch')return;tooltip.hidden=false;if(e)placeTip(e);else{const r=a.getBoundingClientRect();placeTip({clientX:r.left+r.width/2,clientY:r.top});}}
  previous.addEventListener('click',()=>turn(-1));next.addEventListener('click',()=>turn(1));
  addEventListener('keydown',e=>{if(e.altKey||e.ctrlKey||e.metaKey)return;if(e.key==='ArrowRight'){e.preventDefault();turn(1);}if(e.key==='ArrowLeft'){e.preventDefault();turn(-1);}if(e.key==='Escape')hideTip();});
  book.addEventListener('pointerdown',e=>{if(e.isPrimary!==false){clearTimeout(auto);finger={x:e.clientX,y:e.clientY};}});
  book.addEventListener('pointerup',e=>{if(!finger)return;const dx=e.clientX-finger.x,dy=e.clientY-finger.y;finger=null;if(Math.abs(dx)>48&&Math.abs(dx)>Math.abs(dy)*1.4){suppressClickUntil=Date.now()+450;turn(dx<0?1:-1);}});
  book.addEventListener('pointercancel',()=>finger=null);
  addEventListener('resize',resize);resize();
  // The cover rests on the right, then opens to the first interior spread.
  const cover=new Image();cover.src='pages/01.webp';
  Promise.resolve(cover.decode?cover.decode().catch(()=>{}):null).then(()=>{auto=setTimeout(()=>{if(index===1&&!busy)turn(1);},2400);});
})();
